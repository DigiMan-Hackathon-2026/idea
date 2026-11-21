"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale, type Locale } from "@/lib/locale";
import { getSubwayNeighbors, getSubwayStation, getSubwayTransfer, getSubwayTrip, isLineNineExpressStop, subwayStations, type SubwayStation } from "@/modules/transit/subway-network";
import { emptySubwayRide, readSavedRide, restoreSubwayRide, saveSubwayRide, subscribeToSavedRide, type SubwayRide } from "@/modules/transit/saved-subway-ride";

type Situation = "before" | "onboard" | "exit";
const situations: Record<Situation, { ja: string; ko: string }> = {
  before: { ja: "乗る前", ko: "타기 전" },
  onboard: { ja: "乗車中", ko: "열차 안" },
  exit: { ja: "改札・出口", ko: "개찰구·출구" },
};

function stationLabel(station: SubwayStation, locale: Locale) {
  return `${station.code} ${pickLocale(locale, station.ja, station.ko)}`;
}

function lineLabel(line: SubwayStation["line"], locale: Locale) {
  return pickLocale(locale, `${line}号線`, `${line}호선`);
}

function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[\s.()'’·-]/g, "");
}

const stationAliases: Record<string, string[]> = {
  "409": ["당고개", "タンゴゲ", "Danggogae"],
  "432": ["이수", "イス", "Isu"],
  "512": ["キンポゴンハン"],
  "728": ["뚝섬유원지", "トゥクソムユウォンジ", "Ttukseom Resort"],
  "736": ["총신대입구", "チョンシンデイック", "Chongshin Univ."],
};

function StationPicker({ id, label, code, onSelect, readings }: {
  id: string;
  label: string;
  code: string;
  onSelect: (code: string) => void;
  readings: Record<string, string>;
}) {
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const selected = getSubwayStation(code);
  const field = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    (code ? changeButton.current : field.current)?.focus();
  }, [code]);
  const normalized = normalize(query);
  const results = normalized ? subwayStations.flatMap((item) => {
    const terms = [item.code, item.ko, `${item.ko}역`, item.ja, `${item.ja}駅`, item.en, readings[item.ko] ?? "",
      ...(stationAliases[item.code] ?? [])].map(normalize);
    if (terms.includes(normalized)) return [{ item, rank: 0 }];
    if (terms.some((term) => term.startsWith(normalized))) return [{ item, rank: 1 }];
    return terms.some((term) => term.includes(normalized)) ? [{ item, rank: 2 }] : [];
  }).sort((a, b) => a.rank - b.rank).slice(0, 8) : [];

  return (
    <div className="min-w-0">
      <p className="block font-black text-[#504e49]" id={`${id}-label`}>{label}</p>
      {selected ? (
        <div className="mt-2 flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-white px-3">
          <span className="min-w-0 font-bold">{stationLabel(selected, locale)} · {lineLabel(selected.line, locale)}</span>
          <button ref={changeButton} type="button" className="min-h-11 shrink-0 text-sm font-bold text-[#941e34] underline" aria-describedby={`${id}-label`} onClick={() => { restoreFocus.current = true; onSelect(""); setQuery(""); }}>
            {pickLocale(locale, "選び直す", "다시 고르기")}
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            ref={field}
            aria-labelledby={`${id}-label`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={pickLocale(locale, "駅名・駅番号", "역 이름·역번호")}
            className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 font-medium"
            autoComplete="off"
          />
          {normalized ? (
            <ul className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[var(--border)] bg-white">
              {results.map(({ item }) => (
                <li key={item.code}>
                  <button type="button" onClick={() => { restoreFocus.current = true; onSelect(item.code); }} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-start hover:bg-[var(--surface-muted)]">
                    <span className="font-bold">{stationLabel(item, locale)}</span>
                    <span className="text-end text-sm text-slate-600">
                      {locale === "ja" ? <><span lang="ko">{item.ko}</span> · </> : null}<span className="whitespace-nowrap">{lineLabel(item.line, locale)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {results.length === 0 ? <li className="p-3 text-sm" role="status">{pickLocale(locale, "1〜9号線の駅名か駅番号を確認してください。", "1~9호선의 역 이름이나 역번호를 확인해 주세요.")}</li> : null}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

function HelpPhrase({ ko, ja }: { ko: string; ja: string }) {
  const { locale } = useLocale();
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(ko);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }
  return (
    <section className="mt-5 rounded-xl bg-[#eef1f6] p-4">
      <h3 className="font-black">{pickLocale(locale, "駅員に見せる韓国語", "역무원에게 보여줄 문장")}</h3>
      <p lang="ko" className="mt-2 select-all text-xl font-black leading-relaxed">{ko}</p>
      {locale === "ja" ? <p lang="ja" className="mt-2 text-sm leading-6">{ja}</p> : null}
      <button type="button" onClick={copy} className="mt-2 min-h-11 font-bold underline">{pickLocale(locale, "韓国語をコピー", "한국어 문장 복사")}</button>
      <span role="status" className="ml-3 text-sm">
        {feedback === "copied" ? pickLocale(locale, "コピーしました", "복사했어요") : null}
        {feedback === "failed" ? pickLocale(locale, "文を長押ししてコピーしてください。", "문장을 길게 눌러 복사해 주세요.") : null}
      </span>
    </section>
  );
}

const exitSituations = [
  { id: "enter", ko: "개찰구에 들어가기 전", ja: "改札に入る前", titleKo: "교통카드를 찍기 전에 호선과 방면을 확인해요", titleJa: "カードをタッチする前に路線と方面を確認", bodyKo: "개찰구 앞에서 타려는 호선과 방향을 확인해요. 방향을 모르겠으면 ‘타기 전’에서 다음 역을 찾아보고 역무원에게 물어봐요.", bodyJa: "改札の手前で乗る路線と方向を確認します。迷ったら「乗る前」で次の駅を調べて、駅員に聞きましょう。", phraseKo: "이 방향으로 가려면 어느 개찰구로 들어가면 되나요?", phraseJa: "この方向へ行くには、どの改札から入ればいいですか？" },
  { id: "gate", ko: "개찰구를 나가기 전", ja: "改札を出る前", titleKo: "개찰구를 통과하기 전에 출구 번호를 확인해요", titleJa: "改札を出る前に出口番号を確認", bodyKo: "목적지의 출구 번호와 개찰구 위 표지를 대조해요. 모르겠으면 교통카드를 찍기 전에 역무원에게 물어봐요.", bodyJa: "目的地の出口番号と改札上の案内を見比べます。迷ったら、交通カードをタッチする前に駅員に聞きましょう。", phraseKo: "이 목적지로 가려면 몇 번 출구가 가까운가요? 어느 개찰구로 나가면 될까요?", phraseJa: "この目的地へ行くには何番出口が近いですか？ どの改札から出ればいいですか？" },
  { id: "wrong-gate", ko: "다른 개찰구로 나왔어요", ja: "別の改札から出た", titleKo: "교통카드를 다시 찍기 전에 연결 통로를 물어봐요", titleJa: "カードを再度タッチする前に連絡通路を確認", bodyKo: "원하는 출구 번호를 보여주고 개찰구 밖으로 이동할 수 있는지 확인해요.", bodyJa: "目的の出口番号を見せ、改札の外から行けるか尋ねます。", phraseKo: "다른 개찰구로 나왔어요. 교통카드를 다시 찍지 않고 목표 출구로 갈 수 있나요?", phraseJa: "別の改札から出ました。交通カードを再度タッチせずに目的の出口へ行けますか？" },
  { id: "wrong-exit", ko: "다른 출구로 나왔어요", ja: "別の出口から出た", titleKo: "지금 나온 출구 번호로 다시 찾아요", titleJa: "今いる出口番号から探し直す", bodyKo: "출구 기둥에서 역 이름과 번호를 확인해요. 지도를 열어 ‘역 이름 + 출구 번호’를 출발지로 쓰고, 길을 건널 때는 횡단보도를 이용해요.", bodyJa: "出口の柱で駅名と番号を確認します。地図で「駅名＋出口番号」を出発地に設定し、道路は横断歩道で渡りましょう。", phraseKo: "여기가 몇 번 출구인가요? 이 목적지까지 가는 안전한 길을 알려 주세요.", phraseJa: "ここは何番出口ですか？ この目的地まで安全に行ける道を教えてください。" },
] as const;

const choiceClass = "min-h-12 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-black text-[#504e49] aria-pressed:border-[#941e34] aria-pressed:bg-[#f7ecee] aria-pressed:text-[#941e34]";

function ExitHelp() {
  const { locale } = useLocale();
  const [selection, setSelection] = useState<(typeof exitSituations)[number]["id"]>("enter");
  const selected = exitSituations.find(({ id }) => id === selection)!;
  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={pickLocale(locale, "改札・出口での状況", "개찰구·출구 상황")}>
        {exitSituations.map((item) => <button key={item.id} type="button" className={choiceClass} aria-pressed={item.id === selection} onClick={() => setSelection(item.id)}>{pickLocale(locale, item.ja, item.ko)}</button>)}
      </div>
      <div className="mt-5 rounded-xl bg-[#edf1ef] p-4" role="status">
        <h2 className="text-lg font-black">{pickLocale(locale, selected.titleJa, selected.titleKo)}</h2>
        <p className="mt-2 leading-7">{pickLocale(locale, selected.bodyJa, selected.bodyKo)}</p>
      </div>
      <HelpPhrase key={selected.id} ko={selected.phraseKo} ja={selected.phraseJa} />
    </div>
  );
}

export function SubwayDirectionGuide({ readings }: { readings: Record<string, string> }) {
  const { locale } = useLocale();
  const saved = restoreSubwayRide(useSyncExternalStore(subscribeToSavedRide, readSavedRide, () => null));
  const [draft, setDraft] = useState<SubwayRide | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const ride = draft ?? saved ?? emptySubwayRide;
  const { situation, origin, destination, train } = ride;
  const [observed, setObserved] = useState("");
  const [otherStation, setOtherStation] = useState("");
  const transfer = getSubwayStation(ride.transfer);
  const trip = useMemo(() => getSubwayTrip(origin, destination, train), [origin, destination, train]);
  const next = trip?.next;
  const pendingChange = getSubwayTransfer(origin, ride.transfer);
  const changeNow = pendingChange ?? trip?.changeNow;
  const localChange = trip?.localChange;
  const alight = trip?.changes[0]?.from ?? getSubwayStation(destination);
  const observedStation = getSubwayStation(observed);
  const differs = next && observedStation && next.code !== observedStation.code;

  function updateRide(next: SubwayRide) {
    setDraft(next);
    setObserved("");
    setOtherStation("");
    setStorageFailed(!saveSubwayRide(next));
  }

  return (
    <section className="seoul-surface rounded-2xl p-4 sm:p-6" aria-label={pickLocale(locale, "地下鉄の現地サポート", "지하철 현장 안내")}>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={pickLocale(locale, "今の状況", "지금 상황")}>
        {(Object.keys(situations) as Situation[]).map((item) => (
          <button key={item} type="button" className={choiceClass} aria-pressed={item === situation} onClick={() => updateRide({ ...ride, situation: item })}>
            {pickLocale(locale, situations[item].ja, situations[item].ko)}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 text-sm text-slate-600">
        <p role="status">
          {storageFailed
            ? pickLocale(locale, "このブラウザーでは保存できませんでした。", "이 브라우저에는 이동 정보를 저장하지 못했어요.")
            : saved
              ? pickLocale(locale, "この端末に保存した案内です。今いる駅を確かめてください。", "이 기기에 저장된 안내예요. 지금 있는 역을 확인해 주세요.")
              : pickLocale(locale, "駅を二つ選ぶと、この端末に案内を保存します。", "역 두 곳을 고르면 안내를 이 기기에 저장해요.")}
        </p>
        {saved || origin || destination ? (
          <button type="button" onClick={() => updateRide(emptySubwayRide)} className="min-h-11 font-bold text-[#941e34] underline">
            {pickLocale(locale, "移動情報を消す", "이동 정보 지우기")}
          </button>
        ) : null}
      </div>
      {situation === "exit" ? <ExitHelp /> : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StationPicker id="subway-origin" label={pickLocale(locale, situation === "onboard" ? "最後に停車した駅" : "今いる駅", situation === "onboard" ? "마지막으로 정차한 역" : "지금 있는 역")} code={origin} onSelect={(code) => updateRide({ ...ride, origin: code, transfer: "", train: "local" })} readings={readings} />
            <StationPicker id="subway-destination" label={pickLocale(locale, "降りたい駅", "내릴 역")} code={destination} readings={readings} onSelect={(code) => updateRide({ ...ride, destination: code, transfer: "" })} />
          </div>

          {origin !== destination && destination && !pendingChange && getSubwayStation(origin)?.line === 9 ? (
            <fieldset className="mt-5">
              <legend className="font-black">{pickLocale(locale, "9号線の電車", "9호선 열차 종류")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={choiceClass} aria-pressed={train === "local"} onClick={() => { if (train !== "local") updateRide({ ...ride, train: "local", transfer: "" }); }}>
                  {pickLocale(locale, "各駅停車", "일반")}
                </button>
                <button type="button" className={`${choiceClass} disabled:opacity-50`} aria-pressed={train === "express"} disabled={!isLineNineExpressStop(origin)} onClick={() => { if (train !== "express") updateRide({ ...ride, train: "express", transfer: "" }); }}>
                  {pickLocale(locale, "急行", "급행")}
                </button>
              </div>
              {!isLineNineExpressStop(origin) ? (
                <p className="mt-2 text-sm text-slate-600">{pickLocale(locale, "この駅は急行が通過します。各駅停車を利用してください。", "급행은 이 역을 지나가요. 일반열차를 이용해 주세요.")}</p>
              ) : null}
              <a href="https://www.metro9.co.kr/prog/subwayTm/kor/sub01_02/list.do" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-bold underline">
                {pickLocale(locale, "9号線の公式時刻表（別タブ）", "9호선 공식 시간표 (새 탭)")}
              </a>
            </fieldset>
          ) : null}

          {trip && origin === destination ? (
            <p role="status" className="mt-5 rounded-xl bg-[#edf1ef] p-4 font-bold">
              {situation === "onboard"
                ? pickLocale(locale, "最後に停車した駅が目的の駅です。すでに発車した場合は、次に停車した駅を入力して調べ直しましょう。", "마지막으로 정차한 역이 목적지예요. 이미 출발했다면 다음 정차역에서 역 이름을 확인하고 다시 입력해요.")
                : pickLocale(locale, "今いる駅と降りたい駅が同じです。駅名・駅番号を確認し、出口を探してください。", "지금 있는 역과 내릴 역이 같아요. 역 이름과 번호를 확인하고 출구를 찾아요.")}
            </p>
          ) : null}

          {!trip && situation === "onboard" ? (
            <details className="mt-5 rounded-xl border border-[var(--border)] p-4">
              <summary className="cursor-pointer font-black">{pickLocale(locale, "今いる駅が分からない", "지금 어느 역인지 모르겠어요")}</summary>
              <p className="mt-3 leading-7">{pickLocale(locale, "次に停車したとき、窓の外の駅名か車内表示を確認してください。駅名が分かれば「最後に停車した駅」に入力できます。", "다음 정차 때 창밖 역 이름이나 열차 안내 화면을 확인해요. 이름을 알게 되면 ‘마지막으로 정차한 역’에 입력해요.")}</p>
              <HelpPhrase ko="제가 지금 어느 역에 있는지 알려 주실 수 있나요?" ja="今どの駅にいるか教えていただけますか？" />
            </details>
          ) : null}

          {changeNow ? (
            <>
              <section className="mt-5 rounded-xl bg-[#fbf4e6] p-4 sm:p-5">
                <h2 className="text-xl font-black">{pickLocale(locale, `${lineLabel(changeNow.to.line, locale)}に乗り換え`, `${lineLabel(changeNow.to.line, locale)}으로 갈아타요`)}</h2>
                <p className="mt-2 font-bold">{stationLabel(changeNow.from, locale)} → {stationLabel(changeNow.to, locale)}</p>
                <p className="mt-2 leading-7">
                  {situation === "onboard"
                    ? pickLocale(locale, "この駅で降りて、乗り換え表示に従ってください。", "이 역에서 내려 환승 표지를 따라가요.")
                    : pickLocale(locale, "乗り換え表示に従い、ホームの駅番号を確認してください。", "환승 표지를 따라가 승강장에서 역번호를 확인해요.")}
                </p>
                <button type="button" onClick={() => updateRide({ ...ride, origin: changeNow.to.code, situation: "before", transfer: "", train: "local" })} className="seoul-button-primary mt-3 min-h-11 rounded-xl px-3 font-bold">
                  {pickLocale(locale, "乗り換え先のホームに着いた", "갈아탈 승강장에 도착했어요")}
                </button>
              </section>
              <HelpPhrase
                key={changeNow.to.code}
                ko={`${changeNow.to.line}호선으로 갈아타려고 해요. 어느 쪽으로 가면 되나요?`}
                ja={`${changeNow.to.line}号線に乗り換えたいです。どちらへ行けばいいですか？`}
              />
            </>
          ) : null}

          {trip && next && alight && !changeNow ? (
            <>
              {transfer ? (
                <p className="mt-5 rounded-xl bg-[#fbf4e6] p-4 font-bold" role="status">
                  {transfer.line === 9 && train === "local"
                    ? pickLocale(locale, `${stationLabel(transfer, locale)}で各駅停車に乗り換えます。`, `${stationLabel(transfer, locale)}에서 일반열차로 갈아타요.`)
                    : pickLocale(locale, `${stationLabel(transfer, locale)}で乗り換えます。乗り換え案内に従って次のホームを確認しましょう。`, `${stationLabel(transfer, locale)}에서 갈아타요. 환승 안내를 따라 다음 승강장을 확인해요.`)}
                </p>
              ) : null}
              <div className="mt-5 rounded-xl border border-[#455f54]/25 bg-[#edf1ef] p-4 sm:p-5" role="status">
                <h2 className="font-black text-[#455f54]">{pickLocale(locale, "次の駅で方向を照合", "다음 역으로 방향 확인")}</h2>
                <p className="mt-2 text-2xl font-black">{stationLabel(next, locale)}</p>
                <p className="mt-1 font-semibold">{lineLabel(next.line, locale)} · <span lang="ko">{next.ko}</span> · <span lang="en">{next.en}</span></p>
                <p className="mt-3 text-sm leading-6">{pickLocale(locale, "ホームの表示や車内案内と見比べてください。", "승강장 표지나 열차 안내와 대조해요.")}</p>
                {train === "express" ? (
                  <p className="mt-1 text-sm font-bold">{pickLocale(locale, "急行の停車駅です。電車の種別を確認してください。", "급행 정차역이에요. 열차 종류를 확인해요.")}</p>
                ) : next.line === 1 || next.line === 4 || next.line === 9 ? (
                  <p className="mt-1 text-sm font-bold">{pickLocale(locale, "各駅停車の案内です。電車の種別を確認してください。", "일반열차 기준이에요. 열차 종류를 확인해요.")}</p>
                ) : null}
                {next.line === 1 || next.line === 4 || next.line === 5 || next.line === 9 || trip.changes.length > 0 ? (
                  <p className="mt-2 text-sm font-bold">{pickLocale(locale, `行先表示を見て「${stationLabel(alight, locale)}」まで行くか確かめてください。`, `행선지 표시를 보고 ‘${stationLabel(alight, locale)}’까지 가는지 확인해요.`)}</p>
                ) : null}
                {localChange ? (
                  <div className="mt-2 text-sm">
                    <p className="font-black">{pickLocale(locale, `${stationLabel(localChange, locale)}で降りて、各駅停車に乗り換えてください。`, `${stationLabel(localChange, locale)}에서 내려 일반열차로 갈아타요.`)}</p>
                    {situation === "before" && getSubwayStation(destination)?.line === 9 ? (
                      <p className="mt-1">{pickLocale(locale, "乗る前なら、最初から各駅停車でも行けます。", "아직 타기 전이라면 일반열차로 한 번에 갈 수 있어요.")}</p>
                    ) : null}
                  </div>
                ) : null}
                {trip.changes.length > 0 && !localChange ? (
                  <p className="mt-2 text-sm font-black text-[#504e49]">
                    {trip.changes.some(({ from, to }) => from.line !== to.line)
                      ? pickLocale(locale, "乗り換え駅", "갈아탈 역")
                      : pickLocale(locale, `${lineLabel(next.line, locale)}の乗り換え駅`, `${lineLabel(next.line, locale)} 안에서 갈아탈 역`)} · {trip.changes.map(({ from, to }) =>
                      from.line === to.line ? stationLabel(from, locale) : `${stationLabel(from, locale)} → ${lineLabel(to.line, locale)} ${to.code}`,
                    ).join(" / ")}
                  </p>
                ) : null}
              </div>
              {situation === "onboard" ? (
                <div className="mt-5">
                  <label className="block font-black" htmlFor="subway-observed">{pickLocale(locale, "案内で確認した次の駅", "안내에서 확인한 다음 역")}</label>
                  <select id="subway-observed" value={observed} onChange={(event) => { setObserved(event.target.value); setOtherStation(""); }} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3">
                    <option value="">{pickLocale(locale, "まだ分かりません", "아직 모르겠어요")}</option>
                    {getSubwayNeighbors(origin, train).map((item) => <option key={item.code} value={item.code}>{stationLabel(item, locale)} · {item.ko}</option>)}
                    <option value="other">{pickLocale(locale, "一覧にない駅が案内された", "목록에 없는 역이 안내됐어요")}</option>
                  </select>
                  <div className="mt-3 rounded-xl bg-[#fbf4e6] p-4 leading-7" role="status">
                    {differs ? (
                      <>
                        <p>{pickLocale(locale, `選んだ方向と異なります。次の停車駅が「${stationLabel(observedStation, locale)}」と確認できたら、そこで降りて方向を確かめましょう。`, `고른 방향과 달라요. 다음 정차역이 ‘${stationLabel(observedStation, locale)}’가 맞으면 그 역에서 내려 방향을 확인해요.`)}</p>
                        <button type="button" onClick={() => updateRide({ ...ride, origin: observedStation.code, situation: "before", transfer: "", train: "local" })} className="seoul-button-primary mt-3 min-h-11 rounded-xl px-3 font-bold">
                          {pickLocale(locale, "降りた駅から調べ直す", "내린 역에서 다시 찾기")}
                        </button>
                      </>
                    ) : observedStation ? (
                      <>
                        <p>{pickLocale(locale, "次の駅は選んだ方向と一致しています。行先表示も確かめましょう。", "다음 역이 고른 방향과 일치해요. 열차 행선지도 확인해요.")}</p>
                        <button type="button" onClick={() => {
                          const change = trip.changes[0];
                          const changeTrains = change?.from.code === observedStation.code;
                          updateRide({
                            ...ride,
                            origin: observedStation.code,
                            transfer: changeTrains ? change.to.code : "",
                            situation: changeTrains ? "before" : "onboard",
                            train: changeTrains ? "local" : train,
                          });
                        }} className="mt-2 min-h-11 font-bold underline">
                          {pickLocale(locale, "この駅に着いたら、次を確認", "이 역에 도착했어요")}
                        </button>
                      </>
                    ) : observed === "other" ? (
                      <>
                        <p className="mb-3">{pickLocale(locale, "急行や別の路線かもしれません。停車したら、駅の名前と駅番号で調べ直してください。", "급행이나 다른 호선일 수 있어요. 정차하면 역 이름과 역번호를 확인하고 다시 찾아요.")}</p>
                        <StationPicker id="subway-other-station" label={pickLocale(locale, "実際に停車した駅", "실제로 정차한 역")} code={otherStation} onSelect={setOtherStation} readings={readings} />
                        {otherStation ? (
                          <button type="button" onClick={() => updateRide({ ...ride, origin: otherStation, situation: "before", transfer: "", train: "local" })} className="seoul-button-primary mt-3 min-h-11 rounded-xl px-3 font-bold">
                            {pickLocale(locale, "この駅から調べ直す", "이 역에서 다시 찾기")}
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <p>{pickLocale(locale, "車内表示か停車駅の駅名・駅番号を確認してください。判断できなければ駅員に聞きましょう。", "열차 화면이나 정차한 역에서 이름·번호를 확인해요. 판단하기 어렵다면 역무원에게 물어봐요.")}</p>
                    )}
                  </div>
                </div>
              ) : null}
              <details className="mt-5 rounded-xl border border-[var(--border)] p-4">
                <summary className="cursor-pointer font-black">{pickLocale(locale, `経路を見る · ${trip.rideStops}駅`, `경로 보기 · ${trip.rideStops}정거장`)}</summary>
                <ol className="mt-3 grid gap-2 pl-2">
                  {trip.stops.map((item, index) => <li key={`${index}:${item.code}`}>
                    {stationLabel(item, locale)} · {lineLabel(item.line, locale)}
                    {locale === "ja" ? <> · <span lang="ko">{item.ko}</span></> : null}
                  </li>)}
                </ol>
              </details>
              <HelpPhrase
                key={`${situation}:${origin}:${destination}:${train}`}
                ko={situation === "onboard"
                  ? `${alight.ko}역에 가고 싶어요. 지금 탄 ${train === "express" ? "급행열차" : "열차"}가 거기까지 가나요?`
                  : `${alight.ko}역에 가려고 해요. 다음 역이 ${next.ko}역인 ${train === "express" ? "급행열차" : "열차"}를 타면 되나요?`}
                ja={situation === "onboard"
                  ? `${alight.ja}駅へ行きたいです。この${train === "express" ? "急行" : "電車"}で行けますか？`
                  : `${alight.ja}駅へ行きたいです。次が${next.ja}駅の${train === "express" ? "急行" : "電車"}に乗ればいいですか？`}
              />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
