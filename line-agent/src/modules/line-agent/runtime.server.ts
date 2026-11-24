import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import { getTmapWalkingRoute } from "../routing/tmap-walking.server";
import { DiningAgent } from "./agent";
import { readLineAgentConfig, type LineAgentConfig } from "./config";
import { LineMessagingClient, RecordingLineGateway, type LineGateway } from "./line/client";
import { getRuntimeDatabasePool } from "../../db/runtime.server";
import { PostgresAgentStore } from "./postgres-store";
import { naverPlaceSearch } from "./naver-search";
import { fetchLineImage, readImageText } from "./ocr.server";
import { MemoryAgentStore, type AgentStore } from "./store";
import { SimulatedCallPlacer, TwilioCallPlacer, type CallFinished, type CallPlacer } from "./telephony";
import { RoutedTravelProvider } from "./travel";

export const SIMULATOR_PREFIX = "sim-";

export type SimulatorCall = { replyTarget: string; attemptId: string; restaurantId: string; transcript: { speaker: "ai" | "shop"; text: string }[]; outcome: string; at: string };

export type LineAgentRuntime = {
  config: LineAgentConfig;
  store: AgentStore;
  /** Agent wired to the real LINE channel (records messages if no token is set). */
  agent: DiningAgent;
  /** Agent for the local chat simulator; never sends to LINE. */
  simulator: DiningAgent;
  simulatorLine: RecordingLineGateway;
  /** Images uploaded in the simulator, read once by id and then dropped. */
  simulatorImages: Map<string, Buffer>;
  /** Finished simulator calls with transcripts, newest last (memory only). */
  simulatorCalls: SimulatorCall[];
  /** Routes a call result to the agent that owns the conversation. */
  finishCall(result: CallFinished): Promise<void>;
  attemptToken(attemptId: string): string;
};

const globalKey = Symbol.for("line-korea-agent.runtime");

function log(event: string, data: Record<string, string | number | boolean | null>): void {
  console.info(JSON.stringify({ at: new Date().toISOString(), event, ...data }));
}

export function getLineAgentRuntime(): LineAgentRuntime {
  const holder = globalThis as unknown as Record<symbol, LineAgentRuntime | undefined>;
  holder[globalKey] ??= createRuntime();
  return holder[globalKey]!;
}

function createRuntime(): LineAgentRuntime {
  const config = readLineAgentConfig(process.env);
  const startedAt = Date.now();
  const offset = config.demoNow ? Date.parse(config.demoNow) - startedAt : 0;
  const clock = () => new Date(Date.now() + offset).toISOString();
  const keyOf = (raw: string) => createHmac("sha256", config.keySecret).update(`line:${raw}`).digest("base64url").slice(0, 32);
  const attemptToken = (attemptId: string) => createHmac("sha256", config.bridge?.secret ?? config.keySecret).update(`attempt:${attemptId}`).digest("base64url");
  const store: AgentStore = config.store === "postgres" ? new PostgresAgentStore(getRuntimeDatabasePool(), { pool: true }) : new MemoryAgentStore();
  if (store instanceof PostgresAgentStore) {
    // Retention (spec §9): drop expired requests, events and aliases hourly.
    const purge = () => void store.purgeExpired(clock()).catch(() => log("line_agent.purge_failed", {}));
    purge();
    setInterval(purge, 60 * 60 * 1000).unref();
  }
  const travel = new RoutedTravelProvider(async (from, to) =>
    getTmapWalkingRoute({
      start: { latitude: from.lat, longitude: from.lng, name: "출발" },
      destination: { latitude: to.lat, longitude: to.lng, name: "도착" },
    }),
  );
  const phoneAllowed = (ref: string) => config.calls === "simulator" ? ref.startsWith("demo-") : ref in config.phoneAllowlist;

  const self: { runtime?: LineAgentRuntime } = {};
  const finishCall = async (result: CallFinished) => {
    const request = await store.findByAttempt(result.attemptId);
    if (!request) return;
    const owner = request.replyTarget.startsWith(SIMULATOR_PREFIX) ? self.runtime!.simulator : self.runtime!.agent;
    await owner.handleCallFinished(result);
  };

  const placer = (): CallPlacer | null => {
    if (config.calls === "simulator") return new SimulatedCallPlacer(finishCall, config.simulatedCallDelayMs);
    if (config.calls === "twilio" && config.twilio && config.bridge) {
      const statusUrl = (attemptId: string) => `${config.origin}/api/v1/integrations/voice/attempts/${attemptId}/status?t=${attemptToken(attemptId)}`;
      return new TwilioCallPlacer({ ...config.twilio, bridgeHost: config.bridge.host }, (ref) => config.phoneAllowlist[ref] ?? null, attemptToken, statusUrl);
    }
    return null;
  };

  const searchPlaces = config.naverSearch ? naverPlaceSearch(config.naverSearch) : null;
  const simulatorCalls: SimulatorCall[] = [];
  const keepSimulatorCall = (call: SimulatorCall) => {
    if (!call.replyTarget.startsWith(SIMULATOR_PREFIX)) return;
    simulatorCalls.push(call);
    if (simulatorCalls.length > 200) simulatorCalls.splice(0, simulatorCalls.length - 200);
  };
  const make = (line: LineGateway, readImage: ((messageId: string) => Promise<string | null>) | null, onCallTranscript?: (call: SimulatorCall) => void) =>
    new DiningAgent({ store, line, travel, calls: placer(), clock, newId: () => randomUUID().replace(/-/g, ""), keyOf, origin: config.origin, linkSecret: config.linkSecret, phoneAllowed, readImage, searchPlaces, onCallTranscript, log });

  const simulatorLine = new RecordingLineGateway(clock);
  const simulatorImages = new Map<string, Buffer>();
  const readSimulatorImage = async (id: string) => {
    const image = simulatorImages.get(id);
    simulatorImages.delete(id);
    return image ? readImageText(image) : null;
  };
  const accessToken = config.accessToken;
  const readLineImage = accessToken
    ? async (messageId: string) => {
        const image = await fetchLineImage(messageId, accessToken);
        return image ? readImageText(image) : null;
      }
    : null;
  const realLine: LineGateway = accessToken ? new LineMessagingClient(accessToken) : new RecordingLineGateway(clock);
  const runtime: LineAgentRuntime = { config, store, agent: make(realLine, readLineImage), simulator: make(simulatorLine, readSimulatorImage, keepSimulatorCall), simulatorLine, simulatorImages, simulatorCalls, finishCall, attemptToken };
  self.runtime = runtime;
  log("line_agent.started", { calls: config.calls, line: config.accessToken !== null, simulator: config.simulatorEnabled, store: config.store });
  return runtime;
}
