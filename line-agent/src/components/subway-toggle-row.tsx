"use client";

import { useId, type ReactNode } from "react";

export function SubwayToggleRow({ label, expanded, onToggle, children }: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const panelId = useId();

  return (
    <li className="rounded-xl border border-[var(--border)] bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-start text-sm font-bold text-[var(--foreground)] hover:bg-[var(--surface-muted)] aria-expanded:bg-[var(--primary-soft)] aria-expanded:text-[var(--primary)]"
      >
        {label}
        <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center text-lg leading-none">{expanded ? "−" : "+"}</span>
      </button>
      <div id={panelId} hidden={!expanded}>
        {expanded ? children : null}
      </div>
    </li>
  );
}
