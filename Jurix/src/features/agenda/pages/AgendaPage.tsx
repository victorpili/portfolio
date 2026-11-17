import { useEffect, useMemo, useState } from "react";
import { CalendarBlank, CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { cn } from "../../../lib/cn";
import { addDaysIso, formatDateBR, todayIso } from "../../../lib/format/dates";
import { agendaDelete, agendaListCalendar, agendaListWindow, agendaSetStatus } from "../api";
import type { AgendaEventoRow, StatusEvento } from "../types";
import { EventoFormDialog } from "../components/EventoFormDialog";
import { CalendarGrid } from "../components/CalendarGrid";
import { EventoListItem } from "../components/EventoListItem";
import {
  MONTH_NAMES,
  WEEKDAY_LONG,
  relativeDayLabel,
  weekRange,
} from "../components/calendar";

type ViewMode = "calendario" | "semana" | "proximos7" | "proximos30";

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "calendario", label: "Calendário" },
  { value: "semana", label: "Semana" },
  { value: "proximos7", label: "Próximos 7 dias" },
  { value: "proximos30", label: "Próximos 30 dias" },
];

export function AgendaPage() {
  const toast = useToast();
  const now = useMemo(() => new Date(), []);

  const [view, setView] = useState<ViewMode>("calendario");
  const [calRef, setCalRef] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDay, setSelectedDay] = useState(todayIso());
  const [weekAnchor, setWeekAnchor] = useState(todayIso());
  const [includeConcluido, setIncludeConcluido] = useState(false);
  const [includeCancelado, setIncludeCancelado] = useState(false);

  const [eventos, setEventos] = useState<AgendaEventoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgendaEventoRow | null>(null);

  const statuses = useMemo<StatusEvento[]>(() => {
    const s: StatusEvento[] = ["pendente"];
    if (includeConcluido) s.push("concluido");
    if (includeCancelado) s.push("cancelado");
    return s;
  }, [includeConcluido, includeCancelado]);

  const week = useMemo(() => weekRange(weekAnchor), [weekAnchor]);

  async function refresh() {
    setLoading(true);
    try {
      if (view === "calendario") {
        setEventos(await agendaListCalendar(calRef.year, calRef.month));
      } else if (view === "semana") {
        setEventos(await agendaListWindow(week.start, week.end, statuses));
      } else {
        const today = todayIso();
        const span = view === "proximos7" ? 7 : 30;
        setEventos(await agendaListWindow(today, addDaysIso(today, span), statuses));
      }
    } catch (e) {
      toast.error("Falha ao carregar a agenda", String((e as Error).message ?? e));
      setEventos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, calRef, weekAnchor, statuses]);

  function openNew() {
    setEditId(null);
    setDialogOpen(true);
  }
  function openEdit(id: string) {
    setEditId(id);
    setDialogOpen(true);
  }

  async function handleSetStatus(id: string, status: StatusEvento) {
    try {
      await agendaSetStatus(id, status);
      await refresh();
    } catch (e) {
      toast.error("Falha ao atualizar status", String((e as Error).message ?? e));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await agendaDelete(deleteTarget.id);
      toast.success("Evento excluído");
      await refresh();
    } catch (e) {
      toast.error("Falha ao excluir", String((e as Error).message ?? e));
    }
  }

  function shiftMonth(delta: number) {
    setCalRef((prev) => {
      const idx = prev.month - 1 + delta;
      return { year: prev.year + Math.floor(idx / 12), month: ((idx % 12) + 12) % 12 + 1 };
    });
  }

  const itemProps = {
    onEdit: openEdit,
    onDelete: (ev: AgendaEventoRow) => setDeleteTarget(ev),
    onSetStatus: handleSetStatus,
  };

  return (
    <>
      <PageHeader
        eyebrow="Trabalho"
        title="Agenda"
        description="Audiências, prazos e compromissos. Eventos pendentes dentro da janela de alerta aparecem destacados."
        actions={
          <Button variant="primary" size="md" trailingIcon={<Plus weight="bold" />} onClick={openNew}>
            Novo evento
          </Button>
        }
      />

      {/* View switcher */}
      <div className="flex items-center justify-between gap-4 mb-7 flex-wrap">
        <Chips
          value={view}
          onChange={(v) => setView(v as ViewMode)}
          options={VIEWS}
        />
        {view !== "calendario" && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              Incluir
            </span>
            <ToggleChip active={includeConcluido} onClick={() => setIncludeConcluido((v) => !v)}>
              Concluídos
            </ToggleChip>
            <ToggleChip active={includeCancelado} onClick={() => setIncludeCancelado((v) => !v)}>
              Cancelados
            </ToggleChip>
          </div>
        )}
      </div>

      {view === "calendario" && (
        <CalendarView
          year={calRef.year}
          month={calRef.month}
          eventos={eventos}
          loading={loading}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onShiftMonth={shiftMonth}
          onToday={() => {
            const d = new Date();
            setCalRef({ year: d.getFullYear(), month: d.getMonth() + 1 });
            setSelectedDay(todayIso());
          }}
          itemProps={itemProps}
        />
      )}

      {view === "semana" && (
        <WeekView
          week={week}
          eventos={eventos}
          loading={loading}
          onShiftWeek={(d) => setWeekAnchor((prev) => addDaysIso(prev, d * 7))}
          onThisWeek={() => setWeekAnchor(todayIso())}
          itemProps={itemProps}
        />
      )}

      {(view === "proximos7" || view === "proximos30") && (
        <UpcomingView
          span={view === "proximos7" ? 7 : 30}
          eventos={eventos}
          loading={loading}
          itemProps={itemProps}
        />
      )}

      <EventoFormDialog
        open={dialogOpen}
        eventoId={editId}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir evento"
        description={
          <>
            Excluir <strong className="text-[var(--color-ink)]">{deleteTarget?.titulo}</strong> da
            agenda? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

interface ItemProps {
  onEdit: (id: string) => void;
  onDelete: (ev: AgendaEventoRow) => void;
  onSetStatus: (id: string, status: StatusEvento) => void;
}

// ── Calendar view ──────────────────────────────────────────────────────

function CalendarView({
  year,
  month,
  eventos,
  loading,
  selectedDay,
  onSelectDay,
  onShiftMonth,
  onToday,
  itemProps,
}: {
  year: number;
  month: number;
  eventos: AgendaEventoRow[];
  loading: boolean;
  selectedDay: string;
  onSelectDay: (iso: string) => void;
  onShiftMonth: (delta: number) => void;
  onToday: () => void;
  itemProps: ItemProps;
}) {
  const dayEvents = eventos
    .filter((e) => e.data_hora.slice(0, 10) === selectedDay)
    .sort((a, b) => a.data_hora.localeCompare(b.data_hora));

  return (
    <div className="grid grid-cols-12 gap-7">
      <Card className="col-span-12 lg:col-span-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-medium tracking-tight font-display">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onToday}>
              Hoje
            </Button>
            <NavArrow label="Mês anterior" onClick={() => onShiftMonth(-1)}>
              <CaretLeft weight="bold" />
            </NavArrow>
            <NavArrow label="Próximo mês" onClick={() => onShiftMonth(1)}>
              <CaretRight weight="bold" />
            </NavArrow>
          </div>
        </div>
        {loading ? (
          <div className="py-20 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
        ) : (
          <CalendarGrid
            year={year}
            month1={month}
            eventos={eventos}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
          />
        )}
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <div className="eyebrow mb-1">{relativeDayLabel(selectedDay, todayIso())}</div>
        <h3 className="text-[16px] font-medium font-sans tracking-tight mb-4">
          {formatDateBR(selectedDay)}
        </h3>
        {dayEvents.length === 0 ? (
          <p className="text-[13px] text-[var(--color-ink-muted)] py-8 text-center">
            Nenhum evento neste dia.
          </p>
        ) : (
          <ul className="rounded-[1rem] ring-1 ring-[var(--color-hairline)] overflow-hidden -mx-1">
            {dayEvents.map((ev) => (
              <EventoListItem key={ev.id} evento={ev} compact {...itemProps} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── Week view ──────────────────────────────────────────────────────────

function WeekView({
  week,
  eventos,
  loading,
  onShiftWeek,
  onThisWeek,
  itemProps,
}: {
  week: { start: string; end: string };
  eventos: AgendaEventoRow[];
  loading: boolean;
  onShiftWeek: (delta: number) => void;
  onThisWeek: () => void;
  itemProps: ItemProps;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(week.start, i));
  const today = todayIso();

  return (
    <Card className="col-span-12">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-medium tracking-tight font-display">
          {formatDateBR(week.start)} – {formatDateBR(week.end)}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onThisWeek}>
            Esta semana
          </Button>
          <NavArrow label="Semana anterior" onClick={() => onShiftWeek(-1)}>
            <CaretLeft weight="bold" />
          </NavArrow>
          <NavArrow label="Próxima semana" onClick={() => onShiftWeek(1)}>
            <CaretRight weight="bold" />
          </NavArrow>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
      ) : (
        <div className="flex flex-col gap-5">
          {days.map((day) => {
            const dayEvents = eventos
              .filter((e) => e.data_hora.slice(0, 10) === day)
              .sort((a, b) => a.data_hora.localeCompare(b.data_hora));
            const weekdayIdx = new Date(
              Number(day.slice(0, 4)),
              Number(day.slice(5, 7)) - 1,
              Number(day.slice(8, 10)),
            ).getDay();
            return (
              <div key={day}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span
                    className={cn(
                      "text-[13px] font-medium",
                      day === today ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]",
                    )}
                  >
                    {WEEKDAY_LONG[weekdayIdx]}
                  </span>
                  <span className="text-[12px] text-[var(--color-ink-muted)]">
                    {formatDateBR(day)}
                  </span>
                  {day === today && (
                    <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
                      hoje
                    </span>
                  )}
                </div>
                {dayEvents.length === 0 ? (
                  <p className="text-[12.5px] text-[var(--color-ink-subtle)] pl-1">Sem eventos.</p>
                ) : (
                  <ul className="rounded-[1rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
                    {dayEvents.map((ev) => (
                      <EventoListItem key={ev.id} evento={ev} {...itemProps} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Upcoming view ──────────────────────────────────────────────────────

function UpcomingView({
  span,
  eventos,
  loading,
  itemProps,
}: {
  span: number;
  eventos: AgendaEventoRow[];
  loading: boolean;
  itemProps: ItemProps;
}) {
  return (
    <Card className="col-span-12">
      <div className="eyebrow mb-1">Próximos {span} dias</div>
      <h2 className="text-xl font-medium tracking-tight font-display mb-5">
        {eventos.length} evento{eventos.length === 1 ? "" : "s"} na janela
      </h2>
      {loading ? (
        <div className="py-20 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
      ) : eventos.length === 0 ? (
        <EmptyState
          icon={<CalendarBlank weight="light" />}
          title="Nenhum evento à vista"
          description={`Não há compromissos pendentes nos próximos ${span} dias.`}
        />
      ) : (
        <ul className="rounded-[1rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
          {eventos.map((ev) => (
            <EventoListItem key={ev.id} evento={ev} showDate {...itemProps} />
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Small shared controls ──────────────────────────────────────────────

function NavArrow({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-9 h-9 rounded-full inline-flex items-center justify-center text-[var(--color-ink-soft)] ring-1 ring-inset ring-[var(--color-hairline-strong)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)] transition-colors [&_svg]:w-3.5 [&_svg]:h-3.5"
    >
      {children}
    </button>
  );
}

function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-muted)] p-0.5 ring-1 ring-inset ring-[var(--color-hairline)]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            value === opt.value
              ? "bg-[var(--color-surface)] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
              : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-200 ring-1 ring-inset",
        active
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-[#cbd5e0]"
          : "bg-[var(--color-surface)] text-[var(--color-ink-muted)] ring-[var(--color-hairline-strong)] hover:text-[var(--color-ink)]",
      )}
    >
      {children}
    </button>
  );
}
