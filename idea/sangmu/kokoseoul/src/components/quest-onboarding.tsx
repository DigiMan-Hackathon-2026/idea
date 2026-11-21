"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  AREA_LABELS,
  PURPOSE_LABELS,
  TIME_LABELS,
  getAreaLabel,
  getPurposeLabel,
  getTimeLabel,
  resolveDemoAreaFromCoordinates,
  type AreaCode,
  type QuestPurpose,
  type TimeChoice,
} from "@/modules/content/demo-quests";

type AreaChoice = "current" | "choose" | "unknown";
type LocationStatus = "idle" | "loading" | "failed";

function Choice({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="flex min-h-13 items-center rounded-xl border border-[var(--border)] bg-white px-4 text-left text-base font-bold leading-6 text-slate-700 shadow-sm transition peer-checked:border-[#941e34] peer-checked:bg-[#f7ecee] peer-checked:text-[#941e34] peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#6789ca]">
        {children}
      </span>
    </label>
  );
}

export function QuestOnboarding() {
  const router = useRouter();
  const { locale } = useLocale();
  const headingRef = useRef<HTMLLegendElement>(null);
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState<QuestPurpose | null>(null);
  const [time, setTime] = useState<TimeChoice | null>(null);
  const [areaChoice, setAreaChoice] = useState<AreaChoice | null>(null);
  const [chosenArea, setChosenArea] = useState<AreaCode>("seongsu");
  const [locationStatus, setLocationStatus] =
    useState<LocationStatus>("idle");

  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step]);

  function openResults(area: "all" | AreaCode, source?: "current") {
    if (!purpose || !time) return;
    const query = new URLSearchParams({ purpose, time, area });
    if (source) query.set("areaSource", source);
    router.push(`/quests?${query.toString()}`);
  }

  function finish() {
    if (!areaChoice || !purpose || !time) return;
    setLocationStatus("idle");

    if (areaChoice === "unknown") {
      openResults("all");
      return;
    }
    if (areaChoice === "choose") {
      openResults(chosenArea);
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus("failed");
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        openResults(
          resolveDemoAreaFromCoordinates(coords.latitude, coords.longitude),
          "current",
        );
      },
      () => setLocationStatus("failed"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  const canContinue =
    (step === 0 && purpose !== null) ||
    (step === 1 && time !== null) ||
    (step === 2 && areaChoice !== null);

  return (
    <section aria-labelledby="quest-onboarding-title">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-black text-[#941e34]">
          {pickLocale(locale, "おすすめ条件", "추천 조건")}
        </p>
        <p className="text-sm font-bold text-slate-400" aria-label={pickLocale(locale, `全3問の${step + 1}問目`, `총 3개 중 ${step + 1}번째 질문`)}>
          {step + 1} / 3
        </p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`h-1 ${index <= step ? "bg-[#941e34]" : "bg-[#dfdfdd]"}`}
          />
        ))}
      </div>

      {step === 0 ? (
        <fieldset className="mt-6">
          <legend
            ref={headingRef}
            id="quest-onboarding-title"
            tabIndex={-1}
            className="text-2xl font-black leading-tight tracking-[-0.035em] text-[#504e49]"
          >
            {pickLocale(locale, "今日は何をしたいですか？", "오늘 무엇을 하고 싶어요?")}
          </legend>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {pickLocale(locale, "一つ選んでください。", "하나만 골라주세요.")}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {Object.keys(PURPOSE_LABELS).map((value) => (
              <Choice
                key={value}
                name="purpose"
                value={value}
                checked={purpose === value}
                onChange={() => setPurpose(value as QuestPurpose)}
              >
                {getPurposeLabel(value as QuestPurpose, locale)}
              </Choice>
            ))}
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="mt-6">
          <legend
            ref={headingRef}
            id="quest-onboarding-title"
            tabIndex={-1}
            className="text-2xl font-black leading-tight tracking-[-0.035em] text-[#504e49]"
          >
            {pickLocale(locale, "今日はどのくらい時間がありますか？", "오늘 얼마나 시간이 있어요?")}
          </legend>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {pickLocale(locale, "まだ決めていなくても大丈夫です。", "아직 정하지 않았어도 괜찮아요.")}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {Object.keys(TIME_LABELS).map((value) => (
              <Choice
                key={value}
                name="time"
                value={value}
                checked={time === value}
                onChange={() => setTime(value as TimeChoice)}
              >
                {getTimeLabel(value as TimeChoice, locale)}
              </Choice>
            ))}
          </div>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="mt-6">
          <legend
            ref={headingRef}
            id="quest-onboarding-title"
            tabIndex={-1}
            className="text-2xl font-black leading-tight tracking-[-0.035em] text-[#504e49]"
          >
            {pickLocale(locale, "どのエリアで探しますか？", "어느 지역에서 찾아볼까요?")}
          </legend>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {pickLocale(locale, "位置情報は選んだときだけ確認します。", "현재 위치는 직접 선택했을 때만 확인해요.")}
          </p>
          <div className="mt-5 grid gap-2">
            <Choice
              name="areaChoice"
              value="current"
              checked={areaChoice === "current"}
              onChange={() => setAreaChoice("current")}
            >
              {pickLocale(locale, "現在地から探す", "현재 위치에서 찾기")}
            </Choice>
            <Choice
              name="areaChoice"
              value="choose"
              checked={areaChoice === "choose"}
              onChange={() => setAreaChoice("choose")}
            >
              {pickLocale(locale, "エリアを指定する", "동네 직접 선택")}
            </Choice>
            {areaChoice === "choose" ? (
              <label className="ml-2 grid gap-2 text-sm font-bold text-slate-700">
                {pickLocale(locale, "エリア", "동네")}
                <select
                  value={chosenArea}
                  onChange={(event) =>
                    setChosenArea(event.target.value as AreaCode)
                  }
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
                >
                  {Object.keys(AREA_LABELS)
                    .filter((area) => area !== "all")
                    .map((area) => (
                      <option key={area} value={area}>
                        {getAreaLabel(area as AreaCode, locale)}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <Choice
              name="areaChoice"
              value="unknown"
              checked={areaChoice === "unknown"}
              onChange={() => setAreaChoice("unknown")}
            >
              {pickLocale(locale, "まだ分からない", "잘 모르겠어요")}
            </Choice>
          </div>
          {areaChoice === "current" ? (
            <p className="mt-3 rounded-xl border-l-4 border-[#455f54] bg-[#edf1ef] p-3 text-sm font-semibold leading-6 text-[#455f54]">
              {pickLocale(
                locale,
                "現在地は近い対応エリアを選ぶためだけに使い、保存・送信しません。",
                "현재 위치는 가까운 지원 지역을 고르는 데만 사용하며 저장하거나 전송하지 않아요.",
              )}
            </p>
          ) : null}
          {locationStatus === "failed" ? (
            <p className="mt-3 rounded-xl border-l-4 border-[#941e34] bg-[#f7ecee] p-3 text-sm font-semibold leading-6 text-[#941e34]" role="alert">
              {pickLocale(
                locale,
                "現在地を確認できませんでした。エリアを選ぶか「まだ分からない」を選べます。",
                "현재 위치를 확인하지 못했어요. 동네를 직접 고르거나 ‘잘 모르겠어요’를 선택할 수 있어요.",
              )}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="mt-6 grid gap-2">
        <button
          type="button"
          disabled={!canContinue || locationStatus === "loading"}
          onClick={() => (step < 2 ? setStep(step + 1) : finish())}
          className="seoul-button-primary min-h-14 rounded-xl px-6 text-base font-black transition disabled:cursor-not-allowed disabled:opacity-45"
        >
          {locationStatus === "loading"
            ? pickLocale(locale, "現在地を確認中…", "현재 위치 확인 중…")
            : step === 0
              ? pickLocale(locale, "使える時間を選ぶ", "쓸 수 있는 시간 고르기")
              : step === 1
                ? pickLocale(locale, "エリアを選ぶ", "지역 고르기")
                : pickLocale(locale, "おすすめクエストを見る", "추천 퀘스트 보기")}
        </button>
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setLocationStatus("idle");
              setStep(step - 1);
            }}
            className="min-h-11 rounded-xl text-sm font-black text-slate-500 hover:bg-[var(--surface-muted)]"
          >
            {pickLocale(locale, "前の質問に戻る", "이전 질문으로 돌아가기")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
