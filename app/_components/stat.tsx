export interface StatProps {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "muted";
  hint?: string;
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  neutral: "text-ink-100",
  positive: "text-win-400",
  negative: "text-loss-300",
  muted: "text-ink-500",
};

export function Stat({ label, value, tone = "neutral", hint }: StatProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
        {label}
      </span>
      <span className="flex items-baseline gap-1.5">
        {hint ? <span className="font-sans text-[10px] text-ink-500">{hint}</span> : null}
        <output className={`font-mono text-sm tabular-nums ${TONE[tone]}`}>{value}</output>
      </span>
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
      {children}
    </h3>
  );
}
