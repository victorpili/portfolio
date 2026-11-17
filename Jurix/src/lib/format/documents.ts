/** Strip every non-digit character. */
export function onlyDigits(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D+/g, "");
}

/** Format a digit-only CPF for display. Returns the input unchanged when length != 11. */
export function formatCPF(digits: string | null | undefined): string {
  const d = onlyDigits(digits);
  if (d.length !== 11) return d;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/** Format a digit-only CNPJ for display. */
export function formatCNPJ(digits: string | null | undefined): string {
  const d = onlyDigits(digits);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

/** Format a digit-only CEP (8 digits) as 00000-000. */
export function formatCEP(digits: string | null | undefined): string {
  const d = onlyDigits(digits);
  if (d.length !== 8) return d;
  return `${d.slice(0, 5)}-${d.slice(5, 8)}`;
}

/** Format a digit-only phone — accepts 10 or 11 digits with DDD. */
export function formatPhone(digits: string | null | undefined): string {
  const d = onlyDigits(digits);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6, 10)}`;
  return d;
}

/** Live-mask a CPF input as the user types. */
export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  const parts: string[] = [];
  if (d.length > 0) parts.push(d.slice(0, 3));
  if (d.length > 3) parts[0] += "." + d.slice(3, 6);
  if (d.length > 6) parts[0] += "." + d.slice(6, 9);
  if (d.length > 9) parts[0] += "-" + d.slice(9, 11);
  return parts[0] ?? "";
}

/** Live-mask a CNPJ input as the user types. */
export function maskCNPJ(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  let out = "";
  if (d.length > 0) out += d.slice(0, 2);
  if (d.length > 2) out += "." + d.slice(2, 5);
  if (d.length > 5) out += "." + d.slice(5, 8);
  if (d.length > 8) out += "/" + d.slice(8, 12);
  if (d.length > 12) out += "-" + d.slice(12, 14);
  return out;
}

/** Live-mask a CEP input. */
export function maskCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length > 5) return d.slice(0, 5) + "-" + d.slice(5, 8);
  return d;
}

/**
 * Format a digit-only CNJ (20 digits) as canonical NNNNNNN-DD.AAAA.J.TR.OOOO.
 * Returns the input unchanged when length != 20.
 */
export function formatCNJ(digits: string | null | undefined): string {
  const d = onlyDigits(digits);
  if (d.length !== 20) return d;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

/** Live-mask a CNJ input as the user types — partials remain readable. */
export function maskCNJ(value: string): string {
  const d = onlyDigits(value).slice(0, 20);
  let out = "";
  if (d.length > 0) out += d.slice(0, 7);
  if (d.length > 7) out += "-" + d.slice(7, 9);
  if (d.length > 9) out += "." + d.slice(9, 13);
  if (d.length > 13) out += "." + d.slice(13, 14);
  if (d.length > 14) out += "." + d.slice(14, 16);
  if (d.length > 16) out += "." + d.slice(16, 20);
  return out;
}

/** Live-mask a phone input. */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/**
 * Validate a CPF's check digits (algorithm — modulo 11).
 * Returns true for valid documents; rejects all-equal sequences and bad checksums.
 */
export function isValidCPF(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (slice: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += parseInt(slice[i], 10) * (factorStart - i);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  const dig1 = calc(d.slice(0, 9), 10);
  const dig2 = calc(d.slice(0, 10), 11);
  return dig1 === parseInt(d[9], 10) && dig2 === parseInt(d[10], 10);
}

/** Validate a CNPJ's check digits. */
export function isValidCNPJ(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (slice: string, factors: number[]): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += parseInt(slice[i], 10) * factors[i];
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const f1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const f2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dig1 = calc(d.slice(0, 12), f1);
  const dig2 = calc(d.slice(0, 13), f2);
  return dig1 === parseInt(d[12], 10) && dig2 === parseInt(d[13], 10);
}
