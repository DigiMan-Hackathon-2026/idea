"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import type { DemoQuest } from "@/modules/content/demo-quests";

type SituationId = "before_gate" | "platform" | "on_train" | "wrong_way";

type SituationCopy = {
  id: SituationId;
  labelJa: string;
  labelKo: string;
  titleJa: string;
  titleKo: string;
  checksJa: string[];
  checksKo: string[];
  actionJa: string;
  actionKo: string;
  phraseKo: string;
  phraseJa: string;
};

const SITUATIONS: SituationCopy[] = [
  {
    id: "before_gate",
    labelJa: "改札に入る前",
    labelKo: "개찰구에 들어가기 전",
    titleJa: "入る前に、路線と目的駅を照合します",
    titleKo: "들어가기 전에 노선과 목적역을 맞춰 봐요",
    checksJa: [
      "NAVERマップの出発駅と乗換駅",
      "案内板の路線色・路線番号",
      "目的駅の韓国語・英語・駅番号",
    ],
    checksKo: [
      "네이버 지도의 출발역과 환승역",
      "표지판의 노선색과 노선 번호",
      "목적역의 한글·영문·역번호",
    ],
    actionJa: "三つが一致しないときは改札を通らず、駅員にこの画面を見せてください。",
    actionKo: "세 가지가 맞지 않으면 개찰구를 통과하지 말고 역무원에게 이 화면을 보여 주세요.",
    phraseKo: "성수역에 가려면 이 개찰구가 맞나요?",
    phraseJa: "聖水駅へ行くには、この改札で合っていますか？",
  },
  {
    id: "platform",
    labelJa: "ホームで待っている",
    labelKo: "승강장에서 기다리는 중",
    titleJa: "列車が来る前に、行先をもう一度確認します",
    titleKo: "열차가 오기 전에 행선지를 한 번 더 확인해요",
    checksJa: [
      "ホーム案内板の方面・行先",
      "NAVERマップに表示された次の駅",
      "到着列車の前面・側面の行先表示",
    ],
    checksKo: [
      "승강장 표지판의 방면과 행선지",
      "네이버 지도에 표시된 다음 역",
      "도착 열차 앞면·옆면의 행선지 표시",
    ],
    actionJa: "行先が違う、または判断できない場合は乗らずに、次の列車か駅員を確認してください。",
    actionKo: "행선지가 다르거나 판단하기 어렵다면 타지 말고 다음 열차나 역무원을 확인해 주세요.",
    phraseKo: "성수역에 가는 열차는 이 승강장에서 타나요?",
    phraseJa: "聖水駅へ行く列車は、このホームから乗りますか？",
  },
  {
    id: "on_train",
    labelJa: "すでに乗車した",
    labelKo: "이미 열차에 탑승함",
    titleJa: "車内表示と次の駅で、今の方向を確かめます",
    titleKo: "차내 표시와 다음 역으로 지금 방향을 확인해요",
    checksJa: [
      "車内画面・放送の次の駅",
      "ドア上の路線図で目的駅までの並び",
      "NAVERマップの現在の経路",
    ],
    checksKo: [
      "차내 화면·방송의 다음 역",
      "문 위 노선도에서 목적역까지의 순서",
      "네이버 지도의 현재 경로",
    ],
    actionJa: "目的駅へ向かうか確信できない場合は、次の駅で安全に降りてから確認してください。",
    actionKo: "목적역으로 가는지 확신하기 어렵다면 다음 역에서 안전하게 내린 뒤 확인해 주세요.",
    phraseKo: "이 열차가 성수역에 가나요?",
    phraseJa: "この列車は聖水駅へ行きますか？",
  },
  {
    id: "wrong_way",
    labelJa: "方向を間違えたかもしれない",
    labelKo: "방향을 잘못 잡은 것 같음",
    titleJa: "急いで移動せず、次の駅で経路を立て直します",
    titleKo: "서둘러 이동하지 말고 다음 역에서 경로를 다시 잡아요",
    checksJa: [
      "まず次の駅名と駅番号を記録",
      "NAVERマップで現在の駅から再検索",
      "反対ホームへ行く前に改札・乗換案内を確認",
    ],
    checksKo: [
      "먼저 다음 역 이름과 역번호 확인",
      "네이버 지도에서 현재 역을 기준으로 다시 검색",
      "반대편으로 가기 전 개찰구·환승 안내 확인",
    ],
    actionJa: "ホームを推測して移動せず、案内板か駅員で確認してください。改札の外へ出る必要があるかも先に尋ねます。",
    actionKo: "승강장을 추측해 이동하지 말고 표지판이나 역무원에게 확인해 주세요. 개찰구 밖으로 나가야 하는지도 먼저 물어보세요.",
    phraseKo: "반대 방향 열차를 탄 것 같아요. 성수역에 가려면 어디로 가야 하나요?",
    phraseJa: "反対方向の列車に乗ったようです。聖水駅へ行くには、どこへ行けばいいですか？",
  },
];

export function SubwayFieldGuide({ quest }: { quest: DemoQuest }) {
  const { locale } = useLocale();
  const [selectedId, setSelectedId] = useState<SituationId | null>(null);
  const [copied, setCopied] = useState(false);
  const selected = SITUATIONS.find(({ id }) => id === selectedId) ?? null;
  const destinationSign = `${quest.transitGuide.stationKo} · Seongsu · ${quest.transitGuide.stationJa} · ${quest.transitGuide.stationCode}`;

  async function copyPhrase() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.phraseKo);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby={`field-guide-${quest.id}`}>
      <p className="text-sm font-black text-[#ff5a36]">
        {pickLocale(locale, "駅構内サポート · デモ", "역 안 이동 지원 · 데모")}
      </p>
      <h2 id={`field-guide-${quest.id}`} className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {pickLocale(locale, "地下鉄で迷ったとき、今どこにいますか？", "지하철에서 헷갈릴 때, 지금 어디에 있나요?")}
      </h2>
      <p className="mt-3 text-base font-semibold leading-7 text-slate-600">
        {pickLocale(
          locale,
          "現在の状況を一つ選ぶと、確認する表示と次の行動を案内します。リアルタイム運行情報ではありません。",
          "현재 상황 하나를 고르면 확인할 표지와 다음 행동을 알려드려요. 실시간 운행 정보는 아니에요.",
        )}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label={pickLocale(locale, "現在の状況", "현재 상황")}>
        {SITUATIONS.map((situation) => {
          const active = situation.id === selectedId;
          return (
            <button
              key={situation.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSelectedId(situation.id);
                setCopied(false);
              }}
              className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-base font-black transition-colors ${
                active
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400"
              }`}
            >
              {pickLocale(locale, situation.labelJa, situation.labelKo)}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-5 rounded-3xl bg-[#f4f7fb] p-5" aria-live="polite">
          <p className="text-sm font-black text-[#087735]">
            {pickLocale(locale, "目的地の表示", "목적지 표지")}
          </p>
          <p className="mt-2 rounded-2xl bg-white px-4 py-3 text-lg font-black text-slate-950" lang="ko">
            <span className="mr-2 inline-grid size-7 place-items-center rounded-full bg-[#00a84d] text-sm text-white">{quest.transitGuide.lineCode}</span>
            {destinationSign}
          </p>

          <h3 className="mt-5 text-xl font-black leading-7 text-slate-950">
            {pickLocale(locale, selected.titleJa, selected.titleKo)}
          </h3>
          <ul className="mt-4 grid gap-3">
            {pickLocale(locale, selected.checksJa, selected.checksKo).map((check) => (
              <li key={check} className="flex gap-3 text-base font-semibold leading-7 text-slate-700">
                <span className="mt-2 size-2 shrink-0 rounded-full bg-[#00a84d]" aria-hidden="true" />
                {check}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-2xl border border-[#ff5a36]/20 bg-[#fff0eb] p-4 text-base font-bold leading-7 text-[#852a19]">
            {pickLocale(locale, selected.actionJa, selected.actionKo)}
          </p>

          <div className="mt-5 rounded-2xl bg-white p-4">
            <p className="text-sm font-black text-slate-500">
              {pickLocale(locale, "駅員に見せる韓国語", "역무원에게 보여 줄 한국어")}
            </p>
            <p className="mt-3 text-2xl font-black leading-9 text-slate-950" lang="ko">{selected.phraseKo}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{selected.phraseJa}</p>
            <button
              type="button"
              onClick={copyPhrase}
              className="mt-4 min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-base font-black text-white"
            >
              {copied
                ? pickLocale(locale, "韓国語をコピーしました", "한국어 문장을 복사했어요")
                : pickLocale(locale, "韓国語をコピー", "한국어 문장 복사")}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-base font-bold leading-7 text-slate-600">
          {pickLocale(locale, "今いる場所に最も近い状況を選んでください。", "지금 있는 곳과 가장 가까운 상황을 골라 주세요.")}
        </p>
      )}
    </section>
  );
}
