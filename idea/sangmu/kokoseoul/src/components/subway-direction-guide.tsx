"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale, type Locale } from "@/lib/locale";
import { getLineTwoNeighbors, getLineTwoStation, getLineTwoTrip, lineTwoStations, type LineTwoStation } from "@/modules/transit/line-two";

type Situation = "before" | "onboard" | "exit";
const situations: Record<Situation, { ja: string; ko: string }> = {
  before: { ja: "乗る前", ko: "타기 전" },
  onboard: { ja: "乗車中", ko: "열차 안" },
  exit: { ja: "改札・出口", ko: "개찰구·출구" },
};

function stationLabel(station: LineTwoStation, locale: Locale) {
  return `${station.code} ${pickLocale(locale, station.ja, station.ko)}`;
}

function normalize(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[\s.()'’·-]/g, "");
}

function StationPicker({ id, label, code, onSelect, readings }: {
  id: string;
  label: string;
  code: string;
  onSelect: (code: string) => void;
  readings: Record<string, string>;
}) {
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const selected = getLineTwoStation(code);
  const field = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    (code ? changeButton.current : field.current)?.focus();
  }, [code]);
  const normalized = normalize(query);
  const results = lineTwoStations.filter((item) =>
    [item.code, item.ko, `${item.ko}역`, item.ja, `${item.ja}駅`, item.en, readings[item.ko] ?? ""]
      .some((value) => normalize(value).includes(normalized)),
  ).slice(0, 8);

  return (
    <div className="min-w-0">
      <p className="block font-black text-[#504e49]" id={`${id}-label`}>{label}</p>
      {selected ? (
        <div className="mt-2 flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-white px-3">
          <span className="min-w-0 font-bold">{stationLabel(selected, locale)}</span>
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
              {results.map((item) => (
                <li key={item.code}>
                  <button type="button" onClick={() => { restoreFocus.current = true; onSelect(item.code); }} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-start hover:bg-[var(--surface-muted)]">
                    <span className="font-bold">{stationLabel(item, locale)}</span>
                    <span lang="ko" className="text-sm text-slate-600">{item.ko}</span>
                  </button>
                </li>
              ))}
              {results.length === 0 ? <li className="p-3 text-sm" role="status">{pickLocale(locale, "2号線の駅名か駅番号を確認してください。", "2호선에서 찾을 수 없어요. 역 이름이나 역번호를 확인해 주세요.")}</li> : null}
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
  { id: "enter", ko: "개찰구에 들어가기 전", ja: "改札に入る前", titleKo: "교통카드를 찍기 전에 호선과 방면을 확인해요", titleJa: "カードをタッチする前に路線と方面を確認", bodyKo: "개찰구 앞에서 2호선 표지와 타려는 방향을 확인해요. 방향을 모르겠으면 ‘타기 전’에서 다음 역을 찾아보고 역무원에게 물어봐요.", bodyJa: "改札の手前で2号線の表示と乗る方向を確認します。迷ったら「乗る前」で次の駅を調べて、駅員に聞きましょう。", phraseKo: "2호선을 타려고 해요. 지도에 나온 방향으로 가려면 어느 개찰구로 들어가면 되나요?", phraseJa: "2号線に乗りたいです。地図の方向へ行くには、どの改札から入ればいいですか？" },
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
  const [situation, setSituation] = useState<Situation>("before");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [observed, setObserved] = useState("");
  const [transfer, setTransfer] = useState<LineTwoStation | null>(null);
  const trip = getLineTwoTrip(origin, destination);
  const next = trip?.stops[1];
  const originStation = getLineTwoStation(origin);
  const destinationStation = getLineTwoStation(destination);
  const observedStation = getLineTwoStation(observed);
  const differs = next && observedStation && next.code !== observedStation.code;

  function changeOrigin(code: string) {
    setOrigin(code);
    setObserved("");
    setTransfer(null);
  }

  return (
    <section className="seoul-surface rounded-2xl p-4 sm:p-6" aria-label={pickLocale(locale, "地下鉄の現地サポート", "지하철 현장 안내")}>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={pickLocale(locale, "今の状況", "지금 상황")}>
        {(Object.keys(situations) as Situation[]).map((item) => (
          <button key={item} type="button" className={choiceClass} aria-pressed={item === situation} onClick={() => { setSituation(item); setObserved(""); setTransfer(null); }}>
            {pickLocale(locale, situations[item].ja, situations[item].ko)}
          </button>
        ))}
      </div>
      {situation === "exit" ? <ExitHelp /> : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <StationPicker id="subway-origin" label={pickLocale(locale, situation === "onboard" ? "最後に停車した駅" : "今いる駅", situation === "onboard" ? "마지막으로 정차한 역" : "지금 있는 역")} code={origin} onSelect={changeOrigin} readings={readings} />
            <StationPicker id="subway-destination" label={pickLocale(locale, "降りたい駅", "내릴 역")} code={destination} readings={readings} onSelect={(code) => { setDestination(code); setObserved(""); setTransfer(null); }} />
          </div>

          {trip && !next ? (
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

          {trip && next && originStation && destinationStation ? (
            <>
              {transfer ? (
                <p className="mt-5 rounded-xl bg-[#fbf4e6] p-4 font-bold" role="status">
                  {pickLocale(locale, `${stationLabel(transfer, locale)}で乗り換えます。乗り換え案内に従って次のホームを確認しましょう。`, `${stationLabel(transfer, locale)}에서 갈아타요. 환승 안내를 따라 다음 승강장을 확인해요.`)}
                </p>
              ) : null}
              <div className="mt-5 rounded-xl border border-[#455f54]/25 bg-[#edf1ef] p-4 sm:p-5" role="status">
                <h2 className="font-black text-[#455f54]">{pickLocale(locale, "次の駅で方向を照合", "다음 역으로 방향 확인")}</h2>
                <p className="mt-2 text-2xl font-black">{stationLabel(next, locale)}</p>
                <p className="mt-1 font-semibold"><span lang="ko">{next.ko}</span> · <span lang="en">{next.en}</span></p>
                <p className="mt-3 text-sm leading-6">{pickLocale(locale, "ホームの表示や車内案内と見比べてください。行先表示が途中駅止まりの場合は、目的の駅まで行くか駅員に確認しましょう。", "승강장 표지나 열차 안내와 대조해요. 행선지가 중간 역까지만 표시되면 목적지까지 가는 열차인지 역무원에게 확인해요.")}</p>
                {trip.changes.length > 0 ? (
                  <p className="mt-2 text-sm font-black text-[#504e49]">
                    {pickLocale(locale, "2号線の乗り換え駅", "2호선 안에서 갈아탈 역")} · {trip.changes.map((item) => stationLabel(item, locale)).join(" / ")}
                  </p>
                ) : null}
              </div>
              {situation === "onboard" ? (
                <div className="mt-5">
                  <label className="block font-black" htmlFor="subway-observed">{pickLocale(locale, "案内で確認した次の駅", "안내에서 확인한 다음 역")}</label>
                  <select id="subway-observed" value={observed} onChange={(event) => setObserved(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3">
                    <option value="">{pickLocale(locale, "まだ分かりません", "아직 모르겠어요")}</option>
                    {getLineTwoNeighbors(origin).map((item) => <option key={item.code} value={item.code}>{stationLabel(item, locale)} · {item.ko}</option>)}
                    <option value="other">{pickLocale(locale, "一覧にない駅が案内された", "목록에 없는 역이 안내됐어요")}</option>
                  </select>
                  <div className="mt-3 rounded-xl bg-[#fbf4e6] p-4 leading-7" role="status">
                    {differs ? (
                      <>
                        <p>{pickLocale(locale, `選んだ方向と異なります。次の停車駅が「${stationLabel(observedStation, locale)}」と確認できたら、そこで降りて方向を確かめましょう。`, `고른 방향과 달라요. 다음 정차역이 ‘${stationLabel(observedStation, locale)}’가 맞으면 그 역에서 내려 방향을 확인해요.`)}</p>
                        <button type="button" onClick={() => { changeOrigin(observedStation.code); setSituation("before"); }} className="seoul-button-primary mt-3 min-h-11 rounded-xl px-3 font-bold">
                          {pickLocale(locale, "降りた駅から調べ直す", "내린 역에서 다시 찾기")}
                        </button>
                      </>
                    ) : observedStation ? (
                      <>
                        <p>{pickLocale(locale, "次の駅は選んだ方向と一致しています。行先表示も確かめましょう。", "다음 역이 고른 방향과 일치해요. 열차 행선지도 확인해요.")}</p>
                        <button type="button" onClick={() => {
                          changeOrigin(observedStation.code);
                          if (trip.changes.some((item) => item.code === observedStation.code)) {
                            setTransfer(observedStation);
                            setSituation("before");
                          }
                        }} className="mt-2 min-h-11 font-bold underline">
                          {pickLocale(locale, "この駅に着いたら、次を確認", "이 역에 도착했어요")}
                        </button>
                      </>
                    ) : (
                      <p>{pickLocale(locale, "車内表示か停車駅の駅名・駅番号を確認してください。判断できなければ駅員に聞きましょう。", "열차 화면이나 정차한 역에서 이름·번호를 확인해요. 판단하기 어렵다면 역무원에게 물어봐요.")}</p>
                    )}
                  </div>
                </div>
              ) : null}
              <details className="mt-5 rounded-xl border border-[var(--border)] p-4">
                <summary className="cursor-pointer font-black">{pickLocale(locale, `停車駅を見る · ${trip.stops.length - 1}駅`, `정차역 보기 · ${trip.stops.length - 1}정거장`)}</summary>
                <ol className="mt-3 grid gap-2 pl-2">
                  {trip.stops.map((item) => <li key={item.code}>{stationLabel(item, locale)} · <span lang="ko">{item.ko}</span></li>)}
                </ol>
              </details>
              <HelpPhrase
                key={`${situation}:${origin}:${destination}`}
                ko={situation === "onboard"
                  ? `${destinationStation.ko}역에 가고 싶어요. 지금 탄 열차가 그쪽으로 가나요?`
                  : `${destinationStation.ko}역에 가려고 해요. 다음 역이 ${next.ko}역인 열차를 타면 되나요?`}
                ja={situation === "onboard"
                  ? `${destinationStation.ja}駅へ行きたいです。この電車で行けますか？`
                  : `${destinationStation.ja}駅へ行きたいです。次が${next.ja}駅の電車に乗ればいいですか？`}
              />
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
