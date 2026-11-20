"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { pickLocale } from "@/lib/locale";
import {
  DEMO_REPORTS_STORAGE_KEY,
  REPORT_CATEGORY_LABELS,
  REPORT_CATEGORY_LABELS_KO,
  createDemoReport,
  parseDemoReports,
} from "@/modules/feedback/demo-report";

export function DemoReportButton() {
  const { locale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useModalDialog(isOpen, close, dialogRef, closeButtonRef);

  function close() {
    setIsOpen(false);
    setIsSubmitted(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const report = createDemoReport(
      String(form.get("category")),
      String(form.get("comment") ?? ""),
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    const reports = parseDemoReports(
      localStorage.getItem(DEMO_REPORTS_STORAGE_KEY),
    );
    localStorage.setItem(
      DEMO_REPORTS_STORAGE_KEY,
      JSON.stringify([...reports, report]),
    );
    setIsSubmitted(true);
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="flex min-h-11 w-full items-center justify-center rounded-2xl px-4 text-sm font-black text-slate-600 underline decoration-slate-300 underline-offset-4">
        {pickLocale(locale, "情報の誤りを報告", "잘못된 정보 신고")}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
          <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" className="w-full max-w-lg rounded-t-[2rem] bg-[#f7f3eb] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-[#c93418]">DEMO REPORT</p>
                <h2 id="report-dialog-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950">{pickLocale(locale, "情報の誤りを報告", "잘못된 정보 신고")}</h2>
              </div>
              <button ref={closeButtonRef} type="button" onClick={close} className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-slate-700 shadow-sm" aria-label={pickLocale(locale, "閉じる", "닫기")}>×</button>
            </div>

            {isSubmitted ? (
              <div className="py-10 text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-teal-700 text-2xl text-white" aria-hidden="true">✓</span>
                <h3 className="mt-5 text-xl font-black text-slate-950">{pickLocale(locale, "報告を保存しました", "신고를 저장했습니다")}</h3>
                <p className="mt-3 leading-7 text-slate-600">{pickLocale(locale, "このデモではブラウザ内にだけ保存され、運営者には送信されません。", "이 데모에서는 브라우저 안에만 저장되며 운영자에게 전송되지 않습니다.")}</p>
                <button type="button" onClick={close} className="mt-6 min-h-12 rounded-full bg-slate-950 px-6 text-sm font-black text-white">{pickLocale(locale, "閉じる", "닫기")}</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
                <label className="grid gap-2 text-sm font-black text-slate-800">
                  {pickLocale(locale, "どの情報ですか。", "어떤 정보인가요?")}
                  <select name="category" required defaultValue="" className="min-h-12 rounded-2xl border border-slate-900/10 bg-white px-4 text-base font-semibold">
                    <option value="" disabled>{pickLocale(locale, "選んでください", "선택해 주세요")}</option>
                    {Object.entries(REPORT_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{pickLocale(locale, label, REPORT_CATEGORY_LABELS_KO[value as keyof typeof REPORT_CATEGORY_LABELS_KO])}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-black text-slate-800">
                  {pickLocale(locale, "詳しい内容（任意）", "자세한 내용(선택)")}
                  <textarea name="comment" maxLength={500} rows={5} className="resize-none rounded-2xl border border-slate-900/10 bg-white p-4 font-medium leading-6" />
                </label>
                <p className="rounded-2xl bg-[#fff0eb] p-4 text-sm font-semibold leading-6 text-[#852a19]">{pickLocale(locale, "名前、連絡先、予約情報などの個人情報は入力しないでください。この報告はデモ用で外部送信されません。", "이름, 연락처, 예약 정보 등 개인정보는 입력하지 마세요. 이 신고는 데모용이며 외부로 전송되지 않습니다.")}</p>
                <button type="submit" className="min-h-13 rounded-2xl bg-[#ff5a36] px-6 text-base font-black text-white">{pickLocale(locale, "報告を保存する", "신고 저장하기")}</button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
