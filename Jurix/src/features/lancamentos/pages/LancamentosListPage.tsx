import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MagnifyingGlass, Plus, CurrencyCircleDollar, ArrowUpRight, Receipt,
} from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Input } from "../../../components/ui/Input";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { formatBRL } from "../../../lib/format/currency";
import { formatDateBR } from "../../../lib/format/dates";
import { cn } from "../../../lib/cn";
import { lancamentosList } from "../api";
import type { LancamentoListRow, Natureza, StatusPagamento } from "../types";
import { StatusPagamentoBadge } from "../components/StatusPagamentoBadge";
import { TIPO_LABELS } from "../components/labels";

type NaturezaFilter = Natureza | "all";
type StatusFilter = StatusPagamento | "all";

export function LancamentosListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [natureza, setNatureza] = useState<NaturezaFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<LancamentoListRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setRows(await lancamentosList({ search, natureza, status_pagamento: status }));
    } catch (e) {
      toast.error("Falha ao carregar lançamentos", String((e as Error).message ?? e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natureza, status]);

  useEffect(() => {
    const t = setTimeout(refresh, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totals = useMemo(() => {
    if (!rows) return { entradas: 0, saidas: 0, recebido: 0 };
    let entradas = 0;
    let saidas = 0;
    let recebido = 0;
    for (const r of rows) {
      if (r.status_efetivo === "cancelado") continue;
      if (r.natureza === "entrada") {
        entradas += r.valor_total;
        // Parcelados parcialmente pagos também contam: soma só o que já entrou.
        recebido += r.valor_recebido;
      } else {
        saidas += r.valor_total;
      }
    }
    return { entradas, saidas, recebido };
  }, [rows]);

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Lançamentos"
        description="Entradas e saídas do escritório. Lançamentos parcelados geram parcelas automaticamente."
        actions={
          <Button
            variant="primary"
            size="md"
            trailingIcon={<Plus weight="bold" />}
            onClick={() => navigate("/lancamentos/novo")}
          >
            Novo lançamento
          </Button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        <KpiCard label="Entradas (lista)" value={totals.entradas} tone="positive" />
        <KpiCard label="Saídas (lista)" value={totals.saidas} tone="critical" />
        <KpiCard label="Recebido (lista)" value={totals.recebido} tone="neutral" />
      </div>

      <div className="bezel-shell mb-7">
        <div className="bezel-inner !p-0">
          <div className="flex items-center gap-4 p-4 border-b border-[var(--color-hairline)] flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <MagnifyingGlass
                weight="light"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--color-ink-muted)] pointer-events-none"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por descrição ou número do documento"
                className="!pl-10 !bg-transparent !ring-0 !rounded-md !py-2 focus:!ring-0"
                aria-label="Buscar lançamentos"
              />
            </div>
            <FilterChips
              label="Natureza"
              value={natureza}
              onChange={setNatureza}
              options={[
                { value: "all", label: "Todas" },
                { value: "entrada", label: "Entradas" },
                { value: "saida", label: "Saídas" },
              ]}
            />
            <FilterChips
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: "Todos" },
                { value: "pendente", label: "Pendentes" },
                { value: "pago", label: "Pagos" },
                { value: "parcialmente_pago", label: "Parciais" },
                { value: "inadimplente", label: "Inadimplentes" },
                { value: "cancelado", label: "Cancelados" },
              ]}
            />
          </div>

          {loading && rows === null ? (
            <div className="py-20 text-center text-[var(--color-ink-muted)] text-sm">Carregando…</div>
          ) : rows && rows.length === 0 ? (
            <EmptyState
              icon={<CurrencyCircleDollar weight="light" />}
              title={search ? "Nenhum lançamento encontrado" : "Sem lançamentos cadastrados"}
              description={
                search
                  ? "Tente outro termo ou ajuste os filtros."
                  : "Registre a primeira entrada ou saída para acompanhar o financeiro."
              }
              action={
                !search && (
                  <Button
                    variant="primary"
                    size="sm"
                    trailingIcon="auto"
                    onClick={() => navigate("/lancamentos/novo")}
                  >
                    Novo lançamento
                  </Button>
                )
              }
            />
          ) : (
            <ul>
              {rows!.map((row) => (
                <LancamentoRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "critical" | "neutral";
}) {
  const color =
    tone === "positive"
      ? "var(--color-positive)"
      : tone === "critical"
        ? "var(--color-critical)"
        : "var(--color-ink)";
  return (
    <div className="rounded-[1.25rem] bg-[var(--color-surface)] ring-1 ring-[var(--color-hairline)] px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        {label}
      </div>
      <div
        className="text-[22px] font-display font-medium tabular-nums tracking-tight mt-1"
        style={{ color }}
      >
        {formatBRL(value)}
      </div>
    </div>
  );
}

function LancamentoRow({ row }: { row: LancamentoListRow }) {
  const isEntrada = row.natureza === "entrada";
  return (
    <li className="border-b border-[var(--color-hairline)] last:border-b-0">
      <Link
        to={`/lancamentos/${row.id}`}
        className="flex items-center gap-5 px-5 py-4 transition-colors duration-200 hover:bg-[var(--color-surface-muted)] group"
      >
        <div
          className={cn(
            "w-9 h-9 shrink-0 rounded-full ring-1 flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]",
            isEntrada
              ? "bg-[var(--color-positive-soft)] ring-[#cdddd0] text-[var(--color-positive)]"
              : "bg-[var(--color-critical-soft)] ring-[#e7cbc8] text-[var(--color-critical)]",
          )}
        >
          {isEntrada ? <CurrencyCircleDollar weight="light" /> : <Receipt weight="light" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-0.5">
            <span className="text-[14px] font-medium text-[var(--color-ink)] truncate">
              {row.descricao || TIPO_LABELS[row.tipo]}
            </span>
            {row.forma_pagamento === "parcelado" && (
              <span className="text-[11px] text-[var(--color-ink-muted)] shrink-0">
                {row.num_parcelas}x
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-[var(--color-ink-muted)] flex items-center gap-3 flex-wrap">
            <span>{TIPO_LABELS[row.tipo]}</span>
            <span className="text-[var(--color-ink-subtle)]">·</span>
            <span className="truncate">{row.cliente_nome}</span>
            {row.contrato_codigo && (
              <>
                <span className="text-[var(--color-ink-subtle)]">·</span>
                <span className="font-mono text-[11.5px]">{row.contrato_codigo}</span>
              </>
            )}
            {row.data_prevista && (
              <>
                <span className="text-[var(--color-ink-subtle)]">·</span>
                <span>vence {formatDateBR(row.data_prevista)}</span>
              </>
            )}
          </div>
        </div>

        <span
          className={cn(
            "text-[14px] font-medium tabular-nums shrink-0",
            isEntrada ? "text-[var(--color-positive)]" : "text-[var(--color-critical)]",
          )}
        >
          {isEntrada ? "+" : "−"}
          {formatBRL(row.valor_total)}
        </span>

        <StatusPagamentoBadge status={row.status_efetivo} />

        <ArrowUpRight
          weight="light"
          className="w-4 h-4 text-[var(--color-ink-subtle)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:text-[var(--color-ink-soft)]"
        />
      </Link>
    </li>
  );
}

interface FilterChipsProps<T extends string> {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

function FilterChips<T extends string>({ label, value, onChange, options }: FilterChipsProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">{label}</span>
      <div className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-muted)] p-0.5 ring-1 ring-inset ring-[var(--color-hairline)]">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
              value === opt.value
                ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_0_var(--color-hairline)] ring-1 ring-[var(--color-hairline)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
