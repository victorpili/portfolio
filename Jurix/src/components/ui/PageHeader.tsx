import { type ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-8 mb-10">
      <div>
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="text-[40px] leading-[1.05] tracking-[-0.03em] font-medium text-[var(--color-ink)] font-display">
          {title}
        </h1>
        {description && (
          <p className="text-[15px] text-[var(--color-ink-muted)] mt-3 max-w-xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-3">{actions}</div>}
    </header>
  );
}
