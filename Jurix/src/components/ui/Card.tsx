import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/**
 * Card — Double-Bezel pattern: an outer "shell" with a hairline ring and an inner "core"
 * that holds the actual content. Children of <Card> are placed inside the inner core.
 */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional padding applied to the inner core. Defaults to 1.5rem (p-6). */
  innerClassName?: string;
  /** Disable the outer bezel; render only the inner card. Use sparingly. */
  flat?: boolean;
}

export function Card({ flat, className, innerClassName, children, ...rest }: CardProps) {
  if (flat) {
    return (
      <div
        className={cn(
          "rounded-[1.25rem] bg-[var(--color-surface)] ring-1 ring-[var(--color-hairline)] p-6",
          className,
          innerClassName,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[1.75rem] bg-[var(--color-surface-muted)] p-1.5 ring-1 ring-[var(--color-hairline)]",
        className,
      )}
      {...rest}
    >
      <div
        className={cn(
          "rounded-[calc(1.75rem-0.375rem)] bg-[var(--color-surface)] p-6",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>{children}</div>;
}

export function CardTitle({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div>
      {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
      <h2 className="text-xl font-medium tracking-tight">{children}</h2>
    </div>
  );
}
