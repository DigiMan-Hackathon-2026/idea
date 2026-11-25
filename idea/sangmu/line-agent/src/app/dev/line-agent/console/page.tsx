import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { getLineAgentRuntime } from "../../../../modules/line-agent/runtime.server";
import { requestOrigin, simulatorAllowed } from "../../../../modules/line-agent/simulator-access";
import { CallConsole } from "./call-console";

export const metadata: Metadata = { title: "AI電話コンソール", robots: { index: false } };

type SearchParams = Promise<{ token?: string }>;

async function Console({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const [params, list] = await Promise.all([searchParams, headers()]);
  const runtime = getLineAgentRuntime();
  if (!runtime.config.simulatorEnabled || !simulatorAllowed(requestOrigin((name) => list.get(name)), params.token ?? null, runtime.config.simulatorToken)) notFound();
  return <CallConsole token={params.token ?? null} bridgePort={runtime.config.bridgePort} />;
}

// Shown next to the LINE screen during the demo: what the AI is saying on the
// phone right now, with Japanese subtitles, and how each call ended.
export default function CallConsolePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p role="status">読み込み中… · 불러오는 중…</p>}>
      <Console searchParams={searchParams} />
    </Suspense>
  );
}
