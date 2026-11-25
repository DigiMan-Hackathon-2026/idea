// Domain types for the LINE dining agent. Times are ISO-8601 strings in UTC;
// they are shown in Asia/Seoul. See docs/LINE_AGENT_SPEC.md §4–§8.

export type Lang = "ja" | "ko";
export type ConversationKind = "user" | "group" | "room";

export type Point = { lat: number; lng: number };

export type Place = {
  id: string;
  nameJa: string;
  nameKo: string;
  point: Point;
  /** Subway station code (여기서울 network) nearest to the place, if known. */
  stationCode: string | null;
  /** True when the point stands for an area, not a specific venue. */
  approximate: boolean;
};

export type MenuKey =
  | "samgyeopsal"
  | "korean_bbq"
  | "dakgalbi"
  | "chicken"
  | "gukbap"
  | "tteokbokki"
  | "naengmyeon"
  | "bibimbap"
  | "samgyetang"
  | "any";

export type BookingLink = {
  provider: "catchtable" | "tabling" | "naver" | "official";
  url: string;
  checkedAt: string;
};

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** One opening span in Seoul time. A close earlier than the open is after midnight. */
export type OpeningSpan = { open: string; close: string; lastOrder?: string };

export type OpeningHours = {
  /** Spans per weekday; an empty list is a closed day. */
  weekly: Record<Weekday, OpeningSpan[]>;
  source: { label: string; url: string; checkedAt: string };
};

export type Restaurant = {
  id: string;
  areaId: string;
  nameJa: string;
  nameKo: string;
  point: Point;
  addressKo: string;
  menus: MenuKey[];
  /** Largest party the source confirms; null when unknown. */
  maxParty: number | null;
  soloEntry: boolean | null;
  singlePortion: boolean | null;
  bookingLinks: BookingLink[];
  /** Key into the server-side phone allowlist. Never a phone number. */
  phoneRef: string | null;
  source: { label: string; url: string | null; checkedAt: string };
  /** Test entries are labelled as such on every card and result. */
  test: boolean;
  /** A real shop whose demo calls go to a teammate: calls and bookings are marked as tests. */
  testCall?: boolean;
  /** Found by NAVER local search, not curated: shown as unverified and never called. */
  searchOnly?: boolean;
  /** Opening hours from a public page; null or missing = unknown (checked by phone). */
  hours?: OpeningHours | null;
  /** NAVER Place id, so a shared NAVER Map link finds the shop. */
  naverPlaceId?: string | null;
  /** Other names people write or see on the sign (shorter Korean name, katakana). */
  aliases?: string[];
};

export type TravelLeg = {
  minutes: number;
  mode: "walk" | "transit";
  provider: "tmap" | "estimate";
  fetchedAt: string;
};

export type CandidateState = {
  restaurantId: string;
  /** Saved copy of a search candidate (curated shops are looked up by id). */
  snapshot?: Restaurant;
  rank: number;
  toRestaurant: TravelLeg | null;
  toNext: TravelLeg | null;
};

export type WaitBasis = "on_arrival" | "remote_from_observed" | "unknown";

export type WaitObservation = {
  candidateId: string;
  minutes: number | null;
  teams: number | null;
  /** Time the source says you can be seated, if it gives one. */
  readyAt: string | null;
  basis: WaitBasis;
  observedAt: string | null;
  reportedAt: string;
  reportedBy: string;
  /** shop_call: what the shop said on our call. */
  source: "user_text" | "user_image" | "shop_call";
};

export type CallApproval = {
  id: string;
  revision: number;
  approvedBy: string;
  candidateIds: string[];
  partySize: number;
  windowStart: string;
  windowEnd: string;
  alias: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

/** walk_in: the shop takes no bookings; come and queue (with the wait it gave, if any). */
export type CallOutcomeKind = "no_answer" | "declined" | "alternate_offered" | "confirmed" | "walk_in" | "unknown";

export type CallOutcome = {
  kind: CallOutcomeKind;
  offeredTime: string | null;
  confirmedTime: string | null;
  partySize: number | null;
  depositRequired: boolean;
  /** True once the agent asked the shop to book; an unclear end then needs checking. */
  bookingRequested: boolean;
  /** walk_in: the wait the shop gave on the phone. */
  waitMinutes?: number | null;
  waitTeams?: number | null;
  summaryKo: string;
};

export type CallAttempt = {
  id: string;
  approvalId: string;
  candidateId: string;
  ordinal: number;
  status: "placing" | "in_progress" | "finished" | "failed_to_place";
  providerCallId: string | null;
  outcome: CallOutcome | null;
  startedAt: string;
  finishedAt: string | null;
};

export type Reservation = {
  candidateId: string;
  partySize: number;
  time: string;
  alias: string;
  /** call_accept: the shop said yes on the call; user_confirmed: the requester checked with the shop. */
  evidence: "call_accept" | "user_confirmed";
  acceptedAt: string;
  test: boolean;
};

export type CallProposal = {
  candidateIds: string[];
  partySize: number;
  windowStart: string;
  windowEnd: string;
  alias: string;
  expiresAt: string;
};

export type RequestStatus =
  | "collecting"
  | "comparing"
  | "awaiting_approval"
  | "calling"
  | "needs_decision"
  | "needs_verification"
  | "confirmed"
  | "closed";

export type PendingQuestion = "party" | "area" | "menu" | "alias" | "wait" | null;

export type Decision = {
  reason: "out_of_range" | "deposit";
  candidateId: string;
  offeredTime: string | null;
};

export type DiningRequest = {
  id: string;
  /** Keyed (HMAC) conversation id; raw LINE ids are kept only in `replyTarget`. */
  conversationKey: string;
  conversationKind: ConversationKind;
  /** Raw LINE user/group/room id used to push results to this conversation. */
  replyTarget: string;
  requesterKey: string;
  /** Raw LINE user id of the requester, for 1:1 questions. */
  requesterTarget: string;
  lang: Lang;
  status: RequestStatus;
  revision: number;
  partySize: number | null;
  menuKey: MenuKey | null;
  menuLabel: string | null;
  areaId: string | null;
  nextPlace: Place | null;
  arriveBy: string | null;
  mealMinutes: number;
  bufferMinutes: number;
  pendingQuestion: PendingQuestion;
  pendingWaitCandidateId: string | null;
  candidates: CandidateState[];
  selectedCandidateId: string | null;
  waits: WaitObservation[];
  approvals: CallApproval[];
  attempts: CallAttempt[];
  reservation: Reservation | null;
  decision: Decision | null;
  /** Call conditions shown on the approval card, waiting for the requester's tap. */
  proposal: CallProposal | null;
  /** The one shop the user pointed at (link, name or sign photo); the other candidates are alternatives. */
  target?: { candidateId: string; via: "link" | "name" | "image" } | null;
  /** The user asked (in words) for a call before everything was known: ask for calls once it is. */
  callWhenReady?: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};
