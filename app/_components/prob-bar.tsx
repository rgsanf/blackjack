import { pct } from "./format";

export type Tone = "neutral" | "win" | "push" | "loss" | "bust" | "accent";

const TONE_BG: Record<Tone, string> = {
  neutral: "bg-ink-500",
  win: "bg-win-400",
  push: "bg-push-400",
  loss: "bg-loss-400",
  bust: "bg-bust-400",
  accent: "bg-brass-400",
};

export interface ProbBarProps {
  label: string;
  value: number;
  tone?: Tone;
  emphasis?: boolean;
}

/**
 * Fixed label and value gutters, so every bar starts and ends at the same x and bar
 * LENGTHS are directly comparable at a glance. A flex layout would give each row a
 * different origin and destroy that.
 *
 * Bars are absolute 0-100%, never normalised to the row maximum - normalising would
 * make the largest value always full-width and rescale the whole column on every click.
 */
export function ProbBar({ label, value, tone = "neutral", emphasis }: ProbBarProps) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <div className="grid grid-cols-[3.25rem_1fr_3.5rem] items-center gap-2">
      <span
        className={`font-sans text-xs ${
          emphasis ? "font-semibold text-ink-100" : "font-medium text-ink-300"
        }`}
      >
        {label}
      </span>
      <div className="h-2 overflow-hidden rounded-full bg-felt-700/70">
        <div
          className={`prob-fill h-full rounded-full ${TONE_BG[tone]} ${
            safe > 0 ? "min-w-[0.125rem]" : ""
          }`}
          style={{ width: `${(safe * 100).toFixed(1)}%` }}
        />
      </div>
      <output
        className={`text-right font-mono text-sm tabular-nums ${
          emphasis ? "font-semibold text-ink-100" : "text-ink-100"
        }`}
      >
        {pct(safe)}
      </output>
    </div>
  );
}
