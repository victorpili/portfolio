import { formatCNJ } from "../../../lib/format/documents";
import type { NaturezaProcesso, Processo } from "../types";

/**
 * Returns a user-readable representation of `numero_processo` for the given natureza.
 * - judicial: format the 20-digit CNJ canonically (returns digits unchanged when length is wrong)
 * - administrativo: return the stored free text verbatim
 * Returns null when there is no number to display.
 */
export function displayNumeroProcesso(
  p: Pick<Processo, "natureza" | "numero_processo">,
): string | null {
  if (!p.numero_processo) return null;
  if (p.natureza === "judicial") return formatCNJ(p.numero_processo);
  return p.numero_processo;
}

export function naturezaLabel(natureza: NaturezaProcesso): string {
  return natureza === "judicial" ? "Judicial" : "Administrativo";
}
