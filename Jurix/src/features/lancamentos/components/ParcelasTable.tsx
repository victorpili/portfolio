import { useState } from "react";
import { CheckCircle, ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { formatBRL } from "../../../lib/format/currency";
import { formatDateBR, todayIso } from "../../../lib/format/dates";
import { StatusPagamentoBadge } from "./StatusPagamentoBadge";
import { parcelaStatusEfetivo } from "./labels";
import type { Parcela } from "../types";

interface ParcelasTableProps {
  parcelas: Parcela[];
  /** When false, payment actions are hidden (e.g. cancelled lancamento). */
  actionsEnabled?: boolean;
  onMarcarPago: (parcelaId: string, dataPagamento: string) => void | Promise<void>;
  onDesmarcarPago: (parcelaId: string) => void | Promise<void>;
}

export function ParcelasTable({
  parcelas,
  actionsEnabled = true,
  onMarcarPago,
  onDesmarcarPago,
}: ParcelasTableProps) {
  // Per-row date being entered before confirming payment.
  const [payDates, setPayDates] = useState<Record<string, string>>({});

  if (parcelas.length === 0) {
    return (
      <p className="text-[13px] text-[var(--color-ink-muted)]">Sem parcelas geradas.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-[0.875rem] ring-1 ring-[var(--color-hairline)]">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]">
            <th className="text-left font-medium px-4 py-2.5 w-16">#</th>
            <th className="text-left font-medium px-4 py-2.5">Vencimento</th>
            <th className="text-right font-medium px-4 py-2.5">Valor</th>
            <th className="text-left font-medium px-4 py-2.5">Status</th>
            <th className="text-right font-medium px-4 py-2.5">Ação</th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map((p) => {
            const efetivo = parcelaStatusEfetivo(p);
            const isPaid = p.status === "pago";
            return (
              <tr
                key={p.id}
                className="border-t border-[var(--color-hairline)] last:border-b-0"
              >
                <td className="px-4 py-2.5 tabular-nums text-[var(--color-ink-muted)]">
                  {p.numero}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{formatDateBR(p.data_prevista)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatBRL(p.valor)}</td>
                <td className="px-4 py-2.5">
                  <StatusPagamentoBadge status={efetivo} />
                </td>
                <td className="px-4 py-2.5">
                  {!actionsEnabled ? (
                    <span className="text-[12px] text-[var(--color-ink-subtle)]">—</span>
                  ) : isPaid ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[11.5px] text-[var(--color-ink-muted)]">Pago em</span>
                      <Input
                        type="date"
                        value={payDates[p.id] ?? p.data_pagamento ?? todayIso()}
                        onChange={(e) =>
                          setPayDates((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v && v !== p.data_pagamento) onMarcarPago(p.id, v);
                        }}
                        className="!py-1.5 !w-[140px] !text-[12.5px]"
                        aria-label={`Data de pagamento da parcela ${p.numero}`}
                      />
                      <button
                        type="button"
                        onClick={() => onDesmarcarPago(p.id)}
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors"
                      >
                        <ArrowCounterClockwise weight="light" className="w-3.5 h-3.5" />
                        Desfazer
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        type="date"
                        value={payDates[p.id] ?? todayIso()}
                        onChange={(e) =>
                          setPayDates((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        className="!py-1.5 !w-[140px] !text-[12.5px]"
                        aria-label={`Data de pagamento da parcela ${p.numero}`}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<CheckCircle weight="light" />}
                        onClick={() => onMarcarPago(p.id, payDates[p.id] ?? todayIso())}
                      >
                        Pagar
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
