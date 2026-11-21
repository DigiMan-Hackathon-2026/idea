"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale, type Locale } from "@/lib/locale";
import type { DemoQuest } from "@/modules/content/demo-quests";

type FloorId = "3f" | "2f" | "1f";
type LocationId = "platform" | "inside_gate" | "outside_gate" | "exit_3";
type RecoveryId = "wrong_platform" | "wrong_gate" | "wrong_exit";
type LocalizedCopy = { ja: string; ko: string };

type LocationGuide = {
  id: LocationId;
  floor: FloorId;
  label: LocalizedCopy;
  title: LocalizedCopy;
  action: LocalizedCopy;
  phrase: LocalizedCopy;
};

type RecoveryGuide = {
  id: RecoveryId;
  label: LocalizedCopy;
  title: LocalizedCopy;
  action: LocalizedCopy;
  phrase: LocalizedCopy;
};

const FLOORS: Array<{ id: FloorId; label: LocalizedCopy }> = [
  { id: "3f", label: { ja: "3F ホーム", ko: "3F 승강장" } },
  { id: "2f", label: { ja: "2F 改札・コンコース", ko: "2F 개찰구·대합실" } },
  { id: "1f", label: { ja: "1F 3番出口", ko: "1F 3번 출구" } },
];

const LOCATIONS: LocationGuide[] = [
  {
    id: "platform",
    floor: "3f",
    label: { ja: "3Fのホームで降りた", ko: "3F 승강장에서 내렸어요" },
    title: { ja: "まず「出口・Way out」を探します", ko: "먼저 ‘나가는 곳·Way out’을 찾아요" },
    action: {
      ja: "線路を渡ろうとせず、案内板に従って2Fへ下りてください。階段とエレベーターのどちらでも構いません。",
      ko: "선로를 건너려고 하지 말고 표지판을 따라 2F로 내려가세요. 계단이나 엘리베이터 중 편한 쪽을 이용해요.",
    },
    phrase: {
      ja: "3番出口へ行くには、どこから2階へ下りればいいですか？",
      ko: "3번 출구로 가려면 어디에서 2층으로 내려가야 하나요?",
    },
  },
  {
    id: "inside_gate",
    floor: "2f",
    label: { ja: "2F・改札の内側", ko: "2F 개찰구 안쪽이에요" },
    title: { ja: "「3番出口」の表示がある改札を確認します", ko: "‘3번 출구’ 표시가 있는 개찰구를 확인해요" },
    action: {
      ja: "3番出口の表示が見つかるまで改札を出ないでください。分からない場合は駅員にこの画面を見せます。",
      ko: "3번 출구 표시를 찾기 전에는 개찰구를 나가지 마세요. 모르겠다면 역무원에게 이 화면을 보여 주세요.",
    },
    phrase: {
      ja: "3番出口へ行くには、どの改札を通ればいいですか？",
      ko: "3번 출구로 가려면 어느 개찰구로 나가야 하나요?",
    },
  },
  {
    id: "outside_gate",
    floor: "2f",
    label: { ja: "2F・改札を出た", ko: "2F 개찰구 밖으로 나왔어요" },
    title: { ja: "黄色い出口番号から「3」を探します", ko: "출구 번호에서 ‘3’을 찾아요" },
    action: {
      ja: "3番以外の階段へ進まず、案内板の番号が3であることを確認してから1Fへ下ります。",
      ko: "3번이 아닌 계단으로 가지 말고, 표지판 번호가 3인지 확인한 뒤 1F로 내려가세요.",
    },
    phrase: { ja: "3番出口はどちらですか？", ko: "3번 출구는 어느 쪽인가요?" },
  },
  {
    id: "exit_3",
    floor: "1f",
    label: { ja: "1F・3番出口の前", ko: "1F 3번 출구 앞이에요" },
    title: { ja: "駅名と出口番号を最後に確認します", ko: "역 이름과 출구 번호를 마지막으로 확인해요" },
    action: {
      ja: "「聖水・Seongsu・211」と「3番出口」が一致したら、NAVERマップの徒歩ルートを開いてください。",
      ko: "‘성수·Seongsu·211’과 ‘3번 출구’가 맞으면 네이버 지도의 도보 경로를 열어 주세요.",
    },
    phrase: { ja: "ここは聖水駅の3番出口で合っていますか？", ko: "여기가 성수역 3번 출구가 맞나요?" },
  },
];

const RECOVERIES: RecoveryGuide[] = [
  {
    id: "wrong_platform",
    label: { ja: "違うホームにいる", ko: "다른 승강장에 있어요" },
    title: { ja: "線路を越えず、2Fのコンコースで確認します", ko: "선로를 넘지 말고 2F 대합실에서 확인해요" },
    action: {
      ja: "近くの「出口・Way out」から2Fへ移動し、駅員に3番出口への通路を確認してください。",
      ko: "가까운 ‘나가는 곳·Way out’을 따라 2F로 이동한 뒤 역무원에게 3번 출구 통로를 확인해 주세요.",
    },
    phrase: {
      ja: "違うホームに来たようです。3番出口へ行くには、どこへ行けばいいですか？",
      ko: "다른 승강장으로 온 것 같아요. 3번 출구로 가려면 어디로 가야 하나요?",
    },
  },
  {
    id: "wrong_gate",
    label: { ja: "違う改札から出た", ko: "다른 개찰구로 나왔어요" },
    title: { ja: "もう一度改札を通らず、駅員に連絡通路を確認します", ko: "다시 개찰구를 통과하지 말고 연결 통로를 확인해요" },
    action: {
      ja: "追加で交通カードをタッチする前に、駅員へ3番出口まで改札外で移動できるか尋ねてください。",
      ko: "교통카드를 다시 찍기 전에 역무원에게 개찰구 밖에서 3번 출구로 갈 수 있는지 물어보세요.",
    },
    phrase: {
      ja: "違う改札から出ました。改札の外から3番出口へ行けますか？",
      ko: "다른 개찰구로 나왔어요. 개찰구 밖에서 3번 출구로 갈 수 있나요?",
    },
  },
  {
    id: "wrong_exit",
    label: { ja: "別の出口から出た", ko: "다른 출구로 나왔어요" },
    title: { ja: "道路を無理に横断せず、出口番号を基準に戻ります", ko: "무리하게 길을 건너지 말고 출구 번호를 기준으로 돌아가요" },
    action: {
      ja: "NAVERマップで現在の出口から徒歩ルートを再検索してください。横断が危険なら駅員か安全な横断歩道を確認します。",
      ko: "네이버 지도에서 현재 출구를 기준으로 도보 경로를 다시 검색하세요. 길을 건너기 위험하다면 역무원이나 안전한 횡단보도를 확인해요.",
    },
    phrase: { ja: "別の出口から出ました。3番出口はどちらですか？", ko: "다른 출구로 나왔어요. 3번 출구는 어느 쪽인가요?" },
  },
];

function localize(locale: Locale, copy: LocalizedCopy) {
  return pickLocale(locale, copy.ja, copy.ko);
}

function FloorMap({ floor, location, locale }: { floor: FloorId; location: LocationId; locale: Locale }) {
  const markerFloor = location === "platform" ? "3f" : location === "exit_3" ? "1f" : "2f";
  const markerX = floor === "3f" ? 70 : floor === "2f" ? (location === "inside_gate" ? 132 : 228) : 74;
  const markerY = floor === "1f" ? 218 : floor === "3f" ? 84 : 132;

  return (
    <svg viewBox="0 0 360 260" className="h-auto w-full" role="img" aria-label={pickLocale(locale, `${floor.toUpperCase()}の概念図`, `${floor.toUpperCase()} 개념도`)}>
      <rect width="360" height="260" rx="24" fill="#f7faf9" />
      <text x="18" y="30" fill="#0f172a" fontSize="17" fontWeight="800">{floor.toUpperCase()}</text>
      <text x="64" y="30" fill="#64748b" fontSize="11" fontWeight="700">{pickLocale(locale, "概念図・縮尺と方角は実際と異なります", "개념도·축척과 방향은 실제와 달라요")}</text>

      {floor === "3f" ? (
        <>
          <rect x="18" y="60" width="324" height="36" rx="10" fill="#dbe4ea" />
          <rect x="18" y="166" width="324" height="36" rx="10" fill="#dbe4ea" />
          <line x1="18" y1="116" x2="342" y2="116" stroke="#334155" strokeWidth="6" />
          <line x1="18" y1="146" x2="342" y2="146" stroke="#334155" strokeWidth="6" />
          <text x="28" y="83" fill="#334155" fontSize="13" fontWeight="800">{pickLocale(locale, "ホーム", "승강장")}</text>
          <text x="28" y="189" fill="#334155" fontSize="13" fontWeight="800">{pickLocale(locale, "ホーム", "승강장")}</text>
          <path d="M70 84 H256" fill="none" stroke="#00a84d" strokeWidth="9" strokeLinecap="round" strokeDasharray="12 9" />
          <rect x="256" y="50" width="86" height="68" rx="14" fill="#ffffff" stroke="#00a84d" strokeWidth="3" />
          <text x="299" y="78" textAnchor="middle" fill="#087735" fontSize="12" fontWeight="900">Way out</text>
          <text x="299" y="100" textAnchor="middle" fill="#087735" fontSize="12" fontWeight="800">{pickLocale(locale, "2Fへ", "2F로")}</text>
        </>
      ) : null}

      {floor === "2f" ? (
        <>
          <rect x="18" y="64" width="96" height="136" rx="20" fill="#e2e8f0" />
          <text x="66" y="119" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="900">{pickLocale(locale, "ホーム連絡", "승강장 연결")}</text>
          <text x="66" y="141" textAnchor="middle" fill="#64748b" fontSize="12" fontWeight="700">3F</text>
          <path d="M114 132 H144" stroke="#00a84d" strokeWidth="9" strokeLinecap="round" />
          {[0, 1, 2, 3].map((index) => <rect key={index} x={144 + index * 11} y="98" width="6" height="68" rx="3" fill="#334155" />)}
          <text x="164" y="86" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="800">{pickLocale(locale, "改札", "개찰구")}</text>
          <path d="M188 132 H262" stroke="#00a84d" strokeWidth="9" strokeLinecap="round" strokeDasharray="12 9" />
          <rect x="262" y="79" width="80" height="106" rx="18" fill="#ffffff" stroke="#ffb020" strokeWidth="3" />
          <text x="302" y="112" textAnchor="middle" fill="#111827" fontSize="12" fontWeight="900">{pickLocale(locale, "出口", "나가는 곳")}</text>
          <text x="302" y="143" textAnchor="middle" fill="#111827" fontSize="26" fontWeight="950">3</text>
          <text x="302" y="167" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="800">Exit 3</text>
        </>
      ) : null}

      {floor === "1f" ? (
        <>
          <rect x="18" y="62" width="116" height="142" rx="20" fill="#ffffff" stroke="#00a84d" strokeWidth="3" />
          <circle cx="76" cy="106" r="24" fill="#00a84d" />
          <text x="76" y="115" textAnchor="middle" fill="#ffffff" fontSize="23" fontWeight="950">3</text>
          <text x="76" y="158" textAnchor="middle" fill="#111827" fontSize="13" fontWeight="900">{pickLocale(locale, "聖水駅", "성수역")}</text>
          <text x="76" y="181" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="800">Seongsu · 211</text>
          <path d="M134 132 H256" stroke="#00a84d" strokeWidth="9" strokeLinecap="round" strokeDasharray="12 9" />
          <rect x="256" y="76" width="86" height="112" rx="18" fill="#eef8f2" />
          <text x="299" y="113" textAnchor="middle" fill="#087735" fontSize="12" fontWeight="900">NAVER</text>
          <text x="299" y="137" textAnchor="middle" fill="#087735" fontSize="12" fontWeight="900">{pickLocale(locale, "徒歩ルート", "도보 경로")}</text>
          <text x="299" y="162" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="700">{pickLocale(locale, "約4分", "약 4분")}</text>
        </>
      ) : null}

      {markerFloor === floor ? (
        <g>
          <circle cx={markerX} cy={markerY} r="13" fill="#ff5a36" stroke="#ffffff" strokeWidth="5" />
          <text x={markerX} y="238" textAnchor="middle" fill="#852a19" fontSize="12" fontWeight="900">{pickLocale(locale, "現在地", "현재 위치")}</text>
        </g>
      ) : null}
    </svg>
  );
}

function SignCard({ floor, locale }: { floor: FloorId; locale: Locale }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="bg-slate-950 p-5 text-white">
        {floor === "3f" ? (
          <><p className="text-2xl font-black">나가는 곳</p><p className="mt-1 text-lg font-bold text-slate-300">Way out · 出口</p></>
        ) : floor === "1f" ? (
          <div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-full bg-[#00a84d] text-2xl font-black">211</span><div><p className="text-2xl font-black">성수</p><p className="text-lg font-bold text-slate-300">Seongsu · 聖水</p></div><span className="ml-auto grid size-14 place-items-center rounded-xl bg-[#ffb020] text-3xl font-black text-slate-950">3</span></div>
        ) : (
          <div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-xl bg-[#ffb020] text-3xl font-black text-slate-950">3</span><div><p className="text-2xl font-black">3번 출구</p><p className="text-lg font-bold text-slate-300">Exit 3 · 3番出口</p></div></div>
        )}
      </div>
      <p className="p-4 text-sm font-bold leading-6 text-slate-600">
        {pickLocale(locale, "現地写真の代わりに、照合する文字だけを示した検証用カードです。撮影日と利用権を確認した写真だけを今後追加します。", "현장 사진 대신 대조할 글자만 보여 주는 검증용 카드예요. 촬영일과 이용 권리를 확인한 사진만 나중에 추가합니다.")}
      </p>
    </div>
  );
}

export function SubwayFieldGuide({ quest }: { quest: DemoQuest }) {
  const { locale } = useLocale();
  const [locationId, setLocationId] = useState<LocationId | null>(null);
  const [floor, setFloor] = useState<FloorId>("3f");
  const [recoveryId, setRecoveryId] = useState<RecoveryId | null>(null);
  const [copied, setCopied] = useState(false);
  const location = LOCATIONS.find(({ id }) => id === locationId) ?? null;
  const recovery = RECOVERIES.find(({ id }) => id === recoveryId) ?? null;
  const activeGuide = recovery ?? location;

  async function copyPhrase() {
    if (!activeGuide) return;
    try {
      await navigator.clipboard.writeText(activeGuide.phrase.ko);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby={`field-guide-${quest.id}`}>
      <p className="text-sm font-black text-[#ff5a36]">{pickLocale(locale, "駅構内サポート · デモ", "역 안 이동 지원 · 데모")}</p>
      <h2 id={`field-guide-${quest.id}`} className="mt-2 text-2xl font-black tracking-tight text-slate-950">{pickLocale(locale, "今いる場所から3番出口まで案内します", "지금 있는 곳에서 3번 출구까지 안내할게요")}</h2>
      <p className="mt-3 text-base font-semibold leading-7 text-slate-600">
        {pickLocale(locale, "現在地を選ぶと、階ごとの概念図と次に探す表示が変わります。駅工事で動線が変わる場合は現地表示を優先してください。", "현재 위치를 고르면 층별 개념도와 다음에 찾을 표지가 바뀌어요. 역 공사로 동선이 달라졌다면 현장 표지를 우선해 주세요.")}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2" role="group" aria-label={pickLocale(locale, "現在地を選択", "현재 위치 선택")}>
        {LOCATIONS.map((item) => {
          const active = item.id === locationId;
          return (
            <button key={item.id} type="button" aria-pressed={active} onClick={() => { setLocationId(item.id); setFloor(item.floor); setRecoveryId(null); setCopied(false); }} className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-base font-black transition-colors ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400"}`}>
              {localize(locale, item.label)}
            </button>
          );
        })}
      </div>

      {location ? (
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={pickLocale(locale, "階を選択", "층 선택")}>
            {FLOORS.map((item) => (
              <button key={item.id} type="button" aria-pressed={floor === item.id} onClick={() => setFloor(item.id)} className={`min-h-14 rounded-2xl px-2 py-2 text-sm font-black leading-5 ${floor === item.id ? "bg-[#087735] text-white" : "bg-[#eef8f2] text-[#087735]"}`}>
                {localize(locale, item.label)}
              </button>
            ))}
          </div>

          <div className="mt-3 overflow-hidden rounded-3xl border border-[#00a84d]/20 bg-[#f7faf9] p-2 sm:p-4"><FloorMap floor={floor} location={location.id} locale={locale} /></div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-black text-slate-600" aria-label={pickLocale(locale, "移動順序", "이동 순서")}>
            {FLOORS.map((item, index) => <span key={item.id} className="rounded-full bg-slate-100 px-3 py-2">{index + 1}. {localize(locale, item.label)}</span>)}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-sm font-black text-[#087735]">{pickLocale(locale, "次に探す表示", "다음에 찾을 표지")}</p>
              <h3 className="mt-2 text-xl font-black leading-7 text-slate-950" aria-live="polite">{localize(locale, location.title)}</h3>
              <p className="mt-4 rounded-2xl border border-[#ff5a36]/20 bg-[#fff0eb] p-4 text-base font-bold leading-7 text-[#852a19]">{localize(locale, location.action)}</p>
            </div>
            <SignCard floor={location.floor} locale={locale} />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 p-4">
            <p className="text-base font-black text-slate-950">{pickLocale(locale, "道を間違えたかもしれませんか？", "길을 잘못 든 것 같나요?")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3" role="group" aria-label={pickLocale(locale, "復旧状況", "복구 상황")}>
              {RECOVERIES.map((item) => (
                <button key={item.id} type="button" aria-pressed={recoveryId === item.id} onClick={() => { setRecoveryId(item.id); setCopied(false); }} className={`min-h-12 rounded-xl border px-3 text-sm font-black ${recoveryId === item.id ? "border-[#ff5a36] bg-[#fff0eb] text-[#852a19]" : "border-slate-200 bg-white text-slate-700"}`}>
                  {localize(locale, item.label)}
                </button>
              ))}
            </div>
          </div>

          {recovery ? <div className="mt-4 rounded-2xl bg-[#fff7e8] p-4" role="status"><p className="text-lg font-black text-slate-950">{localize(locale, recovery.title)}</p><p className="mt-2 text-base font-semibold leading-7 text-slate-700">{localize(locale, recovery.action)}</p></div> : null}

          <div className="mt-5 rounded-2xl bg-[#f4f7fb] p-4">
            <p className="text-sm font-black text-slate-500">{pickLocale(locale, "駅員に見せる韓国語", "역무원에게 보여 줄 한국어")}</p>
            <p className="mt-3 text-2xl font-black leading-9 text-slate-950" lang="ko">{(recovery ? recovery.phrase : location.phrase).ko}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{(recovery ? recovery.phrase : location.phrase).ja}</p>
            <button type="button" onClick={copyPhrase} className="mt-4 min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-base font-black text-white">
              {copied ? pickLocale(locale, "韓国語をコピーしました", "한국어 문장을 복사했어요") : pickLocale(locale, "韓国語をコピー", "한국어 문장 복사")}
            </button>
          </div>

          <p className="mt-4 text-sm font-bold leading-6 text-slate-500">
            {pickLocale(locale, `検証基準日 2026-11-22 · ${quest.transitGuide.stationJa}の3Fホーム、2Fコンコース、1F出口の階層関係だけを示します。正確な通路形状ではありません。`, `검증 기준일 2026-11-22 · ${quest.transitGuide.stationKo}의 3F 승강장, 2F 대합실, 1F 출구 층 관계만 보여 줘요. 정확한 통로 모양은 아니에요.`)}
          </p>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-base font-bold leading-7 text-slate-600">{pickLocale(locale, "今いる階と改札の内外を選んでください。", "지금 있는 층과 개찰구 안팎을 골라 주세요.")}</p>
      )}
    </section>
  );
}
