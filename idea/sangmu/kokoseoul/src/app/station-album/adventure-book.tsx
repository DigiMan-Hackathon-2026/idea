"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { bookLink, withAdventureOrigin } from "@/lib/adventure-origin";
import { pickLocale, type Locale } from "@/lib/locale";
import { fetchMyRuns, QuestRunApiError, type MyRunSummaryDto } from "@/modules/progress/run-api";
import { AlbumBackLink } from "./album-back-link";
import type { SubwayStation } from "@/modules/transit/subway-stations";
import type { AlbumLine } from "./album-data";
import type { AdventureCategory, AdventureMission } from "./adventure-data";
import styles from "./station-album.module.css";

const categories: { id: AdventureCategory; ko: string; ja: string }[] = [
  { id: "journey", ko: "대표 여정", ja: "おすすめの体験" },
  { id: "food", ko: "동네 한 끼", ja: "街のごはん" },
  { id: "sights", ko: "풍경과 명소", ja: "風景と名所" },
  { id: "culture", ko: "문화 체험", ja: "文化体験" },
  { id: "shopping", ko: "쇼핑과 뷰티", ja: "買い物と美容" },
  { id: "show", ko: "공연 관람", ja: "公演鑑賞" },
  { id: "discovery", ko: "거리의 발견", ja: "街の発見" },
  { id: "challenge", ko: "대표 도전", ja: "チャレンジ" },
  { id: "story", ko: "역 이름의 비밀", ja: "駅名のひみつ" },
  { id: "theme", ko: "주제 탐방", ja: "テーマめぐり" },
  { id: "phrase", ko: "서울에서 한마디", ja: "ソウルでひとこと" },
  { id: "transfer", ko: "환승 연습", ja: "乗り換え練習" },
];

const adventureTabs: { id: string; ko: string; ja: string; categories: AdventureCategory[] }[] = [
  { id: "journey", ko: "방문 퀘스트", ja: "訪問クエスト", categories: ["journey", "challenge", "theme"] },
  { id: "experiences", ko: "장소 체험", ja: "体験", categories: ["food", "sights", "culture", "shopping", "show", "discovery"] },
  { id: "station", ko: "이야기·환승", ja: "駅と乗換", categories: ["story", "phrase", "transfer"] },
];

const prefix = "digiman.adventure-field.v1:";
const changed = "digiman:adventure-field-changed";

function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener("storage", listener);
  };
}

function readFieldRecords() {
  try {
    const storage = window.localStorage;
    const ids = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key !== null && key.startsWith(prefix) && storage.getItem(key) === "1")
      .map((key) => key.slice(prefix.length))
      .sort();
    return JSON.stringify(ids);
  } catch {
    return "unavailable";
  }
}

function saveAdventureRecord(id: string, completed: boolean) {
  if (completed) window.localStorage.setItem(prefix + id, "1");
  else window.localStorage.removeItem(prefix + id);
  window.dispatchEvent(new Event(changed));
}

function FieldMissionCard({ mission, locale, completed, storageAvailable, expanded, stationHref }: {
  mission: Extract<AdventureMission, { type: "field" }>;
  locale: Locale;
  completed: boolean;
  storageAvailable: boolean;
  expanded?: boolean;
  stationHref?: string;
}) {
  const [failed, setFailed] = useState(false);
  const t = (ja: string, ko: string) => pickLocale(locale, ja, ko);

  function updateRecord() {
    try {
      saveAdventureRecord(mission.id, !completed);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  const content = <>
      <p>{mission.condition[locale]}</p>
      {mission.note && <p>{mission.note[locale]}</p>}
      {stationHref && <Link className={styles.adventureLink} href={stationHref} prefetch={false}>
        {t(`${mission.station.ja}駅の案内を見る`, `${mission.station.ko}역 안내 보기`)}
      </Link>}
      <a className={styles.adventureLink} href={mission.officialUrl} target="_blank" rel="noreferrer">
        {t("公式案内を開く（別タブ）", "공식 안내 열기(새 탭)")}
      </a>
      <p>{t("体験したことを、このブラウザーに記録できます。", "직접 한 체험을 이 브라우저에 기록할 수 있어요.")}</p>
      <button className={expanded && !completed ? styles.bookAction : undefined} type="button" onClick={updateRecord} disabled={!storageAvailable}>
        {completed ? t("記録を取り消す", "완료 기록 취소") : t("体験を記録する", "체험 완료 기록")}
      </button>
      {(failed || !storageAvailable) && <p role="status">{t("記録を保存できません。ブラウザーの保存設定をご確認ください。", "기록을 저장할 수 없어요. 브라우저의 저장 설정을 확인해 주세요.")}</p>}
  </>;
  return expanded ? <div className={styles.fieldMission}>{content}</div> : (
    <details className={styles.fieldMission}>
      <summary>{t("達成条件を見る", "완료 조건 보기")}</summary>
      {content}
    </details>
  );
}

function QuizMissionCard({ mission, locale, completed, storageAvailable, expanded, guideHref }: {
  mission: Extract<AdventureMission, { type: "quiz" }>;
  locale: Locale;
  completed: boolean;
  storageAvailable: boolean;
  expanded?: boolean;
  guideHref: string;
}) {
  const [message, setMessage] = useState<"retry" | "unavailable">();
  const t = (ja: string, ko: string) => pickLocale(locale, ja, ko);

  function answer(index: number) {
    if (index !== mission.answerIndex) {
      setMessage("retry");
      return;
    }
    try {
      saveAdventureRecord(mission.id, true);
      setMessage(undefined);
    } catch {
      setMessage("unavailable");
    }
  }

  const content = <>
      <p>{mission.question[locale]}</p>
      {completed ? <p role="status">{t("正解", "정답")} · {mission.options[mission.answerIndex][locale]}</p> : (
        <div className={styles.quizOptions}>
          {mission.options.map((option, index) => (
            <button type="button" key={option.ko} onClick={() => answer(index)} disabled={!storageAvailable}>
              {option[locale]}
            </button>
          ))}
        </div>
      )}
      {message === "retry" && <p role="status">{t("ヒントを読んで、もう一度選んでみましょう。", "힌트를 읽고 다시 골라보세요.")}</p>}
      {message === "unavailable" && <p role="status">{t("記録を保存できませんでした。もう一度お試しください。", "기록을 저장하지 못했어요. 다시 시도해 주세요.")}</p>}
      {!storageAvailable && <p role="status">{t("ブラウザーの保存設定をご確認ください。", "브라우저의 저장 설정을 확인해 주세요.")}</p>}
      <Link className={styles.adventureLink} href={guideHref} prefetch={false}>
        {mission.category === "transfer" ? t("駅の案内を見る", "역 안내 보기") : t("駅名の物語を読む", "역 이름 이야기 읽기")}
      </Link>
  </>;
  return expanded ? <div className={styles.fieldMission}>{content}</div> : (
    <details className={styles.fieldMission}>
      <summary>{t("クイズを開く", "문제 열기")}</summary>
      {content}
    </details>
  );
}

export function AdventureBook({ line, station, missions, locale, book, missionId }: {
  line: AlbumLine;
  station?: SubwayStation;
  missions: AdventureMission[];
  locale: Locale;
  book?: string;
  missionId?: string;
}) {
  const t = (ja: string, ko: string) => pickLocale(locale, ja, ko);
  const lineName = t(`${line.id}号線`, `${line.id}호선`);
  const name = station ? t(`${station.ja}駅`, `${station.ko}역`) : lineName;
  const bookTitle = t(`${name}の冒険ノート`, `${name} 모험의 서`);
  const stationCode = station?.code;
  const [request, setRequest] = useState(0);
  const [history, setHistory] = useState<{ request: number; runs: MyRunSummaryDto[]; error?: true }>();
  const openedFrom = useRef<{ lineId: number; stationCode?: string; tabId: string; missionId: string; scrollY: number }>(null);
  const fieldSnapshot = useSyncExternalStore(subscribe, readFieldRecords, () => null);
  const fieldAvailable = fieldSnapshot !== null && fieldSnapshot !== "unavailable";
  const fields = new Set<string>(fieldAvailable ? JSON.parse(fieldSnapshot) as string[] : []);
  const hasQuests = missions.some(({ type }) => type === "quest");
  const currentHistory = hasQuests && history?.request === request ? history : undefined;

  useEffect(() => {
    if (!hasQuests) return;
    let active = true;
    void fetchMyRuns().then(
      (runs) => { if (active) setHistory({ request, runs }); },
      (error: unknown) => {
        if (!active) return;
        const noSession = error instanceof QuestRunApiError && error.code === "SESSION_REQUIRED";
        setHistory({ request, runs: [], ...(noSession ? {} : { error: true }) });
      },
    );
    return () => { active = false; };
  }, [hasQuests, request]);

  const runs = new Map(currentHistory?.runs.filter((run) => !run.isDemo).map((run) => [run.questId, run]));
  const isComplete = (mission: AdventureMission) => mission.type === "field" || mission.type === "quiz"
    ? fields.has(mission.id) : mission.type === "quest" && runs.get(mission.id)?.status === "completed";
  const tabs = adventureTabs.map((tab) => ({
    ...tab,
    count: missions.filter(({ category }) => tab.categories.includes(category)).length,
    available: missions.filter(({ category, type }) => tab.categories.includes(category) && type !== "planned").length,
  })).filter(({ count }) => count > 0);
  const activeTab = tabs.find(({ id }) => id === book);
  const tabMissions = activeTab ? missions.filter(({ category }) => activeTab.categories.includes(category)) : [];
  const selectedMission = tabMissions.find(({ id, type }) => id === missionId && type !== "planned");
  const activeTabId = activeTab?.id;
  const selectedMissionId = selectedMission?.id;
  useEffect(() => {
    const previous = openedFrom.current;
    if (!previous) return;
    if (previous.lineId !== line.id || previous.stationCode !== stationCode || previous.tabId !== activeTabId) {
      openedFrom.current = null;
      return;
    }
    if (selectedMissionId) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`book-mission-${previous.missionId}`)?.focus({ preventScroll: true });
      window.scrollTo({ top: previous.scrollY, behavior: "instant" });
      openedFrom.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTabId, line.id, selectedMissionId, stationCode]);
  const readyMissions = tabMissions.filter(({ type }) => type !== "planned");
  const plannedMissions = tabMissions.filter(({ type }) => type === "planned");
  const ongoing = missions.find(({ id, type }) => type === "quest" && runs.get(id)?.status === "in_progress");
  const suggested = !ongoing && missions.find((mission) => mission.type === "field" && !isComplete(mission));
  const suggestedTab = suggested && adventureTabs.find(({ categories }) => categories.includes(suggested.category));
  const plannedCount = missions.filter(({ type }) => type === "planned").length;
  const required = missions.filter(({ optional, type }) => !optional && type !== "planned");
  const total = required.length;
  const done = required.filter(isComplete).length;
  const progressReady = (!required.some(({ type }) => type === "field" || type === "quiz") || fieldAvailable)
    && (!required.some(({ type }) => type === "quest") || (!!currentHistory && !currentHistory.error));
  const percent = progressReady && total > 0 ? Math.floor(done * 100 / total) : null;
  const milestones = [
    { percent: 25, title: t(`${name}の探検家`, `${name} 탐험가`) },
    { percent: 60, title: t(`${name}の案内人`, `${name} 길잡이`) },
    { percent: 100, title: t(`${name}マスター`, `${name} 마스터`) },
  ];

  function missionMeta(mission: AdventureMission) {
    return <p className={styles.missionMeta}>
      {t(`${mission.station.ja}駅`, `${mission.station.ko}역`)}
      {mission.optional && <span>{t("任意", "선택 체험")}</span>}
      {mission.type === "quest" && mission.durationMinutes && <span>{t(`約${mission.durationMinutes}分`, `약 ${mission.durationMinutes}분`)}</span>}
      {isComplete(mission) && <span data-earned="true">{t("達成", "달성")}</span>}
      {runs.get(mission.id)?.status === "in_progress" && <span>{t("進行中", "진행 중")}</span>}
      {mission.type === "planned" && <span>{t("準備中", "준비 중")}</span>}
    </p>;
  }

  function missionActions(mission: AdventureMission, expanded = false) {
    const props = { locale, completed: isComplete(mission), storageAvailable: fieldAvailable, expanded };
    const tab = adventureTabs.find(({ categories }) => categories.includes(mission.category));
    const origin = tab ? { line: line.id, book: tab.id, mission: mission.id, station: stationCode } : null;
    if (mission.type === "field") {
      const stationHref = expanded ? withAdventureOrigin(`/subway?station=${mission.station.code}#station-album-entry`, origin) : undefined;
      return <FieldMissionCard key={mission.id} mission={mission} {...props} stationHref={stationHref} />;
    }
    if (mission.type === "quiz") return <QuizMissionCard key={mission.id} mission={mission} {...props} guideHref={withAdventureOrigin(mission.href, origin)} />;
    if (mission.type !== "quest") return null;
    const run = runs.get(mission.id);
    return <Link className={expanded ? styles.bookAction : styles.adventureLink} prefetch={false}
      href={withAdventureOrigin(run?.status === "in_progress" ? `/runs/${run.id}` : mission.href, origin)}>
      {run?.status === "in_progress" ? t("クエストの続きへ", "퀘스트 이어하기") : t("訪問ガイドを見る", "방문 안내 보기")}
    </Link>;
  }

  const availabilityText = t(`体験できる ${missions.length - plannedCount}枠 · 準備中 ${plannedCount}枠`,
    `체험 가능 ${missions.length - plannedCount}칸 · 준비 중 ${plannedCount}칸`);
  const historyStatus = <>
    {hasQuests && !currentHistory && <p role="status">{t("クエストの記録を読み込み中です。", "퀘스트 기록을 불러오는 중이에요.")}</p>}
    {currentHistory?.error && <div role="status">
      <p>{t("クエストの記録を読み込めませんでした。", "퀘스트 기록을 불러오지 못했어요.")}</p>
      <button className={styles.adventureLink} type="button" onClick={() => setRequest((value) => value + 1)}>{t("記録を再読み込み", "퀘스트 기록 다시 불러오기")}</button>
    </div>}
  </>;
  const progressNote = plannedCount > 0
    ? t("今できる必須項目の達成数を表示します。路線の称号はすべての項目がそろったら公開します。", "지금 할 수 있는 필수 항목의 완료 수를 보여줘요. 호선 칭호는 모든 항목이 준비되면 열려요.")
    : t("必須のクエストや体験を完了すると達成率に反映されます。", "필수 퀘스트와 체험을 완료하면 달성률에 반영돼요.");
  const milestoneList = !station && total > 0 && plannedCount === 0 && <ul className={styles.adventureGoals}>
    {milestones.map((goal) => (
      <li key={goal.percent} data-earned={percent !== null && percent >= goal.percent}>
        <strong>{goal.title}</strong>
        <span>{percent !== null && percent >= goal.percent ? t("達成", "달성") : `${goal.percent}%`}</span>
      </li>
    ))}
  </ul>;
  const stationIndexLink = <Link className={styles.adventureLink} href={{ ...bookLink(line.id, "stations"), hash: "book-page" }} prefetch={false}>
    {t("駅からクエストを探す", "역별 모험의 서 보기")}
  </Link>;
  const nearbyLink = station && <Link className={styles.adventureLink} href={{ pathname: "/quests/nearby", query: { station: station.code }, hash: "station-quests" }} prefetch={false}>
    {t("この駅の近くのクエストを探す", "이 역 주변 퀘스트 찾기")}
  </Link>;

  if (activeTab) return (
    <section id="book-page" className={styles.bookPage} style={{ "--line-color": line.color } as CSSProperties} aria-labelledby="book-page-title">
      <header className={styles.albumPageHeader}>
        <AlbumBackLink
          href={{ ...bookLink(line.id, selectedMission ? activeTab.id : undefined, undefined, stationCode), hash: selectedMission ? "book-page" : "adventure-book" }}
          label={selectedMission ? t(`${activeTab.ja}の一覧に戻る`, `${activeTab.ko} 목록으로 돌아가기`) : t("冒険ノートの目次に戻る", "모험의 서 목차로 돌아가기")}
        />
        <div>
          <p className={styles.note}>{name}</p>
          <h1 id="book-page-title">{selectedMission?.title[locale] ?? t(activeTab.ja, activeTab.ko)}</h1>
        </div>
      </header>
      {selectedMission ? <>
        {missionMeta(selectedMission)}
        {selectedMission.type === "quest" && <p className={styles.questSummary}>{selectedMission.summary[locale]}</p>}
        {missionActions(selectedMission, true)}
        <p><Link className={styles.adventureLink} prefetch={false} href={{
          pathname: "/station-album",
          query: { line: line.id, station: selectedMission.station.ko, fromLine: line.id, fromBook: activeTab.id, fromMission: selectedMission.id, fromStation: stationCode },
          hash: "station-story",
        }}>{t(`${selectedMission.station.ja}駅のスタンプを見る`, `${selectedMission.station.ko}역 스탬프 보기`)}</Link></p>
      </> : <>
        {missionId && <p role="status">{t("この項目は開けません。体験できる項目を一覧から選べます。", "이 항목은 열 수 없어요. 목록에서 지금 할 수 있는 항목을 골라보세요.")}</p>}
        <p className={styles.note}>{t(`今できる項目 ${readyMissions.length}件`, `지금 할 수 있는 항목 ${readyMissions.length}개`)}</p>
        {categories.map(({ id, ko, ja }) => {
          const items = readyMissions.filter(({ category }) => category === id);
          return items.length > 0 && <section key={id} className={styles.bookList} aria-labelledby={`book-list-${id}`}>
            <h3 id={`book-list-${id}`}>{t(ja, ko)}</h3>
            <ul>{items.map((mission) => <li key={mission.id}>
              <Link id={`book-mission-${mission.id}`} href={{ ...bookLink(line.id, activeTab.id, mission.id, stationCode), hash: "book-page" }} prefetch={false}
                onNavigate={() => {
                  openedFrom.current = { lineId: line.id, stationCode, tabId: activeTab.id, missionId: mission.id, scrollY: window.scrollY };
                }}>
                <strong>{mission.title[locale]}</strong>
                {missionMeta(mission)}
              </Link>
            </li>)}</ul>
          </section>;
        })}
        {plannedMissions.length > 0 && <details className={styles.bookPlanned}>
          <summary>{t(`準備中の${plannedMissions.length}件を見る`, `준비 중 ${plannedMissions.length}개 보기`)}</summary>
          <ul>{plannedMissions.map((mission) => <li key={mission.id}>
            <strong>{mission.title[locale]}</strong>
            {missionMeta(mission)}
          </li>)}</ul>
        </details>}
      </>}
      {currentHistory?.error && historyStatus}
    </section>
  );

  return (
    <section id="adventure-book" className={styles.adventureBook} style={{ "--line-color": line.color } as CSSProperties}
      aria-label={bookTitle}>
      <div className={styles.bookContents}>
        {station && <AlbumBackLink href={{ ...bookLink(line.id, "stations"), hash: "book-page" }} label={t("駅の一覧に戻る", "역 목록으로 돌아가기")} />}
        <h1>{bookTitle}</h1>
        {plannedCount > 0 && <p className={styles.note}>{availabilityText}</p>}
        {percent !== null && <p className={styles.note}>{t(`必須の目標 ${done} / ${total}`, `필수 목표 ${done} / ${total}`)}</p>}
        {station && total === 0 && missions.every(({ type }) => type === "planned") &&
          <p className={styles.note}>{t("この駅の体験は準備中です。", "이 역의 체험은 준비 중이에요.")}</p>}
        {ongoing && missionActions(ongoing, true)}
        {suggested && suggestedTab && <Link className={styles.adventureSuggestion} prefetch={false}
          href={{ ...bookLink(line.id, suggestedTab.id, suggested.id, stationCode), hash: "book-page" }}>
          <span>{t("今できる体験", "지금 할 수 있는 체험")}</span>
          <strong>{suggested.title[locale]}</strong>
        </Link>}
        <nav aria-label={t("冒険ノートの項目", "모험 수첩 항목")}>
          {tabs.map((tab) => <Link key={tab.id} href={{ ...bookLink(line.id, tab.id, undefined, stationCode), hash: "book-page" }} prefetch={false}>
            <strong>{t(tab.ja, tab.ko)}</strong>
            <span>{tab.id === "experiences" && tab.available < tab.count
              ? t(`今できる ${tab.available}件 · 全${tab.count}件`, `지금 가능 ${tab.available}개 · 전체 ${tab.count}개`)
              : t(`${tab.count}枠`, `${tab.count}칸`)}</span>
          </Link>)}
        </nav>
        {station ? nearbyLink : stationIndexLink}
        {total > 0 && <details className={styles.bookProgressInfo}>
          <summary>{t("達成率と報酬について", "달성률과 보상 안내")}</summary>
          <p className={styles.note}>{progressNote}</p>
          {milestoneList}
        </details>}
        {currentHistory?.error && historyStatus}
      </div>
      <div className={styles.adventureCover}>
        <span className={styles.lineSeal}>{name}</span>
        <h1 id="adventure-heading">{bookTitle}</h1>
        {plannedCount > 0 ? (
          <div>
            <p className={styles.adventurePercent}>{t(`${missions.length}枠`, `${missions.length}칸`)}</p>
            <p>{availabilityText}</p>
          </div>
        ) : <>
          <p className={styles.adventurePercent}>{percent === null ? "—" : `${percent}%`}</p>
          {percent !== null && <progress className={styles.adventureProgress} aria-labelledby="adventure-heading" value={done} max={total} />}
          {progressReady && <p>{t(`必須の目標 ${done} / ${total}`, `필수 목표 ${done} / ${total}`)}</p>}
          {milestoneList}
        </>}
        {station && !missions.length
          ? <p className={styles.note}>{t("この駅の体験は準備中です。", "이 역의 체험은 준비 중이에요.")}</p>
          : <p className={styles.note}>{progressNote}</p>}
        {station ? <>{nearbyLink}<p>{stationIndexLink}</p></> : stationIndexLink}
        {historyStatus}
      </div>
      <div className={styles.adventurePages}>
        {categories.map(({ id, ko, ja }) => {
          const items = missions.filter(({ category }) => category === id);
          if (!items.length) return null;
          const tab = adventureTabs.find(({ categories }) => categories.includes(id));
          return (
            <section key={id} className={styles.adventureGroup} aria-labelledby={`adventure-${id}`}>
              <h3 id={`adventure-${id}`}>{t(ja, ko)}{plannedCount > 0 && <span>{t(`${items.length}枠`, `${items.length}칸`)}</span>}</h3>
              <ul className={styles.adventureMissions}>
                {items.map((mission) => (
                    <li key={mission.id} className={mission.type === "planned" ? styles.plannedMission : undefined}>
                      {missionMeta(mission)}
                      <h4>{mission.type !== "planned" && tab
                        ? <Link href={{ ...bookLink(line.id, tab.id, mission.id, stationCode), hash: "book-page" }} prefetch={false}>{mission.title[locale]}</Link>
                        : mission.title[locale]}</h4>
                      {missionActions(mission)}
                    </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
