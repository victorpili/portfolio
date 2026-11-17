/** Today's date as YYYY-MM-DD in local time. */
export function todayIso(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Current full ISO timestamp in UTC for criado_em / atualizado_em columns. */
export function nowIsoTimestamp(): string {
  return new Date().toISOString();
}

/** Format YYYY-MM-DD → DD/MM/YYYY for display. */
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Format an ISO datetime (YYYY-MM-DDTHH:MM) → DD/MM/YYYY HH:MM. */
export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return formatDateBR(iso);
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

/** Extract HH:MM from an ISO datetime; empty string when absent. */
export function formatTimeBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /[T ](\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "";
}

/** Add `days` calendar days to a YYYY-MM-DD date, returning YYYY-MM-DD. */
export function addDaysIso(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Whole-day difference toIso − fromIso (both YYYY-MM-DD). Positive when `to` is later. */
export function diffDaysIso(fromIso: string, toIso: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(fromIso);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(toIso);
  if (!a || !b) return 0;
  const from = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const to = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((to - from) / 86_400_000);
}

/** Number of days in a given month. monthIndex0 is 0-based (0 = January). */
export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/**
 * Adds `monthsToAdd` calendar months to an ISO date (YYYY-MM-DD), keeping the
 * same day-of-month. When the target month has fewer days, the result is
 * clamped to the last day of that month. The anchor day is always the ORIGINAL
 * date's day — it never drifts to a previously clamped day.
 *
 * Examples (anchor day 31):
 *   2026-01-31 +1 → 2026-02-28   +2 → 2026-03-31   +3 → 2026-04-30
 */
export function addMonthsClamped(iso: string, monthsToAdd: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = Number(m[1]);
  const month0 = Number(m[2]) - 1;
  const day = Number(m[3]);

  const targetIndex = month0 + monthsToAdd;
  const targetYear = year + Math.floor(targetIndex / 12);
  const targetMonth0 = ((targetIndex % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth0));

  return `${targetYear}-${pad2(targetMonth0 + 1)}-${pad2(clampedDay)}`;
}
