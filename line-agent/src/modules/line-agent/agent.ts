// The LINE dining agent. It keeps one active request per conversation, asks
// for what is missing, compares candidates against the next appointment, and
// — only after the requester approves — calls shops one at a time until one
// accepts inside the approved window (spec §3–§5, §8).
import { buildCallInstructions } from "./call-brief";
import { interpret, normalizeText, parsePartySize, type Interpretation } from "./interpret";
import { makeCardToken } from "./links";
import type { LineGateway } from "./line/client";
import type { LineEvent, LineMessage, LineSource } from "./line/types";
import { conversationTarget } from "./line/webhook";
import * as m from "./messages";
import { classifyCall } from "./outcome";
import { computePlan, rankPlans, type CandidatePlan } from "./plan";
import { findArea, findAreaMentions, findMenu, findRestaurant, listRestaurants, menuNames } from "./places";
import { decodePostback, type Postback } from "./postback";
import { isActive, type AgentStore } from "./store";
import type { CallFinished, CallPlacer } from "./telephony";
import { addMinutes, ceilToMinutes, laterOf, seoulDate, seoulInstant } from "./time";
import type { TravelProvider } from "./travel";
import type { CallApproval, CallAttempt, CandidateState, DiningRequest, MenuKey } from "./types";
import { readWait } from "./wait";

export type AgentDeps = {
  store: AgentStore;
  line: LineGateway;
  travel: TravelProvider;
  /** null = phone calls switched off (feature flag, spec §2). */
  calls: CallPlacer | null;
  clock: () => string;
  newId: () => string;
  /** Keyed hash of raw LINE ids; raw ids never reach logs (spec §9). */
  keyOf: (raw: string) => string;
  origin: string;
  linkSecret: string | null;
  phoneAllowed: (phoneRef: string) => boolean;
  log?: (event: string, data: Record<string, string | number | boolean | null>) => void;
};

const REQUEST_TTL_MINUTES = 6 * 60;
const APPROVAL_TTL_MINUTES = 10;
const MAX_CALL_CANDIDATES = 2;
const MAX_CARDS = 3;
const CALL_WINDOW_MINUTES = 75;
const MEAL_MINUTES = 45;
const BUFFER_MINUTES = 10;
const REQUESTER_ONLY = new Set(["call_request", "approve", "cancel_call", "new_search", "party", "area", "menu", "decision_retry", "verify_yes", "verify_no"]);

type Context = {
  target: string;
  convKey: string;
  kind: LineSource["type"];
  userId: string | null;
  requesterKey: string | null;
  replyToken: string;
};

export class DiningAgent {
  constructor(private readonly deps: AgentDeps) {}

  private now(): string {
    return this.deps.clock();
  }

  private log(event: string, data: Record<string, string | number | boolean | null> = {}): void {
    this.deps.log?.(event, data);
  }

  // ── Entry points ──────────────────────────────────────────────────────────

  async handleEvent(event: LineEvent): Promise<void> {
    if (!(await this.deps.store.claimEvent(event.webhookEventId, this.now()))) return;
    const userId = "userId" in event.source && event.source.userId ? event.source.userId : null;
    const target = conversationTarget(event.source);
    const ctx: Context = {
      target,
      convKey: this.deps.keyOf(target),
      kind: event.source.type,
      userId,
      requesterKey: userId ? this.deps.keyOf(userId) : null,
      replyToken: "replyToken" in event ? event.replyToken : "",
    };
    this.log("line.event", { type: event.type, conversation: ctx.kind });
    if (event.type === "follow" || event.type === "join") {
      await this.reply(ctx, [m.greeting("ja", ctx.kind === "user" ? "user" : "group")]);
    } else if (event.type === "message") {
      if (event.message.type === "text") {
        const mentioned = event.message.mention?.mentionees.some((mentionee) => mentionee.isSelf) ?? false;
        await this.onText(ctx, event.message.text, mentioned);
      } else if (event.message.type === "image") {
        await this.onImage(ctx);
      }
    } else if (event.type === "postback") {
      await this.onPostback(ctx, event.postback.data);
    }
  }

  async handleCallFinished(result: CallFinished): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const request = await this.deps.store.findByAttempt(result.attemptId);
      if (!request) return;
      const call = request.attempts.find((a) => a.id === result.attemptId)!;
      if (call.status === "finished" || call.status === "failed_to_place") return; // duplicate callback
      const approval = request.approvals.find((a) => a.id === call.approvalId)!;
      const restaurant = findRestaurant(call.candidateId)!;
      const now = this.now();
      const next = this.bump(request, now);
      const nextCall = next.attempts.find((a) => a.id === call.id)!;
      nextCall.finishedAt = now;

      if ("lost" in result) {
        nextCall.status = "finished";
        nextCall.outcome = { kind: "unknown", offeredTime: null, confirmedTime: null, partySize: null, depositRequired: false, bookingRequested: true, summaryKo: "통화 결과를 받지 못했습니다." };
        next.status = "needs_verification";
        next.decision = { reason: "out_of_range", candidateId: restaurant.id, offeredTime: null };
        if (!(await this.deps.store.save(next, request.revision))) continue;
        await this.push(next, [m.needsVerification(next, restaurant)]);
        return;
      }
      if ("failed" in result) {
        nextCall.status = "failed_to_place";
        if (!(await this.deps.store.save(next, request.revision))) continue;
        await this.push(next, [m.callMovedOn(next.lang, restaurant, "failed", null, next)]);
        await this.startNextAttempt(next.id, approval.id);
        return;
      }

      const outcome = classifyCall(result.transcript, { partySize: approval.partySize, windowStart: approval.windowStart, windowEnd: approval.windowEnd });
      nextCall.status = "finished";
      nextCall.outcome = outcome;
      this.log("call.outcome", { kind: outcome.kind, attempt: call.ordinal });
      const messages: LineMessage[] = [];
      let continueCalling = false;

      if (outcome.kind === "confirmed" && outcome.confirmedTime) {
        next.reservation = {
          candidateId: restaurant.id,
          partySize: approval.partySize,
          time: outcome.confirmedTime,
          alias: approval.alias,
          evidence: "call_accept",
          acceptedAt: now,
          test: restaurant.test,
        };
        next.status = "confirmed";
        next.selectedCandidateId = restaurant.id;
        const token = this.deps.linkSecret
          ? makeCardToken({ restaurantId: restaurant.id, partySize: approval.partySize, time: outcome.confirmedTime, alias: approval.alias, test: restaurant.test, expiresAt: addMinutes(outcome.confirmedTime, 6 * 60) }, this.deps.linkSecret)
          : null;
        messages.push(m.confirmedCard(next, next.reservation, restaurant, { origin: this.deps.origin, cardToken: token }));
      } else if (outcome.kind === "alternate_offered" && outcome.depositRequired) {
        next.status = "needs_decision";
        next.decision = { reason: "deposit", candidateId: restaurant.id, offeredTime: outcome.offeredTime };
        messages.push(m.needsDecision(next, restaurant, "deposit", outcome.offeredTime));
      } else if (outcome.kind === "alternate_offered" && outcome.offeredTime) {
        const plan = this.planFor(next, restaurant.id, now);
        const limit = plan?.seatDeadline ?? approval.windowEnd;
        if (Date.parse(outcome.offeredTime) > Date.parse(limit)) {
          messages.push(m.callMovedOn(next.lang, restaurant, "late_offer", outcome.offeredTime, next));
          continueCalling = true;
        } else {
          next.status = "needs_decision";
          next.decision = { reason: "out_of_range", candidateId: restaurant.id, offeredTime: outcome.offeredTime };
          messages.push(m.needsDecision(next, restaurant, "out_of_range", outcome.offeredTime));
        }
      } else if (outcome.kind === "unknown" && outcome.bookingRequested) {
        // A booking may exist: never call the next shop until it is checked (spec CALL-03).
        next.status = "needs_verification";
        next.decision = { reason: "out_of_range", candidateId: restaurant.id, offeredTime: outcome.offeredTime };
        messages.push(m.needsVerification(next, restaurant));
      } else {
        messages.push(m.callMovedOn(next.lang, restaurant, outcome.kind === "no_answer" ? "no_answer" : "declined", null, next));
        continueCalling = true;
      }

      if (continueCalling && approval.revokedAt) {
        next.status = "closed";
        continueCalling = false;
      }
      if (!(await this.deps.store.save(next, request.revision))) continue;
      await this.push(next, messages);
      if (continueCalling) await this.startNextAttempt(next.id, approval.id);
      return;
    }
  }

  // ── Text ──────────────────────────────────────────────────────────────────

  private async onText(ctx: Context, rawText: string, mentioned: boolean): Promise<void> {
    const now = this.now();
    const isGroup = ctx.kind !== "user";
    const addressed = !isGroup || mentioned || mentionsBot(rawText);
    const text = stripBotName(rawText);
    const active = await this.deps.store.getActiveRequest(ctx.convKey, now);
    const fromRequester = active !== null && ctx.requesterKey !== null && active.requesterKey === ctx.requesterKey;

    // The requester answers a group request's name question in 1:1.
    if (!isGroup && ctx.requesterKey && (!active || active.pendingQuestion !== "alias")) {
      const elsewhere = await this.deps.store.getActiveByRequester(ctx.requesterKey, now);
      if (elsewhere && elsewhere.id !== active?.id && elsewhere.pendingQuestion === "alias") {
        await this.answerAlias(elsewhere, text, ctx);
        return;
      }
    }

    if (active?.pendingQuestion && (fromRequester || (active.pendingQuestion === "wait" && addressed)) && !interpret(text).cancel) {
      if (await this.answerPending(active, text, ctx)) return;
    }
    if (!addressed) return;

    const reading = interpret(text);
    if (reading.cancel) {
      if (active && (fromRequester || !isGroup)) await this.cancel(active, ctx);
      return;
    }
    if (active?.status === "calling") {
      await this.reply(ctx, [m.busyCalling(active.lang)]);
      return;
    }
    if (reading.wantsFood || filledFields(reading) >= 2) {
      if (active && !(fromRequester || !isGroup)) {
        await this.reply(ctx, [m.onlyRequester(active.lang)]);
        return;
      }
      if (!ctx.userId) {
        await this.reply(ctx, [m.greeting(reading.lang, isGroup ? "group" : "user")]);
        return;
      }
      if (active) {
        const closed = { ...this.bump(active, now), status: "closed" as const };
        await this.deps.store.save(closed, active.revision);
      }
      await this.startRequest(ctx, reading, now);
      return;
    }
    if (active) {
      const wait = readWait(text);
      const candidateId = active.pendingWaitCandidateId ?? active.selectedCandidateId;
      if (wait && candidateId) {
        await this.recordWait(active, candidateId, text, ctx);
        return;
      }
    }
    await this.reply(ctx, [m.didNotUnderstand(reading.lang)]);
  }

  private async onImage(ctx: Context): Promise<void> {
    const active = await this.deps.store.getActiveRequest(ctx.convKey, this.now());
    if (active && (active.pendingQuestion === "wait" || ctx.kind === "user")) await this.reply(ctx, [m.imageNotSupported(active.lang)]);
  }

  private async startRequest(ctx: Context, reading: Interpretation, now: string): Promise<void> {
    const request: DiningRequest = {
      id: this.deps.newId(),
      conversationKey: ctx.convKey,
      conversationKind: ctx.kind,
      replyTarget: ctx.target,
      requesterKey: ctx.requesterKey!,
      requesterTarget: ctx.userId!,
      lang: reading.lang,
      status: "collecting",
      revision: 0,
      partySize: null,
      menuKey: null,
      menuLabel: null,
      areaId: null,
      nextPlace: null,
      arriveBy: null,
      mealMinutes: MEAL_MINUTES,
      bufferMinutes: BUFFER_MINUTES,
      pendingQuestion: null,
      pendingWaitCandidateId: null,
      candidates: [],
      selectedCandidateId: null,
      waits: [],
      approvals: [],
      attempts: [],
      reservation: null,
      decision: null,
      proposal: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: addMinutes(now, REQUEST_TTL_MINUTES),
    };
    const notices = this.merge(request, reading, now);
    this.log("request.started", { lang: request.lang, kind: ctx.kind });
    const unsupported = reading.currentAreaId && !findArea(reading.currentAreaId)?.diningArea ? findArea(reading.currentAreaId) : undefined;
    await this.advance(request, null, ctx, notices, unsupported);
  }

  /** Copies what the text states into fields that are still empty. */
  private merge(request: DiningRequest, reading: Interpretation, now: string): LineMessage[] {
    const notices: LineMessage[] = [];
    request.partySize ??= reading.partySize;
    if (!request.menuKey && reading.menu) {
      request.menuKey = reading.menu.key;
      request.menuLabel = reading.menu.label;
    }
    if (!request.areaId && reading.currentAreaId && findArea(reading.currentAreaId)?.diningArea) request.areaId = reading.currentAreaId;
    request.nextPlace ??= reading.nextPlace;
    if (!request.arriveBy && reading.arriveBy) {
      let arrive = seoulInstant(seoulDate(now), reading.arriveBy.hour, reading.arriveBy.minute);
      if (Date.parse(arrive) <= Date.parse(now)) {
        const hoursPast = (Date.parse(now) - Date.parse(arrive)) / 3_600_000;
        if (hoursPast < 3) {
          if (request.nextPlace) notices.push(m.arrivalTimePassed(request.lang, request.nextPlace, arrive));
          return notices;
        }
        arrive = addMinutes(arrive, 24 * 60); // e.g. "1時までに" asked at 23:00
      }
      request.arriveBy = arrive;
    }
    return notices;
  }

  /** Asks the next missing question, or searches once everything is known. */
  private async advance(request: DiningRequest, expectedRevision: number | null, ctx: Context, notices: LineMessage[] = [], unsupportedArea?: { nameJa: string; nameKo: string }): Promise<void> {
    const now = this.now();
    const next = expectedRevision === null ? request : this.bump(request, now);
    if (expectedRevision === null) next.revision = 1;
    let question: LineMessage | null = null;
    if (next.partySize === null) {
      next.pendingQuestion = "party";
      question = m.askPartySize(next);
    } else if (next.areaId === null) {
      next.pendingQuestion = "area";
      question = m.askArea(next, unsupportedArea);
    } else if (next.menuKey === null) {
      next.pendingQuestion = "menu";
      question = m.askMenu(next);
    }
    if (question) {
      next.status = "collecting";
      if (!(await this.deps.store.save(next, expectedRevision))) return this.reply(ctx, [m.staleCard(next.lang)]);
      return this.reply(ctx, [...notices, question]);
    }
    next.pendingQuestion = null;
    next.candidates = await this.searchCandidates(next, now);
    next.status = "comparing";
    if (!(await this.deps.store.save(next, expectedRevision))) return this.reply(ctx, [m.staleCard(next.lang)]);
    await this.reply(ctx, [...notices, ...this.candidateView(next, now)]);
  }

  private async searchCandidates(request: DiningRequest, now: string): Promise<CandidateState[]> {
    const area = findArea(request.areaId!)!;
    // Shops whose confirmed capacity is below the party are left out (spec §2 인원).
    const found = listRestaurants(area.id, request.menuKey ?? "any").filter((restaurant) => restaurant.maxParty === null || restaurant.maxParty >= (request.partySize ?? 1));
    const states = await Promise.all(
      found.map(async (restaurant): Promise<CandidateState> => ({
        restaurantId: restaurant.id,
        rank: 0,
        toRestaurant: await this.deps.travel.leg(area.point, restaurant.point, now),
        toNext: request.nextPlace ? await this.deps.travel.leg(restaurant.point, request.nextPlace.point, now) : null,
      })),
    );
    const plans = rankPlans(states.map((state) => computePlan(request, state, now)), states);
    return plans.slice(0, MAX_CARDS).map((plan, index) => ({ ...states.find((s) => s.restaurantId === plan.candidateId)!, rank: index + 1 }));
  }

  private plans(request: DiningRequest, now: string): CandidatePlan[] {
    return request.candidates.map((candidate) => computePlan(request, candidate, now));
  }

  private planFor(request: DiningRequest, candidateId: string, now: string): CandidatePlan | null {
    const candidate = request.candidates.find((c) => c.restaurantId === candidateId);
    return candidate ? computePlan(request, candidate, now) : null;
  }

  private candidateView(request: DiningRequest, now: string, intro?: string): LineMessage[] {
    const plans = this.plans(request, now).sort((a, b) => rankOf(request, a.candidateId) - rankOf(request, b.candidateId));
    return m.candidatesMessages(request, plans, findRestaurant, { callingEnabled: this.deps.calls !== null, intro });
  }

  private async answerPending(request: DiningRequest, text: string, ctx: Context): Promise<boolean> {
    const now = this.now();
    switch (request.pendingQuestion) {
      case "party": {
        const reading = interpret(text);
        const size = parsePartySize(text);
        if (size === null || size < 1 || size > 30) {
          if (reading.wantsFood && filledFields(reading) >= 2) return false;
          await this.reply(ctx, [m.askPartySize(request)]);
          return true;
        }
        const next = structuredClone(request);
        next.partySize = size;
        const notices = this.merge(next, reading, now);
        await this.advance(next, request.revision, ctx, notices);
        return true;
      }
      case "area": {
        const mentions = findAreaMentions(normalizeText(text));
        const mention = mentions.find((hit) => hit.area.diningArea);
        if (!mention) {
          await this.reply(ctx, [m.askArea(request, mentions[0]?.area)]);
          return true;
        }
        const next = structuredClone(request);
        next.areaId = mention.area.id;
        await this.advance(next, request.revision, ctx, this.merge(next, interpret(text), now));
        return true;
      }
      case "menu": {
        const menu = findMenu(normalizeText(text));
        if (!menu) {
          await this.reply(ctx, [m.askMenu(request)]);
          return true;
        }
        const next = structuredClone(request);
        next.menuKey = menu.key;
        next.menuLabel = menu.label;
        await this.advance(next, request.revision, ctx, this.merge(next, interpret(text), now));
        return true;
      }
      case "alias":
        await this.answerAlias(request, text, ctx);
        return true;
      case "wait":
        if (!request.pendingWaitCandidateId) return false;
        if (!readWait(text)) {
          await this.reply(ctx, [m.waitNotUnderstood(request.lang)]);
          return true;
        }
        await this.recordWait(request, request.pendingWaitCandidateId, text, ctx);
        return true;
      default:
        return false;
    }
  }

  private async answerAlias(request: DiningRequest, text: string, ctx: Context): Promise<void> {
    const alias = normalizeText(text).slice(0, 20);
    // Refuse anything that looks like a phone number or is empty.
    if (!alias || /\d{4,}/.test(alias.replace(/[-\s]/g, ""))) {
      await this.reply(ctx, [m.askAlias(request.lang)]);
      return;
    }
    await this.deps.store.setAlias(request.requesterKey, alias);
    const next = this.bump(request, this.now());
    next.pendingQuestion = null;
    await this.propose(next, request.revision, ctx, alias);
  }

  private async recordWait(request: DiningRequest, candidateId: string, text: string, ctx: Context): Promise<void> {
    const now = this.now();
    const reading = readWait(text)!;
    const restaurant = findRestaurant(candidateId);
    if (!restaurant) return;
    const next = this.bump(request, now);
    const readyAt = reading.readyAt ? seoulInstant(seoulDate(now), reading.readyAt.hour, reading.readyAt.minute) : null;
    next.waits.push({ candidateId, minutes: reading.minutes, teams: reading.teams, readyAt, basis: reading.basis, observedAt: now, reportedAt: now, reportedBy: ctx.requesterKey ?? "unknown", source: "user_text" });
    next.pendingQuestion = null;
    next.pendingWaitCandidateId = null;
    if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(next.lang)]);
    if (reading.basis === "unknown" && reading.minutes && !readyAt) {
      await this.reply(ctx, [m.askWaitBasis(next, restaurant, reading.minutes)]);
      return;
    }
    const plan = this.planFor(next, candidateId, now)!;
    await this.reply(ctx, this.candidateView(next, now, m.waitRecorded(next.lang, restaurant, plan)));
  }

  // ── Postbacks ─────────────────────────────────────────────────────────────

  private async onPostback(ctx: Context, data: string): Promise<void> {
    const postback = decodePostback(data);
    if (!postback) return;
    const now = this.now();
    const request = await this.deps.store.getRequest(postback.requestId);
    if (!request || request.conversationKey !== ctx.convKey) return;
    const lang = request.lang;
    if (!isActive(request, now)) {
      await this.reply(ctx, [m.staleCard(lang)]);
      return;
    }
    if (postback.revision !== request.revision) {
      await this.reply(ctx, [m.staleCard(lang), ...(request.status === "comparing" ? this.candidateView(request, now) : [])]);
      return;
    }
    if (REQUESTER_ONLY.has(postback.action) && ctx.requesterKey !== request.requesterKey) {
      await this.reply(ctx, [m.onlyRequester(lang)]);
      return;
    }
    await this.applyPostback(request, postback, ctx, now);
  }

  private async applyPostback(request: DiningRequest, postback: Postback, ctx: Context, now: string): Promise<void> {
    const lang = request.lang;
    switch (postback.action) {
      case "party":
      case "area":
      case "menu": {
        const next = structuredClone(request);
        if (postback.action === "party") next.partySize = Number(postback.value) || null;
        if (postback.action === "area" && postback.value && findArea(postback.value)?.diningArea) next.areaId = postback.value;
        if (postback.action === "menu" && postback.value) {
          const key = postback.value as MenuKey;
          if (key in menuNames) {
            next.menuKey = key;
            next.menuLabel = menuNames[key][lang];
          }
        }
        await this.advance(next, request.revision, ctx);
        return;
      }
      case "select": {
        const restaurant = postback.candidateId ? findRestaurant(postback.candidateId) : undefined;
        if (!restaurant || !request.candidates.some((c) => c.restaurantId === restaurant.id)) return;
        const next = this.bump(request, now);
        next.selectedCandidateId = restaurant.id;
        if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
        await this.reply(ctx, [m.selectedMessage(next, restaurant, this.deps.origin)]);
        return;
      }
      case "wait": {
        const restaurant = postback.candidateId ? findRestaurant(postback.candidateId) : undefined;
        if (!restaurant) return;
        const next = this.bump(request, now);
        next.pendingQuestion = "wait";
        next.pendingWaitCandidateId = restaurant.id;
        if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
        await this.reply(ctx, [m.askWait(next, restaurant)]);
        return;
      }
      case "wait_on_arrival":
      case "wait_remote": {
        const candidateId = postback.candidateId;
        const restaurant = candidateId ? findRestaurant(candidateId) : undefined;
        const next = this.bump(request, now);
        const wait = [...next.waits].reverse().find((w) => w.candidateId === candidateId);
        if (!restaurant || !wait) return;
        wait.basis = postback.action === "wait_remote" ? "remote_from_observed" : "on_arrival";
        if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
        const plan = this.planFor(next, restaurant.id, now)!;
        await this.reply(ctx, this.candidateView(next, now, m.waitRecorded(lang, restaurant, plan)));
        return;
      }
      case "call_request":
      case "decision_retry": {
        if (!this.deps.calls) return this.reply(ctx, [m.callingDisabled(lang)]);
        const alias = await this.deps.store.getAlias(request.requesterKey);
        if (!alias) {
          const next = this.bump(request, now);
          next.pendingQuestion = "alias";
          if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
          if (ctx.kind !== "user") {
            try {
              await this.deps.line.push(request.requesterTarget, [m.askAlias(lang)]);
              await this.reply(ctx, [{ type: "text", text: lang === "ja" ? "予約名は個別トークでお聞きします。" : "예약자 이름은 1:1 대화에서 여쭤볼게요." }]);
              return;
            } catch {
              // Not a friend of the account yet: ask here instead.
            }
          }
          await this.reply(ctx, [m.askAlias(lang)]);
          return;
        }
        await this.propose(this.bump(request, now), request.revision, ctx, alias);
        return;
      }
      case "approve": {
        const proposal = request.proposal;
        if (!proposal || Date.parse(proposal.expiresAt) < Date.parse(now)) {
          await this.reply(ctx, [m.staleCard(lang)]);
          return;
        }
        const approval: CallApproval = { id: this.deps.newId(), revision: request.revision, approvedBy: ctx.requesterKey!, ...proposal, createdAt: now, revokedAt: null };
        const next = this.bump(request, now);
        next.approvals.push(approval);
        next.proposal = null;
        next.decision = null;
        next.status = "calling";
        if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
        this.log("call.approved", { candidates: approval.candidateIds.length });
        await this.startNextAttempt(next.id, approval.id);
        return;
      }
      case "cancel_call": {
        const next = this.bump(request, now);
        next.proposal = null;
        next.status = "comparing";
        if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
        await this.reply(ctx, [{ type: "text", text: lang === "ja" ? "電話はやめました。" : "전화는 그만뒀어요." }]);
        return;
      }
      case "verify_yes":
      case "verify_no": {
        const restaurant = postback.candidateId ? findRestaurant(postback.candidateId) : undefined;
        if (request.status !== "needs_verification" || !restaurant) return this.reply(ctx, [m.staleCard(lang)]);
        const attempt = [...request.attempts].reverse().find((a) => a.candidateId === restaurant.id);
        const approval = request.approvals.find((a) => a.id === attempt?.approvalId);
        const next = this.bump(request, now);
        next.decision = null;
        if (postback.action === "verify_no" || !approval) {
          next.status = "comparing";
          if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
          return this.reply(ctx, [m.verifiedNone(next)]);
        }
        next.status = "confirmed";
        next.selectedCandidateId = restaurant.id;
        next.reservation = {
          candidateId: restaurant.id,
          partySize: approval.partySize,
          time: attempt?.outcome?.offeredTime ?? request.decision?.offeredTime ?? approval.windowStart,
          alias: approval.alias,
          evidence: "user_confirmed",
          acceptedAt: now,
          test: restaurant.test,
        };
        if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
        const token = this.deps.linkSecret
          ? makeCardToken({ restaurantId: restaurant.id, partySize: approval.partySize, time: next.reservation.time, alias: approval.alias, test: restaurant.test, expiresAt: addMinutes(next.reservation.time, 6 * 60) }, this.deps.linkSecret)
          : null;
        return this.reply(ctx, [m.confirmedCard(next, next.reservation, restaurant, { origin: this.deps.origin, cardToken: token })]);
      }
      case "new_search": {
        const next = structuredClone(request);
        next.proposal = null;
        next.decision = null;
        await this.advance(next, request.revision, ctx);
        return;
      }
    }
  }

  // ── Calls ─────────────────────────────────────────────────────────────────

  private async propose(next: DiningRequest, expectedRevision: number, ctx: Context, alias: string): Promise<void> {
    const now = this.now();
    const lang = next.lang;
    const attempted = new Set(next.attempts.map((attempt) => attempt.candidateId));
    const plans = this.plans(next, now)
      .filter((plan) => plan.verdict !== "late" && !attempted.has(plan.candidateId))
      .filter((plan) => {
        const ref = findRestaurant(plan.candidateId)?.phoneRef;
        return ref !== null && ref !== undefined && this.deps.phoneAllowed(ref);
      })
      .sort((a, b) => rankOf(next, a.candidateId) - rankOf(next, b.candidateId))
      .slice(0, MAX_CALL_CANDIDATES);
    if (plans.length === 0) {
      await this.deps.store.save(next, expectedRevision);
      await this.replyOrPush(ctx, next, [m.noCallableCandidates(lang)]);
      return;
    }
    const starts = plans.map((plan) => plan.arriveRestaurantAt ?? addMinutes(now, 15));
    const ends = plans.map((plan) => plan.seatDeadline).filter((value): value is string => value !== null);
    const latestArrival = starts.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
    const earliestEnd = ends.length ? ends.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b)) : null;
    // Ask for a table close to the deadline, not hours early (e.g. asked in the morning for dinner).
    const windowStart = ceilToMinutes(earliestEnd ? laterOf(latestArrival, addMinutes(earliestEnd, -CALL_WINDOW_MINUTES)) : latestArrival, 5);
    const minEnd = earliestEnd ?? addMinutes(windowStart, 60);
    const windowEnd = Date.parse(minEnd) > Date.parse(windowStart) ? minEnd : addMinutes(windowStart, 30);
    next.proposal = {
      candidateIds: plans.map((plan) => plan.candidateId),
      partySize: next.partySize!,
      windowStart,
      windowEnd,
      alias,
      expiresAt: addMinutes(now, APPROVAL_TTL_MINUTES),
    };
    next.status = "awaiting_approval";
    if (!(await this.deps.store.save(next, expectedRevision))) return this.reply(ctx, [m.staleCard(lang)]);
    await this.replyOrPush(ctx, next, [m.approvalCard(next, next.proposal, findRestaurant)]);
  }

  /** Starts the next approved shop, one call at a time (spec §5). */
  async startNextAttempt(requestId: string, approvalId: string): Promise<void> {
    const placer = this.deps.calls;
    if (!placer) return;
    for (let retry = 0; retry < 3; retry++) {
      const request = await this.deps.store.getRequest(requestId);
      if (!request || request.status !== "calling") return;
      const approval = request.approvals.find((a) => a.id === approvalId);
      if (!approval || approval.revokedAt) return;
      if (request.attempts.some((a) => a.status === "placing" || a.status === "in_progress")) return;
      const done = new Set(request.attempts.filter((a) => a.approvalId === approvalId).map((a) => a.candidateId));
      const candidateId = approval.candidateIds.find((id) => !done.has(id));
      const now = this.now();
      if (!candidateId) {
        const next = this.bump(request, now);
        next.status = "comparing";
        if (!(await this.deps.store.save(next, request.revision))) continue;
        await this.push(next, [m.callsExhausted(next)]);
        return;
      }
      const restaurant = findRestaurant(candidateId)!;
      const attempt: CallAttempt = { id: this.deps.newId(), approvalId, candidateId, ordinal: 1, status: "placing", providerCallId: null, outcome: null, startedAt: now, finishedAt: null };
      const next = this.bump(request, now);
      next.attempts.push(attempt);
      if (!(await this.deps.store.save(next, request.revision))) continue;
      const index = approval.candidateIds.indexOf(candidateId) + 1;
      await this.push(next, [m.calling(next.lang, restaurant, index, approval.candidateIds.length)]);
      try {
        const brief = { restaurantNameKo: restaurant.nameKo, partySize: approval.partySize, windowStart: approval.windowStart, windowEnd: approval.windowEnd, alias: approval.alias, test: restaurant.test };
        const providerCallId = await placer.place({ attemptId: attempt.id, phoneRef: restaurant.phoneRef!, brief });
        await this.updateAttempt(attempt.id, (a) => {
          if (a.status === "placing") {
            a.status = "in_progress";
            a.providerCallId = providerCallId;
          }
        });
      } catch {
        await this.handleCallFinished({ attemptId: attempt.id, failed: true });
      }
      return;
    }
  }

  /** Instructions for the voice bridge, only for an attempt that is in progress. */
  async callInstructions(attemptId: string): Promise<string | null> {
    const request = await this.deps.store.findByAttempt(attemptId);
    const attempt = request?.attempts.find((a) => a.id === attemptId);
    if (!request || !attempt || (attempt.status !== "placing" && attempt.status !== "in_progress")) return null;
    const approval = request.approvals.find((a) => a.id === attempt.approvalId)!;
    const restaurant = findRestaurant(attempt.candidateId)!;
    return buildCallInstructions({ restaurantNameKo: restaurant.nameKo, partySize: approval.partySize, windowStart: approval.windowStart, windowEnd: approval.windowEnd, alias: approval.alias, test: restaurant.test });
  }

  private async updateAttempt(attemptId: string, change: (attempt: CallAttempt) => void): Promise<void> {
    for (let retry = 0; retry < 3; retry++) {
      const request = await this.deps.store.findByAttempt(attemptId);
      if (!request) return;
      const next = this.bump(request, this.now());
      change(next.attempts.find((a) => a.id === attemptId)!);
      if (await this.deps.store.save(next, request.revision)) return;
    }
  }

  private async cancel(request: DiningRequest, ctx: Context): Promise<void> {
    const now = this.now();
    const next = this.bump(request, now);
    const inFlight = next.attempts.some((a) => a.status === "placing" || a.status === "in_progress");
    for (const approval of next.approvals) approval.revokedAt ??= now;
    next.proposal = null;
    if (!inFlight) next.status = "closed";
    if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(next.lang)]);
    await this.reply(ctx, [m.cancelled(next.lang, inFlight)]);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private bump(request: DiningRequest, now: string): DiningRequest {
    const next = structuredClone(request);
    next.revision = request.revision + 1;
    next.updatedAt = now;
    return next;
  }

  private async reply(ctx: Context, messages: LineMessage[]): Promise<void> {
    if (messages.length === 0) return;
    try {
      await this.deps.line.reply(ctx.replyToken, messages);
    } catch {
      // An expired reply token: fall back to push so the user is not left waiting.
      await this.deps.line.push(ctx.target, messages).catch(() => undefined);
    }
  }

  private async replyOrPush(ctx: Context, request: DiningRequest, messages: LineMessage[]): Promise<void> {
    if (ctx.target === request.replyTarget) return this.reply(ctx, messages);
    await this.push(request, messages);
  }

  private async push(request: DiningRequest, messages: LineMessage[]): Promise<void> {
    await this.deps.line.push(request.replyTarget, messages).catch(() => this.log("line.push_failed", {}));
  }
}

function rankOf(request: DiningRequest, candidateId: string): number {
  return request.candidates.find((c) => c.restaurantId === candidateId)?.rank ?? 99;
}

function filledFields(reading: Interpretation): number {
  return [reading.partySize, reading.menu, reading.currentAreaId, reading.nextPlace].filter((value) => value !== null).length;
}

const botNames = [m.BOT_NAME.ja, m.BOT_NAME.ko, "@" + m.BOT_NAME.ja, "@" + m.BOT_NAME.ko];

function mentionsBot(text: string): boolean {
  return botNames.some((name) => text.includes(name));
}

function stripBotName(text: string): string {
  let out = text;
  for (const name of botNames) out = out.split(name).join(" ");
  return out.trim();
}

