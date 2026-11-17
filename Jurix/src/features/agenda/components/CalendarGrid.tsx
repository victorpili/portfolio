import { useMemo } from "react";
import { todayIso } from "../../../lib/format/dates";
import { cn } from "../../../lib/cn";
import { MONTH_NAMES, WEEKDAY_SHORT, monthGrid, tipoEventoColor } from "./calendar";
import type { AgendaEventoRow } from "../types";

interface CalendarGridProps {
  year: number;
  month1: number; // 1-based
  eventos: AgendaEventoRow[];
  selectedDay: string;
  onSelectDay: (iso: string) => void;
}

const MAX_CHIPS = 3;

export function CalendarGrid({ year, month1, eventos, selectedDay, onSelectDay }: CalendarGridProps) {
  const rows = useMemo(() => monthGrid(year, month1), [year, month1]);
  const today = todayIso();

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaEventoRow[]>();
    for (const ev of eventos) {
      const day = ev.data_hora.slice(0, 10);
      const list = map.get(day);
      if (list) list.push(ev);
      else map.set(day, [ev]);
    }
    return map;
  }, [eventos]);

  return (
    <div>
      <div className="grid grid-cols-7">
        {WEEKDAY_SHORT.map((wd) => (
          <div
            key={wd}
            className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-subtle)] text-center"
          >
            {wd}
          </div>
        ))}
      </div>

      <div className="rounded-[1rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
        {rows.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((iso) => {
              const dayNum = Number(iso.slice(8, 10));
              const inMonth = Number(iso.slice(5, 7)) === month1;
              const isToday = iso === today;
              const isSelected = iso === selectedDay;
              const dayEvents = byDay.get(iso) ?? [];

              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => onSelectDay(iso)}
                  className={cn(
                    "min-h-[104px] text-left p-1.5 border-b border-r border-[var(--color-hairline)]",
                    "[&:nth-child(7n)]:border-r-0 last:border-b-0",
                    "transition-colors duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    inMonth ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-muted)]",
                    "hover:bg-[var(--color-surface-muted)]",
                    isSelected && "!bg-[var(--color-accent-soft)]",
                  )}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${dayNum} de ${MONTH_NAMES[month1 - 1]} — ${dayEvents.length} evento(s)`}
                >
                  <div className="flex items-center justify-end mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center text-[12px] tabular-nums w-6 h-6 rounded-full",
                        isToday
                          ? "bg-[var(--color-accent)] text-[var(--color-canvas)] font-semibold"
                          : inMonth
                            ? "text-[var(--color-ink-soft)]"
                            : "text-[var(--color-ink-subtle)]",
                      )}
                    >
                      {dayNum}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {dayEvents.slice(0, MAX_CHIPS).map((ev) => (
                      <div
                        key={ev.id}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-1.5 py-1 bg-[var(--color-surface-muted)]",
                          "ring-1 ring-inset ring-[var(--color-hairline)]",
                          ev.status !== "pendente" && "opacity-55",
                        )}
                        title={`${ev.titulo} — ${ev.tipo_evento_nome}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: tipoEventoColor(ev.tipo_evento_nome) }}
                        />
                        <span
                          className={cn(
                            "text-[11px] truncate",
                            ev.status !== "pendente"
                              ? "text-[var(--color-ink-muted)] line-through"
                              : "text-[var(--color-ink-soft)]",
                          )}
                        >
                          {ev.titulo}
                        </span>
                      </div>
                    ))}
                    {dayEvents.length > MAX_CHIPS && (
                      <span className="text-[10.5px] font-medium text-[var(--color-ink-muted)] pl-1">
                        +{dayEvents.length - MAX_CHIPS} mais
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
