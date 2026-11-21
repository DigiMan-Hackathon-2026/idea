"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale, type Locale } from "@/lib/locale";
import type { DemoQuest } from "@/modules/content/demo-quests";
import type { SeoulMetroStationSnapshot } from "@/modules/transit/seoul-metro";
import {
  decodeElevatorStatus,
  isSurfaceElevator,
  selectQuickExit,
  type ArrivalId,
  type MobilityId,
} from "@/modules/transit/seoul-metro-display";

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
      ja: "改札を出る前に「2・3番出口／建大入口方面」の表示を探してください。見つからない場合は駅員にこの画面を見せます。",
      ko: "개찰구를 나가기 전에 ‘2·3번 출구·건대입구 방면’ 표시를 찾아요. 보이지 않으면 역무원에게 이 화면을 보여 주세요.",
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
    title: { ja: "「2・3番出口」方面へ進み、「3」を選びます", ko: "‘2·3번 출구’ 방면으로 간 뒤 ‘3’을 골라요" },
    action: {
      ja: "公式案内図では2・3番出口が建大入口側です。最後の分岐で番号が3であることを確認して1Fへ下ります。",
      ko: "공식 안내도에서 2·3번 출구는 건대입구 쪽이에요. 마지막 갈림길에서 번호가 3인지 확인하고 1F로 내려가세요.",
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

const ELEVATOR_LOCATION_GUIDES: Record<LocationId, Pick<LocationGuide, "title" | "action" | "phrase">> = {
  platform: {
    title: { ja: "選んだ方向の車両ドア付近でエレベーターを探します", ko: "선택한 방향의 차량 문 근처에서 엘리베이터를 찾아요" },
    action: { ja: "上の公式案内で表示されたドア番号を確認してください。見つからなければ「出口・Way out」をたどり、駅員にエレベーターの位置を確認します。", ko: "위 공식 안내에 나온 문 번호를 확인해요. 찾지 못했다면 ‘나가는 곳·Way out’을 따라가며 역무원에게 엘리베이터 위치를 확인해 주세요." },
    phrase: { ja: "2階へ下りるエレベーターはどこですか？", ko: "2층으로 내려가는 엘리베이터는 어디에 있나요?" },
  },
  inside_gate: {
    title: { ja: "改札を出る前に地上エレベーターを確認します", ko: "개찰구를 나가기 전에 지상 엘리베이터를 확인해요" },
    action: { ja: "3番出口の階段へ進まず、1番・4番出口のどちらが目的地に適しているか駅員に確認してください。", ko: "3번 출구 계단으로 가지 말고, 1번·4번 출구 중 어디가 목적지에 맞는지 역무원에게 확인해 주세요." },
    phrase: { ja: "地上へ行くエレベーターは、1番と4番出口のどちらですか？", ko: "지상으로 가는 엘리베이터는 1번과 4번 출구 중 어디인가요?" },
  },
  outside_gate: {
    title: { ja: "3番出口の階段ではなく、1番・4番出口を確認します", ko: "3번 출구 계단 대신 1번·4번 출구를 확인해요" },
    action: { ja: "公式データで地上連絡エレベーターが確認できるのは1番・4番出口です。道路を横断する前に駅員へ目的地側の出口を尋ねてください。", ko: "공식 데이터에서 지상 연결 엘리베이터가 확인되는 곳은 1번·4번 출구예요. 길을 건너기 전에 역무원에게 목적지 쪽 출구를 물어보세요." },
    phrase: { ja: "この目的地へ行くには、1番と4番出口のどちらのエレベーターがいいですか？", ko: "이 목적지로 가려면 1번과 4번 출구 중 어느 엘리베이터가 좋나요?" },
  },
  exit_3: {
    title: { ja: "階段を使わず、駅員にエレベーター経路を確認します", ko: "계단을 이용하지 말고 엘리베이터 경로를 확인해요" },
    action: { ja: "3番出口に地上連絡エレベーターの公式情報はありません。無理に進まず、1番・4番出口への安全な移動方法を駅員に確認してください。", ko: "3번 출구에는 지상 연결 엘리베이터 공식 정보가 없어요. 무리해서 이동하지 말고 1번·4번 출구로 안전하게 가는 방법을 역무원에게 확인해 주세요." },
    phrase: { ja: "階段を使えません。地上へ行くエレベーターまで案内してください。", ko: "계단을 이용하기 어려워요. 지상으로 가는 엘리베이터까지 안내해 주세요." },
  },
};

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

const PROVIDER_LABELS: Record<string, LocalizedCopy> = {
  외선: { ja: "外回り", ko: "외선" },
  내선: { ja: "内回り", ko: "내선" },
  상행: { ja: "上り", ko: "상행" },
  하행: { ja: "下り", ko: "하행" },
  건대입구: { ja: "建大入口方面", ko: "건대입구 방면" },
  뚝섬: { ja: "トゥクソム方面", ko: "뚝섬 방면" },
  용답: { ja: "龍踏方面", ko: "용답 방면" },
  계단: { ja: "階段", ko: "계단" },
  엘리베이터: { ja: "エレベーター", ko: "엘리베이터" },
  에스컬레이터: { ja: "エスカレーター", ko: "에스컬레이터" },
};

const ARRIVALS: Array<{ id: ArrivalId; label: LocalizedCopy }> = [
  { id: "from_ttukseom", label: { ja: "トゥクソムから", ko: "뚝섬에서 왔어요" } },
  { id: "from_konkuk", label: { ja: "建大入口から", ko: "건대입구에서 왔어요" } },
  { id: "from_yongdap", label: { ja: "龍踏から", ko: "용답에서 왔어요" } },
  { id: "unknown", label: { ja: "わかりません", ko: "잘 모르겠어요" } },
];

const MOBILITY_OPTIONS: Array<{ id: MobilityId; label: LocalizedCopy }> = [
  { id: "stairs_ok", label: { ja: "階段を使えます", ko: "계단을 이용할 수 있어요" } },
  { id: "elevator_needed", label: { ja: "エレベーターが必要です", ko: "엘리베이터가 필요해요" } },
];

const ELEVATOR_STATUS_LABELS: Record<ReturnType<typeof decodeElevatorStatus>, LocalizedCopy> = {
  available: { ja: "利用可能", ko: "사용 가능" },
  deleted: { ja: "利用不可", ko: "이용 불가" },
  maintenance: { ja: "整備中", ko: "보수 중" },
  stopped: { ja: "停止中", ko: "중지" },
  inspection: { ja: "点検中", ko: "점검 중" },
  construction: { ja: "工事中", ko: "공사 중" },
  unknown: { ja: "現地確認が必要", ko: "현장 확인 필요" },
};

function providerLabel(locale: Locale, value: string | null) {
  if (!value) return pickLocale(locale, "方向未表示", "방향 정보 없음");
  const match = Object.entries(PROVIDER_LABELS).find(([source]) => value.includes(source));
  return match
    ? localize(locale, match[1])
    : pickLocale(locale, "公式情報を確認", "공식 정보 확인");
}

function formatReferenceDate(value: string | null) {
  if (!value || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
}

function elevatorLocation(locale: Locale, entranceNumber: string | null, detailPosition: string | null) {
  if (entranceNumber && /^\d+$/.test(entranceNumber)) {
    return pickLocale(locale, `${entranceNumber}番出入口・地上連絡`, `${entranceNumber}번 출입구·지상 연결`);
  }
  const door = detailPosition?.match(/\d+-\d+/)?.[0];
  if (detailPosition?.includes("뚝섬")) {
    return pickLocale(locale, `トゥクソム方面 ${door ?? ""}`.trim(), `뚝섬 방면 ${door ?? ""}`.trim());
  }
  if (detailPosition?.includes("건대입구")) {
    return pickLocale(locale, `建大入口方面 ${door ?? ""}`.trim(), `건대입구 방면 ${door ?? ""}`.trim());
  }
  return pickLocale(locale, "駅構内・位置は現地確認", "역 내부·위치는 현장 확인");
}

function StationDataPanel({
  snapshot,
  locale,
  arrival,
  mobility,
  onArrival,
  onMobility,
}: {
  snapshot: SeoulMetroStationSnapshot;
  locale: Locale;
  arrival: ArrivalId | null;
  mobility: MobilityId | null;
  onArrival: (arrival: ArrivalId) => void;
  onMobility: (mobility: MobilityId) => void;
}) {
  const [copied, setCopied] = useState(false);
  const checkedAt = snapshot.checkedAt
    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "ja-JP", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      }).format(new Date(snapshot.checkedAt))
    : null;

  if (snapshot.status === "not_configured") {
    return <p className="mt-5 rounded-2xl bg-[#fff7e8] p-4 text-sm font-bold leading-6 text-slate-700">{pickLocale(locale, "公式のエレベーター・快速降車情報は接続準備中です。駅構内の表示と駅員の案内を優先してください。", "공식 엘리베이터·빠른 하차 정보는 연결 준비 중이에요. 역 안 표지와 역무원 안내를 우선해 주세요.")}</p>;
  }

  if (snapshot.status === "unavailable") {
    return <p className="mt-5 rounded-2xl bg-[#fff0eb] p-4 text-sm font-bold leading-6 text-[#852a19]">{pickLocale(locale, "ソウル交通公社の情報を取得できませんでした。車両・設備を推測せず、現地表示を確認してください。", "서울교통공사 정보를 불러오지 못했어요. 차량·설비를 추측하지 말고 현장 표지를 확인해 주세요.")}</p>;
  }

  const quickExit = selectQuickExit(snapshot.quickExits, arrival, mobility);
  const surfaceElevators = snapshot.elevators.filter(isSurfaceElevator);
  const sourceDates = Array.from(new Set([
    ...snapshot.quickExits.map(({ referenceDate }) => formatReferenceDate(referenceDate)),
    ...snapshot.elevators.map(({ referenceDate }) => formatReferenceDate(referenceDate)),
  ].filter((value): value is string => value !== null)));
  const routeUnknown = arrival === "unknown" || arrival === "from_yongdap";
  const staffPhrase = "엘리베이터로 지상까지 가고 싶어요. 1번과 4번 출구 중 어디로 가야 하나요?";

  async function copyStaffPhrase() {
    try {
      await navigator.clipboard.writeText(staffPhrase);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-black text-slate-950">{pickLocale(locale, "乗ってきた方向に合わせる", "타고 온 방향에 맞추기")}</p>
        <p className="text-xs font-bold text-slate-500">{checkedAt ? `${checkedAt} KST` : null}</p>
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{pickLocale(locale, "聖水駅の直前に通った駅を選んでください。覚えていなくても進めます。", "성수역 바로 전에 지나온 역을 골라 주세요. 기억나지 않아도 진행할 수 있어요.")}</p>

      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={pickLocale(locale, "直前の駅", "직전 역")}>
        {ARRIVALS.map((item) => (
          <button key={item.id} type="button" aria-pressed={arrival === item.id} onClick={() => { onArrival(item.id); setCopied(false); }} className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-black ${arrival === item.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
            {localize(locale, item.label)}
          </button>
        ))}
      </div>

      {arrival ? (
        <>
          <p className="mt-5 text-sm font-black text-slate-950">{pickLocale(locale, "移動方法を選んでください", "이동 방법을 골라 주세요")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-label={pickLocale(locale, "移動方法", "이동 방법")}>
            {MOBILITY_OPTIONS.map((item) => (
              <button key={item.id} type="button" aria-pressed={mobility === item.id} onClick={() => { onMobility(item.id); setCopied(false); }} className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-black ${mobility === item.id ? "border-[#087735] bg-[#eef8f2] text-[#087735]" : "border-slate-200 bg-white text-slate-700"}`}>
                {localize(locale, item.label)}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {arrival && mobility ? (
        <div className="mt-5" aria-live="polite">
          {quickExit ? (
            <div className="rounded-2xl bg-[#eef8f2] p-4">
              <p className="text-sm font-black text-[#087735]">{pickLocale(locale, "聖水駅で降りる位置", "성수역에서 내릴 위치")}</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{quickExit.carDoorNumber ? pickLocale(locale, `${quickExit.carDoorNumber}ドア`, `${quickExit.carDoorNumber} 문`) : "—"}</p>
              <p className="mt-2 text-sm font-bold text-slate-600">{providerLabel(locale, quickExit.nextStation)} · {providerLabel(locale, quickExit.facility)}</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#fff7e8] p-4">
              <p className="font-black text-slate-950">{routeUnknown ? pickLocale(locale, "対応する公式ドア情報がありません", "맞는 공식 문 위치 정보가 없어요") : pickLocale(locale, "公式情報を取得できませんでした", "공식 정보를 불러오지 못했어요")}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{pickLocale(locale, "車両番号を推測せず、「出口・Way out」の表示を探してください。分からない場合は駅員に確認します。", "차량 번호를 추측하지 말고 ‘나가는 곳·Way out’ 표지를 찾아요. 모르겠다면 역무원에게 확인해 주세요.")}</p>
            </div>
          )}

          {mobility === "elevator_needed" ? (
            <div className="mt-4">
              <p className="font-black text-slate-950">{pickLocale(locale, "エレベーターの公式公開状態", "엘리베이터 공식 공개 상태")}</p>
              {snapshot.elevatorAvailable ? (
                <ul className="mt-3 grid gap-2">
                  {snapshot.elevators.map((item, index) => {
                    const status = decodeElevatorStatus(item.operatingStatus);
                    const available = status === "available";
                    return (
                      <li key={`${item.entranceNumber}-${item.detailPosition}-${index}`} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-sm">
                        <span><span className="block font-black text-slate-800">{elevatorLocation(locale, item.entranceNumber, item.detailPosition)}</span><span className="mt-1 block font-semibold text-slate-500">{item.startFloor && item.endFloor ? `${item.startFloor}F–${item.endFloor}F` : pickLocale(locale, "階情報なし", "층 정보 없음")}</span></span>
                        <span className={`rounded-full px-2.5 py-1 font-black ${available ? "bg-[#dff5e8] text-[#087735]" : "bg-[#fff0eb] text-[#9a341f]"}`}>{localize(locale, ELEVATOR_STATUS_LABELS[status])}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="mt-2 text-sm font-bold text-slate-600">{pickLocale(locale, "エレベーター情報は取得できませんでした。", "엘리베이터 정보를 불러오지 못했어요.")}</p>}

              <div className="mt-4 rounded-2xl border border-[#ffb020]/50 bg-[#fff7e8] p-4">
                <p className="font-black text-slate-950">{pickLocale(locale, "3番出口には地上連絡エレベーターの公式情報がありません", "3번 출구에는 지상 연결 엘리베이터 공식 정보가 없어요")}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{pickLocale(locale, `地上連絡は${surfaceElevators.map(({ entranceNumber }) => entranceNumber).filter(Boolean).join("・") || "1・4"}番出口で確認できます。道路を無理に横断せず、目的地に合う出口を駅員に確認してから徒歩ルートを検索し直してください。`, `지상 연결은 ${surfaceElevators.map(({ entranceNumber }) => entranceNumber).filter(Boolean).join("·") || "1·4"}번 출구에서 확인돼요. 무리하게 길을 건너지 말고 목적지에 맞는 출구를 역무원에게 확인한 뒤 도보 경로를 다시 검색해 주세요.`)}</p>
                <p className="mt-3 text-lg font-black leading-7 text-slate-950" lang="ko">{staffPhrase}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">1番と4番出口のうち、どちらへ行けばいいですか？</p>
                <button type="button" onClick={copyStaffPhrase} className="mt-3 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm font-black text-white">{copied ? pickLocale(locale, "韓国語をコピーしました", "한국어 문장을 복사했어요") : pickLocale(locale, "駅員に見せる韓国語をコピー", "역무원에게 보여 줄 한국어 복사")}</button>
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{pickLocale(locale, `ソウル交通公社API取得 ${checkedAt ?? "—"} KST・データ基準日 ${sourceDates.join(" / ") || "表示なし"}。現地表示を優先してください。`, `서울교통공사 API 조회 ${checkedAt ?? "—"} KST·데이터 기준일 ${sourceDates.join(" / ") || "표시 없음"}. 현장 표지를 우선해 주세요.`)}</p>
        </div>
      ) : null}
    </div>
  );
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
          <text x="28" y="82" fill="#334155" fontSize="11" fontWeight="800">{pickLocale(locale, "トゥクソム・龍踏方面", "뚝섬·용답 방면")}</text>
          <text x="28" y="188" fill="#334155" fontSize="11" fontWeight="800">{pickLocale(locale, "建大入口方面", "건대입구 방면")}</text>
          <path d="M70 84 H256" fill="none" stroke="#00a84d" strokeWidth="9" strokeLinecap="round" strokeDasharray="12 9" />
          <rect x="256" y="50" width="86" height="68" rx="14" fill="#ffffff" stroke="#00a84d" strokeWidth="3" />
          <text x="299" y="78" textAnchor="middle" fill="#087735" fontSize="12" fontWeight="900">Way out</text>
          <text x="299" y="100" textAnchor="middle" fill="#087735" fontSize="12" fontWeight="800">{pickLocale(locale, "2Fへ", "2F로")}</text>
        </>
      ) : null}

      {floor === "2f" ? (
        <>
          <rect x="18" y="62" width="74" height="140" rx="18" fill="#e2e8f0" />
          <text x="55" y="118" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="900">{pickLocale(locale, "3Fから", "3F에서")}</text>
          <text x="55" y="139" textAnchor="middle" fill="#64748b" fontSize="11" fontWeight="700">Way out</text>
          <path d="M92 132 H126" stroke="#00a84d" strokeWidth="9" strokeLinecap="round" />
          {[0, 1, 2, 3].map((index) => <rect key={index} x={126 + index * 11} y="98" width="6" height="68" rx="3" fill="#334155" />)}
          <text x="146" y="86" textAnchor="middle" fill="#334155" fontSize="12" fontWeight="800">{pickLocale(locale, "改札", "개찰구")}</text>
          <path d="M170 132 H208" stroke="#00a84d" strokeWidth="9" strokeLinecap="round" strokeDasharray="12 9" />
          <rect x="208" y="52" width="134" height="160" rx="18" fill="#ffffff" stroke="#ffb020" strokeWidth="3" />
          <text x="275" y="78" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="800">{pickLocale(locale, "建大入口方面", "건대입구 방면")}</text>
          <text x="275" y="105" textAnchor="middle" fill="#111827" fontSize="12" fontWeight="900">{pickLocale(locale, "2・3番出口", "2·3번 출구")}</text>
          <line x1="226" y1="124" x2="324" y2="124" stroke="#e2e8f0" strokeWidth="2" />
          <circle cx="248" cy="160" r="21" fill="#f8d469" />
          <text x="248" y="168" textAnchor="middle" fill="#111827" fontSize="22" fontWeight="950">2</text>
          <circle cx="302" cy="160" r="25" fill="#ffb020" stroke="#00a84d" strokeWidth="4" />
          <text x="302" y="169" textAnchor="middle" fill="#111827" fontSize="25" fontWeight="950">3</text>
          <text x="275" y="200" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="800">Exit 2 · Exit 3</text>
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

export function SubwayFieldGuide({ quest, stationSnapshot }: { quest: DemoQuest; stationSnapshot: SeoulMetroStationSnapshot }) {
  const { locale } = useLocale();
  const [arrivalId, setArrivalId] = useState<ArrivalId | null>(null);
  const [mobilityId, setMobilityId] = useState<MobilityId | null>(null);
  const [locationId, setLocationId] = useState<LocationId | null>(null);
  const [floor, setFloor] = useState<FloorId>("3f");
  const [recoveryId, setRecoveryId] = useState<RecoveryId | null>(null);
  const [copied, setCopied] = useState(false);
  const location = LOCATIONS.find(({ id }) => id === locationId) ?? null;
  const locationGuide = location && mobilityId === "elevator_needed"
    ? { ...location, ...ELEVATOR_LOCATION_GUIDES[location.id] }
    : location;
  const recovery = RECOVERIES.find(({ id }) => id === recoveryId) ?? null;
  const activeGuide = recovery ?? locationGuide;

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
        {pickLocale(locale, "現在地を選ぶと、公式案内図から単純化した階・出口方向と次に探す表示が変わります。駅工事で動線が変わる場合は現地表示を優先してください。", "현재 위치를 고르면 공식 안내도에서 단순화한 층·출구 방향과 다음에 찾을 표지가 바뀌어요. 역 공사로 동선이 달라졌다면 현장 표지를 우선해 주세요.")}
      </p>

      <StationDataPanel
        snapshot={stationSnapshot}
        locale={locale}
        arrival={arrivalId}
        mobility={mobilityId}
        onArrival={setArrivalId}
        onMobility={setMobilityId}
      />

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

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-black text-slate-950">{pickLocale(locale, "実際の構造を3Dで確認したいですか？", "실제 구조를 3D로 확인하고 싶나요?")}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {pickLocale(locale, "ソウル市のS-MAPを開き、「성수역」を検索してください。外部サイトに移動し、階ごとの移動は現地の案内表示を優先します。", "서울시 S-MAP을 연 뒤 ‘성수역’을 검색해 주세요. 외부 사이트로 이동하며, 층별 이동은 현장 표지를 우선해요.")}
            </p>
            <a
              href="https://smap.seoul.go.kr/smap/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 text-center text-sm font-black text-slate-800 hover:border-slate-500"
            >
              {pickLocale(locale, "S-MAPで聖水駅の3D地図を開く", "S-MAP에서 성수역 3D 지도 열기")}
            </a>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-sm font-black text-[#087735]">{pickLocale(locale, "次に探す表示", "다음에 찾을 표지")}</p>
              <h3 className="mt-2 text-xl font-black leading-7 text-slate-950" aria-live="polite">{localize(locale, locationGuide!.title)}</h3>
              <p className="mt-4 rounded-2xl border border-[#ff5a36]/20 bg-[#fff0eb] p-4 text-base font-bold leading-7 text-[#852a19]">{localize(locale, locationGuide!.action)}</p>
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
            <p className="mt-3 text-2xl font-black leading-9 text-slate-950" lang="ko">{(recovery ? recovery.phrase : locationGuide!.phrase).ko}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{(recovery ? recovery.phrase : locationGuide!.phrase).ja}</p>
            <button type="button" onClick={copyPhrase} className="mt-4 min-h-12 w-full rounded-2xl bg-slate-950 px-4 text-base font-black text-white">
              {copied ? pickLocale(locale, "韓国語をコピーしました", "한국어 문장을 복사했어요") : pickLocale(locale, "韓国語をコピー", "한국어 문장 복사")}
            </button>
          </div>

          <p className="mt-4 text-sm font-bold leading-6 text-slate-500">
            {pickLocale(locale, `公式駅利用案内図の公開日 2026-08-24・画像内基準 2024-04-16・閲覧日 2026-11-22。${quest.transitGuide.stationJa}の階と出口方向を単純化したもので、正確な通路形状ではありません。`, `공식 역이용안내도 게시일 2026-08-24·이미지 내부 기준 2024-04-16·열람일 2026-11-22. ${quest.transitGuide.stationKo}의 층과 출구 방향을 단순화한 것으로 정확한 통로 모양은 아니에요.`)}
          </p>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-base font-bold leading-7 text-slate-600">{pickLocale(locale, "今いる階と改札の内外を選んでください。", "지금 있는 층과 개찰구 안팎을 골라 주세요.")}</p>
      )}
    </section>
  );
}
