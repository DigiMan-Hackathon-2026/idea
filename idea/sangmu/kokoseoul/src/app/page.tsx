export default function Home() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-[0.18em] text-orange-700">
          DIGIMAN
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
          Development environment ready
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          Next.js, TypeScript, Tailwind CSS, Vitest, and Playwright are ready.
        </p>
      </section>
    </main>
  );
}
