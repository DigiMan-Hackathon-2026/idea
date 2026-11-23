import type { Category } from "@/lib/domain/types";

// Placeholder illustrations: no real product images (copyright/trademark), one motif per category.
const ART: Record<Category, { from: string; to: string; motif: "cards" | "star" | "heart" | "book" | "sparkle" }> = {
  "pokemon-sealed": { from: "#fde047", to: "#f97316", motif: "cards" },
  "kpop-japan-limited": { from: "#f0abfc", to: "#a855f7", motif: "star" },
  "jp-idol": { from: "#fbcfe8", to: "#ec4899", motif: "heart" },
  "idol-magazine": { from: "#a5f3fc", to: "#0ea5e9", motif: "book" },
  "anime-character": { from: "#bbf7d0", to: "#14b8a6", motif: "sparkle" },
};

function Motif({ kind }: { kind: (typeof ART)[Category]["motif"] }) {
  switch (kind) {
    case "cards":
      return (
        <g fill="white" fillOpacity="0.9">
          <rect x="22" y="18" width="26" height="36" rx="4" transform="rotate(-12 35 36)" />
          <rect x="32" y="16" width="26" height="36" rx="4" fillOpacity="0.7" transform="rotate(10 45 34)" />
        </g>
      );
    case "star":
      return <path fill="white" fillOpacity="0.9" d="M40 14l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" />;
    case "heart":
      return <path fill="white" fillOpacity="0.9" d="M40 60S16 45 16 30a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 15-24 30-24 30z" />;
    case "book":
      return (
        <g fill="white" fillOpacity="0.9">
          <rect x="24" y="16" width="32" height="44" rx="3" />
          <rect x="29" y="22" width="22" height="4" rx="2" fill="#0ea5e9" fillOpacity="0.5" />
        </g>
      );
    case "sparkle":
      return <path fill="white" fillOpacity="0.9" d="M40 12c2 14 6 18 20 20-14 2-18 6-20 20-2-14-6-18-20-20 14-2 18-6 20-20z" />;
  }
}

export function ItemArt({ category, size = 64, label }: { category: Category; size?: number; label: string }) {
  const a = ART[category];
  const id = `g-${category}`;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role="img" aria-label={label} className="shrink-0 rounded-md">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a.from} />
          <stop offset="1" stopColor={a.to} />
        </linearGradient>
      </defs>
      <rect width="80" height="80" fill={`url(#${id})`} />
      <Motif kind={a.motif} />
    </svg>
  );
}

// Sample proof photos used by the "attach sample" button and seeds.
export function SamplePhoto({ kind, label }: { kind: "receipt" | "item"; label: string }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={label} className="h-full w-full rounded-md bg-muted">
      {kind === "receipt" ? (
        <g>
          <rect x="34" y="12" width="52" height="96" rx="3" fill="white" stroke="#d4d4d4" />
          {[24, 34, 44, 54, 64].map((y) => (
            <rect key={y} x="42" y={y} width={y % 20 === 4 ? 36 : 28} height="4" rx="2" fill="#a3a3a3" />
          ))}
          <rect x="42" y="82" width="36" height="6" rx="2" fill="#525252" />
          <text x="60" y="100" textAnchor="middle" fontSize="8" fill="#525252" fontFamily="monospace">
            ¥5,400
          </text>
        </g>
      ) : (
        <g>
          <rect x="24" y="30" width="72" height="60" rx="6" fill="#fde047" />
          <rect x="24" y="30" width="72" height="14" rx="6" fill="#f97316" />
          <path d="M60 52l5 10 11 1-8 8 2 11-10-6-10 6 2-11-8-8 11-1z" fill="white" />
        </g>
      )}
    </svg>
  );
}
