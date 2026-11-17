import { ArrowUpRight } from "@phosphor-icons/react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  trailingIcon?: ReactNode | "auto";
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-[var(--color-canvas)] hover:bg-[var(--color-accent-hover)] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_0_var(--color-accent-hover)]",
  secondary:
    "bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] " +
    "ring-1 ring-inset ring-[var(--color-hairline-strong)]",
  ghost:
    "bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
  danger:
    "bg-[var(--color-critical)] text-[var(--color-canvas)] hover:bg-[#71190f] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-2 rounded-full",
  md: "h-11 px-5 text-sm gap-2.5 rounded-full",
  lg: "h-12 px-6 text-[15px] gap-3 rounded-full",
};

const trailingWrapperBase =
  "flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] " +
  "group-hover:translate-x-[2px] group-hover:-translate-y-[1px]";

const trailingWrapperVariant: Record<Variant, string> = {
  primary: "bg-white/15 text-[var(--color-canvas)]",
  secondary: "bg-[var(--color-surface-sunken)] text-[var(--color-ink)]",
  ghost: "bg-[var(--color-surface-sunken)] text-[var(--color-ink-soft)]",
  danger: "bg-white/15 text-[var(--color-canvas)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, trailingIcon, className, children, disabled, ...rest },
  ref,
) {
  const showTrailing = trailingIcon !== undefined && trailingIcon !== null;
  const resolvedTrailing = trailingIcon === "auto" ? <ArrowUpRight weight="light" /> : trailingIcon;

  const trailingSize = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-9 h-9" : "w-8 h-8";
  const iconSize = size === "sm" ? "[&_svg]:w-4 [&_svg]:h-4" : "[&_svg]:w-[18px] [&_svg]:h-[18px]";

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "group inline-flex items-center justify-center font-medium select-none whitespace-nowrap",
        "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
        iconSize,
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...rest}
    >
      {icon && <span className="inline-flex items-center">{icon}</span>}
      {children !== undefined && children !== null && children !== "" && <span>{children}</span>}
      {showTrailing && (
        <span
          className={cn(
            "rounded-full -mr-1 [&_svg]:w-[14px] [&_svg]:h-[14px]",
            trailingSize,
            trailingWrapperBase,
            trailingWrapperVariant[variant],
          )}
        >
          {resolvedTrailing}
        </span>
      )}
    </button>
  );
});
