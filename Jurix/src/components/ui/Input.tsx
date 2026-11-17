import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface FieldShellProps {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, required, children, className }: FieldShellProps) {
  return (
    <label htmlFor={htmlFor} className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)] tracking-tight">
        {label}
        {required && <span className="text-[var(--color-critical)] ml-1">*</span>}
      </span>
      {children}
      {error ? (
        <span className="text-[12px] text-[var(--color-critical)]">{error}</span>
      ) : hint ? (
        <span className="text-[12px] text-[var(--color-ink-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

const inputBaseClasses =
  "w-full bg-[var(--color-surface)] text-[var(--color-ink)] " +
  "rounded-[0.875rem] px-4 py-2.5 text-[14px] " +
  "ring-1 ring-inset ring-[var(--color-hairline-strong)] " +
  "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] " +
  "placeholder:text-[var(--color-ink-subtle)] " +
  "focus:outline-none focus:ring-[1.5px] focus:ring-[var(--color-accent)] focus:bg-[var(--color-surface)] " +
  "disabled:bg-[var(--color-surface-muted)] disabled:text-[var(--color-ink-muted)] disabled:cursor-not-allowed";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ invalid, className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(inputBaseClasses, invalid && "ring-[var(--color-critical)] focus:ring-[var(--color-critical)]", className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={3}
      className={cn(
        inputBaseClasses,
        "resize-none",
        invalid && "ring-[var(--color-critical)] focus:ring-[var(--color-critical)]",
        className,
      )}
      {...rest}
    />
  );
});
