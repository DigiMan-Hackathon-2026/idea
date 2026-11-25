import type { NextRequest } from "next/server";
import { translationFor } from "../../../../../../modules/line-agent/console-translate.server";
import { findRestaurant } from "../../../../../../modules/line-agent/places";
import { getLineAgentRuntime } from "../../../../../../modules/line-agent/runtime.server";
import { requestOrigin, simulatorAllowed } from "../../../../../../modules/line-agent/simulator-access";

// Operations console feed: connection status and recent calls with their live
// transcript. Same access rule as the simulator (this machine, or the token).
function enabled(request: NextRequest) {
  const runtime = getLineAgentRuntime();
  if (!runtime.config.simulatorEnabled) return null;
  const token = request.headers.get("x-simulator-token") ?? request.nextUrl.searchParams.get("token");
  return simulatorAllowed(requestOrigin((name) => request.headers.get(name)), token, runtime.config.simulatorToken) ? runtime : null;
}

async function bridgeUp(): Promise<boolean> {
  const port = Number(process.env.VOICE_BRIDGE_PORT ?? 8787);
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500), cache: "no-store" }).catch(() => null);
  return response?.ok ?? false;
}

export async function GET(request: NextRequest) {
  const runtime = enabled(request);
  if (!runtime) return new Response(null, { status: 404 });
  const { config } = runtime;
  const realCalls = config.calls !== "simulator";

  const calls = await Promise.all(
    runtime.board.list().map(async (call) => {
      const dining = await runtime.store.findByAttempt(call.attemptId).catch(() => null);
      const attempt = dining?.attempts.find((entry) => entry.id === call.attemptId) ?? null;
      const approval = attempt ? (dining?.approvals.find((entry) => entry.id === attempt.approvalId) ?? null) : null;
      const restaurant = attempt ? findRestaurant(attempt.candidateId) : undefined;
      const settled = call.phase === "ended" || call.phase === "failed";
      return {
        attemptId: call.attemptId,
        approvalId: attempt?.approvalId ?? null,
        phase: call.phase,
        simulated: call.simulated,
        placedAt: call.placedAt,
        answeredAt: call.answeredAt,
        endedAt: call.endedAt,
        nameJa: restaurant?.nameJa ?? null,
        nameKo: restaurant?.nameKo ?? call.restaurantNameKo,
        total: approval?.candidateIds.length ?? null,
        partySize: approval?.partySize ?? null,
        windowStart: approval?.windowStart ?? null,
        windowEnd: approval?.windowEnd ?? null,
        arriveBy: dining?.arriveBy ?? null,
        nextPlaceJa: dining?.nextPlace?.nameJa ?? null,
        outcome: attempt?.outcome ? { kind: attempt.outcome.kind, offeredTime: attempt.outcome.offeredTime, confirmedTime: attempt.outcome.confirmedTime, depositRequired: attempt.outcome.depositRequired, waitMinutes: attempt.outcome.waitMinutes ?? null } : null,
        reserved: dining?.reservation?.candidateId === attempt?.candidateId && dining?.reservation !== null && attempt !== null,
        // A line still being spoken is translated once it settles.
        turns: call.turns.map((turn, index) => ({ ...turn, ja: settled || index < call.turns.length - 1 ? translationFor(turn.text) : null })),
      };
    }),
  );

  return Response.json(
    {
      now: Date.now(),
      status: {
        line: config.accessToken !== null,
        calls: config.calls,
        carrier: realCalls ? (config.calls === "kat" ? config.kat !== null : config.twilio !== null) : null,
        bridge: realCalls ? await bridgeUp() : null,
        store: config.store,
        demoNow: config.demoNow,
      },
      calls,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
