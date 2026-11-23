import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-active",
  secondary: "border-2 border-primary text-primary bg-transparent hover:bg-primary-soft",
  ghost: "text-ink-2 bg-transparent hover:bg-muted",
  destructive: "bg-error text-white hover:bg-[#dc2626]",
};
const SIZE: Record<Size, string> = {
  sm: "h-[34px] px-[18px] text-[13px]",
  md: "h-[42px] px-7 text-[15px]",
  lg: "h-[50px] px-9 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    />
  );
}
