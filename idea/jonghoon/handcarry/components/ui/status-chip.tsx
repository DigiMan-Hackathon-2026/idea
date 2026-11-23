import type { OrderStatus } from "@/lib/domain/types";

type Tone = "neutral" | "info" | "success" | "warning" | "error";

const TONE_OF: Record<OrderStatus, Tone> = {
  open: "info",
  awaiting_payment: "warning",
  paid: "neutral",
  purchased: "neutral",
  at_hub: "info",
  delivered: "warning",
  completed: "success",
  disputed: "error",
  resolved_buyer: "neutral",
  resolved_traveler: "success",
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-ink-2",
  info: "bg-[#e0f2fe] text-[#075985]",
  success: "bg-[#dcfce7] text-[#166534]",
  warning: "bg-[#fef9c3] text-[#854d0e]",
  error: "bg-[#fee2e2] text-[#991b1b]",
};

export function StatusChip({ status, label }: { status: OrderStatus; label: string }) {
  return (
    <span
      data-status={status}
      className={`inline-flex h-6 items-center rounded-sm px-2 text-[12px] font-medium tracking-[0.02em] ${TONE_CLASS[TONE_OF[status]]}`}
    >
      {label}
    </span>
  );
}
