import { forwardRef, type SelectHTMLAttributes } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full appearance-none bg-[var(--color-surface)] text-[var(--color-ink)]",
          "rounded-[0.875rem] pl-4 pr-10 py-2.5 text-[14px]",
          "ring-1 ring-inset ring-[var(--color-hairline-strong)]",
          "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "focus:outline-none focus:ring-[1.5px] focus:ring-[var(--color-accent)]",
          "disabled:bg-[var(--color-surface-muted)] disabled:text-[var(--color-ink-muted)] disabled:cursor-not-allowed",
          invalid && "ring-[var(--color-critical)] focus:ring-[var(--color-critical)]",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <CaretDown
        weight="light"
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-muted)]"
      />
    </div>
  );
});
