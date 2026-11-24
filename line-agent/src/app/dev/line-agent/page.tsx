import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { getLineAgentRuntime } from "../../../modules/line-agent/runtime.server";
import { requestOrigin, simulatorAllowed } from "../../../modules/line-agent/simulator-access";
import { LineAgentSimulator } from "./simulator";

export const metadata: Metadata = { title: "LINE 秘書シミュレーター", robots: { index: false } };

type SearchParams = Promise<{ token?: string }>;

async function Simulator({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const [params, list] = await Promise.all([searchParams, headers()]);
  const runtime = getLineAgentRuntime();
  if (!runtime.config.simulatorEnabled || !simulatorAllowed(requestOrigin((name) => list.get(name)), params.token ?? null, runtime.config.simulatorToken)) notFound();
  return <LineAgentSimulator calls={runtime.config.calls} token={params.token ?? null} />;
}

export default function LineAgentSimulatorPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p role="status">読み込み中… · 불러오는 중…</p>}>
      <Simulator searchParams={searchParams} />
    </Suspense>
  );
}
