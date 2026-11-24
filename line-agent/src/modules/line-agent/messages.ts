// LINE messages in Japanese (default) and Korean with the same facts and the
// same recovery actions in both (spec §3, AGENTS.md UX rules). Each message
// leads with one main action.
import { cardUrl, goUrl, placeRef } from "./links";
import type { FlexBox, FlexBubble, FlexComponent, LineAction, LineMessage, QuickReply } from "./line/types";
import type { CandidatePlan } from "./plan";
import { findArea, menuNames } from "./places";
import { encodePostback, type PostbackAction } from "./postback";
import { formatSeoulTime } from "./time";
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
    text: tr(lang, `${restaurant.nameJa}の「${minutes}分」は、どちらですか？`, `${restaurant.nameKo}의 "${minutes}분"은 어느 쪽인가요?`),
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
    text: tr(lang, "画像の読み取りはまだできません。待ち時間を「40分」のように文字で送ってください。", "이미지는 아직 읽지 못해요. 대기 시간을 \"40분\"처럼 글자로 보내 주세요."),
  };
}

// ── Candidates ───────────────────────────────────────────────────────────────

function waitLine(lang: Lang, wait: WaitObservation | null): string {
  if (!wait) return tr(lang, "待ち状況：未確認", "대기 상황: 확인 안 됨");
  const when = formatSeoulTime(wait.reportedAt);
  if (wait.readyAt) return tr(lang, `${formatSeoulTime(wait.readyAt)}に入店できる（${when} 共有）`, `${formatSeoulTime(wait.readyAt)} 입장 가능 (${when} 공유)`);
  if (wait.minutes === null) return tr(lang, `前に${wait.teams}組・待ち時間は表示なし（${when} 共有）`, `앞에 ${wait.teams}팀 · 예상 시간 표시 없음 (${when} 공유)`);
  if (wait.minutes === 0) return tr(lang, `待ちなし（${when} 共有）`, `대기 없음 (${when} 공유)`);
  const basis = wait.basis === "remote_from_observed" ? tr(lang, "登録済み", "원격 대기 중") : wait.basis === "on_arrival" ? tr(lang, "着いてから", "도착 후") : tr(lang, "基準未確認", "기준 확인 필요");
  return tr(lang, `待ち${wait.minutes}分（${basis}・${when} 共有）`, `대기 ${wait.minutes}분 (${basis} · ${when} 공유)`);
}

function verdictLine(lang: Lang, plan: CandidatePlan): FlexComponent | null {
  if (plan.unknown.includes("no_deadline")) return null;
  if (plan.verdict === "fits") {
    const spare = -(plan.marginMinutes ?? 0);
    const room = spare > 120 ? tr(lang, "時間に余裕あり", "시간 여유 있음") : tr(lang, `余裕${spare}分`, `여유 ${spare}분`);
    return text(tr(lang, `間に合う見込み（${room}）`, `시간 안에 들어갈 수 있어요 (${room})`), { color: color.primary, weight: "bold" });
  }
  if (plan.verdict === "late") {
    const over = plan.marginMinutes ?? 0;
    return plan.seatExpected
      ? text(tr(lang, `${formatSeoulTime(plan.seatExpected)}着席見込み・${over}分オーバー`, `${formatSeoulTime(plan.seatExpected)} 착석 예상 · ${over}분 초과`), { color: color.warning, weight: "bold" })
      : text(tr(lang, `お店に着く時点で締切を${over}分過ぎます`, `가게 도착 때 이미 마감을 ${over}분 넘겨요`), { color: color.warning, weight: "bold" });
  }
  if (plan.unknown.includes("wait_basis_unknown")) return text(tr(lang, "待ちの基準を確認中", "대기 기준 확인 중"), { color: color.info });
  if (plan.unknown.includes("wait_teams_only")) return text(tr(lang, "組数だけでは間に合うか判断できません", "팀 수만으로는 판단할 수 없어요"), { color: color.info });
  if (plan.unknown.includes("wait_unknown") && plan.marginMinutes !== null) {
    const spare = -plan.marginMinutes;
    const room = spare > 120 ? tr(lang, "時間に余裕あり", "시간 여유 있음") : tr(lang, `余裕${spare}分`, `여유 ${spare}분`);
    return text(tr(lang, `移動だけなら間に合います（${room}）・待ちは未確認`, `이동만 보면 시간 안이에요 (${room}) · 대기는 확인 안 됨`), { color: color.info });
  }
  return text(tr(lang, "間に合うか確認できませんでした", "시간 안에 들어갈 수 있는지 확인하지 못했어요"), { color: color.info });
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

export function candidateBubble(request: DiningRequest, restaurant: Restaurant, plan: CandidatePlan): FlexBubble {
  const lang = request.lang;
  const state = request.candidates.find((c) => c.restaurantId === restaurant.id);
  const leg = state?.toRestaurant ?? null;
  const body: FlexComponent[] = [text(travelLine(lang, plan, leg?.minutes ?? null, leg?.mode ?? null, leg?.provider ?? null))];
  if (plan.seatDeadline && request.nextPlace && request.arriveBy) {
    body.push(text(tr(lang, `${formatSeoulTime(plan.seatDeadline)}までに席に着けば${formatSeoulTime(request.arriveBy)}に${request.nextPlace.nameJa}へ`, `${formatSeoulTime(plan.seatDeadline)}까지 앉으면 ${formatSeoulTime(request.arriveBy)}에 ${request.nextPlace.nameKo} 도착`), { color: color.time }));
  }
  body.push(text(waitLine(lang, plan.wait)));
  const verdict = verdictLine(lang, plan);
  if (verdict) body.push(verdict);
  body.push(partyLine(lang, restaurant, request.partySize ?? 2));
  const header: FlexComponent[] = [text(name(lang, restaurant), { size: "md", weight: "bold" }), text(lang === "ja" ? restaurant.nameKo : restaurant.nameJa, { size: "xs", color: color.muted })];
  if (restaurant.test) header.push(text(tr(lang, "テスト用の店舗です", "테스트용 매장이에요"), { size: "xs", color: color.warning }));
  const footer: FlexComponent[] = [
    { type: "button", style: "primary", color: color.primary, height: "sm", action: postback(request, "select", tr(lang, "ここに行く", "여기로 갈게요"), { candidateId: restaurant.id, displayText: tr(lang, `${restaurant.nameJa}に行く`, `${restaurant.nameKo}로 갈게요`) }) },
    { type: "button", style: "secondary", height: "sm", action: postback(request, "wait", tr(lang, "待ち状況を送る", "대기 상황 보내기"), { candidateId: restaurant.id }) },
  ];
  const link = restaurant.bookingLinks[0];
  if (link) footer.push({ type: "button", style: "link", height: "sm", action: { type: "uri", label: tr(lang, "予約・順番待ちを確認", "예약·웨이팅 확인"), uri: link.url } });
  return { type: "bubble", size: "kilo", header: vbox(header, { spacing: "xs" }), body: vbox(body), footer: vbox(footer) };
}

export function candidatesMessages(request: DiningRequest, plans: CandidatePlan[], lookup: (id: string) => Restaurant | undefined, options: { callingEnabled: boolean; intro?: string }): LineMessage[] {
  const lang = request.lang;
  if (plans.length === 0) {
    return [{
      type: "text",
      text: tr(lang, "条件に合うお店が見つかりませんでした。メニューか地域を変えて送ってください。", "조건에 맞는 가게를 찾지 못했어요. 메뉴나 지역을 바꿔서 보내 주세요."),
    }];
  }
  const bubbles = plans.flatMap((plan) => {
    const restaurant = lookup(plan.candidateId);
    return restaurant ? [candidateBubble(request, restaurant, plan)] : [];
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

export function approvalCard(request: DiningRequest, approval: CallProposal, lookup: (id: string) => Restaurant | undefined): LineMessage {
  const lang = request.lang;
  const shops = approval.candidateIds.map((id, i) => `${i + 1}. ${name(lang, lookup(id) ?? { nameJa: id, nameKo: id })}`);
  const anyTest = approval.candidateIds.some((id) => lookup(id)?.test);
  const body: FlexComponent[] = [
    text(tr(lang, "電話する順番", "전화 순서"), { size: "xs", color: color.muted }),
    ...shops.map((line) => text(line, { weight: "bold" })),
    { type: "separator", margin: "md" },
    text(tr(lang, `人数：${approval.partySize}名`, `인원: ${approval.partySize}명`)),
    text(tr(lang, `時間：${formatSeoulTime(approval.windowStart)}〜${formatSeoulTime(approval.windowEnd)}のあいだ`, `시간: ${formatSeoulTime(approval.windowStart)}~${formatSeoulTime(approval.windowEnd)} 사이`)),
    text(tr(lang, `予約名：${approval.alias}`, `예약자 이름: ${approval.alias}`)),
    { type: "separator", margin: "md" },
    text(tr(lang, "AIだと名乗って、韓国語で1店ずつ問い合わせます。この範囲の外の時間や予約金を求められたら、確定せずにここで確認します。", "AI라고 밝히고 한국어로 한 곳씩 물어봐요. 이 범위 밖의 시간이나 예약금을 요구하면 확정하지 않고 여기서 다시 확인해요."), { size: "xs", color: color.muted }),
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
  return { type: "text", text: tr(lang, `${restaurant.nameJa}に電話しています（${index}/${total}）。結果はこのトークに送ります。`, `${restaurant.nameKo}에 전화하고 있어요 (${index}/${total}). 결과는 이 대화방으로 보낼게요.`) };
}

export function callMovedOn(lang: Lang, restaurant: Restaurant, reason: "declined" | "no_answer" | "late_offer" | "failed", offeredTime: string | null, request: DiningRequest): LineMessage {
  const arrive = request.arriveBy && request.nextPlace ? tr(lang, `${formatSeoulTime(request.arriveBy)}までの到着に間に合いません。`, `${formatSeoulTime(request.arriveBy)}까지 도착하기 어려워요.`) : "";
  const why =
    reason === "late_offer" && offeredTime
      ? tr(lang, `${restaurant.nameJa}は${formatSeoulTime(offeredTime)}なら空いているそうですが、${arrive}`, `${restaurant.nameKo}는 ${formatSeoulTime(offeredTime)}이면 된대요. 하지만 ${arrive}`)
      : reason === "declined"
        ? tr(lang, `${restaurant.nameJa}は今日は難しいそうです。`, `${restaurant.nameKo}는 오늘은 어렵대요.`)
        : reason === "no_answer"
          ? tr(lang, `${restaurant.nameJa}は電話に出ませんでした。`, `${restaurant.nameKo}는 전화를 받지 않았어요.`)
          : tr(lang, `${restaurant.nameJa}に電話をかけられませんでした。`, `${restaurant.nameKo}에 전화를 걸지 못했어요.`);
  return { type: "text", text: `${why}${tr(lang, "人数と時間はそのままで、次のお店に電話します。", " 인원과 시간은 그대로 두고 다음 가게에 전화할게요.")}` };
}

export function callsExhausted(request: DiningRequest): LineMessage {
  const lang = request.lang;
  return {
    type: "text",
    text: tr(lang, "承認されたお店では予約が取れませんでした。ほかのお店を探しますか？", "승인한 가게에서는 예약을 못 했어요. 다른 가게를 찾아볼까요?"),
    quickReply: quickReply([postback(request, "new_search", tr(lang, "ほかのお店を探す", "다른 가게 찾기"), { displayText: tr(lang, "ほかのお店を探す", "다른 가게 찾기") })]),
  };
}

export function needsDecision(request: DiningRequest, restaurant: Restaurant, reason: "out_of_range" | "deposit", offeredTime: string | null): LineMessage {
  const lang = request.lang;
  const what =
    reason === "deposit"
      ? tr(lang, `${restaurant.nameJa}から予約金の支払いを求められたので、確定していません。`, `${restaurant.nameKo}에서 예약금을 요구해서 확정하지 않았어요.`)
      : tr(lang, `${restaurant.nameJa}から${offeredTime ? formatSeoulTime(offeredTime) : "別の時間"}の提案がありました。承認された時間の外なので、確定していません。`, `${restaurant.nameKo}에서 ${offeredTime ? formatSeoulTime(offeredTime) : "다른 시간"}을 제안했어요. 승인한 시간 밖이라 확정하지 않았어요.`);
  return {
    type: "text",
    text: `${what}${tr(lang, "条件を変えてもう一度頼むか、ほかのお店を探せます。", " 조건을 바꿔 다시 부탁하거나 다른 가게를 찾을 수 있어요.")}`,
    quickReply: quickReply([
      postback(request, "call_request", tr(lang, "条件を変えて頼む", "조건 바꿔 부탁하기"), { displayText: tr(lang, "条件を変えて頼む", "조건 바꿔 부탁하기") }),
      postback(request, "new_search", tr(lang, "ほかのお店を探す", "다른 가게 찾기"), { displayText: tr(lang, "ほかのお店を探す", "다른 가게 찾기") }),
    ]),
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

export function confirmedCard(request: DiningRequest, reservation: Reservation, restaurant: Restaurant, links: { origin: string; cardToken: string | null }): LineMessage {
  const lang = request.lang;
  const title = reservation.test ? tr(lang, "予約が取れました（テスト）", "예약했어요 (테스트)") : tr(lang, "予約が取れました", "예약했어요");
  const footer: FlexComponent[] = [
    { type: "button", style: "primary", color: color.primary, height: "sm", action: { type: "uri", label: tr(lang, "お店への行き方を見る", "식당으로 가는 길 보기"), uri: goUrl(links.origin, { to: placeRef({ restaurantId: restaurant.id }), from: request.areaId ? `a:${request.areaId}` : undefined, lang }) } },
  ];
  if (links.cardToken) footer.push({ type: "button", style: "secondary", height: "sm", action: { type: "uri", label: tr(lang, "韓国語の予約カード", "한국어 예약 카드"), uri: cardUrl(links.origin, links.cardToken, lang) } });
  if (request.nextPlace) footer.push({ type: "button", style: "link", height: "sm", action: { type: "uri", label: tr(lang, "次の予定への行き方", "다음 일정으로 가는 길"), uri: goUrl(links.origin, { to: placeRef(request.nextPlace), from: placeRef({ restaurantId: restaurant.id }), lang }) } });
  return {
    type: "flex",
    altText: `${title} ${name(lang, restaurant)} ${formatSeoulTime(reservation.time)}`,
    contents: {
      type: "bubble",
      header: vbox([text(title, { size: "md", weight: "bold", color: color.primary })]),
      body: vbox([
        text(name(lang, restaurant), { weight: "bold" }),
        text(lang === "ja" ? restaurant.nameKo : restaurant.nameJa, { size: "xs", color: color.muted }),
        text(tr(lang, `時間：${formatSeoulTime(reservation.time)}`, `시간: ${formatSeoulTime(reservation.time)}`), { color: color.time, weight: "bold" }),
        text(tr(lang, `人数：${reservation.partySize}名`, `인원: ${reservation.partySize}명`)),
        text(tr(lang, `予約名：${reservation.alias}`, `예약자 이름: ${reservation.alias}`)),
        text(
          reservation.evidence === "call_accept"
            ? tr(lang, `根拠：電話でお店が承諾（${formatSeoulTime(reservation.acceptedAt)}）`, `근거: 전화로 가게가 수락 (${formatSeoulTime(reservation.acceptedAt)})`)
            : tr(lang, `根拠：お店に確認したと依頼者が共有（${formatSeoulTime(reservation.acceptedAt)}）`, `근거: 가게에 확인했다고 요청자가 공유 (${formatSeoulTime(reservation.acceptedAt)})`),
          { size: "xs", color: color.muted },
        ),
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
    ? { type: "text", text: tr(lang, `${BOT_NAME.ja}です。グループでは「${BOT_NAME.ja} 新村で2人、サムギョプサル。20時までに弘大」のように名前を付けて呼んでください。`, `${BOT_NAME.ko}예요. 그룹에서는 "${BOT_NAME.ko} 신촌에서 2명, 삼겹살. 8시까지 홍대"처럼 이름을 붙여 불러 주세요.`) }
    : { type: "text", text: tr(lang, `${BOT_NAME.ja}です。食べたいもの、人数、いる場所、次の予定を送ってください。例：「新村で2人、サムギョプサル。20時までに弘大のライブ会場に着きたい」`, `${BOT_NAME.ko}예요. 먹고 싶은 것, 인원, 지금 위치, 다음 일정을 보내 주세요. 예: "신촌에서 2명, 삼겹살. 8시까지 홍대 공연장"`) };
}

export function didNotUnderstand(lang: Lang): LineMessage {
  return greeting(lang, "user");
}

export function arrivalTimePassed(lang: Lang, place: Place, arriveBy: string): LineMessage {
  return { type: "text", text: tr(lang, `${place.nameJa}の${formatSeoulTime(arriveBy)}はもう過ぎています。到着したい時間をもう一度送ってください。`, `${place.nameKo} ${formatSeoulTime(arriveBy)}은 이미 지났어요. 도착하고 싶은 시간을 다시 보내 주세요.`) };
}

export function waitRecorded(lang: Lang, restaurant: Restaurant, plan: CandidatePlan): string {
  if (plan.verdict === "late") return tr(lang, `${restaurant.nameJa}は${plan.marginMinutes}分間に合わない見込みです。`, `${restaurant.nameKo}는 ${plan.marginMinutes}분 늦을 것 같아요.`);
  if (plan.verdict === "fits") return tr(lang, `${restaurant.nameJa}は間に合う見込みです。`, `${restaurant.nameKo}는 시간 안에 들어갈 수 있을 것 같아요.`);
  return tr(lang, `${restaurant.nameJa}の待ち状況を記録しました。`, `${restaurant.nameKo}의 대기 상황을 기록했어요.`);
}

