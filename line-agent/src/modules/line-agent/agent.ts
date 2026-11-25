// The LINE dining agent. It keeps one active request per conversation, asks
// for what is missing, compares candidates against the next appointment, and
// — only after the requester approves — calls shops one at a time until one
// accepts inside the approved window (spec §3–§5, §8).
import { buildCallInstructions } from "./call-brief";
import { findClockTimes, interpret, normalizeText, parsePartySize, wantsCall, type Interpretation } from "./interpret";
import { makeCardToken } from "./links";
import type { LineGateway } from "./line/client";
import type { LineEvent, LineMessage, LineSource } from "./line/types";
import { conversationTarget } from "./line/webhook";
import { bilingual, say } from "./bilingual";
import * as messages from "./messages";
import { classifyCall, type TranscriptTurn } from "./outcome";
import { computePlan, rankPlans, type CandidatePlan } from "./plan";
import { searchCandidate, type PlaceSearch } from "./naver-search";
import { findShopByName, identifyPlace, type LinkResolver } from "./identify";
import { findArea, findAreaMentions, findMenu, findRestaurant, listRestaurants, menuNames, registerSearchRestaurant, stationAdventurePath } from "./places";
import { decodePostback, type Postback } from "./postback";
import { isActive, type AgentStore } from "./store";
import type { CallFinished, CallPlacer } from "./telephony";
import { addMinutes, ceilToMinutes, floorToMinutes, laterOf, seoulDate, seoulInstant } from "./time";
import { judgeToday } from "./today";
import type { Understanding } from "./understand";
import type { TravelProvider } from "./travel";
import type { CallApproval, CallAttempt, CallOutcome, CandidateState, DiningRequest, Lang, MenuKey, Restaurant } from "./types";
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
  /** Reads the text in an image the user sent (OCR). null = cannot read images here. */
  readImage?: ((messageId: string) => Promise<string | null>) | null;
  /** NAVER local search to fill up when fewer than three curated shops match (spec §2). */
  searchPlaces?: PlaceSearch | null;
  /** Called with each finished call's transcript (the simulator shows it; nothing is stored by default). */
  onCallTranscript?: (info: { replyTarget: string; attemptId: string; restaurantId: string; transcript: TranscriptTurn[]; outcome: CallOutcome["kind"]; at: string }) => void;
  log?: (event: string, data: Record<string, string | number | boolean | null>) => void;
  /** Follows NAVER/Google Maps short links to their full URL. null = short links are not opened. */
  resolveLink?: LinkResolver | null;
  /** Reads a message the rules could not (language model, form only). null = rules only. */
  understand?: ((text: string, lang: Lang, now: string) => Promise<Understanding | null>) | null;
};

type Target = NonNullable<DiningRequest["target"]>;

/** Message builders; Japanese conversations also get the Korean text below a line. */
const m = bilingual(messages);

const REQUEST_TTL_MINUTES = 6 * 60;
const APPROVAL_TTL_MINUTES = 10;
const MAX_CALL_CANDIDATES = 3;
const MAX_CARDS = 3;
const CALL_WINDOW_MINUTES = 75;
const MEAL_MINUTES = 45;
const BUFFER_MINUTES = 10;
const REQUESTER_ONLY = new Set(["call_request", "approve", "cancel_call", "new_search", "party", "area", "menu", "decision_retry", "decision_accept", "verify_yes", "verify_no"]);

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
    if (event.type === "unfollow") {
      // The user blocked the account: forget the booking name they gave.
      if (ctx.requesterKey) await this.deps.store.deleteAlias(ctx.requesterKey);
      return;
    }
    if (event.type === "follow" || event.type === "join") {
      await this.reply(ctx, [m.greeting("ja", ctx.kind === "user" ? "user" : "group")]);
    } else if (event.type === "message") {
      if (event.message.type === "text") {
        const mentioned = event.message.mention?.mentionees.some((mentionee) => mentionee.isSelf) ?? false;
        await this.onText(ctx, event.message.text, mentioned);
      } else if (event.message.type === "image") {
        await this.onImage(ctx, event.message.id);
      }
    } else if (event.type === "postback") {
      await this.onPostback(ctx, event.postback.data);
    }
  }

  async handleCallFinished(result: CallFinished): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const request = this.hydrate(await this.deps.store.findByAttempt(result.attemptId));
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
      const quote = lastShopWords(result.transcript);
      this.deps.onCallTranscript?.({ replyTarget: request.replyTarget, attemptId: call.id, restaurantId: restaurant.id, transcript: result.transcript, outcome: outcome.kind, at: now });
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
          test: restaurant.test || restaurant.testCall === true,
        };
        next.status = "confirmed";
        next.selectedCandidateId = restaurant.id;
        const token = this.deps.linkSecret
          ? makeCardToken({ restaurantId: restaurant.id, partySize: approval.partySize, time: outcome.confirmedTime, alias: approval.alias, test: restaurant.test, expiresAt: addMinutes(outcome.confirmedTime, 6 * 60) }, this.deps.linkSecret)
          : null;
        messages.push(m.confirmedCard(next, next.reservation, restaurant, { origin: this.deps.origin, cardToken: token }, quote));
      } else if (outcome.kind === "alternate_offered" && outcome.depositRequired) {
        next.status = "needs_decision";
        next.decision = { reason: "deposit", candidateId: restaurant.id, offeredTime: outcome.offeredTime };
        messages.push(m.needsDecision(next, restaurant, "deposit", outcome.offeredTime, quote));
      } else if (outcome.kind === "alternate_offered" && outcome.offeredTime) {
        const plan = this.planFor(next, restaurant.id, now);
        // Too late for the next appointment → try the next shop. Without an appointment,
        // or for an earlier time, the requester decides.
        if (plan?.seatDeadline && Date.parse(outcome.offeredTime) > Date.parse(plan.seatDeadline)) {
          messages.push(m.callMovedOn(next.lang, restaurant, "late_offer", outcome.offeredTime, next, quote));
          continueCalling = true;
        } else {
          next.status = "needs_decision";
          next.decision = { reason: "out_of_range", candidateId: restaurant.id, offeredTime: outcome.offeredTime };
          messages.push(m.needsDecision(next, restaurant, "out_of_range", outcome.offeredTime, quote));
        }
      } else if (outcome.kind === "walk_in") {
        // No bookings, but a queue: what the shop said is a wait report, checked against the next plan.
        next.waits.push({ candidateId: restaurant.id, minutes: outcome.waitMinutes ?? null, teams: outcome.waitTeams ?? null, readyAt: null, basis: "on_arrival", observedAt: now, reportedAt: now, reportedBy: "shop_call", source: "shop_call" });
        const plan = this.planFor(next, restaurant.id, now);
        if (plan?.verdict === "late") {
          messages.push(m.walkIn(next, restaurant, plan, quote, "late"));
          continueCalling = true;
        } else {
          next.status = "comparing";
          messages.push(m.walkIn(next, restaurant, plan, quote, plan?.verdict === "fits" ? "fits" : "unknown"));
        }
      } else if (outcome.kind === "unknown" && outcome.bookingRequested) {
        // A booking may exist: never call the next shop until it is checked (spec CALL-03).
        next.status = "needs_verification";
        next.decision = { reason: "out_of_range", candidateId: restaurant.id, offeredTime: outcome.offeredTime };
        messages.push(m.needsVerification(next, restaurant));
      } else {
        messages.push(m.callMovedOn(next.lang, restaurant, outcome.kind === "no_answer" ? "no_answer" : "declined", null, next, quote));
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
    const active = this.hydrate(await this.deps.store.getActiveRequest(ctx.convKey, now));
    const fromRequester = active !== null && ctx.requesterKey !== null && active.requesterKey === ctx.requesterKey;

    // The requester answers a group request's name question in 1:1.
    if (!isGroup && ctx.requesterKey && (!active || active.pendingQuestion !== "alias")) {
      const elsewhere = await this.deps.store.findAwaitingAlias(ctx.requesterKey, now);
      if (elsewhere && elsewhere.id !== active?.id) {
        await this.answerAlias(elsewhere, text, ctx);
        return;
      }
    }

    if (active?.pendingQuestion && (fromRequester || (active.pendingQuestion === "wait" && addressed)) && !interpret(text).cancel) {
      // In a group, chat not addressed to the bot only counts if it reads as an answer.
      if (await this.answerPending(active, text, ctx, isGroup && !addressed)) return;
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
    if (wantsCall(text)) return this.callFromText(ctx, text, active, reading);
    // A shop the user points at (map link, page, or its name) is answered for that shop first.
    const place = await identifyPlace(text, this.deps.resolveLink ?? null);
    if (place?.kind === "shop") {
      this.log("request.target", { via: place.via });
      return this.beginRequest(ctx, active, fromRequester, reading, now, { candidateId: place.restaurant.id, via: place.via });
    }
    if (place && !(reading.wantsFood && filledFields(reading) >= 2)) {
      await this.reply(ctx, [place.kind === "unknown_place" ? m.unknownPlace(reading.lang) : m.unreadableLink(reading.lang, place.host)]);
      return;
    }
    if (reading.wantsFood || filledFields(reading) >= 2) return this.beginRequest(ctx, active, fromRequester, reading, now, null);
    if (active) {
      const wait = readWait(text);
      const candidateId = active.pendingWaitCandidateId ?? active.selectedCandidateId;
      if (wait && candidateId) {
        await this.recordWait(active, candidateId, text, ctx);
        return;
      }
    }
    // The rules did not get it: let the model read it into the same form.
    const understood = await this.understand(text, active?.lang ?? reading.lang);
    if (understood) {
      const read = understood.reading;
      const shop = understood.shopName ? findShopByName(understood.shopName) : null;
      if (read.cancel) {
        if (active && (fromRequester || !isGroup)) await this.cancel(active, ctx);
        return;
      }
      if (understood.wantsCall) return this.callFromText(ctx, text, active, read, shop);
      if (shop) return this.beginRequest(ctx, active, fromRequester, read, now, { candidateId: shop.id, via: "name" });
      if (read.wantsFood || filledFields(read) >= 2) return this.beginRequest(ctx, active, fromRequester, read, now, null);
    }
    await this.reply(ctx, [m.didNotUnderstand(reading.lang)]);
  }

  private async understand(text: string, lang: Lang): Promise<Understanding | null> {
    if (!this.deps.understand) return null;
    const found = await this.deps.understand(text, lang, this.now()).catch(() => null);
    this.log("request.model_read", { understood: found !== null });
    return found;
  }

  /** A new request (closing the open one), only by its requester in a group. */
  private async beginRequest(ctx: Context, active: DiningRequest | null, fromRequester: boolean, reading: Interpretation, now: string, target: Target | null): Promise<void> {
    if (active && !(fromRequester || ctx.kind === "user")) return this.reply(ctx, [m.onlyRequester(active.lang)]);
    if (!ctx.userId) return this.reply(ctx, [m.greeting(reading.lang, ctx.kind === "user" ? "user" : "group")]);
    if (active) await this.deps.store.save({ ...this.bump(active, now), status: "closed" as const }, active.revision);
    await this.startRequest(ctx, reading, now, target);
  }

  private async onImage(ctx: Context, messageId: string): Promise<void> {
    const active = this.hydrate(await this.deps.store.getActiveRequest(ctx.convKey, this.now()));
    // Only images sent as an answer to "send the wait", or sent in 1:1, are read (spec §9: no group-wide reading).
    const candidateId = !active ? null : active.pendingQuestion === "wait" ? active.pendingWaitCandidateId : ctx.kind === "user" ? active.selectedCandidateId : null;
    if (!candidateId) {
      if (ctx.kind === "user") await this.shopFromPhoto(ctx, messageId, active);
      return;
    }
    if (!active) return;
    if (ctx.kind === "user") await this.deps.line.showLoading?.(ctx.target, 10);
    const text = this.deps.readImage ? await this.deps.readImage(messageId).catch(() => null) : null;
    if (!text || !readWait(text)) {
      await this.reply(ctx, [m.imageNotSupported(active.lang)]);
      return;
    }
    const other = otherCandidateNamed(active, candidateId, text);
    if (other) {
      await this.reply(ctx, [m.imageOtherShop(active.lang, findRestaurant(candidateId)!, other)]);
      return;
    }
    const fresh = await this.deps.store.getRequest(active.id);
    if (fresh) await this.recordWait(fresh, candidateId, text, ctx, "user_image");
  }

  /** A photo sent in 1:1 outside a wait question: the sign or page of a shop the user wants to try. */
  private async shopFromPhoto(ctx: Context, messageId: string, active: DiningRequest | null): Promise<void> {
    const lang = active?.lang ?? "ja";
    if (!this.deps.readImage || !ctx.userId) {
      await this.reply(ctx, [active ? m.askWaitFirst(lang) : m.greeting(lang, "user")]);
      return;
    }
    await this.deps.line.showLoading?.(ctx.target, 10);
    const text = await this.deps.readImage(messageId).catch(() => null);
    const restaurant = text ? findShopByName(text) : null;
    if (!restaurant) {
      await this.reply(ctx, [active ? m.askWaitFirst(lang) : m.photoNotPlace(lang)]);
      return;
    }
    const now = this.now();
    if (active) await this.deps.store.save({ ...this.bump(active, now), status: "closed" as const }, active.revision);
    this.log("request.target", { via: "image" });
    await this.startRequest(ctx, { ...interpret(""), lang }, now, { candidateId: restaurant.id, via: "image" });
  }

  private async startRequest(ctx: Context, reading: Interpretation, now: string, target: Target | null = null, callWhenReady = false): Promise<void> {
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
      target,
      callWhenReady,
      createdAt: now,
      updatedAt: now,
      expiresAt: addMinutes(now, REQUEST_TTL_MINUTES),
    };
    const shop = target ? findRestaurant(target.candidateId) : undefined;
    if (shop) {
      // The shop fixes where and what; the text still gives the party and the next plan.
      request.areaId = shop.areaId;
      request.menuKey = shop.menus[0];
      request.menuLabel = menuNames[shop.menus[0]][request.lang];
    }
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
    const shop = next.target ? findRestaurant(next.target.candidateId) : undefined;
    if (question && shop && next.target && expectedRevision === null) notices.push(m.targetRecognized(next, shop, next.target.via));
    if (question) {
      next.status = "collecting";
      if (!(await this.deps.store.save(next, expectedRevision))) return this.reply(ctx, [m.staleCard(next.lang)]);
      return this.reply(ctx, [...notices, question]);
    }
    next.pendingQuestion = null;
    if (ctx.kind === "user") await this.deps.line.showLoading?.(ctx.target, 10);
    next.candidates = await this.searchCandidates(next, now);
    next.status = "comparing";
    const callNow = next.callWhenReady === true;
    next.callWhenReady = false;
    if (!(await this.deps.store.save(next, expectedRevision))) return this.reply(ctx, [m.staleCard(next.lang)]);
    const intro = shop && next.target ? [m.todayIntro(next, shop, next.target.via, expectedRevision !== null)] : [];
    const view = [...notices, ...intro, ...this.overview(next, now)];
    // Asked for a call in words: go on to the booking name or approval card in the same reply.
    const targetPlan = shop ? this.planFor(next, shop.id, now) : null;
    const ruledOut = shop && targetPlan ? judgeToday(next, shop, targetPlan, now).verdict === "hard" : false;
    if (callNow && !ruledOut) return this.requestCalls(next, ctx, now, view);
    await this.reply(ctx, view);
  }

  private async searchCandidates(request: DiningRequest, now: string): Promise<CandidateState[]> {
    const area = findArea(request.areaId!)!;
    // Shops whose confirmed capacity is below the party are left out (spec §2 인원).
    const found = listRestaurants(area.id, request.menuKey ?? "any").filter((restaurant) => restaurant.maxParty === null || restaurant.maxParty >= (request.partySize ?? 1));
    if (found.length < MAX_CARDS && this.deps.searchPlaces) {
      const menu = request.menuKey ?? "any";
      const query = `${area.nameKo} ${menu === "any" ? "맛집" : menuNames[menu].ko}`;
      const hits = await this.deps.searchPlaces(query).catch(() => []);
      for (const hit of hits) {
        if (found.length >= MAX_CARDS * 2) break;
        const candidate = searchCandidate(hit, area.id, menu, seoulDate(now));
        if (!found.some((r) => r.id === candidate.id || r.nameKo === candidate.nameKo)) {
          registerSearchRestaurant(candidate);
          found.push(candidate);
        }
      }
    }
    const states = await Promise.all(
      found.map(async (restaurant): Promise<CandidateState> => ({
        restaurantId: restaurant.id,
        ...(restaurant.searchOnly ? { snapshot: restaurant } : {}),
        rank: 0,
        toRestaurant: await this.deps.travel.leg(area.point, restaurant.point, now),
        toNext: request.nextPlace ? await this.deps.travel.leg(restaurant.point, request.nextPlace.point, now) : null,
      })),
    );
    const ranked = rankPlans(states.map((state) => computePlan(request, state, now)), states).map((plan) => plan.candidateId);
    // The shop the user pointed at comes first; the best others follow as alternatives.
    const targetId = request.target?.candidateId;
    const order = targetId && ranked.includes(targetId) ? [targetId, ...ranked.filter((id) => id !== targetId)] : ranked;
    return order.slice(0, MAX_CARDS).map((id, index) => ({ ...states.find((s) => s.restaurantId === id)!, rank: index + 1 }));
  }

  /** Whether the agent may call this shop (calls on, a phone key, the key allowed). */
  private callable(restaurant: Restaurant | undefined): boolean {
    return this.deps.calls !== null && !!restaurant?.phoneRef && this.deps.phoneAllowed(restaurant.phoneRef);
  }

  /** Candidates whose published hours rule out a seat today are never called. */
  private openForCall(request: DiningRequest, plan: CandidatePlan, now: string): boolean {
    const restaurant = findRestaurant(plan.candidateId);
    if (!restaurant) return false;
    const hours = judgeToday(request, restaurant, plan, now).hours.state;
    return hours !== "closed_today" && hours !== "outside";
  }

  /** The answer for the shop the user pointed at, or the candidate list. */
  private overview(request: DiningRequest, now: string, intro?: string): LineMessage[] {
    const shop = request.target ? findRestaurant(request.target.candidateId) : undefined;
    const plan = shop ? this.planFor(request, shop.id, now) : null;
    if (!shop || !plan) return this.candidateView(request, now, intro);
    const others = this.plans(request, now).filter((p) => p.candidateId !== shop.id && p.verdict !== "late" && this.openForCall(request, p, now) && this.callable(findRestaurant(p.candidateId)));
    const answer = m.todayAnswer(request, shop, judgeToday(request, shop, plan, now), plan, { callingEnabled: this.callable(shop), canCallOthers: others.length > 0, origin: this.deps.origin, intro });
    return intro ? [{ type: "text", text: intro }, answer] : [answer];
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
    return m.candidatesMessages(request, plans, findRestaurant, { callingEnabled: this.deps.calls !== null, intro, now, origin: this.deps.origin });
  }

  private async answerPending(request: DiningRequest, text: string, ctx: Context, quietIfUnclear = false): Promise<boolean> {
    const now = this.now();
    switch (request.pendingQuestion) {
      case "party": {
        const reading = interpret(text);
        let size = parsePartySize(text);
        if ((size === null || size < 1 || size > 30) && !quietIfUnclear && !(reading.wantsFood && filledFields(reading) >= 2)) {
          size = (await this.understand(text, request.lang))?.reading.partySize ?? null; // "カップルで" → 2
        }
        if (size === null || size < 1 || size > 30) {
          if (quietIfUnclear || (reading.wantsFood && filledFields(reading) >= 2)) return false;
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
        let mention: { area: { id: string } } | undefined = mentions.find((hit) => hit.area.diningArea);
        if (!mention && !quietIfUnclear && mentions.length === 0) {
          const areaId = (await this.understand(text, request.lang))?.reading.currentAreaId;
          if (areaId && findArea(areaId)?.diningArea) mention = { area: { id: areaId } };
        }
        if (!mention) {
          if (quietIfUnclear && mentions.length === 0) return false;
          await this.reply(ctx, [m.askArea(request, mentions[0]?.area)]);
          return true;
        }
        const next = structuredClone(request);
        next.areaId = mention.area.id;
        await this.advance(next, request.revision, ctx, this.merge(next, interpret(text), now));
        return true;
      }
      case "menu": {
        const menu = findMenu(normalizeText(text)) ?? (quietIfUnclear ? null : ((await this.understand(text, request.lang))?.reading.menu ?? null));
        if (!menu) {
          if (quietIfUnclear) return false;
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
          if (quietIfUnclear) return false;
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
    // Refuse anything that looks like a phone number, is empty, or is a request ("電話して").
    if (!alias || /\d{4,}/.test(alias.replace(/[-\s]/g, "")) || wantsCall(text)) {
      await this.reply(ctx, [m.askAlias(request.lang)]);
      return;
    }
    await this.deps.store.setAlias(request.requesterKey, alias);
    const next = this.bump(request, this.now());
    next.pendingQuestion = null;
    await this.propose(next, request.revision, ctx, alias);
  }

  private async recordWait(request: DiningRequest, candidateId: string, text: string, ctx: Context, source: "user_text" | "user_image" = "user_text"): Promise<void> {
    const now = this.now();
    const reading = readWait(text)!;
    const restaurant = findRestaurant(candidateId);
    if (!restaurant) return;
    const next = this.bump(request, now);
    const readyAt = reading.readyAt ? seoulInstant(seoulDate(now), reading.readyAt.hour, reading.readyAt.minute) : null;
    next.waits.push({ candidateId, minutes: reading.minutes, teams: reading.teams, readyAt, basis: reading.basis, observedAt: now, reportedAt: now, reportedBy: ctx.requesterKey ?? "unknown", source });
    next.pendingQuestion = null;
    next.pendingWaitCandidateId = null;
    if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(next.lang)]);
    if (reading.basis === "unknown" && reading.minutes && !readyAt) {
      await this.reply(ctx, [m.askWaitBasis(next, restaurant, reading.minutes)]);
      return;
    }
    const plan = this.planFor(next, candidateId, now)!;
    await this.reply(ctx, [...this.overview(next, now, m.waitRecorded(next.lang, restaurant, plan)), ...this.waitIdea(next, plan)]);
  }

  /** A nearby mission while a remote wait runs, only when it still fits the schedule. */
  private waitIdea(request: DiningRequest, plan: CandidatePlan): LineMessage[] {
    const wait = plan.wait;
    const restaurant = findRestaurant(plan.candidateId);
    const path = restaurant ? stationAdventurePath(restaurant.areaId) : null;
    if (!wait || !restaurant || !path || wait.basis !== "remote_from_observed" || (wait.minutes ?? 0) < 30 || plan.verdict === "late") return [];
    return [m.waitTimeIdea(request, restaurant, wait.minutes!, this.deps.origin, path)];
  }

  // ── Postbacks ─────────────────────────────────────────────────────────────

  private async onPostback(ctx: Context, data: string): Promise<void> {
    const postback = decodePostback(data);
    if (!postback) return;
    const now = this.now();
    const request = this.hydrate(await this.deps.store.getRequest(postback.requestId));
    if (!request || request.conversationKey !== ctx.convKey) return;
    const lang = request.lang;
    if (!isActive(request, now)) {
      await this.reply(ctx, [m.staleCard(lang)]);
      return;
    }
    if (postback.revision !== request.revision) {
      await this.reply(ctx, [m.staleCard(lang), ...(request.status === "comparing" ? this.overview(request, now) : [])]);
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
      case "alternatives": {
        const shop = request.target ? findRestaurant(request.target.candidateId) : undefined;
        await this.reply(ctx, this.candidateView(request, now, shop ? m.alternativesIntro(lang, shop) : undefined));
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
        await this.reply(ctx, [...this.overview(next, now, m.waitRecorded(lang, restaurant, plan)), ...this.waitIdea(next, plan)]);
        return;
      }
      case "call_request":
      case "decision_retry":
        await this.requestCalls(request, ctx, now);
        return;
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
        await this.reply(ctx, [{ type: "text", text: say(lang, "電話はやめました。", "전화는 그만뒀어요.") }]);
        return;
      }
      case "decision_accept": {
        // The requester accepts the time the shop offered: a new approval for that shop only,
        // and the call starts by checking the table again (spec §5).
        const decision = request.decision;
        const restaurant = decision ? findRestaurant(decision.candidateId) : undefined;
        if (request.status !== "needs_decision" || !decision?.offeredTime || !restaurant || postback.candidateId !== restaurant.id || !this.deps.calls) {
          return this.reply(ctx, [m.staleCard(lang)]);
        }
        const alias = (await this.deps.store.getAlias(request.requesterKey)) ?? request.approvals.at(-1)?.alias;
        if (!alias) return this.reply(ctx, [m.staleCard(lang)]);
        const next = this.bump(request, now);
        next.proposal = {
          candidateIds: [restaurant.id],
          partySize: next.partySize!,
          windowStart: decision.offeredTime,
          windowEnd: addMinutes(decision.offeredTime, 15),
          alias,
          expiresAt: addMinutes(now, APPROVAL_TTL_MINUTES),
        };
        next.decision = null;
        next.status = "awaiting_approval";
        if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
        return this.reply(ctx, [m.approvalCard(next, next.proposal, findRestaurant)]);
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
          test: restaurant.test || restaurant.testCall === true,
        };
        if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
        const token = this.deps.linkSecret
          ? makeCardToken({ restaurantId: restaurant.id, partySize: approval.partySize, time: next.reservation.time, alias: approval.alias, test: next.reservation.test, expiresAt: addMinutes(next.reservation.time, 6 * 60) }, this.deps.linkSecret)
          : null;
        return this.reply(ctx, [m.confirmedCard(next, next.reservation, restaurant, { origin: this.deps.origin, cardToken: token })]);
      }
      case "new_search": {
        const next = structuredClone(request);
        next.proposal = null;
        next.decision = null;
        next.target = null;
        await this.advance(next, request.revision, ctx);
        return;
      }
    }
  }

  // ── Calls ─────────────────────────────────────────────────────────────────

  /** The call buttons (and "電話して"): ask the booking name once, then show the approval card. */
  private async requestCalls(request: DiningRequest, ctx: Context, now: string, prefix: LineMessage[] = []): Promise<void> {
    const lang = request.lang;
    if (!this.deps.calls) return this.reply(ctx, [...prefix, m.callingDisabled(lang)]);
    const alias = await this.deps.store.getAlias(request.requesterKey);
    if (!alias) {
      const next = this.bump(request, now);
      next.pendingQuestion = "alias";
      if (!(await this.deps.store.save(next, request.revision))) return this.reply(ctx, [m.staleCard(lang)]);
      if (ctx.kind !== "user") {
        try {
          await this.deps.line.push(request.requesterTarget, [m.askAlias(lang)]);
          await this.reply(ctx, [...prefix, { type: "text", text: say(lang, "予約名は個別トークでお聞きします。", "예약자 이름은 1:1 대화에서 여쭤볼게요.") }]);
          return;
        } catch {
          // Not a friend of the account yet: ask here instead.
        }
      }
      await this.reply(ctx, [...prefix, m.askAlias(lang)]);
      return;
    }
    await this.propose(this.bump(request, now), request.revision, ctx, alias, prefix);
  }

  /** "電話して" / "전화해 줘", optionally with a shop name: same as the call button, that shop first. */
  private async callFromText(ctx: Context, text: string, active: DiningRequest | null, reading: Interpretation, shopHint: Restaurant | null = null): Promise<void> {
    const now = this.now();
    const shop = shopHint ?? findShopByName(text);
    if (!active) {
      if (!shop || !ctx.userId) return this.reply(ctx, [m.askWhichShop(reading.lang)]);
      return this.startRequest(ctx, reading, now, { candidateId: shop.id, via: "name" }, true);
    }
    if (ctx.requesterKey !== active.requesterKey) return this.reply(ctx, [m.onlyRequester(active.lang)]);
    if (shop && !active.candidates.some((c) => c.restaurantId === shop.id)) {
      // A shop outside this search: start over for that shop.
      if (!ctx.userId) return this.reply(ctx, [m.askWhichShop(active.lang)]);
      await this.deps.store.save({ ...this.bump(active, now), status: "closed" as const }, active.revision);
      return this.startRequest(ctx, { ...reading, lang: active.lang }, now, { candidateId: shop.id, via: "name" }, true);
    }
    const next = structuredClone(active);
    if (shop) {
      // Call the named shop first.
      next.target = { candidateId: shop.id, via: "name" };
      for (const candidate of next.candidates) if (candidate.restaurantId === shop.id) candidate.rank = 0;
    }
    if (next.status === "collecting" || next.candidates.length === 0) {
      next.callWhenReady = true;
      return this.advance(next, active.revision, ctx);
    }
    if (shop) {
      const saved = this.bump(next, now);
      if (!(await this.deps.store.save(saved, active.revision))) return this.reply(ctx, [m.staleCard(active.lang)]);
      return this.requestCalls(saved, ctx, now);
    }
    return this.requestCalls(active, ctx, now);
  }

  private async propose(next: DiningRequest, expectedRevision: number, ctx: Context, alias: string, prefix: LineMessage[] = []): Promise<void> {
    const now = this.now();
    const lang = next.lang;
    const attempted = new Set(next.attempts.map((attempt) => attempt.candidateId));
    const plans = this.plans(next, now)
      .filter((plan) => plan.verdict !== "late" && !attempted.has(plan.candidateId) && this.openForCall(next, plan, now))
      .filter((plan) => {
        const ref = findRestaurant(plan.candidateId)?.phoneRef;
        return ref !== null && ref !== undefined && this.deps.phoneAllowed(ref);
      })
      .sort((a, b) => rankOf(next, a.candidateId) - rankOf(next, b.candidateId))
      .slice(0, MAX_CALL_CANDIDATES);
    if (plans.length === 0) {
      await this.deps.store.save(next, expectedRevision);
      await this.replyOrPush(ctx, next, [...prefix, m.noCallableCandidates(lang)]);
      return;
    }
    const starts = plans.map((plan) => plan.arriveRestaurantAt ?? addMinutes(now, 15));
    const ends = plans.map((plan) => plan.seatDeadline).filter((value): value is string => value !== null);
    const latestArrival = starts.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
    const earliestEnd = ends.length ? ends.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b)) : null;
    // Ask for a table close to the deadline, not hours early (e.g. asked in the morning for dinner).
    const windowStart = ceilToMinutes(earliestEnd ? laterOf(latestArrival, addMinutes(earliestEnd, -CALL_WINDOW_MINUTES)) : latestArrival, 5);
    // Spoken on the call, so keep both ends on 5-minute marks ("6시 40분", not "6시 44분").
    const minEnd = earliestEnd ? floorToMinutes(earliestEnd, 5) : addMinutes(windowStart, 60);
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
    await this.replyOrPush(ctx, next, [...prefix, m.approvalCard(next, next.proposal, findRestaurant)]);
  }

  /** The earliest time a called shop offered outside the window (not a deposit), still ahead of now. */
  private bestOffer(request: DiningRequest, approvalId: string, now: string): { restaurant: Restaurant; offeredTime: string; lateMinutes: number | null } | null {
    const offers = request.attempts
      .filter((a) => a.approvalId === approvalId && a.outcome?.kind === "alternate_offered" && !a.outcome.depositRequired && a.outcome.offeredTime && Date.parse(a.outcome.offeredTime) > Date.parse(now))
      .sort((a, b) => Date.parse(a.outcome!.offeredTime!) - Date.parse(b.outcome!.offeredTime!));
    const first = offers[0];
    const restaurant = first ? findRestaurant(first.candidateId) : undefined;
    if (!first || !restaurant) return null;
    const offeredTime = first.outcome!.offeredTime!;
    const deadline = this.planFor(request, restaurant.id, now)?.seatDeadline ?? null;
    return { restaurant, offeredTime, lateMinutes: deadline ? Math.round((Date.parse(offeredTime) - Date.parse(deadline)) / 60_000) : null };
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
        // None fit: come back with the closest option a shop offered, if any (one tap to book it).
        const best = this.bestOffer(next, approvalId, now);
        if (best) {
          next.status = "needs_decision";
          next.decision = { reason: "out_of_range", candidateId: best.restaurant.id, offeredTime: best.offeredTime };
        } else {
          next.status = "comparing";
        }
        if (!(await this.deps.store.save(next, request.revision))) continue;
        const called = approval.candidateIds.length;
        await this.push(next, [best ? m.bestAlternative(next, best.restaurant, best.offeredTime, called, best.lateMinutes) : m.callsExhausted(next)]);
        return;
      }
      const restaurant = findRestaurant(candidateId)!;
      const attempt: CallAttempt = { id: this.deps.newId(), approvalId, candidateId, ordinal: request.attempts.filter((a) => a.candidateId === candidateId).length + 1, status: "placing", providerCallId: null, outcome: null, startedAt: now, finishedAt: null };
      const next = this.bump(request, now);
      next.attempts.push(attempt);
      if (!(await this.deps.store.save(next, request.revision))) continue;
      const index = approval.candidateIds.indexOf(candidateId) + 1;
      await this.push(next, [m.calling(next.lang, restaurant, index, approval.candidateIds.length)]);
      try {
        const brief = { restaurantNameKo: restaurant.nameKo, partySize: approval.partySize, windowStart: approval.windowStart, windowEnd: approval.windowEnd, alias: approval.alias, test: restaurant.test || restaurant.testCall === true };
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
    return buildCallInstructions({ restaurantNameKo: restaurant.nameKo, partySize: approval.partySize, windowStart: approval.windowStart, windowEnd: approval.windowEnd, alias: approval.alias, test: restaurant.test || restaurant.testCall === true });
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

  /** Makes saved search candidates findable again (e.g. after a restart with the DB store). */
  private hydrate<T extends DiningRequest | null>(request: T): T {
    for (const candidate of request?.candidates ?? []) if (candidate.snapshot) registerSearchRestaurant(candidate.snapshot);
    return request;
  }

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

/** A shop other than the expected one whose name appears in the image text (spec WAIT-01). */
function otherCandidateNamed(request: DiningRequest, candidateId: string, text: string): Restaurant | null {
  const core = (name: string) => name.replace(/[（(].*$/, "").replace(/\s+/g, "");
  const flat = text.replace(/\s+/g, "");
  for (const candidate of request.candidates) {
    if (candidate.restaurantId === candidateId) continue;
    const restaurant = findRestaurant(candidate.restaurantId);
    if (restaurant && [restaurant.nameJa, restaurant.nameKo].some((name) => core(name).length >= 2 && flat.includes(core(name)))) {
      const expected = findRestaurant(candidateId);
      if (expected && [expected.nameJa, expected.nameKo].some((name) => flat.includes(core(name)))) return null;
      return restaurant;
    }
  }
  return null;
}

/** The shop's most telling line: the last one that says something about the booking. */
function lastShopWords(transcript: readonly { speaker: "ai" | "shop"; text: string }[]): string | null {
  const lines = transcript.filter((turn) => turn.speaker === "shop").map((turn) => turn.text.trim()).filter((text) => text.length > 1);
  // The line naming a time says the most ("11시 반에 두 분 가능해요"), more than a later "네, 맞아요".
  const telling =
    [...lines].reverse().find((text) => findClockTimes(text).length > 0) ??
    [...lines].reverse().find((text) => /돼|되|안|어렵|만석|가능|예약|맞/.test(text) && !/^네[.,!]?$/.test(text)) ??
    lines.at(-1);
  if (!telling) return null;
  return telling.length > 80 ? `${telling.slice(0, 79)}…` : telling;
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

