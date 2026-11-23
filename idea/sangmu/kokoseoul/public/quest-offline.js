// Keep the key and checks in sync with src/modules/content/offline-quests.ts.
const STORAGE_KEY = "yeogiseoul.offline-quests.v1";
const LINE_COLORS = { 1: "#0052a4", 2: "#00a84d", 3: "#ef7c1c", 4: "#00a5de", 5: "#996cac", 6: "#cd7c2f", 7: "#747f00", 8: "#e6186c", 9: "#bdb092" };
const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function isText(value) {
  return typeof value === "string" && value.length > 0;
}

function isStep(step) {
  return step && isText(step.titleJa) && isText(step.titleKo) &&
    ["bodyJa", "bodyKo", "phraseJa", "phraseKo"].every((key) => step[key] === undefined || isText(step[key]));
}

function isQuest(quest) {
  return quest && isText(quest.path) && /^\/quests\/[a-z0-9-]+$/.test(quest.path) &&
    isText(quest.titleJa) && isText(quest.titleKo) &&
    (quest.exitJa === null || isText(quest.exitJa)) && (quest.exitKo === null || isText(quest.exitKo)) &&
    Array.isArray(quest.lines) && quest.lines.every((line) => Number.isInteger(line) && line >= 1 && line <= 9) &&
    (quest.straightLineM === null || (typeof quest.straightLineM === "number" && quest.straightLineM >= 0)) &&
    Array.isArray(quest.closedWeekdays) && quest.closedWeekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) &&
    isText(quest.addressKo) && (quest.verifiedAt === null || isText(quest.verifiedAt)) &&
    Array.isArray(quest.steps) && quest.steps.length > 0 && quest.steps.every(isStep) && isText(quest.savedAt);
}

function readQuests() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter(isQuest) : [];
  } catch {
    return [];
  }
}

function writeQuests(list) {
  try {
    if (list.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    else localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

const ko = (text, tag = "span") => el(tag, { lang: "ko", textContent: text });

function seoulWeekday() {
  return WEEKDAY[new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Seoul" }).format(new Date())];
}

function formatDate(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(date);
}

function closedNotice(days) {
  if (!days.length) return null;
  const today = seoulWeekday();
  const ja = days.map((day) => DAYS_JA[day]).join("·");
  const kor = days.map((day) => DAYS_KO[day]).join("·");
  const closedToday = days.includes(today);
  const notice = el("p", { className: closedToday ? "notice today" : "notice" });
  if (closedToday) {
    notice.append(
      `今日は${DAYS_JA[today]}曜日です。毎週${ja}曜は休みなので、公式案内を確認してから向かってください。`,
      el("br"),
      ko(`오늘은 ${DAYS_KO[today]}요일이에요. 매주 ${kor}요일은 쉬는 곳이라 공식 안내를 확인하고 가 주세요.`),
    );
  } else {
    notice.append(`毎週${ja}曜は休みです · `, ko(`매주 ${kor}요일은 쉬어요`));
  }
  return notice;
}

function renderQuest(quest, onRemove) {
  const card = el("article", { className: "card" });
  card.setAttribute("aria-labelledby", "quest-title");
  card.append(el("h2", { id: "quest-title" }, quest.titleJa, ko(quest.titleKo)));

  if (quest.exitJa && quest.exitKo) {
    const exit = el("p", { className: "exit" });
    for (const line of quest.lines) {
      const badge = el("span", { className: "line", textContent: `${line}号線 · ${line}호선` });
      badge.style.borderLeftColor = LINE_COLORS[line];
      exit.append(badge);
    }
    exit.append(quest.exitJa, " · ", ko(quest.exitKo));
    card.append(exit);
  }
  if (quest.straightLineM !== null) {
    const metres = new Intl.NumberFormat("ja-JP").format(quest.straightLineM);
    card.append(el("p", { className: "muted" },
      `出口から開始地点まで直線で約${metres} mです。実際の道のりはこれより長くなります。`, el("br"),
      ko(`출구에서 시작 지점까지 직선으로 약 ${metres} m예요. 실제로 걷는 길은 이보다 길어요.`)));
  }
  card.append(closedNotice(quest.closedWeekdays));

  const steps = el("ol");
  quest.steps.forEach((step, index) => {
    const item = el("li", {}, el("strong", { textContent: `${index + 1}. ${step.titleJa}` }), ko(step.titleKo, "span"));
    if (step.bodyJa) item.append(el("p", { textContent: step.bodyJa }));
    if (step.bodyKo) item.append(ko(step.bodyKo, "p"));
    if (step.phraseKo) {
      item.append(el("div", { className: "phrase" },
        el("p", { className: "muted", textContent: "見せる韓国語カード · 보여 주는 한국어 카드" }),
        ko(step.phraseKo, "p"),
        step.phraseJa ? el("p", { className: "muted", textContent: step.phraseJa }) : null));
    }
    steps.append(item);
  });
  card.append(steps);

  card.append(el("p", { className: "muted" }, "住所 · ", ko("주소")));
  card.append(ko(quest.addressKo, "p"));
  card.lastChild.className = "address";

  const verifiedJa = quest.verifiedAt && formatDate(quest.verifiedAt, "ja-JP");
  const verifiedKo = quest.verifiedAt && formatDate(quest.verifiedAt, "ko-KR");
  const savedJa = formatDate(quest.savedAt, "ja-JP");
  const savedKo = formatDate(quest.savedAt, "ko-KR");
  card.append(el("p", { className: "muted" },
    `${savedJa}にこの端末へ保存した内容です${verifiedJa ? `（${verifiedJa}時点の公式案内に基づく）` : ""}。営業時間や混み具合は現地で確かめてください。`,
    el("br"),
    ko(`${savedKo}에 이 기기에 저장한 내용이에요${verifiedKo ? ` (${verifiedKo} 공식 안내 기준)` : ""}. 영업시간과 혼잡도는 현장에서 확인해 주세요.`)));

  const remove = el("button", { type: "button" }, "この端末から消す · ", ko("이 기기에서 지우기"));
  remove.addEventListener("click", onRemove);
  card.append(remove);
  return card;
}

function render() {
  const quests = readQuests();
  const path = location.pathname.replace(/\/+$/, "");
  const current = quests.find((quest) => quest.path === path) || null;
  const target = document.getElementById("quest");
  target.replaceChildren();
  document.getElementById("empty").hidden = quests.length > 0;
  if (path.startsWith("/quests/")) document.getElementById("reload").href = path;

  if (current) {
    target.append(renderQuest(current, () => {
      if (writeQuests(quests.filter((quest) => quest.path !== current.path))) render();
    }));
  } else if (quests.length && path.startsWith("/quests/")) {
    target.append(el("p", { className: "card" },
      "このページは保存されていません。保存したクエストから選んでください。", el("br"),
      ko("이 페이지는 저장되지 않았어요. 저장한 퀘스트 중에서 골라 주세요.")));
  }

  const others = quests.filter((quest) => quest !== current);
  const list = document.getElementById("other-list");
  list.replaceChildren(...others.map((quest) =>
    el("li", {}, el("a", { href: quest.path }, quest.titleJa, " · ", ko(quest.titleKo)))));
  document.getElementById("others").hidden = others.length === 0;
}

render();
