import type { ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-md border-[1.5px] border-line-strong bg-surface px-4 text-base text-ink placeholder:text-ink-3 outline-none transition focus:border-primary focus:ring-[3px] focus:ring-primary/15 aria-[invalid=true]:border-error aria-[invalid=true]:ring-error/15";

export function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-error">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-[12px] text-ink-2">
          {help}
        </p>
      ) : null}
    </div>
  );
}
