import {
  ArrowCounterClockwise, CheckCircle, PencilSimple, Trash, Bell,
} from "@phosphor-icons/react";
import { formatCNJ } from "../../../lib/format/documents";
import { formatDateBR, formatTimeBR, todayIso } from "../../../lib/format/dates";
import { cn } from "../../../lib/cn";
import { StatusEventoBadge } from "./StatusEventoBadge";
import { isAlertActive, tipoEventoColor } from "./calendar";
import type { AgendaEventoRow, StatusEvento } from "../types";

interface EventoListItemProps {
  evento: AgendaEventoRow;
  /** Show the full date instead of only the time. */
  showDate?: boolean;
  /** Stacked layout for narrow containers (e.g. the calendar side panel). */
  compact?: boolean;
  onEdit: (id: string) => void;
  onDelete: (evento: AgendaEventoRow) => void;
  onSetStatus: (id: string, status: StatusEvento) => void;
}

export function EventoListItem({
  evento,
  showDate,
  compact,
  onEdit,
  onDelete,
  onSetStatus,
}: EventoListItemProps) {
  const muted = evento.status !== "pendente";
  const alert = isAlertActive(evento, todayIso());
  const barColor = muted ? "var(--color-hairline-strong)" : tipoEventoColor(evento.tipo_evento_nome);

  const links: string[] = [];
  if (evento.cliente_nome) links.push(evento.cliente_nome);
  if (evento.processo_numero) {
    links.push(
      evento.processo_natureza === "judicial"
        ? formatCNJ(evento.processo_numero)
        : evento.processo_numero,
    );
  }
  if (evento.contrato_codigo) links.push(evento.contrato_codigo);

  const actions = (
    <div className="flex items-center gap-1 shrink-0">
      {evento.status === "pendente" ? (
        <IconBtn
          label="Marcar como concluído"
          onClick={() => onSetStatus(evento.id, "concluido")}
          tone="positive"
        >
          <CheckCircle weight="light" />
        </IconBtn>
      ) : (
        <IconBtn label="Reabrir evento" onClick={() => onSetStatus(evento.id, "pendente")}>
          <ArrowCounterClockwise weight="light" />
        </IconBtn>
      )}
      <IconBtn label="Editar evento" onClick={() => onEdit(evento.id)}>
        <PencilSimple weight="light" />
      </IconBtn>
      <IconBtn label="Excluir evento" onClick={() => onDelete(evento)} tone="danger">
        <Trash weight="light" />
      </IconBtn>
    </div>
  );

  const titulo = (
    <span
      className={cn(
        "text-[14px] font-medium truncate",
        muted ? "text-[var(--color-ink-muted)] line-through" : "text-[var(--color-ink)]",
      )}
      title={evento.titulo}
    >
      {evento.titulo}
    </span>
  );

  const alertBadge = alert && (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[var(--color-warning)] shrink-0"
      title={`Alerta de ${evento.alerta_dias} dia(s) de antecedência`}
    >
      <Bell weight="fill" className="w-3 h-3" />
      alerta
    </span>
  );

  const meta = (
    <div className="text-[12px] text-[var(--color-ink-muted)] truncate">
      {evento.tipo_evento_nome}
      {links.length > 0 && ` · ${links.join(" · ")}`}
    </div>
  );

  if (compact) {
    return (
      <li className="flex items-start gap-2.5 px-3 py-2.5 border-b border-[var(--color-hairline)] last:border-b-0">
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: barColor }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "text-[12.5px] font-medium tabular-nums shrink-0",
                  muted ? "text-[var(--color-ink-muted)]" : "text-[var(--color-ink)]",
                )}
              >
                {formatTimeBR(evento.data_hora)}
              </span>
              <StatusEventoBadge status={evento.status} />
            </div>
            {actions}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            {titulo}
            {alertBadge}
          </div>
          {meta}
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-hairline)] last:border-b-0">
      <span
        className="w-1.5 h-9 rounded-full shrink-0"
        style={{ backgroundColor: barColor }}
        aria-hidden="true"
      />

      <div className="w-[92px] shrink-0 text-right tabular-nums">
        <div
          className={cn(
            "text-[13px] font-medium",
            muted ? "text-[var(--color-ink-muted)]" : "text-[var(--color-ink)]",
          )}
        >
          {showDate ? formatDateBR(evento.data_hora) : formatTimeBR(evento.data_hora)}
        </div>
        {showDate && (
          <div className="text-[11.5px] text-[var(--color-ink-muted)]">
            {formatTimeBR(evento.data_hora)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {titulo}
          {alertBadge}
        </div>
        {meta}
      </div>

      <StatusEventoBadge status={evento.status} />

      {actions}
    </li>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger" | "positive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors duration-200",
        "[&_svg]:w-[16px] [&_svg]:h-[16px]",
        tone === "danger"
          ? "text-[var(--color-ink-subtle)] hover:bg-[var(--color-critical-soft)] hover:text-[var(--color-critical)]"
          : tone === "positive"
            ? "text-[var(--color-ink-subtle)] hover:bg-[var(--color-positive-soft)] hover:text-[var(--color-positive)]"
            : "text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
      )}
    >
      {children}
    </button>
  );
}
