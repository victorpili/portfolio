import { useMemo } from "react";
import { addMonthsClamped } from "../../../lib/format/dates";
import { formatDateBR } from "../../../lib/format/dates";
import { formatBRL } from "../../../lib/format/currency";

/**
 * Live preview of the parcela schedule while filling the lancamento form.
 * Mirrors the backend `addMonthsClamped` rule (same day of month, clamped).
 */
export function ParcelasPreview({
  dataPrimeira,
  numParcelas,
  valorCents,
}: {
  dataPrimeira: string;
  numParcelas: number;
  valorCents: number | null;
}) {
  const rows = useMemo(() => {
    if (!dataPrimeira || numParcelas < 2) return [];
    return Array.from({ length: numParcelas }, (_, i) => ({
      numero: i + 1,
      data: addMonthsClamped(dataPrimeira, i),
    }));
  }, [dataPrimeira, numParcelas]);

  if (rows.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--color-ink-muted)]">
        Informe a data da primeira parcela e o número de parcelas para visualizar o cronograma.
      </p>
    );
  }

  const total = valorCents != null ? valorCents * numParcelas : null;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rows.map((r) => (
          <div
            key={r.numero}
            className="rounded-[0.625rem] bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] px-3 py-2"
          >
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
              Parcela {r.numero}
            </div>
            <div className="text-[13px] font-medium tabular-nums text-[var(--color-ink)]">
              {formatDateBR(r.data)}
            </div>
            {valorCents != null && (
              <div className="text-[11.5px] tabular-nums text-[var(--color-ink-muted)]">
                {formatBRL(valorCents)}
              </div>
            )}
          </div>
        ))}
      </div>
      {total != null && (
        <div className="mt-3 text-[12.5px] text-[var(--color-ink-muted)]">
          Total do parcelamento:{" "}
          <strong className="text-[var(--color-ink)] tabular-nums">{formatBRL(total)}</strong>{" "}
          ({numParcelas} × {formatBRL(valorCents)})
        </div>
      )}
    </div>
  );
}
