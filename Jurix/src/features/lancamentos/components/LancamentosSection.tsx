import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Plus, CurrencyCircleDollar } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { formatBRL } from "../../../lib/format/currency";
import { cn } from "../../../lib/cn";
import { lancamentosList } from "../api";
import type { LancamentoListRow } from "../types";
import { StatusPagamentoBadge } from "./StatusPagamentoBadge";
import { TIPO_LABELS } from "./labels";

export type LancamentosContext =
  | { kind: "cliente"; clienteId: string }
  | { kind: "contrato"; contratoId: string; clienteId: string }
  | { kind: "processo"; processoId: string; clienteId: string };

export function LancamentosSection({ context }: { context: LancamentosContext }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<LancamentoListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const filters =
          context.kind === "cliente"
            ? { cliente_id: context.clienteId }
            : context.kind === "contrato"
              ? { contrato_id: context.contratoId }
              : { processo_id: context.processoId };
        setRows(await lancamentosList(filters));
      } catch (e) {
        toast.error("Falha ao carregar lançamentos", String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [context, toast]);

  function novoLancamentoHref(): string {
    const p = new URLSearchParams();
    p.set("cliente_id", context.clienteId);
    if (context.kind === "contrato") p.set("contrato_id", context.contratoId);
    if (context.kind === "processo") p.set("processo_id", context.processoId);
    return `/lancamentos/novo?${p.toString()}`;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1.5">Lançamentos</div>
          <h3 className="text-[16px] font-medium font-sans tracking-tight">
            Entradas e saídas vinculadas
          </h3>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus weight="bold" />}
          onClick={() => navigate(novoLancamentoHref())}
        >
          Novo lançamento
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CurrencyCircleDollar weight="light" />}
          title="Sem lançamentos vinculados"
          description="Registre entradas e saídas — cliente e contrato já vêm preenchidos a partir deste contexto."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-hairline)] -mx-1">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to={`/lancamentos/${row.id}`}
                className="group flex items-center gap-5 px-1 py-3.5 transition-colors hover:bg-[var(--color-surface-muted)] rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-[var(--color-ink)] truncate">
                    {row.descricao || TIPO_LABELS[row.tipo]}
                  </div>
                  <div className="text-[12px] text-[var(--color-ink-muted)]">
                    {TIPO_LABELS[row.tipo]}
                    {row.forma_pagamento === "parcelado" ? ` · ${row.num_parcelas}x` : ""}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[13px] font-medium tabular-nums",
                    row.natureza === "entrada"
                      ? "text-[var(--color-positive)]"
                      : "text-[var(--color-critical)]",
                  )}
                >
                  {row.natureza === "entrada" ? "+" : "−"}
                  {formatBRL(row.valor_total)}
                </span>
                <StatusPagamentoBadge status={row.status_efetivo} />
                <ArrowUpRight
                  weight="light"
                  className="w-4 h-4 text-[var(--color-ink-subtle)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:text-[var(--color-ink-soft)]"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
