"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { pickLocale, type Locale } from "@/lib/locale";
import {
  fetchReportTargetVersion,
  NETWORK_ERROR_CODE,
  submitQuestReport,
} from "@/modules/feedback/report-api";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_COMMENT_MAX_LENGTH,
  isReportCategory,
  normalizeOptionalComment,
} from "@/modules/feedback/report-categories";
import { QuestRunApiError } from "@/modules/progress/run-api";

type TargetState =
  | { status: "loading" }
  | { status: "ready"; versionId: string }
  | { status: "failed"; code: string };

type SubmitState = "idle" | "submitting" | "succeeded";

function errorCode(error: unknown): string {
  return error instanceof QuestRunApiError ? error.code : "INTERNAL_ERROR";
}

function describeReportError(code: string, locale: Locale): string {
  switch (code) {
    case NETWORK_ERROR_CODE:
      return pickLocale(
        locale,
        "インターネットにつながりませんでした。入力内容はそのままです。接続を確認して、もう一度送信してください。",
        "인터넷에 연결하지 못했어요. 입력한 내용은 그대로예요. 연결을 확인하고 다시 보내 주세요.",
      );
    case "REQUEST_CONFLICT":
      return pickLocale(
        locale,
        "前回の送信と内容が違うため、同じ報告として受け付けられませんでした。新しい報告として送ることができます。",
        "이전에 보낸 내용과 달라서 같은 신고로 접수하지 못했어요. 새 신고로 보낼 수 있어요.",
      );
    case "NOT_FOUND":
      return pickLocale(
        locale,
        "このクエストは現在、報告を受け付けていません。",
        "이 퀘스트는 지금 신고를 받을 수 없어요.",
      );
    case "VALIDATION_ERROR":
      return pickLocale(
        locale,
        "入力内容を受け付けられませんでした。種類を選び、500文字以内で入力してください。",
        "입력 내용을 받을 수 없었어요. 종류를 고르고 500자 이내로 입력해 주세요.",
      );
    case "ORIGIN_FORBIDDEN":
      return pickLocale(
        locale,
        "この画面からは送信できません。ページを開き直してください。",
        "이 화면에서는 보낼 수 없어요. 페이지를 다시 열어 주세요.",
      );
    default:
      return pickLocale(
        locale,
        "送信できたか確認できませんでした。入力内容はそのままです。少し待ってから、もう一度送信してください。",
        "보냈는지 확인하지 못했어요. 입력한 내용은 그대로예요. 잠시 후 다시 보내 주세요.",
      );
  }
}

export function ReportButton({
  questId,
  versionId,
}: {
  questId: string;
  /** The version the visitor is viewing; fetched from the public detail when omitted. */
  versionId?: string;
}) {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<TargetState>(
    versionId ? { status: "ready", versionId } : { status: "loading" },
  );
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  // One report intent keeps one idempotency key across explicit retries.
  // It lives only in memory, never in storage or the URL.
  const clientRequestIdRef = useRef<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  const loadTarget = useCallback(async () => {
    if (versionId) {
      setTarget({ status: "ready", versionId });
      return;
    }
    setTarget({ status: "loading" });
    try {
      setTarget({
        status: "ready",
        versionId: await fetchReportTargetVersion(questId),
      });
    } catch (caught) {
      setTarget({ status: "failed", code: errorCode(caught) });
    }
  }, [questId, versionId]);

  const close = useCallback(() => {
    if (state === "submitting") return;
    setIsOpen(false);
    if (state === "succeeded") {
      setCategory("");
      setComment("");
      setState("idle");
      setError(null);
      clientRequestIdRef.current = null;
    }
  }, [state]);

  useModalDialog(isOpen, close, dialogRef, closeButtonRef);

  function open() {
    setIsOpen(true);
    if (target.status !== "ready") void loadTarget();
  }

  async function submit(startNewIntent: boolean) {
    if (target.status !== "ready" || !isReportCategory(category) || state === "submitting") {
      return;
    }
    let normalizedComment: string | null;
    try {
      normalizedComment = normalizeOptionalComment(comment);
    } catch {
      setError("VALIDATION_ERROR");
      return;
    }
    if (startNewIntent || clientRequestIdRef.current === null) {
      clientRequestIdRef.current = crypto.randomUUID();
    }
    setState("submitting");
    setError(null);
    try {
      await submitQuestReport(questId, {
        versionId: target.versionId,
        category,
        comment: normalizedComment,
        clientRequestId: clientRequestIdRef.current,
      });
      setState("succeeded");
    } catch (caught) {
      setState("idle");
      setError(errorCode(caught));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(false);
  }

  const submitting = state === "submitting";

  return (
    <>
      <button type="button" onClick={open} className="flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-black text-slate-600 underline decoration-slate-300 underline-offset-4">
        {pickLocale(locale, "情報の誤りを報告", "잘못된 정보 신고")}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" className="max-h-dvh w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[#f7f3eb] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <h2 id="report-dialog-title" className="text-2xl font-black tracking-tight text-slate-950">{pickLocale(locale, "情報の誤りを報告", "잘못된 정보 신고")}</h2>
              <button ref={closeButtonRef} type="button" onClick={close} disabled={submitting} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-slate-700 shadow-sm disabled:opacity-50" aria-label={pickLocale(locale, "閉じる", "닫기")}>×</button>
            </div>

            {state === "succeeded" ? (
              <div className="py-10 text-center" role="status">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-teal-700 text-2xl text-white" aria-hidden="true">✓</span>
                <h3 className="mt-5 text-xl font-black text-slate-950">{pickLocale(locale, "報告を受け付けました", "신고를 접수했어요")}</h3>
                <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, "運営者が内容を確認して、案内を見直します。個別の返信はしていません。", "운영자가 내용을 확인하고 안내를 점검할게요. 개별 답변은 드리지 않아요.")}</p>
                <button type="button" onClick={close} className="mt-6 min-h-12 rounded-full bg-slate-950 px-6 text-sm font-black text-white">{pickLocale(locale, "閉じる", "닫기")}</button>
              </div>
            ) : target.status === "failed" ? (
              <div className="mt-6 grid gap-4" role="alert">
                <p className="rounded-2xl bg-[#fff0eb] p-4 text-sm font-semibold leading-6 text-[#852a19]">
                  {target.code === "NOT_FOUND"
                    ? describeReportError("NOT_FOUND", locale)
                    : pickLocale(locale, "報告の準備ができませんでした。接続を確認して、もう一度お試しください。", "신고를 준비하지 못했어요. 연결을 확인하고 다시 시도해 주세요.")}
                </p>
                {target.code !== "NOT_FOUND" ? (
                  <button type="button" onClick={() => void loadTarget()} className="min-h-12 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white">{pickLocale(locale, "報告の準備をやり直す", "신고 준비 다시 하기")}</button>
                ) : null}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
                <label className="grid gap-2 text-sm font-black text-slate-800">
                  {pickLocale(locale, "どの情報ですか。", "어떤 정보인가요?")}
                  <select name="category" required value={category} disabled={submitting} onChange={(event) => setCategory(event.target.value)} className="min-h-12 rounded-2xl border border-slate-900/10 bg-white px-4 text-base font-semibold">
                    <option value="" disabled>{pickLocale(locale, "選んでください", "선택해 주세요")}</option>
                    {REPORT_CATEGORIES.map((value) => (
                      <option key={value} value={value}>{pickLocale(locale, REPORT_CATEGORY_LABELS[value].ja, REPORT_CATEGORY_LABELS[value].ko)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-800">
                  {pickLocale(locale, "詳しい内容（任意）", "자세한 내용(선택)")}
                  <textarea name="comment" maxLength={REPORT_COMMENT_MAX_LENGTH} rows={5} value={comment} disabled={submitting} onChange={(event) => setComment(event.target.value)} className="resize-none rounded-2xl border border-slate-900/10 bg-white p-4 font-medium leading-6" />
                </label>
                <p className="rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-slate-600">{pickLocale(locale, "名前・連絡先・予約情報などの個人情報は入力しないでください。送信すると運営者に届き、このブラウザ用の匿名記録が作られます。", "이름·연락처·예약 정보 같은 개인정보는 입력하지 마세요. 보내면 운영자에게 전달되고, 이 브라우저용 익명 기록이 만들어져요.")}</p>
                {error ? (
                  <div className="rounded-2xl bg-[#fff0eb] p-4 text-sm font-semibold leading-6 text-[#852a19]" role="alert">
                    <p>{describeReportError(error, locale)}</p>
                    {error === "REQUEST_CONFLICT" ? (
                      <button type="button" onClick={() => void submit(true)} className="mt-3 min-h-11 rounded-full bg-white px-4 text-sm font-black text-slate-800 shadow-sm">{pickLocale(locale, "新しい報告として送信する", "새 신고로 보내기")}</button>
                    ) : null}
                  </div>
                ) : null}
                <button type="submit" disabled={submitting || target.status !== "ready"} className="min-h-13 rounded-2xl bg-[#ff5a36] px-6 text-base font-black text-white disabled:cursor-wait disabled:opacity-65">
                  {submitting
                    ? pickLocale(locale, "送信しています…", "보내는 중…")
                    : target.status === "loading"
                      ? pickLocale(locale, "準備しています…", "준비하는 중…")
                      : pickLocale(locale, "運営者に報告を送る", "운영자에게 신고 보내기")}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
