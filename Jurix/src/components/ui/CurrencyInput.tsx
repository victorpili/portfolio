import {
  forwardRef, useEffect, useMemo, useRef,
  type InputHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";

const inputBaseClasses =
  "w-full bg-[var(--color-surface)] text-[var(--color-ink)] " +
  "rounded-[0.875rem] pl-10 pr-4 py-2.5 text-[14px] tabular-nums " +
  "ring-1 ring-inset ring-[var(--color-hairline-strong)] " +
  "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] " +
  "placeholder:text-[var(--color-ink-subtle)] " +
  "focus:outline-none focus:ring-[1.5px] focus:ring-[var(--color-accent)] " +
  "disabled:bg-[var(--color-surface-muted)] disabled:text-[var(--color-ink-muted)] disabled:cursor-not-allowed";

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Value in integer cents, or null when blank. */
  valueCents: number | null;
  /** Receives the new cents value (or null when blank). */
  onValueChange: (cents: number | null) => void;
  invalid?: boolean;
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;
  return `${sign}${reais.toLocaleString("pt-BR")},${centavos.toString().padStart(2, "0")}`;
}

/**
 * BRL currency input. Uses the **accumulator pattern** common in Brazilian
 * fintech apps: the user types digits that flow into the cents value from the
 * right. The displayed string is always derived from `valueCents`, and the
 * cursor is pinned to the end of the input after every keystroke. This avoids
 * the cursor-jump issues that happen when you try to keep formatted text
 * synced with parsed cents.
 *
 * Example: typing 1 → 2 → 5 → 0 results in 0,01 → 0,12 → 1,25 → 12,50.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { valueCents, onValueChange, invalid, className, disabled, placeholder, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);

  const display = useMemo(() => {
    if (valueCents == null) return "";
    return formatCents(valueCents);
  }, [valueCents]);

  function setRefs(node: HTMLInputElement | null) {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawDigits = e.target.value.replace(/\D+/g, "");
    if (!rawDigits) {
      onValueChange(null);
      return;
    }
    // Strip leading zeros so "0050" becomes "50".
    const normalized = rawDigits.replace(/^0+/, "") || "0";
    const cents = Number(normalized);
    if (!Number.isFinite(cents) || cents > Number.MAX_SAFE_INTEGER) return;
    onValueChange(cents);
  }

  // Pin the cursor to the end of the input after every value change.
  // This keeps the accumulator behavior: each digit appends, never inserts.
  useEffect(() => {
    const el = innerRef.current;
    if (el && document.activeElement === el) {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [display]);

  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-[var(--color-ink-muted)] pointer-events-none select-none">
        R$
      </span>
      <input
        ref={setRefs}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        // Click anywhere in the field → cursor jumps to end so the next
        // keystroke continues the accumulator.
        onFocus={(e) => {
          const len = e.currentTarget.value.length;
          e.currentTarget.setSelectionRange(len, len);
        }}
        onClick={(e) => {
          const el = e.currentTarget;
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }}
        disabled={disabled}
        className={cn(
          inputBaseClasses,
          invalid && "ring-[var(--color-critical)] focus:ring-[var(--color-critical)]",
          className,
        )}
        placeholder={placeholder ?? "0,00"}
        {...rest}
      />
    </div>
  );
});
