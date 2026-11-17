/** Format cents (integer) as BRL: 1234567 → "R$ 12.345,67". */
export function formatBRL(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const value = cents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Parse a BRL-formatted (or plain digits) string into integer cents. Returns null when blank. */
export function parseBRLToCents(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  // Strip everything except digits, comma, dot, minus
  const cleaned = trimmed.replace(/[^\d,.-]/g, "");
  // Normalize Brazilian format (1.234,56) → (1234.56)
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}
