import { type ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "neutral" | "positive" | "warning" | "critical" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--color-surface-muted)] text-[var(--color-ink-soft)] ring-[var(--color-hairline-strong)]",
  positive: "bg-[var(--color-positive-soft)] text-[var(--color-positive)] ring-[#cdddd0]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] ring-[#e7d8b3]",
  critical: "bg-[var(--color-critical-soft)] text-[var(--color-critical)] ring-[#e7cbc8]",
  info: "bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-[#cbd5e0]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px]",
        "text-[11.5px] font-medium tracking-[0.01em]",
        "ring-1 ring-inset",
        "[&_svg]:w-3 [&_svg]:h-3",
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
