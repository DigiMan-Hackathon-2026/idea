import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getLineAgentRuntime } from "../../../modules/line-agent/runtime.server";
import { LineAgentSimulator } from "./simulator";

export const metadata: Metadata = { title: "LINE 秘書シミュレーター", robots: { index: false } };

async function Simulator() {
  await connection();
  const runtime = getLineAgentRuntime();
  if (!runtime.config.simulatorEnabled) notFound();
  return <LineAgentSimulator calls={runtime.config.calls} />;
}

export default function LineAgentSimulatorPage() {
  return (
    <Suspense fallback={<p role="status">読み込み中… · 불러오는 중…</p>}>
      <Simulator />
    </Suspense>
  );
}
