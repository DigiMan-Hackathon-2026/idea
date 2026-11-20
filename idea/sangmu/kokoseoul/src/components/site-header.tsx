import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-full text-slate-950"
        aria-label="DigiMan ホーム"
      >
        <span
          aria-hidden="true"
          className="grid size-10 place-items-center rounded-full bg-[#ff5a36] text-lg font-black text-white shadow-[0_6px_18px_rgba(255,90,54,0.25)]"
        >
          D
        </span>
        <span className="text-lg font-black tracking-[-0.04em]">DIGIMAN</span>
      </Link>
      <Link
        href="/quests"
        className="rounded-full border border-slate-900/10 bg-white/70 px-4 py-2 text-sm font-bold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white"
      >
        クエスト一覧
      </Link>
    </header>
  );
}
