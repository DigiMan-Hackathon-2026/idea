import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-line bg-surface ${className}`} {...rest} />;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-[17px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "text-base font-bold" : "text-sm text-ink-2"}`}>
      <span>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: ReactNode }) {
  const tones = {
    info: "bg-[#eff6ff] text-[#1e40af]",
    success: "bg-[#dcfce7] text-[#166534]",
    warning: "bg-[#fef9c3] text-[#854d0e]",
    error: "bg-[#fee2e2] text-[#991b1b]",
  };
  return (
    <p role="status" className={`rounded-md px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>
      {children}
    </p>
  );
}
