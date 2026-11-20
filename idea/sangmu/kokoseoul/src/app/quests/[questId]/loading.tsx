export default function QuestDetailLoading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl animate-pulse px-5 py-10 sm:px-8" aria-label="クエスト詳細を読み込み中">
      <div className="h-8 w-36 rounded-full bg-slate-200" />
      <div className="mt-8 h-96 rounded-[2.5rem] bg-slate-200" />
      <div className="mt-8 h-12 w-2/3 rounded-2xl bg-slate-200" />
    </main>
  );
}
