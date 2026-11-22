import type { ReactNode } from "react";

export function ScenicHero({
  theme,
  title,
  description,
  children,
}: {
  theme: "dawn" | "dusk" | "night";
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="scenic-hero" data-theme={theme}>
      <div className="scenic-hero-copy">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
    </header>
  );
}
