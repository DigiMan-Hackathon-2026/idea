#!/usr/bin/env node
// Lifecycle helper for the verify-prototype skill.
// Usage (from the repo root):
//   node .claude/skills/verify-prototype/scripts/verify.mjs launch [--prod] [--port 3100]
//   node .claude/skills/verify-prototype/scripts/verify.mjs doctor
//   node .claude/skills/verify-prototype/scripts/verify.mjs cleanup
import { spawn, spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const RUN_DIR = path.join(ROOT, ".verify", "run");
const EVIDENCE_DIR = path.join(ROOT, ".verify", "evidence");
const STATE_FILE = path.join(RUN_DIR, "state.json");
const LOG_FILE = path.join(RUN_DIR, "server.log");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const IS_WIN = process.platform === "win32";
const READY_TIMEOUT_MS = 180_000;
const DEV_LOCK_MESSAGE = "Another next dev server is already running";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readState = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : null);
const readLog = () => (fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, "utf8") : "");
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function httpStatus(url) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    return res.status;
  } catch {
    return 0;
  }
}

function listenerPids(port) {
  if (IS_WIN) {
    const out = execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" });
    return [...new Set(out.split(/\r?\n/)
      .map((l) => l.trim().split(/\s+/))
      .filter((c) => c[3] === "LISTENING" && c[1]?.endsWith(`:${port}`))
      .map((c) => Number(c[4])))];
  }
  const r = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" });
  return [...new Set(r.stdout.split(/\s+/).filter(Boolean).map(Number))];
}

function processTree(rootPid) {
  const rows = IS_WIN
    ? JSON.parse(execFileSync("powershell", ["-NoProfile", "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress"],
        { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })).map((p) => [p.ProcessId, p.ParentProcessId])
    : execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" })
        .trim().split("\n").map((l) => l.trim().split(/\s+/).map(Number));
  const tree = new Set([rootPid]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [pid, ppid] of rows) if (tree.has(ppid) && !tree.has(pid)) { tree.add(pid); grew = true; }
  }
  return tree;
}

function killTree(pid) {
  if (!isAlive(pid)) return;
  if (IS_WIN) spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else try { process.kill(-pid, "SIGTERM"); } catch { /* group already gone */ }
}

function startServer(args) {
  const log = fs.openSync(LOG_FILE, "a");
  const child = spawn(process.execPath, [NEXT_BIN, ...args], {
    cwd: ROOT, detached: true, windowsHide: true, stdio: ["ignore", log, log],
  });
  child.unref();
  return child.pid;
}

// Resolves "ready" once GET / answers 200 after redirects, "locked" if Next refuses a second dev server.
async function waitReady(pid, port, mode) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (mode === "dev" && readLog().includes(DEV_LOCK_MESSAGE)) return "locked";
    if (!isAlive(pid)) return "exited";
    if ((await httpStatus(`http://localhost:${port}/`)) === 200) return "ready";
    await sleep(1000);
  }
  return "timeout";
}

async function launch(argv) {
  const portIdx = argv.indexOf("--port");
  const port = portIdx >= 0 ? Number(argv[portIdx + 1]) : 3100;
  let mode = argv.includes("--prod") ? "prod" : "dev";
  const prev = readState();
  if (prev && isAlive(prev.pid)) fail(`an instance from this skill is already running (pid ${prev.pid}, port ${prev.port}). Run doctor or cleanup.`);
  if (listenerPids(port).length) fail(`port ${port} is already in use by a process this skill did not start. Pick another --port; never drive someone else's server.`);

  fs.rmSync(RUN_DIR, { recursive: true, force: true });
  fs.mkdirSync(RUN_DIR, { recursive: true });

  let pid;
  let result;
  if (mode === "dev") {
    pid = startServer(["dev", "-p", String(port)]);
    result = await waitReady(pid, port, "dev");
    if (result === "locked") {
      console.log("NOTE: the user's own `next dev` holds this folder's dev lock. Falling back to --prod (build + start).");
      killTree(pid);
      mode = "prod";
    }
  }
  if (mode === "prod") {
    const log = fs.openSync(LOG_FILE, "a");
    const build = spawnSync(process.execPath, [NEXT_BIN, "build"], { cwd: ROOT, stdio: ["ignore", log, log], windowsHide: true });
    if (build.status !== 0) fail(`next build failed (exit ${build.status}). See ${LOG_FILE}`);
    pid = startServer(["start", "-p", String(port)]);
    result = await waitReady(pid, port, "prod");
  }

  const state = { pid, port, mode, url: `http://localhost:${port}`, startedAt: new Date().toISOString() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  if (result !== "ready") {
    console.error(readLog().split("\n").slice(-20).join("\n"));
    fail(`server not ready (${result}). Run cleanup before retrying.`);
  }
  console.log(`READY ${state.url} mode=${mode} pid=${pid} log=${path.relative(ROOT, LOG_FILE)}`);
}

async function doctor() {
  const state = readState();
  if (!state) fail("no instance launched by this skill (.verify/run/state.json missing). Run launch.");
  const nextVersion = JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", "next", "package.json"), "utf8")).version;
  const checks = [];
  const alive = isAlive(state.pid);
  checks.push([`root process ${state.pid} alive`, alive]);
  const listeners = listenerPids(state.port);
  const tree = alive ? processTree(state.pid) : new Set();
  checks.push([`port ${state.port} owned by our process tree (listeners: ${listeners.join(",") || "none"})`,
    listeners.length > 0 && listeners.every((p) => tree.has(p))]);
  const status = await httpStatus(`${state.url}/`);
  checks.push([`GET ${state.url}/ -> ${status}`, status === 200]);
  for (const [label, ok] of checks) console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  console.log(`mode=${state.mode} next=${nextVersion} startedAt=${state.startedAt}`);
  if (!checks.every(([, ok]) => ok)) {
    console.log("--- last server log lines ---\n" + readLog().split("\n").slice(-15).join("\n"));
    process.exit(1);
  }
  console.log("HEALTHY");
}

async function cleanup() {
  const state = readState();
  if (state) {
    killTree(state.pid);
    for (let i = 0; i < 20 && listenerPids(state.port).length; i++) await sleep(500);
    if (listenerPids(state.port).length) fail(`port ${state.port} still listening after killing pid ${state.pid}. Inspect manually; do not kill by name.`);
    console.log(`stopped pid ${state.pid}, port ${state.port} free`);
  } else {
    console.log("no instance recorded; nothing to stop");
  }
  fs.rmSync(RUN_DIR, { recursive: true, force: true });
  console.log(`evidence kept in ${path.relative(ROOT, EVIDENCE_DIR)}`);
}

const [cmd, ...rest] = process.argv.slice(2);
const commands = { launch: () => launch(rest), doctor, cleanup };
if (!commands[cmd]) fail("usage: verify.mjs <launch [--prod] [--port N] | doctor | cleanup>");
await commands[cmd]();
