"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useLocale } from "@/components/locale-provider";
import { pickLocale } from "@/lib/locale";
import {
  offlineQuestsKey,
  parseOfflineQuests,
  withOfflineQuest,
  withoutOfflineQuest,
  type OfflineQuest,
} from "@/modules/content/offline-quests";

const changed = "yeogiseoul:offline-quests-changed";

function subscribe(listener: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === offlineQuestsKey || event.key === null) listener();
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(changed, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changed, listener);
  };
}

/** The stored string, `""` when empty, or `null` where this browser cannot keep it. */
function readStored(): string | null {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return window.localStorage.getItem(offlineQuestsKey) ?? "";
  } catch {
    return null;
  }
}

function write(list: OfflineQuest[]) {
  try {
    if (list.length) window.localStorage.setItem(offlineQuestsKey, JSON.stringify(list));
    else window.localStorage.removeItem(offlineQuestsKey);
    window.dispatchEvent(new Event(changed));
    return true;
  } catch {
    return false;
  }
}

const buttonClass =
  "min-h-11 rounded-xl px-4 text-sm font-black focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#6789ca]";

/**
 * Keeps this quest's public text on the device for the offline quest screen.
 * Nothing is saved until the visitor asks, and they can remove it here or offline.
 */
export function SaveQuestOffline({ quest }: { quest: Omit<OfflineQuest, "path" | "savedAt"> }) {
  const { locale } = useLocale();
  const path = usePathname();
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const [failed, setFailed] = useState(false);
  if (stored === null) return null;
  const list = parseOfflineQuests(stored);
  const saved = list.some((item) => item.path === path);

  return (
    <section aria-labelledby="quest-offline-title" className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-3">
      <h2 id="quest-offline-title" className="text-sm font-bold text-slate-600">
        {pickLocale(locale, "電波がないときのために", "전파가 안 터질 때를 위해")}
      </h2>
      {saved ? (
        <>
          <p role="status" className="mt-1 text-sm leading-6">
            {pickLocale(
              locale,
              "この端末に保存しました。電波がなくてもこのページを開くと、出口・手順・韓国語カードが表示されます。",
              "이 기기에 저장했어요. 전파가 없어도 이 페이지를 열면 출구, 진행 순서, 한국어 카드가 보여요.",
            )}
          </p>
          <button type="button" onClick={() => setFailed(!write(withoutOfflineQuest(list, path)))}
            className={`${buttonClass} mt-2 border border-[var(--border)] bg-white text-slate-700`}>
            {pickLocale(locale, "この端末から消す", "이 기기에서 지우기")}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {pickLocale(
              locale,
              "地下や駅の中では電波が弱いことがあります。出発前に保存しておくと、オフラインでも案内を見られます。",
              "지하나 역 안에서는 전파가 약할 수 있어요. 출발 전에 저장해 두면 오프라인에서도 안내를 볼 수 있어요.",
            )}
          </p>
          <button type="button"
            onClick={() => setFailed(!write(withOfflineQuest(list, { ...quest, path, savedAt: new Date().toISOString() })))}
            className={`${buttonClass} mt-2 bg-[#504e49] text-white hover:bg-[#941e34]`}>
            {pickLocale(locale, "オフライン用に保存する", "오프라인용으로 저장하기")}
          </button>
        </>
      )}
      {failed ? (
        <p role="alert" className="mt-2 text-sm font-bold text-[#941e34]">
          {pickLocale(locale, "この端末に保存できませんでした。ブラウザの保存設定を確認してください。", "이 기기에 저장하지 못했어요. 브라우저의 저장 설정을 확인해 주세요.")}
        </p>
      ) : null}
    </section>
  );
}
