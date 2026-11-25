// LINE messages in Japanese (default) and Korean with the same facts and the
// same recovery actions in both (spec §3, AGENTS.md UX rules). Each message
// leads with one main action.
import { cardUrl, goUrl, placeRef } from "./links";
import type { FlexBox, FlexBubble, FlexComponent, FlexImage, LineAction, LineMessage, QuickReply } from "./line/types";
import type { CandidatePlan } from "./plan";
import { findArea, menuNames } from "./places";
import { encodePostback, type PostbackAction } from "./postback";
import { formatSeoulTime } from "./time";
import type { TodayCheck } from "./today";
import type { CallProposal, DiningRequest, Lang, Place, Reservation, Restaurant, WaitObservation } from "./types";

export const BOT_NAME = { ja: "ココソウル", ko: "코코서울" };

const color = {
  primary: "#455f54",
  warning: "#941e34",
  text: "#504e49",
  muted: "#7a776f",
  info: "#6789ca",
  time: "#bc6f25",
};

const tr = (lang: Lang, ja: string, ko: string) => (lang === "ja" ? ja : ko);
/** "90分", "2時間", "15時間30分" — long waits read as hours. */
const duration = (lang: Lang, minutes: number) => {
  if (minutes < 60) return tr(lang, `${minutes}分`, `${minutes}분`);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? tr(lang, `${hours}時間${rest}分`, `${hours}시간 ${rest}분`) : tr(lang, `${hours}時間`, `${hours}시간`);
};

function name(lang: Lang, item: { nameJa: string; nameKo: string }): string {
  return lang === "ja" ? item.nameJa : item.nameKo;
}

function postback(request: Pick<DiningRequest, "id" | "revision">, action: PostbackAction, label: string, extra: { candidateId?: string; value?: string; displayText?: string } = {}): LineAction {
  return {
    type: "postback",
    label,
    data: encodePostback({ action, requestId: request.id, revision: request.revision, candidateId: extra.candidateId ?? null, value: extra.value ?? null }),
    ...(extra.displayText ? { displayText: extra.displayText } : {}),
  };
}

function quickReply(actions: LineAction[]): QuickReply {
  return { items: actions.slice(0, 13).map((action) => ({ type: "action", action })) };
}

const HERO_VERSION = "1";

/** Station image on top of a card (public/line-agent/hero). LINE only loads HTTPS images. */
export function heroImage(origin: string | undefined, areaId: string): FlexImage | undefined {
  const code = findArea(areaId)?.stationCode;
  if (!origin?.startsWith("https://") || !code) return undefined;
  return { type: "image", url: new URL(`/line-agent/hero/${code}.png?v=${HERO_VERSION}`, origin).toString(), size: "full", aspectRatio: "20:9", aspectMode: "cover" };
}

const text = (value: string, options: Partial<Omit<Extract<FlexComponent, { type: "text" }>, "type" | "text">> = {}): FlexComponent => ({ type: "text", text: value, wrap: true, size: "sm", color: color.text, ...options });
const vbox = (contents: FlexComponent[], extra: Partial<FlexBox> = {}): FlexBox => ({ type: "box", layout: "vertical", spacing: "sm", contents, ...extra });

// ── Questions ────────────────────────────────────────────────────────────────

export function askPartySize(request: DiningRequest): LineMessage {
  const lang = request.lang;
  return {
    type: "text",
    text: tr(lang, "今回、お食事は何名ですか？", "이번 식사는 몇 명이세요?"),
    quickReply: quickReply([1, 2, 3, 4, 5, 6].map((n) => postback(request, "party", tr(lang, `${n}名`, `${n}명`), { value: String(n), displayText: tr(lang, `${n}名`, `${n}명`) }))),
  };
}

export function askArea(request: DiningRequest, unsupported?: { nameJa: string; nameKo: string }): LineMessage {
  const lang = request.lang;
  const options = ["shinchon", "seongsu"].map((id) => findArea(id)!);
  const note = unsupported
    ? tr(lang, `${unsupported.nameJa}のお店はまだ準備中です。新村か聖水なら探せます。`, `${unsupported.nameKo} 가게는 아직 준비 중이에요. 신촌이나 성수라면 찾을 수 있어요.`)
    : tr(lang, "どのあたりで食べますか？いまいる駅や地域を送ってください。", "어디쯤에서 드실 건가요? 지금 계신 역이나 동네를 보내 주세요.");
  return {
    type: "text",
    text: note,
    quickReply: quickReply(options.map((area) => postback(request, "area", name(lang, area), { value: area.id, displayText: name(lang, area) }))),
  };
}

export function askMenu(request: DiningRequest): LineMessage {
  const lang = request.lang;
  const keys = ["samgyeopsal", "korean_bbq", "dakgalbi", "any"] as const;
  return {
    type: "text",
    text: tr(lang, "何を食べたいですか？", "어떤 음식을 드시고 싶으세요?"),
    quickReply: quickReply(keys.map((key) => postback(request, "menu", menuNames[key][lang], { value: key, displayText: menuNames[key][lang] }))),
  };
}

export function askAlias(lang: Lang): LineMessage {
  return {
    type: "text",
    text: tr(lang, "お店に伝える予約名を送ってください（ニックネームでも大丈夫です）。", "가게에 전할 예약자 이름을 보내 주세요 (닉네임도 괜찮아요)."),
  };
}

export function askWait(request: DiningRequest, restaurant: Restaurant): LineMessage {
  const lang = request.lang;
  return {
    type: "text",
    text: tr(
      lang,
      `${restaurant.nameJa}の待ち状況を送ってください。例：「40分待ち」「前に8組」「順番待ち登録済み、あと30分」`,
      `${restaurant.nameKo}의 대기 상황을 보내 주세요. 예: "대기 40분", "앞에 8팀", "원격 줄서기 했고 30분 남음"`,
    ),
  };
}

export function askWaitBasis(request: DiningRequest, restaurant: Restaurant, minutes: number): LineMessage {
  const lang = request.lang;
  return {
    type: "text",
    text: tr(lang, `${restaurant.nameJa}の「${duration(lang, minutes)}」は、着いてから並ぶ時間ですか？それとも順番待ち登録済みの残り時間ですか？`, `${restaurant.nameKo}의 "${duration(lang, minutes)}"은 도착해서 줄 설 시간인가요, 이미 원격 줄서기를 한 뒤 남은 시간인가요?`),
    quickReply: quickReply([
      postback(request, "wait_on_arrival", tr(lang, "着いてから並ぶ", "도착해서 줄 서기"), { candidateId: restaurant.id, displayText: tr(lang, "着いてから並ぶ", "도착해서 줄 서기") }),
      postback(request, "wait_remote", tr(lang, "もう順番待ち登録済み", "이미 원격 줄서기 함"), { candidateId: restaurant.id, displayText: tr(lang, "もう順番待ち登録済み", "이미 원격 줄서기 함") }),
    ]),
  };
}

export function waitNotUnderstood(lang: Lang): LineMessage {
  return {
    type: "text",
    text: tr(lang, "待ち時間か待ち組数を読み取れませんでした。「40分」や「前に8組」のように送ってください。", "대기 시간이나 대기 팀 수를 읽지 못했어요. \"40분\"이나 \"앞에 8팀\"처럼 보내 주세요."),
  };
}

export function imageNotSupported(lang: Lang): LineMessage {
  return {
    type: "text",
    text: tr(lang, "画像から待ち時間を読み取れませんでした。「40分」や「前に8組」のように文字で送ってください。", "이미지에서 대기 시간을 읽지 못했어요. \"40분\"이나 \"앞에 8팀\"처럼 글자로 보내 주세요."),
  };
}

export function imageOtherShop(lang: Lang, expected: Restaurant, other: Restaurant): LineMessage {
  return {
    type: "text",
    text: tr(lang, `この画像は${other.nameJa}の画面のようです。${expected.nameJa}の待ち状況なら、その画面か「40分」のような文字を送ってください。`, `이 이미지는 ${other.nameKo} 화면 같아요. ${expected.nameKo}의 대기 상황이라면 그 화면이나 "40분" 같은 글자를 보내 주세요.`),
  };
}

export function askWaitFirst(lang: Lang): LineMessage {
  return {
    type: "text",
    text: tr(lang, "待ち状況の画像は、お店のカードの「待ち状況を送る」を押してから送ってください。", "대기 화면 이미지는 가게 카드의 \"대기 상황 보내기\"를 누른 뒤 보내 주세요."),
  };
}

// ── Candidates ───────────────────────────────────────────────────────────────

function waitLine(lang: Lang, wait: WaitObservation | null): string {
  if (!wait) return tr(lang, "待ち状況：未確認", "대기 상황: 확인 안 됨");
  const when = wait.source === "user_image" ? tr(lang, `画像・${formatSeoulTime(wait.reportedAt)}`, `이미지 · ${formatSeoulTime(wait.reportedAt)}`) : formatSeoulTime(wait.reportedAt);
  if (wait.readyAt) return tr(lang, `${formatSeoulTime(wait.readyAt)}に入店予定（${when}時点）`, `${formatSeoulTime(wait.readyAt)} 입장 가능 (${when} 공유)`);
  if (wait.minutes === null) return tr(lang, `前に${wait.teams}組・待ち時間の表示なし（${when}時点）`, `앞에 ${wait.teams}팀 · 예상 시간 표시 없음 (${when} 공유)`);
  if (wait.minutes === 0) return tr(lang, `待ちなし（${when}時点）`, `대기 없음 (${when} 공유)`);
  const basis = wait.basis === "remote_from_observed" ? tr(lang, "登録済み", "원격 대기 중") : wait.basis === "on_arrival" ? tr(lang, "着いてから", "도착 후") : tr(lang, "基準未確認", "기준 확인 필요");
  return tr(lang, `待ち${duration(lang, wait.minutes)}（${basis}・${when}時点）`, `대기 ${duration(lang, wait.minutes)} (${basis} · ${when} 공유)`);
}

type Verdict = { label: string; color: string };

/** The coloured band on top of each card: one look tells whether the shop works. */
function verdictBand(lang: Lang, plan: CandidatePlan): Verdict {
  const room = (spare: number) => (spare > 120 ? tr(lang, "時間に余裕あり", "시간 여유 있음") : tr(lang, `余裕${spare}分`, `여유 ${spare}분`));
  if (plan.unknown.includes("no_deadline")) return { label: tr(lang, "候補", "후보"), color: color.text };
  if (plan.verdict === "fits") return { label: tr(lang, `間に合う見込み（${room(-(plan.marginMinutes ?? 0))}）`, `시간 안에 들어갈 수 있어요 (${room(-(plan.marginMinutes ?? 0))})`), color: color.primary };
  if (plan.verdict === "late") {
    const over = plan.marginMinutes ?? 0;
    return plan.seatExpected
      ? { label: tr(lang, `${formatSeoulTime(plan.seatExpected)}着席見込み・${over}分オーバー`, `${formatSeoulTime(plan.seatExpected)} 착석 예상 · ${over}분 초과`), color: color.warning }
      : { label: tr(lang, `お店に着く時点で締切を${over}分過ぎます`, `가게 도착 때 이미 마감을 ${over}분 넘겨요`), color: color.warning };
  }
  if (plan.unknown.includes("wait_basis_unknown")) return { label: tr(lang, "待ちの基準を確認中", "대기 기준 확인 중"), color: color.info };
  if (plan.unknown.includes("wait_teams_only")) return { label: tr(lang, "組数だけでは判断できません", "팀 수만으로는 판단할 수 없어요"), color: color.info };
  if (plan.unknown.includes("wait_unknown") && plan.marginMinutes !== null) {
    return { label: tr(lang, `移動だけなら間に合います（${room(-plan.marginMinutes)}）・待ちは未確認`, `이동만 보면 시간 안이에요 (${room(-plan.marginMinutes)}) · 대기는 확인 안 됨`), color: color.info };
  }
  return { label: tr(lang, "間に合うか確認できませんでした", "시간 안에 들어갈 수 있는지 확인하지 못했어요"), color: color.info };
}

const barColor = { travel: "#a4a199", wait: "#e5b560", slack: "#7f9a8d", over: "#941e34" };

function segment(minutes: number, background: string): FlexBox {
  return { type: "box", layout: "vertical", contents: [], flex: Math.max(1, Math.round(minutes)), height: "8px", backgroundColor: background };
}

/** Now → arrive → seated → deadline as one bar; red where it runs past the deadline. */
function timeBar(lang: Lang, plan: CandidatePlan, now: string): FlexComponent[] {
  if (!plan.seatDeadline || !plan.arriveRestaurantAt) return [];
  const t = (iso: string) => Date.parse(iso) / 60000;
  const start = t(now);
  const deadline = t(plan.seatDeadline) - start;
  const arrive = t(plan.arriveRestaurantAt) - start;
  const seat = plan.seatExpected ? t(plan.seatExpected) - start : null;
  const segments: FlexBox[] = [];
  const end = seat ?? arrive;
  const before = Math.min(end, deadline);
  // Before the deadline: travel, then waiting.
  if (Math.min(arrive, before) > 0) segments.push(segment(Math.min(arrive, before), barColor.travel));
  if (seat !== null && before > arrive) segments.push(segment(before - arrive, barColor.wait));
  if (end > deadline) segments.push(segment(end - deadline, barColor.over));
  else if (deadline > end) segments.push(segment(deadline - end, seat === null ? "#dfdfdd" : barColor.slack));
  if (segments.length === 0) return [];
  const label = (value: string, align: "start" | "center" | "end") => text(value, { size: "xxs", color: color.muted, align, flex: 1, wrap: false });
  const legend: FlexComponent = {
    type: "text",
    text: " ",
    size: "xxs",
    color: color.muted,
    contents: [
      { type: "span", text: "■", color: barColor.travel },
      { type: "span", text: tr(lang, "移動 ", "이동 ") },
      { type: "span", text: "■", color: barColor.wait },
      { type: "span", text: tr(lang, "待ち ", "대기 ") },
      { type: "span", text: "■", color: barColor.slack },
      { type: "span", text: tr(lang, "余裕 ", "여유 ") },
      { type: "span", text: "■", color: barColor.over },
      { type: "span", text: tr(lang, "超過", "초과") },
    ],
  };
  return [
    { type: "box", layout: "horizontal", contents: segments, cornerRadius: "4px", margin: "md", spacing: "none" },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        label(tr(lang, `今 ${formatSeoulTime(now)}`, `지금 ${formatSeoulTime(now)}`), "start"),
        label(plan.seatExpected ? tr(lang, `席 ${formatSeoulTime(plan.seatExpected)}`, `착석 ${formatSeoulTime(plan.seatExpected)}`) : tr(lang, `着 ${formatSeoulTime(plan.arriveRestaurantAt)}`, `도착 ${formatSeoulTime(plan.arriveRestaurantAt)}`), "center"),
        label(tr(lang, `締切 ${formatSeoulTime(plan.seatDeadline)}`, `마감 ${formatSeoulTime(plan.seatDeadline)}`), "end"),
      ],
    },
    legend,
  ];
}

/** Small rounded labels: test shop, test call, booking link, search candidate. */
function badges(lang: Lang, restaurant: Restaurant): FlexComponent[] {
  const items: { label: string; background: string }[] = [];
  if (restaurant.test) items.push({ label: tr(lang, "テスト店舗", "테스트 매장"), background: color.warning });
  if (restaurant.testCall && !restaurant.test) items.push({ label: tr(lang, "テスト通話", "테스트 통화"), background: color.time });
  if (restaurant.searchOnly) items.push({ label: tr(lang, `検索候補・未確認（NAVER ${restaurant.source.checkedAt}）`, `검색 후보 · 확인 안 됨 (네이버 ${restaurant.source.checkedAt})`), background: color.muted });
  if (restaurant.bookingLinks.some((link) => link.provider !== "naver" || !restaurant.searchOnly)) items.push({ label: tr(lang, "予約リンクあり", "예약 링크 있음"), background: color.info });
  if (items.length === 0) return [];
  return [{
    type: "box",
    layout: "horizontal",
    spacing: "xs",
    contents: items.map((item) => ({ type: "box", layout: "vertical", flex: 0, backgroundColor: item.background, cornerRadius: "12px", paddingStart: "8px", paddingEnd: "8px", paddingTop: "2px", paddingBottom: "2px", contents: [text(item.label, { size: "xxs", color: "#ffffff", weight: "bold", wrap: false })] })),
  }];
}

function partyLine(lang: Lang, restaurant: Restaurant, partySize: number): FlexComponent {
  if (restaurant.maxParty !== null && partySize > restaurant.maxParty) {
    return text(tr(lang, `${partySize}名は入れない可能性（確認できた上限${restaurant.maxParty}名）`, `${partySize}명은 어려울 수 있어요 (확인된 최대 ${restaurant.maxParty}명)`), { color: color.warning });
  }
  if (partySize >= 5) return text(tr(lang, `${partySize}名・団体席と事前予約を先に確認`, `${partySize}명 · 단체석과 사전 예약 먼저 확인`));
  if (partySize === 1) {
    const solo = restaurant.soloEntry === false ? tr(lang, "ひとり入店は難しい可能性", "혼자 입장은 어려울 수 있어요") : restaurant.soloEntry ? tr(lang, "ひとり入店可", "혼자 입장 가능") : tr(lang, "ひとり入店は未確認", "혼자 입장 확인 안 됨");
    const portion = restaurant.singlePortion === false ? tr(lang, "1人前の注文は難しい可能性", "1인분 주문은 어려울 수 있어요") : restaurant.singlePortion ? tr(lang, "1人前の注文可", "1인분 주문 가능") : tr(lang, "1人前の注文は未確認", "1인분 주문 확인 안 됨");
    return text(`${solo} · ${portion}`, { color: restaurant.soloEntry === false || restaurant.singlePortion === false ? color.warning : color.text });
  }
  return text(tr(lang, `${partySize}名・席の条件は未確認`, `${partySize}명 · 좌석 조건은 확인 안 됨`));
}

function travelLine(lang: Lang, plan: CandidatePlan, minutes: number | null, mode: "walk" | "transit" | null, provider: "tmap" | "estimate" | null): string {
  if (minutes === null) return tr(lang, "お店までの時間を確認できませんでした", "가게까지 시간을 확인하지 못했어요");
  const how = mode === "walk" ? tr(lang, "徒歩", "도보") : tr(lang, "電車", "지하철");
  const source = provider === "tmap" ? "TMAP" : tr(lang, "目安", "추정");
  const arrive = plan.arriveRestaurantAt ? tr(lang, `・${formatSeoulTime(plan.arriveRestaurantAt)}着`, ` · ${formatSeoulTime(plan.arriveRestaurantAt)} 도착`) : "";
  return tr(lang, `お店まで約${minutes}分（${how}・${source}）${arrive}`, `가게까지 약 ${minutes}분 (${how} · ${source})${arrive}`);
}

export function candidateBubble(request: DiningRequest, restaurant: Restaurant, plan: CandidatePlan, now: string = new Date().toISOString(), origin?: string): FlexBubble {
  const lang = request.lang;
  const state = request.candidates.find((c) => c.restaurantId === restaurant.id);
  const leg = state?.toRestaurant ?? null;
  const verdict = verdictBand(lang, plan);
  const body: FlexComponent[] = [...badges(lang, restaurant), text(travelLine(lang, plan, leg?.minutes ?? null, leg?.mode ?? null, leg?.provider ?? null))];
  if (plan.seatDeadline && request.nextPlace && request.arriveBy) {
    body.push(text(tr(lang, `${formatSeoulTime(plan.seatDeadline)}までに席に着けば、${formatSeoulTime(request.arriveBy)}に${request.nextPlace.nameJa}へ間に合います`, `${formatSeoulTime(plan.seatDeadline)}까지 앉으면 ${formatSeoulTime(request.arriveBy)}에 ${request.nextPlace.nameKo} 도착`), { color: color.time }));
  }
  body.push(...timeBar(lang, plan, now));
  body.push(text(waitLine(lang, plan.wait)));
  body.push(partyLine(lang, restaurant, request.partySize ?? 2));
  const header = vbox(
    [
      text(verdict.label, { size: "xs", color: "#ffffff", weight: "bold" }),
      text(name(lang, restaurant), { size: "md", weight: "bold", color: "#ffffff" }),
      text(lang === "ja" ? restaurant.nameKo : restaurant.nameJa, { size: "xs", color: "#ffffffcc" }),
    ],
    { spacing: "xs", backgroundColor: verdict.color, paddingAll: "12px" },
  );
  const footer: FlexComponent[] = [
    { type: "button", style: "primary", color: color.primary, height: "sm", action: postback(request, "select", tr(lang, "ここに行く", "여기로 갈게요"), { candidateId: restaurant.id, displayText: tr(lang, `${restaurant.nameJa}に行く`, `${restaurant.nameKo}로 갈게요`) }) },
    { type: "button", style: "secondary", height: "sm", action: postback(request, "wait", tr(lang, "待ち状況を送る", "대기 상황 보내기"), { candidateId: restaurant.id }) },
  ];
  const link = restaurant.bookingLinks[0];
  if (link) {
    const label = link.provider === "naver" ? tr(lang, "NAVERで見る", "네이버에서 보기") : tr(lang, "予約・順番待ちを確認", "예약·웨이팅 확인");
    footer.push({ type: "button", style: "link", height: "sm", action: { type: "uri", label, uri: link.url } });
  }
  const hero = heroImage(origin, restaurant.areaId);
  return { type: "bubble", size: "kilo", header, ...(hero ? { hero } : {}), body: vbox(body), footer: vbox(footer) };
}

export function candidatesMessages(request: DiningRequest, plans: CandidatePlan[], lookup: (id: string) => Restaurant | undefined, options: { callingEnabled: boolean; intro?: string; now?: string; origin?: string }): LineMessage[] {
  const lang = request.lang;
  if (plans.length === 0) {
    return [{
      type: "text",
      text: tr(lang, "条件に合うお店が見つかりませんでした。メニューか地域を変えて送ってください。", "조건에 맞는 가게를 찾지 못했어요. 메뉴나 지역을 바꿔서 보내 주세요."),
    }];
  }
  const bubbles = plans.flatMap((plan) => {
    const restaurant = lookup(plan.candidateId);
    return restaurant ? [candidateBubble(request, restaurant, plan, options.now, options.origin)] : [];
  });
  const area = request.areaId ? findArea(request.areaId) : undefined;
  const menu = request.menuKey ? menuNames[request.menuKey][lang] : "";
  const first = plans[0];
  const deadlineSentence = first.seatDeadline && request.arriveBy && request.nextPlace
    ? tr(lang, `${formatSeoulTime(request.arriveBy)}に${request.nextPlace.nameJa}に着くには、${formatSeoulTime(first.seatDeadline)}ごろまでに席に着く必要があります（食事${request.mealMinutes}分・余裕${request.bufferMinutes}分）。`, `${formatSeoulTime(request.arriveBy)}까지 ${request.nextPlace.nameKo}에 가려면 ${formatSeoulTime(first.seatDeadline)}쯤까지 앉아야 해요 (식사 ${request.mealMinutes}분 · 여유 ${request.bufferMinutes}분).`)
    : "";
  const summary = (options.intro ? `${options.intro}\n` : "") + tr(lang, `${area ? area.nameJa : ""}で${menu}、${request.partySize}名の候補です。${deadlineSentence}`, `${area ? area.nameKo : ""}에서 ${menu}, ${request.partySize}명 후보예요. ${deadlineSentence}`);
  const actions: LineAction[] = [];
  const hasLate = plans.some((plan) => plan.verdict === "late");
  if (options.callingEnabled && plans.some((plan) => lookup(plan.candidateId)?.phoneRef)) {
    actions.push(postback(request, "call_request", tr(lang, "電話で聞いてもらう", "전화로 물어봐 주세요"), { displayText: tr(lang, "電話で聞いてもらう", "전화로 물어봐 주세요") }));
  }
  actions.push({ type: "message", label: tr(lang, "キャンセル", "취소"), text: tr(lang, "キャンセル", "취소") });
  const hint = hasLate ? tr(lang, "\n間に合わないお店があります。ほかのお店に電話で空きを聞くこともできます。", "\n시간이 안 맞는 가게가 있어요. 다른 가게에 전화로 자리를 물어볼 수도 있어요.") : "";
  return [
    { type: "text", text: summary.trim() + hint },
    { type: "flex", altText: tr(lang, `お店の候補 ${bubbles.length}件`, `가게 후보 ${bubbles.length}곳`), contents: { type: "carousel", contents: bubbles }, quickReply: quickReply(actions) },
  ];
}

// ── Calls ────────────────────────────────────────────────────────────────────

/** The shop's own words from the call, quoted in Korean (no translation is claimed). */
function shopQuote(lang: Lang, quote: string | null): string {
  if (!quote) return "";
  return tr(lang, `\nお店の返事（韓国語）：「${quote}」`, `\n가게 답변: "${quote}"`);
}

export function approvalCard(request: DiningRequest, approval: CallProposal, lookup: (id: string) => Restaurant | undefined): LineMessage {
  const lang = request.lang;
  const shops = approval.candidateIds.map((id, i) => `${i + 1}. ${name(lang, lookup(id) ?? { nameJa: id, nameKo: id })}`);
  const anyTest = approval.candidateIds.some((id) => lookup(id)?.test || lookup(id)?.testCall);
  const body: FlexComponent[] = [
    text(tr(lang, "電話する順番", "전화 순서"), { size: "xs", color: color.muted }),
    ...shops.map((line) => text(line, { weight: "bold" })),
    { type: "separator", margin: "md" },
    text(tr(lang, `人数：${approval.partySize}名`, `인원: ${approval.partySize}명`)),
    text(tr(lang, `時間：${formatSeoulTime(approval.windowStart)}〜${formatSeoulTime(approval.windowEnd)}のあいだ`, `시간: ${formatSeoulTime(approval.windowStart)}~${formatSeoulTime(approval.windowEnd)} 사이`)),
    text(tr(lang, `予約名：${approval.alias}`, `예약자 이름: ${approval.alias}`)),
    { type: "separator", margin: "md" },
    text(tr(lang, "AIであることを伝えたうえで、韓国語で1軒ずつ問い合わせます。この範囲外の時間を提案されたり予約金を求められたりした場合は、確定せずにこちらで確認します。", "AI라고 밝히고 한국어로 한 곳씩 물어봐요. 이 범위 밖의 시간이나 예약금을 요구하면 확정하지 않고 여기서 다시 확인해요."), { size: "xs", color: color.muted }),
  ];
  if (anyTest) body.push(text(tr(lang, "テスト通話です。チームメンバーの電話につながります。", "테스트 통화예요. 팀원 전화로 연결돼요."), { size: "xs", color: color.warning }));
  body.push(text(tr(lang, `${formatSeoulTime(approval.expiresAt)}まで有効です。`, `${formatSeoulTime(approval.expiresAt)}까지 유효해요.`), { size: "xs", color: color.muted }));
  return {
    type: "flex",
    altText: tr(lang, "この条件で電話を頼みますか？", "이 조건으로 전화를 부탁할까요?"),
    contents: {
      type: "bubble",
      header: vbox([text(tr(lang, "この条件で電話を頼みますか？", "이 조건으로 전화를 부탁할까요?"), { size: "md", weight: "bold" })]),
      body: vbox(body),
      footer: vbox([
        { type: "button", style: "primary", color: color.primary, height: "sm", action: postback(request, "approve", tr(lang, "この条件で電話を頼む", "이 조건으로 전화 부탁하기"), { displayText: tr(lang, "この条件で電話を頼む", "이 조건으로 전화 부탁하기") }) },
        { type: "button", style: "link", height: "sm", action: postback(request, "cancel_call", tr(lang, "やめる", "그만두기"), { displayText: tr(lang, "やめる", "그만두기") }) },
      ]),
    },
  };
}

export function noCallableCandidates(lang: Lang): LineMessage {
  return { type: "text", text: tr(lang, "電話で問い合わせできるお店がありません。お店の公式ページか地図から確認してください。", "전화로 물어볼 수 있는 가게가 없어요. 가게 공식 페이지나 지도에서 확인해 주세요.") };
}

export function callingDisabled(lang: Lang): LineMessage {
  return { type: "text", text: tr(lang, "いまは電話の問い合わせを使えません。お店の公式ページか地図から確認してください。", "지금은 전화 문의를 쓸 수 없어요. 가게 공식 페이지나 지도에서 확인해 주세요.") };
}

export function calling(lang: Lang, restaurant: Restaurant, index: number, total: number): LineMessage {
  return { type: "text", text: tr(lang, `${restaurant.nameJa}に電話しています（${index}/${total}）。結果はこのトークでお知らせします。`, `${restaurant.nameKo}에 전화하고 있어요 (${index}/${total}). 결과는 이 대화방으로 보낼게요.`) };
}

export function callMovedOn(lang: Lang, restaurant: Restaurant, reason: "declined" | "no_answer" | "late_offer" | "failed", offeredTime: string | null, request: DiningRequest, quote: string | null = null): LineMessage {
  const arrive = request.arriveBy && request.nextPlace ? tr(lang, `それでは${formatSeoulTime(request.arriveBy)}の到着に間に合いません。`, `${formatSeoulTime(request.arriveBy)}까지 도착하기 어려워요.`) : "";
  const why =
    reason === "late_offer" && offeredTime
      ? tr(lang, `${restaurant.nameJa}は${formatSeoulTime(offeredTime)}なら空いているそうです。${arrive}`, `${restaurant.nameKo}는 ${formatSeoulTime(offeredTime)}이면 된대요. 하지만 ${arrive}`)
      : reason === "declined"
        ? tr(lang, `${restaurant.nameJa}は今日は難しいそうです。`, `${restaurant.nameKo}는 오늘은 어렵대요.`)
        : reason === "no_answer"
          ? tr(lang, `${restaurant.nameJa}は電話に出ませんでした。`, `${restaurant.nameKo}는 전화를 받지 않았어요.`)
          : tr(lang, `${restaurant.nameJa}に電話をかけられませんでした。`, `${restaurant.nameKo}에 전화를 걸지 못했어요.`);
  return { type: "text", text: `${why}${tr(lang, "人数と時間の条件はそのままで、次のお店に電話します。", " 인원과 시간은 그대로 두고 다음 가게에 전화할게요.")}${shopQuote(lang, quote)}` };
}

export function callsExhausted(request: DiningRequest): LineMessage {
  const lang = request.lang;
  return {
    type: "text",
    text: tr(lang, "お願いしたお店では予約が取れませんでした。ほかのお店を探しますか？", "승인한 가게에서는 예약을 못 했어요. 다른 가게를 찾아볼까요?"),
    quickReply: quickReply([postback(request, "new_search", tr(lang, "ほかのお店を探す", "다른 가게 찾기"), { displayText: tr(lang, "ほかのお店を探す", "다른 가게 찾기") })]),
  };
}

export function needsDecision(request: DiningRequest, restaurant: Restaurant, reason: "out_of_range" | "deposit", offeredTime: string | null, quote: string | null = null): LineMessage {
  const lang = request.lang;
  const what =
    reason === "deposit"
      ? tr(lang, `${restaurant.nameJa}から予約金の支払いを求められたので、確定していません。`, `${restaurant.nameKo}에서 예약금을 요구해서 확정하지 않았어요.`)
      : tr(lang, `${restaurant.nameJa}から${offeredTime ? formatSeoulTime(offeredTime) : "別の時間"}の提案がありました。お願いした時間の範囲外なので、まだ確定していません。`, `${restaurant.nameKo}에서 ${offeredTime ? formatSeoulTime(offeredTime) : "다른 시간"}을 제안했어요. 승인한 시간 밖이라 확정하지 않았어요.`);
  const actions: LineAction[] = [];
  if (reason === "out_of_range" && offeredTime) {
    const label = tr(lang, `${formatSeoulTime(offeredTime)}でお願いする`, `${formatSeoulTime(offeredTime)}로 부탁하기`);
    actions.push(postback(request, "decision_accept", label, { candidateId: restaurant.id, displayText: label }));
  }
  actions.push(postback(request, "call_request", tr(lang, "ほかのお店に電話", "다른 가게에 전화"), { displayText: tr(lang, "ほかのお店に電話", "다른 가게에 전화") }));
  actions.push(postback(request, "new_search", tr(lang, "ほかのお店を探す", "다른 가게 찾기"), { displayText: tr(lang, "ほかのお店を探す", "다른 가게 찾기") }));
  return {
    type: "text",
    text: `${what}${tr(lang, "その時間でもう一度頼むか、ほかのお店を探せます。", " 그 시간으로 다시 부탁하거나 다른 가게를 찾을 수 있어요.")}${shopQuote(lang, quote)}`,
    quickReply: quickReply(actions),
  };
}

export function needsVerification(request: DiningRequest, restaurant: Restaurant): LineMessage {
  const lang = request.lang;
  return {
    type: "text",
    text: tr(lang, `${restaurant.nameJa}で予約が取れたか確認できませんでした。お店に確認してください。確認できるまで、ほかのお店には電話しません。`, `${restaurant.nameKo}에서 예약이 됐는지 확인하지 못했어요. 가게에 확인해 주세요. 확인될 때까지 다른 가게에는 전화하지 않아요.`),
    quickReply: quickReply([
      postback(request, "verify_yes", tr(lang, "予約できていた", "예약돼 있었어요"), { candidateId: restaurant.id, displayText: tr(lang, "予約できていた", "예약돼 있었어요") }),
      postback(request, "verify_no", tr(lang, "予約できていなかった", "예약 안 돼 있었어요"), { candidateId: restaurant.id, displayText: tr(lang, "予約できていなかった", "예약 안 돼 있었어요") }),
    ]),
  };
}

export function verifiedNone(request: DiningRequest): LineMessage {
  const lang = request.lang;
  return {
    type: "text",
    text: tr(lang, "予約はないことを記録しました。ほかのお店に電話で聞くこともできます。", "예약이 없다고 기록했어요. 다른 가게에 전화로 물어볼 수도 있어요."),
    quickReply: quickReply([
      postback(request, "call_request", tr(lang, "電話で聞いてもらう", "전화로 물어봐 주세요"), { displayText: tr(lang, "電話で聞いてもらう", "전화로 물어봐 주세요") }),
      postback(request, "new_search", tr(lang, "ほかのお店を探す", "다른 가게 찾기"), { displayText: tr(lang, "ほかのお店を探す", "다른 가게 찾기") }),
    ]),
  };
}

export function confirmedCard(request: DiningRequest, reservation: Reservation, restaurant: Restaurant, links: { origin: string; cardToken: string | null }, quote: string | null = null): LineMessage {
  const lang = request.lang;
  const title = reservation.test ? tr(lang, "予約が取れました（テスト）", "예약했어요 (테스트)") : tr(lang, "予約が取れました", "예약했어요");
  const footer: FlexComponent[] = [
    { type: "button", style: "primary", color: color.primary, height: "sm", action: { type: "uri", label: tr(lang, "お店への行き方を見る", "식당으로 가는 길 보기"), uri: goUrl(links.origin, { to: placeRef({ restaurantId: restaurant.id }), from: request.areaId ? `a:${request.areaId}` : undefined, lang }) } },
  ];
  if (links.cardToken) footer.push({ type: "button", style: "secondary", height: "sm", action: { type: "uri", label: tr(lang, "韓国語の予約カード", "한국어 예약 카드"), uri: cardUrl(links.origin, links.cardToken, lang) } });
  if (request.nextPlace) footer.push({ type: "button", style: "link", height: "sm", action: { type: "uri", label: tr(lang, "次の予定への行き方", "다음 일정으로 가는 길"), uri: goUrl(links.origin, { to: placeRef(request.nextPlace), from: placeRef({ restaurantId: restaurant.id }), lang }) } });
  const field = (label: string, value: string): FlexBox => vbox([text(label, { size: "xxs", color: color.muted }), text(value, { size: "md", weight: "bold" })], { spacing: "none", flex: 1 });
  const evidence =
    reservation.evidence === "call_accept"
      ? tr(lang, `電話でお店が了承（${formatSeoulTime(reservation.acceptedAt)}）`, `근거: 전화로 가게가 수락 (${formatSeoulTime(reservation.acceptedAt)})`)
      : tr(lang, `依頼者がお店に確認済み（${formatSeoulTime(reservation.acceptedAt)}）`, `근거: 가게에 확인했다고 요청자가 공유 (${formatSeoulTime(reservation.acceptedAt)})`);
  // A ticket: one big time, then party and name, framed like a stub.
  const ticket = vbox(
    [
      text(tr(lang, "予約時間", "예약 시간"), { size: "xxs", color: color.muted }),
      text(formatSeoulTime(reservation.time), { size: "3xl", weight: "bold", color: color.time }),
      { type: "separator", margin: "md", color: "#d8ccad" },
      { type: "box", layout: "horizontal", margin: "md", contents: [field(tr(lang, "人数", "인원"), tr(lang, `${reservation.partySize}名`, `${reservation.partySize}명`)), field(tr(lang, "予約名", "예약자"), reservation.alias)] },
    ],
    { spacing: "xs", borderWidth: "2px", borderColor: color.primary, cornerRadius: "12px", paddingAll: "12px", backgroundColor: "#fbf8f1" },
  );
  return {
    type: "flex",
    altText: `${title} ${name(lang, restaurant)} ${formatSeoulTime(reservation.time)}`,
    contents: {
      type: "bubble",
      ...(heroImage(links.origin, restaurant.areaId) ? { hero: heroImage(links.origin, restaurant.areaId) } : {}),
      header: vbox(
        [
          text(title, { size: "sm", weight: "bold", color: "#ffffff" }),
          text(name(lang, restaurant), { size: "lg", weight: "bold", color: "#ffffff" }),
          text(lang === "ja" ? restaurant.nameKo : restaurant.nameJa, { size: "xs", color: "#ffffffcc" }),
        ],
        { spacing: "xs", backgroundColor: color.primary, paddingAll: "14px" },
      ),
      body: vbox([
        ticket,
        text(evidence, { size: "xs", color: color.muted }),
        ...(quote ? [text(tr(lang, `お店の返事（韓国語）：「${quote}」`, `가게 답변: "${quote}"`), { size: "xs", color: color.muted })] : []),
      ]),
      footer: vbox(footer),
    },
  };
}

// ── Selection, routing, notices ──────────────────────────────────────────────

export function selectedMessage(request: DiningRequest, restaurant: Restaurant, origin: string): LineMessage {
  const lang = request.lang;
  const footer: FlexComponent[] = [
    { type: "button", style: "primary", color: color.primary, height: "sm", action: { type: "uri", label: tr(lang, "お店への行き方を見る", "식당으로 가는 길 보기"), uri: goUrl(origin, { to: placeRef({ restaurantId: restaurant.id }), from: request.areaId ? `a:${request.areaId}` : undefined, lang }) } },
  ];
  if (request.nextPlace) footer.push({ type: "button", style: "link", height: "sm", action: { type: "uri", label: tr(lang, "次の予定への行き方", "다음 일정으로 가는 길"), uri: goUrl(origin, { to: placeRef(request.nextPlace), from: placeRef({ restaurantId: restaurant.id }), lang }) } });
  return {
    type: "flex",
    altText: tr(lang, `${restaurant.nameJa}に行きます`, `${restaurant.nameKo}로 가요`),
    contents: {
      type: "bubble",
      body: vbox([
        text(tr(lang, `${restaurant.nameJa}に行きます`, `${restaurant.nameKo}로 가요`), { size: "md", weight: "bold" }),
        text(tr(lang, "行き先を決めただけで、予約はまだです。", "목적지만 정했고, 예약은 아직이에요."), { size: "xs", color: color.muted }),
      ]),
      footer: vbox(footer),
    },
  };
}

export function staleCard(lang: Lang): LineMessage {
  return { type: "text", text: tr(lang, "この案内は古くなりました。最新の案内を送ります。", "이 안내는 지난 내용이에요. 최신 안내를 보낼게요.") };
}

export function onlyRequester(lang: Lang): LineMessage {
  return { type: "text", text: tr(lang, "電話の依頼や変更は、この食事を頼んだ人だけができます。", "전화 부탁이나 변경은 이 식사를 요청한 사람만 할 수 있어요.") };
}

export function busyCalling(lang: Lang): LineMessage {
  return { type: "text", text: tr(lang, "いまお店に電話しています。終わったら結果を送ります。", "지금 가게에 전화하고 있어요. 끝나면 결과를 보낼게요.") };
}

export function cancelled(lang: Lang, hadPendingCalls: boolean): LineMessage {
  return {
    type: "text",
    text: hadPendingCalls
      ? tr(lang, "まだかけていない電話は取り消しました。かけ終わった電話の結果は確認してください。", "아직 걸지 않은 전화는 취소했어요. 이미 건 전화의 결과는 확인해 주세요.")
      : tr(lang, "この食事の依頼を終了しました。またいつでも送ってください。", "이 식사 요청을 끝냈어요. 언제든 다시 보내 주세요."),
  };
}

export function greeting(lang: Lang, kind: "user" | "group"): LineMessage {
  return kind === "group"
    ? { type: "text", text: tr(lang, `${BOT_NAME.ja}です。グループでは「${BOT_NAME.ja} このお店、今日2人で行ける？（NAVER地図のリンク）」や「${BOT_NAME.ja} 新村で2人、サムギョプサル。20時までに弘大」のように名前を付けて呼んでください。`, `${BOT_NAME.ko}예요. 그룹에서는 "${BOT_NAME.ko} 이 가게 오늘 2명 돼? (네이버 지도 링크)"나 "${BOT_NAME.ko} 신촌에서 2명, 삼겹살. 8시까지 홍대"처럼 이름을 붙여 불러 주세요.`) }
    : { type: "text", text: tr(lang, `${BOT_NAME.ja}です。気になるお店のNAVER地図・Googleマップのリンク、お店の名前、看板の写真を送ると、今日行けるか確かめます。お店が決まっていなければ、食べたいもの、人数、いる場所、次の予定を送ってください。例：「新村で2人、サムギョプサル。20時までに弘大のライブ会場に着きたい」`, `${BOT_NAME.ko}예요. 가고 싶은 가게의 네이버 지도·구글 지도 링크, 가게 이름, 간판 사진을 보내면 오늘 갈 수 있는지 확인해 드려요. 가게가 정해지지 않았다면 먹고 싶은 것, 인원, 지금 위치, 다음 일정을 보내 주세요. 예: "신촌에서 2명, 삼겹살. 8시까지 홍대 공연장"`) };
}

export function didNotUnderstand(lang: Lang): LineMessage {
  return greeting(lang, "user");
}

export function arrivalTimePassed(lang: Lang, place: Place, arriveBy: string): LineMessage {
  return { type: "text", text: tr(lang, `${place.nameJa}の${formatSeoulTime(arriveBy)}はもう過ぎています。到着したい時間をもう一度送ってください。`, `${place.nameKo} ${formatSeoulTime(arriveBy)}은 이미 지났어요. 도착하고 싶은 시간을 다시 보내 주세요.`) };
}

/** Offered only when a remote wait leaves free time before the seat is ready (spec §4). */
export function waitTimeIdea(request: DiningRequest, restaurant: Restaurant, minutes: number, origin: string, path: string): LineMessage {
  const lang = request.lang;
  const label = tr(lang, "駅のまわりのミッション", "역 주변 미션 보기");
  return {
    type: "text",
    text: tr(lang, `${restaurant.nameJa}の順番まで約${duration(lang, minutes)}あります。呼ばれる時間に戻れる範囲で、駅のまわりの小さなミッションもどうですか？`, `${restaurant.nameKo} 차례까지 약 ${duration(lang, minutes)} 남았어요. 부를 때 돌아올 수 있는 범위에서 역 주변 작은 미션은 어때요?`),
    quickReply: quickReply([{ type: "uri", label, uri: new URL(path, origin).toString() }]),
  };
}

export function waitRecorded(lang: Lang, restaurant: Restaurant, plan: CandidatePlan): string {
  if (plan.verdict === "late") return tr(lang, `${restaurant.nameJa}は締切に${plan.marginMinutes}分遅れる見込みです。`, `${restaurant.nameKo}는 ${plan.marginMinutes}분 늦을 것 같아요.`);
  if (plan.verdict === "fits") return tr(lang, `${restaurant.nameJa}は間に合う見込みです。`, `${restaurant.nameKo}는 시간 안에 들어갈 수 있을 것 같아요.`);
  return tr(lang, `${restaurant.nameJa}の待ち状況を記録しました。`, `${restaurant.nameKo}의 대기 상황을 기록했어요.`);
}

// ── "Can we go there today?" ─────────────────────────────────────────────────

const mark = { ok: "○", unknown: "？", no: "×" } as const;

function row(label: string, state: keyof typeof mark, value: string): FlexBox {
  const tone = state === "no" ? color.warning : state === "ok" ? color.primary : color.info;
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    contents: [
      text(mark[state], { size: "sm", weight: "bold", color: tone, flex: 0 }),
      vbox([text(label, { size: "xxs", color: color.muted }), text(value, { size: "sm" })], { spacing: "none", flex: 1 }),
    ],
  };
}

function hoursRow(lang: Lang, restaurant: Restaurant, check: TodayCheck, deadline: string | null): FlexBox {
  const label = tr(lang, "営業時間", "영업시간");
  const hours = check.hours;
  const checked = restaurant.hours ? tr(lang, `（NAVER Place・${restaurant.hours.source.checkedAt.slice(5).replace("-", "/")}確認）`, ` (네이버 플레이스 · ${restaurant.hours.source.checkedAt.slice(5).replace("-", "/")} 확인)`) : "";
  switch (hours.state) {
    case "open":
      return row(label, "ok", tr(lang, `${formatSeoulTime(hours.seatFrom)}〜${formatSeoulTime(hours.lastSeatAt)}に入店できます${checked}`, `${formatSeoulTime(hours.seatFrom)}~${formatSeoulTime(hours.lastSeatAt)} 사이에 들어갈 수 있어요${checked}`));
    case "closed_today":
      return row(label, "no", tr(lang, `今日はお休みです${checked}`, `오늘은 쉬는 날이에요${checked}`));
    case "outside":
      return hours.opensAt
        ? row(label, "no", tr(lang, `${formatSeoulTime(hours.opensAt)}から営業なので${deadline ? `、${formatSeoulTime(deadline)}までに入れません` : "、まだ入れません"}${checked}`, `${formatSeoulTime(hours.opensAt)}부터 영업이라${deadline ? ` ${formatSeoulTime(deadline)}까지 들어갈 수 없어요` : " 아직 못 들어가요"}${checked}`))
        : row(label, "no", tr(lang, `今日の受付は${hours.lastSeatAt ? formatSeoulTime(hours.lastSeatAt) : ""}で終わっています${checked}`, `오늘 입장은 ${hours.lastSeatAt ? formatSeoulTime(hours.lastSeatAt) : ""}에 끝났어요${checked}`));
    default:
      return row(label, "unknown", tr(lang, "営業時間は確認できていません", "영업시간은 확인하지 못했어요"));
  }
}

function timingRow(lang: Lang, request: DiningRequest, plan: CandidatePlan, minutesToShop: number | null): FlexBox {
  const label = tr(lang, "次の予定", "다음 일정");
  const walk = minutesToShop !== null ? tr(lang, `お店まで約${minutesToShop}分。`, `가게까지 약 ${minutesToShop}분. `) : "";
  if (!request.arriveBy || !request.nextPlace || !plan.seatDeadline) {
    return row(tr(lang, "移動", "이동"), minutesToShop !== null ? "ok" : "unknown", walk ? walk.replace(/。$/, "") : tr(lang, "お店までの時間は確認できていません", "가게까지 시간은 확인하지 못했어요"));
  }
  const goal = tr(lang, `${formatSeoulTime(plan.seatDeadline)}までに席に着けば、${formatSeoulTime(request.arriveBy)}に${request.nextPlace.nameJa}へ間に合います`, `${formatSeoulTime(plan.seatDeadline)}까지 앉으면 ${formatSeoulTime(request.arriveBy)}에 ${request.nextPlace.nameKo}에 갈 수 있어요`);
  if (plan.verdict === "late") {
    const over = plan.marginMinutes ?? 0;
    return row(label, "no", tr(lang, `${walk}席に着くのが締切より${over}分遅れる見込みです`, `${walk}마감보다 ${over}분 늦게 앉을 것 같아요`));
  }
  // An unknown wait is shown on its own row; the walk and the deadline are known here.
  const onlyWaitUnknown = plan.unknown.every((reason) => reason.startsWith("wait_"));
  return row(label, plan.verdict === "fits" || onlyWaitUnknown ? "ok" : "unknown", `${walk}${goal}`);
}

function seatRow(lang: Lang, plan: CandidatePlan): FlexBox {
  const label = tr(lang, "今の空席・待ち", "지금 빈자리·대기");
  if (!plan.wait) return row(label, "unknown", tr(lang, "お店にしか分かりません。AIが韓国語で電話して確かめられます", "가게만 알아요. AI가 한국어로 전화해서 확인할 수 있어요"));
  return row(label, plan.verdict === "late" ? "no" : "ok", waitLine(lang, plan.wait));
}

/** The answer for one shop the user pointed at: today, on their conditions, and what to do next. */
export function todayAnswer(
  request: DiningRequest,
  restaurant: Restaurant,
  check: TodayCheck,
  plan: CandidatePlan,
  options: { callingEnabled: boolean; canCallOthers: boolean; origin?: string; intro?: string },
): LineMessage {
  const lang = request.lang;
  const party = request.partySize ?? 2;
  const headline = {
    ok: { label: tr(lang, `今日 ${party}名で行けそうです`, `오늘 ${party}명이면 갈 수 있을 것 같아요`), background: color.primary },
    check: { label: tr(lang, `今日 ${party}名で行けるか、確認が必要です`, `오늘 ${party}명이 갈 수 있는지 확인이 필요해요`), background: color.info },
    hard: { label: tr(lang, "今日は難しそうです", "오늘은 어려울 것 같아요"), background: color.warning },
  }[check.verdict];
  const leg = request.candidates.find((c) => c.restaurantId === restaurant.id)?.toRestaurant ?? null;
  const body: FlexComponent[] = [
    hoursRow(lang, restaurant, check, plan.seatDeadline),
    timingRow(lang, request, plan, leg?.minutes ?? null),
    seatRow(lang, plan),
    check.tooSmall ? row(tr(lang, "人数", "인원"), "no", tr(lang, `${party}名は入れない可能性があります`, `${party}명은 못 들어갈 수 있어요`)) : partyLine(lang, restaurant, party),
    ...badges(lang, restaurant),
  ];
  const callable = options.callingEnabled && restaurant.phoneRef !== null;
  const buttons: FlexComponent[] = [];
  const button = (style: "primary" | "secondary" | "link", action: LineAction): FlexComponent => ({ type: "button", style, height: "sm", ...(style === "primary" ? { color: color.primary } : {}), action });
  const alternatives = postback(request, "alternatives", tr(lang, "近くの似たお店", "근처 비슷한 가게"), { displayText: tr(lang, "近くの似たお店を見る", "근처 비슷한 가게 보기") });
  const callLabel = (ja: string, ko: string) => postback(request, "call_request", tr(lang, ja, ko), { displayText: tr(lang, ja, ko) });
  if (check.verdict === "hard") {
    buttons.push(button("primary", alternatives));
    if (options.canCallOthers) buttons.push(button("secondary", callLabel("ほかのお店に電話で聞く", "다른 가게에 전화로 묻기")));
  } else {
    if (callable) buttons.push(button("primary", check.verdict === "ok" ? callLabel("電話で予約を頼む", "전화로 예약 부탁하기") : callLabel("AIに電話で確かめてもらう", "AI에게 전화로 확인 부탁하기")));
    buttons.push(button(callable ? "secondary" : "primary", postback(request, "select", tr(lang, "このまま行く", "그냥 갈게요"), { candidateId: restaurant.id, displayText: tr(lang, `${restaurant.nameJa}に行く`, `${restaurant.nameKo}로 갈게요`) })));
    buttons.push(button("link", postback(request, "wait", tr(lang, "待ち状況を送る", "대기 상황 보내기"), { candidateId: restaurant.id })));
    buttons.push(button("link", alternatives));
  }
  const header = vbox(
    [
      text(headline.label, { size: "sm", color: "#ffffff", weight: "bold" }),
      text(name(lang, restaurant), { size: "lg", weight: "bold", color: "#ffffff" }),
      text(lang === "ja" ? restaurant.nameKo : restaurant.nameJa, { size: "xs", color: "#ffffffcc" }),
    ],
    { spacing: "xs", backgroundColor: headline.background, paddingAll: "14px" },
  );
  const hero = heroImage(options.origin, restaurant.areaId);
  const bubble: FlexBubble = { type: "bubble", size: "mega", header, ...(hero ? { hero } : {}), body: vbox(body, { spacing: "md" }), footer: vbox(buttons) };
  const altText = `${headline.label}：${name(lang, restaurant)}`;
  return { type: "flex", altText: options.intro ? `${options.intro} ${altText}` : altText, contents: bubble };
}

/** Text before the answer: what we understood and what the user can still add. */
export function todayIntro(request: DiningRequest, restaurant: Restaurant, via: "link" | "name" | "image", alreadySaid = false): LineMessage {
  const lang = request.lang;
  const from = { link: tr(lang, "リンク", "링크"), name: tr(lang, "お店の名前", "가게 이름"), image: tr(lang, "写真", "사진") }[via];
  const missing = !request.arriveBy ? tr(lang, "\n次の予定があれば「20時までに弘大」のように送ってください。間に合うかも一緒に見ます。", "\n다음 일정이 있으면 \"8시까지 홍대\"처럼 보내 주세요. 시간 안에 되는지도 같이 볼게요.") : "";
  const found = alreadySaid
    ? tr(lang, `「${restaurant.nameJa}」に今日行けるか調べました。`, `"${restaurant.nameKo}"에 오늘 갈 수 있는지 알아봤어요.`)
    : tr(lang, `${from}から「${restaurant.nameJa}（${restaurant.nameKo}）」だと分かりました。今日行けるか調べました。`, `${from}에서 "${restaurant.nameKo}"(으)로 확인했어요. 오늘 갈 수 있는지 알아봤어요.`);
  return { type: "text", text: found + missing };
}

/** Said before the first question when the user pointed at a shop but gave no party size. */
export function targetRecognized(request: DiningRequest, restaurant: Restaurant, via: "link" | "name" | "image"): LineMessage {
  const lang = request.lang;
  const from = { link: tr(lang, "リンク", "링크"), name: tr(lang, "お店の名前", "가게 이름"), image: tr(lang, "写真", "사진") }[via];
  return { type: "text", text: tr(lang, `${from}から「${restaurant.nameJa}（${restaurant.nameKo}）」だと分かりました。今日行けるか調べます。`, `${from}에서 "${restaurant.nameKo}"(으)로 확인했어요. 오늘 갈 수 있는지 알아볼게요.`) };
}

export function unknownPlace(lang: Lang): LineMessage {
  return { type: "text", text: tr(lang, "地図のリンクは読めましたが、まだ情報がないお店です。いまは新村のお店に対応しています。お店の名前か「新村で2人、サムギョプサル」のように送ってください。", "지도 링크는 읽었지만 아직 정보가 없는 가게예요. 지금은 신촌 가게를 지원해요. 가게 이름이나 \"신촌에서 2명, 삼겹살\"처럼 보내 주세요.") };
}

export function unreadableLink(lang: Lang, host: string): LineMessage {
  return { type: "text", text: tr(lang, `${host}のリンクは開けません。お店の名前、NAVER地図・Googleマップのリンク、または看板の写真を送ってください。`, `${host} 링크는 열 수 없어요. 가게 이름, 네이버 지도·구글 지도 링크, 또는 간판 사진을 보내 주세요.`) };
}

export function alternativesIntro(lang: Lang, restaurant: Restaurant): string {
  return tr(lang, `${restaurant.nameJa}の近くで、同じメニューのお店です。`, `${restaurant.nameKo} 근처의 같은 메뉴 가게예요.`);
}

export function photoNotPlace(lang: Lang): LineMessage {
  return { type: "text", text: tr(lang, "写真からお店が分かりませんでした。お店の名前、NAVER地図・Googleマップのリンク、または看板がはっきり写った写真を送ってください。", "사진에서 가게를 찾지 못했어요. 가게 이름, 네이버 지도·구글 지도 링크, 또는 간판이 잘 보이는 사진을 보내 주세요.") };
}
