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
      <nav className="flex items-center gap-1 rounded-full border border-slate-900/10 bg-white/70 p-1 shadow-sm backdrop-blur" aria-label="メインナビゲーション">
        <Link
          href="/quests"
          className="rounded-full px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-white sm:px-4"
        >
          クエスト
        </Link>
        <Link
          href="/my"
          className="rounded-full px-3 py-2 text-sm font-bold text-slate-800 transition hover:bg-white sm:px-4"
        >
          記録
        </Link>
      </nav>
    </header>
  );
}
