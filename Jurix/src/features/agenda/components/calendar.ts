import { addDaysIso, diffDaysIso } from "../../../lib/format/dates";
import type { AgendaEvento, StatusEvento } from "../types";

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_LONG = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Builds the calendar grid (Sunday-first) for the given year/month (1-based).
 * Returns whole weeks of 7 ISO dates each — 5 or 6 rows as needed.
 */
export function monthGrid(year: number, month1: number): string[][] {
  const first = new Date(year, month1 - 1, 1);
  const startWeekday = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month1, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const cells: string[] = [];
  for (let i = 0; i < totalCells; i++) {
    cells.push(isoOf(new Date(year, month1 - 1, 1 - startWeekday + i)));
  }
  const rows: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** Sunday-to-Saturday bounds of the week containing `iso` (YYYY-MM-DD). */
export function weekRange(iso: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return { start: iso, end: iso };
  const weekday = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return { start: addDaysIso(iso, -weekday), end: addDaysIso(iso, 6 - weekday) };
}

/** Human label for a date relative to today: "Hoje", "Amanhã", "em 3 dias", "há 2 dias". */
export function relativeDayLabel(dateIso: string, todayIsoStr: string): string {
  const d = diffDaysIso(todayIsoStr, dateIso);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d === -1) return "Ontem";
  if (d > 1) return `em ${d} dias`;
  return `há ${Math.abs(d)} dias`;
}

/** Splits an ISO datetime into the date/time parts an <input> expects. */
export function splitDataHora(iso: string): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? { date: m[1], time: m[2] } : { date: "", time: "" };
}

/** Joins a date (YYYY-MM-DD) and a time (HH:MM) into a stored ISO datetime. */
export function joinDataHora(date: string, time: string): string {
  return `${date}T${time}:00`;
}

/**
 * True when a pending event is inside its anticipation window:
 * today is on or after (data_hora − alerta_dias) and on or before data_hora.
 */
export function isAlertActive(evento: AgendaEvento, todayIsoStr: string): boolean {
  if (evento.status !== "pendente") return false;
  const eventDate = evento.data_hora.slice(0, 10);
  const toEvent = diffDaysIso(todayIsoStr, eventDate);
  return toEvent >= 0 && toEvent <= evento.alerta_dias;
}

// Stable, muted colour per event type — the lookup table carries no colour column,
// so we hash the name into a fixed editorial palette.
const TIPO_PALETTE = ["#1c2a3a", "#3f6f5f", "#8a5a2b", "#6b4a6f", "#2f5d7a", "#7a3b32"];

export function tipoEventoColor(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return TIPO_PALETTE[h % TIPO_PALETTE.length];
}

export const STATUS_EVENTO_LABEL: Record<StatusEvento, string> = {
  pendente: "Pendente",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
