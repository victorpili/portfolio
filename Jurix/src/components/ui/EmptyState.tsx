import { type ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      {icon && (
        <div className="mb-5 w-14 h-14 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink-muted)] [&_svg]:w-6 [&_svg]:h-6">
          {icon}
        </div>
      )}
      <h3 className="text-[18px] font-medium text-[var(--color-ink)] mb-1.5 tracking-tight font-sans">
        {title}
      </h3>
      {description && (
        <p className="text-[14px] text-[var(--color-ink-muted)] max-w-md leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
