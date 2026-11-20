export const DEMO_RUN_ID = "seongsu-craft-demo";
export const DEMO_RUN_STORAGE_KEY = "digiman.demo-run.v1";
export const DEMO_FEEDBACK_STORAGE_KEY = "digiman.demo-feedback.v1";

export type DemoRunStep = {
  id: string;
  position: number;
  titleJa: string;
  titleKo: string;
  bodyJa: string;
  bodyKo: string;
  completionLabelJa: string;
  completionLabelKo: string;
  phrase?: { ko: string; ja: string };
  place?: {
    nameJa: string;
    nameKo: string;
    addressKo: string;
    verifiedAt: string;
  };
};

export const DEMO_RUN_STEPS: DemoRunStep[] = [
  {
    id: "demo-step-1",
    position: 1,
    titleJa: "場所と利用条件を確認する",
    titleKo: "장소와 이용 조건 확인하기",
    bodyJa:
      "この画面は仮想デモです。表示された条件と韓国語カードの使い方を確認しましょう。実際の訪問や出席を証明するものではありません。",
    bodyKo:
      "이 화면은 가상 데모입니다. 표시된 조건과 한국어 카드 사용 방법을 확인해 보세요. 실제 방문이나 출석을 증명하는 화면이 아닙니다.",
    completionLabelJa: "案内を確認しました",
    completionLabelKo: "안내를 확인했어요",
    phrase: {
      ko: "혼자 체험할 수 있나요?",
      ja: "一人で体験できますか。",
    },
    place: {
      nameJa: "デモ体験場所",
      nameKo: "데모 체험 장소",
      addressKo: "데모 전용 가상 주소",
      verifiedAt: "2026-11-20T07:00:00Z",
    },
  },
  {
    id: "demo-step-2",
    position: 2,
    titleJa: "韓国語カードを見せて注文する",
    titleKo: "한국어 카드를 보여 주고 주문하기",
    bodyJa:
      "注文したいものを一つ選んだ想定で、下の韓国語を相手に見せてみましょう。",
    bodyKo:
      "주문하고 싶은 것을 하나 골랐다고 생각하고, 아래 한국어를 상대방에게 보여 주세요.",
    completionLabelJa: "韓国語カードを使いました",
    completionLabelKo: "한국어 카드를 사용했어요",
    phrase: { ko: "이걸 하나 주세요.", ja: "これを一つください。" },
  },
  {
    id: "demo-step-3",
    position: 3,
    titleJa: "今日の小さな発見を残す",
    titleKo: "오늘의 작은 발견 남기기",
    bodyJa:
      "最後の案内まで進めました。完了すると、デモ用の記録カードを確認できます。",
    bodyKo:
      "마지막 안내까지 진행했습니다. 완료하면 데모용 기록 카드를 확인할 수 있습니다.",
    completionLabelJa: "クエストを完了する",
    completionLabelKo: "퀘스트 완료하기",
  },
];

export type DemoRunProgress = {
  runId: typeof DEMO_RUN_ID;
  startedAt: string;
  completedStepIds: string[];
  completedAt: string | null;
};

export function createDemoRun(now: string): DemoRunProgress {
  return {
    runId: DEMO_RUN_ID,
    startedAt: now,
    completedStepIds: [],
    completedAt: null,
  };
}

export function parseDemoRun(value: string | null): DemoRunProgress | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<DemoRunProgress>;
    const validStepIds = new Set(DEMO_RUN_STEPS.map((step) => step.id));
    if (
      parsed.runId !== DEMO_RUN_ID ||
      typeof parsed.startedAt !== "string" ||
      !Array.isArray(parsed.completedStepIds) ||
      !parsed.completedStepIds.every(
        (id) => typeof id === "string" && validStepIds.has(id),
      ) ||
      (parsed.completedAt !== null &&
        typeof parsed.completedAt !== "string")
    ) {
      return null;
    }

    const requestedStepIds = new Set(parsed.completedStepIds);
    const completedStepIds: string[] = [];
    for (const step of DEMO_RUN_STEPS) {
      if (!requestedStepIds.has(step.id)) break;
      completedStepIds.push(step.id);
    }
    const isComplete = completedStepIds.length === DEMO_RUN_STEPS.length;

    return {
      runId: DEMO_RUN_ID,
      startedAt: parsed.startedAt,
      completedStepIds,
      completedAt: isComplete ? (parsed.completedAt ?? null) : null,
    };
  } catch {
    return null;
  }
}

export function getNextDemoStep(
  progress: DemoRunProgress,
): DemoRunStep | null {
  return (
    DEMO_RUN_STEPS.find(
      (step) => !progress.completedStepIds.includes(step.id),
    ) ?? null
  );
}

export function completeDemoStep(
  progress: DemoRunProgress,
  stepId: string,
  now: string,
): DemoRunProgress {
  const nextStep = getNextDemoStep(progress);
  if (!nextStep || nextStep.id !== stepId) {
    throw new Error("Steps must be completed in order");
  }

  const completedStepIds = [...progress.completedStepIds, stepId];
  return {
    ...progress,
    completedStepIds,
    completedAt:
      completedStepIds.length === DEMO_RUN_STEPS.length ? now : null,
  };
}

export function isDemoRunComplete(progress: DemoRunProgress): boolean {
  return (
    progress.completedAt !== null &&
    progress.completedStepIds.length === DEMO_RUN_STEPS.length
  );
}
