import {
  forwardRef, useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent,
} from "react";
import { CaretDown, Check, X } from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional secondary text shown subdued on the right of the option. */
  meta?: string;
  /** Optional CSS colour for a small leading dot — used for status colour coding. */
  dotColor?: string;
  disabled?: boolean;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  invalid?: boolean;
  allowClear?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

/** Accent-insensitive lowercase normalization. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Accessible combobox with substring autocomplete.
 * - Type to filter options (accent-insensitive)
 * - ArrowUp/Down navigates, Enter selects, Escape closes
 * - Click outside or blur closes and reverts the input to the selected label
 * - When `allowClear`, an × appears to wipe the current value
 */
export const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  {
    value,
    onChange,
    options,
    placeholder,
    emptyMessage = "Nada encontrado",
    disabled,
    invalid,
    allowClear,
    id,
    "aria-label": ariaLabel,
    className,
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = fold(query);
    return options.filter(
      (o) => fold(o.label).includes(q) || (o.meta ? fold(o.meta).includes(q) : false),
    );
  }, [options, query]);

  // Keep highlight valid as the filtered list shrinks.
  useEffect(() => {
    if (highlight >= filtered.length) {
      setHighlight(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, highlight]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Scroll the highlighted option into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const node = listRef.current.children[highlight] as HTMLElement | undefined;
    node?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [disabled, options, value]);

  const selectOption = useCallback(
    (opt: ComboboxOption) => {
      if (opt.disabled) return;
      onChange(opt.value);
      setQuery("");
      setOpen(false);
    },
    [onChange],
  );

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault();
        selectOption(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    } else if (e.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onChange("");
    setQuery("");
    inputRef.current?.focus();
    setOpen(true);
  }

  const displayValue = open ? query : selectedOption?.label ?? "";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={open ? `${id ?? "combobox"}-list` : undefined}
        aria-label={ariaLabel}
        value={displayValue}
        placeholder={selectedOption ? "" : placeholder}
        disabled={disabled}
        onFocus={openDropdown}
        onClick={openDropdown}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={handleKey}
        className={cn(
          "w-full appearance-none bg-[var(--color-surface)] text-[var(--color-ink)]",
          "rounded-[0.875rem] pl-4 pr-12 py-2.5 text-[14px]",
          "ring-1 ring-inset ring-[var(--color-hairline-strong)]",
          "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "placeholder:text-[var(--color-ink-subtle)]",
          "focus:outline-none focus:ring-[1.5px] focus:ring-[var(--color-accent)]",
          "disabled:bg-[var(--color-surface-muted)] disabled:text-[var(--color-ink-muted)] disabled:cursor-not-allowed",
          invalid && "ring-[var(--color-critical)] focus:ring-[var(--color-critical)]",
        )}
      />

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {allowClear && selectedOption && !disabled && (
          <button
            type="button"
            onMouseDown={handleClear}
            className="rounded-full w-5 h-5 flex items-center justify-center text-[var(--color-ink-subtle)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] transition-colors"
            aria-label="Limpar seleção"
            tabIndex={-1}
          >
            <X weight="bold" className="w-3 h-3" />
          </button>
        )}
        <CaretDown
          weight="light"
          className={cn(
            "w-4 h-4 text-[var(--color-ink-muted)] pointer-events-none transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </div>

      {open && (
        <ul
          ref={listRef}
          id={`${id ?? "combobox"}-list`}
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1.5 max-h-72 overflow-auto rounded-[1rem] bg-[var(--color-surface)] ring-1 ring-[var(--color-hairline-strong)] shadow-ambient p-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-[var(--color-ink-muted)] text-center">
              {emptyMessage}
            </li>
          ) : (
            filtered.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlight;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(opt);
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                  className={cn(
                    "rounded-[0.625rem] px-3 py-2 text-[13.5px] flex items-center justify-between gap-3 cursor-pointer transition-colors",
                    isHighlighted && !opt.disabled
                      ? "bg-[var(--color-surface-muted)]"
                      : "",
                    isSelected
                      ? "text-[var(--color-ink)] font-medium"
                      : "text-[var(--color-ink-soft)]",
                    opt.disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span className="flex items-center gap-2 truncate flex-1 min-w-0">
                    {opt.dotColor && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: opt.dotColor }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {opt.meta && (
                    <span className="text-[11.5px] text-[var(--color-ink-muted)] shrink-0">
                      {opt.meta}
                    </span>
                  )}
                  {isSelected && (
                    <Check weight="bold" className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
});
