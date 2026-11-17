import {
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  addMonths,
  eachMonthOfInterval,
  format,
} from "date-fns";

export type PeriodKind = "mes_atual" | "trimestre" | "ano" | "personalizado";

export interface Period {
  kind: PeriodKind;
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
}

const iso = (d: Date): string => format(d, "yyyy-MM-dd");

/** Resolves a period kind into an inclusive [from, to] date range. */
export function resolvePeriod(
  kind: PeriodKind,
  custom?: { from: string; to: string },
): Period {
  const now = new Date();
  if (kind === "mes_atual") {
    return { kind, from: iso(startOfMonth(now)), to: iso(endOfMonth(now)) };
  }
  if (kind === "trimestre") {
    return { kind, from: iso(startOfQuarter(now)), to: iso(endOfQuarter(now)) };
  }
  if (kind === "ano") {
    return { kind, from: iso(startOfYear(now)), to: iso(endOfYear(now)) };
  }
  return { kind: "personalizado", from: custom?.from ?? iso(now), to: custom?.to ?? iso(now) };
}

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  mes_atual: "Mês atual",
  trimestre: "Trimestre",
  ano: "Ano",
  personalizado: "Personalizado",
};

/** The `YYYY-MM` buckets spanned by an inclusive [from, to] date range. */
export function monthsInRange(from: string, to: string): string[] {
  const parse = (s: string): Date => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const start = parse(from);
  const end = parse(to);
  if (start > end) return [];
  return eachMonthOfInterval({ start, end }).map((d) => format(d, "yyyy-MM"));
}

/** Today as YYYY-MM-DD and today + `months` as YYYY-MM-DD. */
export function horizonRange(months: number): { from: string; to: string } {
  const now = new Date();
  return { from: iso(now), to: iso(addMonths(now, months)) };
}

/** Short pt-BR label for a `YYYY-MM` bucket, e.g. "mai/26". */
export function monthShortLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}
