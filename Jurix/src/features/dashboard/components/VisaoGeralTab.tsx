import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CaretDown, Warning, TrendUp, TrendDown } from "@phosphor-icons/react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/Input";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { cn } from "../../../lib/cn";
import { formatBRL } from "../../../lib/format/currency";
import { formatDateBR } from "../../../lib/format/dates";
import { TIPO_LABELS } from "../../lancamentos/components/labels";
import type { TipoLancamento } from "../../lancamentos/types";
import {
  dashboardConcentracao,
  dashboardFluxoMensal,
  dashboardInadimplenciaDetalhada,
  dashboardKpis,
  dashboardRecebiveisProximos,
  dashboardReceitaPorArea,
  dashboardReceitaPorTipoContrato,
} from "../api";
import { PERIOD_LABELS, resolvePeriod, type Period, type PeriodKind } from "../period";
import type {
  ChartScenario,
  ConcentracaoResult,
  DashboardKpis,
  GrupoReceita,
  InadimplenciaItem,
  MesFluxo,
  RecebiveisProximos,
} from "../types";
import { DonutChart, EntradasSaidasChart } from "./DashboardCharts";

const tipoLabel = (t: string): string => TIPO_LABELS[t as TipoLancamento] ?? t;

const SCENARIO_LABEL: Record<ChartScenario, string> = {
  garantido: "Lucro garantido",
  pior: "Pior cenário",
  melhor: "Melhor cenário",
};

interface Data {
  kpis: DashboardKpis;
  mensais: MesFluxo[];
  area: GrupoReceita[];
  tipoContrato: GrupoReceita[];
  concentracao: ConcentracaoResult;
  receb7: RecebiveisProximos;
  receb30: RecebiveisProximos;
  inadimplencia: InadimplenciaItem[];
}

export function VisaoGeralTab() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>(() => resolvePeriod("mes_atual"));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartScenario, setChartScenario] = useState<ChartScenario>("garantido");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [kpis, mensais, area, tipoContrato, concentracao, receb7, receb30, inadimplencia] =
          await Promise.all([
            dashboardKpis(period.from, period.to),
            dashboardFluxoMensal(period.from, period.to),
            dashboardReceitaPorArea(period.from, period.to),
            dashboardReceitaPorTipoContrato(period.from, period.to),
            dashboardConcentracao(period.from, period.to),
            dashboardRecebiveisProximos(7),
            dashboardRecebiveisProximos(30),
            dashboardInadimplenciaDetalhada(),
          ]);
        if (!cancelled) {
          setData({ kpis, mensais, area, tipoContrato, concentracao, receb7, receb30, inadimplencia });
        }
      } catch (e) {
        if (!cancelled) toast.error("Falha ao carregar o dashboard", String((e as Error).message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, toast]);

  return (
    <div>
      <PeriodSelector period={period} onChange={setPeriod} />

      {loading || !data ? (
        <div className="py-24 text-center text-sm text-[var(--color-ink-muted)]">
          Carregando indicadores…
        </div>
      ) : (
        <>
          {data.concentracao.alert_eligible && data.concentracao.top && (
            <div className="mb-6 flex items-start gap-3 rounded-[1rem] bg-[var(--color-warning-soft)] ring-1 ring-[#e7d8b3] px-4 py-3">
              <Warning weight="light" className="w-5 h-5 text-[var(--color-warning)] shrink-0 mt-0.5" />
              <p className="text-[13px] text-[var(--color-warning)] leading-relaxed">
                <strong>{data.concentracao.top.cliente_nome}</strong> concentra{" "}
                <strong>{Math.round(data.concentracao.top.pct * 100)}%</strong> do faturamento do
                período. Considere diversificar a carteira de clientes.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <KpiCard label="Entradas recebidas" cents={data.kpis.total_recebido_cents} tone="positive" />
            <KpiCard label="Saídas pagas" cents={data.kpis.total_pago_saidas_cents} tone="critical" />
            <KpiCard
              label="Ticket médio / cliente"
              cents={data.kpis.ticket_medio_cents}
              hint={`${data.kpis.num_clientes_pagantes} cliente(s) pagante(s)`}
            />
            <KpiCard label="Inadimplência" cents={data.kpis.inadimplencia_total_cents} tone="warning" />
          </div>

          <div className="mb-7">
            <div className="eyebrow mb-2">
              Cenários do período · clique para projetar no gráfico
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <KpiCard
                label="Pior cenário"
                cents={data.kpis.pior_cenario_cents}
                tone={data.kpis.pior_cenario_cents >= 0 ? "positive" : "critical"}
                hint="entradas gar. − todas as saídas"
                onClick={() => setChartScenario("pior")}
                selected={chartScenario === "pior"}
              />
              <KpiCard
                label="Lucro garantido"
                cents={data.kpis.resultado_liquido_cents}
                tone={data.kpis.resultado_liquido_cents >= 0 ? "positive" : "critical"}
                hint="entradas gar. − saídas gar."
                emphasize
                onClick={() => setChartScenario("garantido")}
                selected={chartScenario === "garantido"}
              />
              <KpiCard
                label="Melhor cenário"
                cents={data.kpis.melhor_cenario_cents}
                tone={data.kpis.melhor_cenario_cents >= 0 ? "positive" : "critical"}
                hint="+ entradas incertas, − saídas gar."
                onClick={() => setChartScenario("melhor")}
                selected={chartScenario === "melhor"}
              />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-7">
            <Card className="col-span-12">
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <div className="eyebrow mb-1">Fluxo mensal</div>
                  <h2 className="text-xl font-medium tracking-tight font-display">
                    Entradas × Saídas no período
                  </h2>
                </div>
                <span className="text-[12px] text-[var(--color-ink-muted)] text-right">
                  Realizado até hoje · daqui em diante:{" "}
                  <strong className="text-[var(--color-ink-soft)]">
                    {SCENARIO_LABEL[chartScenario]}
                  </strong>
                </span>
              </div>
              <EntradasSaidasChart data={data.mensais} scenario={chartScenario} />
            </Card>

            <Card className="col-span-12 lg:col-span-6">
              <div className="eyebrow mb-4">Receita por área do direito</div>
              <DonutChart data={data.area} />
            </Card>
            <Card className="col-span-12 lg:col-span-6">
              <div className="eyebrow mb-4">Receita por tipo de contrato</div>
              <DonutChart data={data.tipoContrato} />
            </Card>

            <RecebiveisWidget className="col-span-12 lg:col-span-6" receb={data.receb7} />
            <RecebiveisWidget className="col-span-12 lg:col-span-6" receb={data.receb30} />

            <Card className="col-span-12">
              <div className="eyebrow mb-1">Inadimplência</div>
              <h2 className="text-xl font-medium tracking-tight font-display mb-4">
                Recebíveis em atraso
              </h2>
              <InadimplenciaTable itens={data.inadimplencia} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ── Period selector ────────────────────────────────────────────────────

function PeriodSelector({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);

  function pick(kind: PeriodKind) {
    if (kind === "personalizado") {
      setCustomOpen(true);
      return;
    }
    onChange(resolvePeriod(kind));
  }

  return (
    <div className="flex items-center gap-3 mb-7 flex-wrap">
      <div className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-muted)] p-0.5 ring-1 ring-inset ring-[var(--color-hairline)]">
        {(Object.keys(PERIOD_LABELS) as PeriodKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => pick(kind)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all duration-200",
              period.kind === kind
                ? "bg-[var(--color-surface)] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {PERIOD_LABELS[kind]}
          </button>
        ))}
      </div>
      <span className="text-[12.5px] text-[var(--color-ink-muted)]">
        {formatDateBR(period.from)} – {formatDateBR(period.to)}
      </span>

      {customOpen && (
        <CustomRangeModal
          initial={period}
          onClose={() => setCustomOpen(false)}
          onApply={(from, to) => {
            onChange({ kind: "personalizado", from, to });
            setCustomOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CustomRangeModal({
  initial,
  onClose,
  onApply,
}: {
  initial: Period;
  onClose: () => void;
  onApply: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [error, setError] = useState<string | null>(null);

  function apply() {
    if (!from || !to) {
      setError("Informe as duas datas.");
      return;
    }
    if (from > to) {
      setError("A data inicial não pode ser posterior à final.");
      return;
    }
    onApply(from, to);
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[1.5rem] bg-[var(--color-surface-muted)] p-1.5 ring-1 ring-[var(--color-hairline)] shadow-ambient"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-[var(--color-surface)] p-7">
          <h3 className="text-[18px] font-medium tracking-tight font-sans mb-4">Período personalizado</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="De" required>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setError(null);
                }}
              />
            </Field>
            <Field label="Até" required>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setError(null);
                }}
              />
            </Field>
          </div>
          {error && <p className="text-[12px] text-[var(--color-critical)] mt-2">{error}</p>}
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={apply}>
              Aplicar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  cents,
  tone = "neutral",
  hint,
  emphasize,
  onClick,
  selected,
}: {
  label: string;
  cents: number | null;
  tone?: "neutral" | "positive" | "critical" | "warning";
  hint?: string;
  emphasize?: boolean;
  onClick?: () => void;
  selected?: boolean;
}) {
  const color =
    tone === "positive"
      ? "var(--color-positive)"
      : tone === "critical"
        ? "var(--color-critical)"
        : tone === "warning"
          ? "var(--color-warning)"
          : "var(--color-ink)";

  const className = cn(
    "block w-full text-left rounded-[1.25rem] bg-[var(--color-surface)] px-5 py-4 ring-1 ring-inset",
    "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
    selected
      ? "ring-[1.5px] ring-[var(--color-accent)]"
      : "ring-[var(--color-hairline)]",
    emphasize && "shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
    onClick && "cursor-pointer hover:ring-[var(--color-hairline-strong)]",
  );

  const body = (
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
          {label}
        </span>
        {selected && (
          <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-accent)]">
            no gráfico
          </span>
        )}
      </div>
      <div
        className="text-[21px] font-display font-medium tabular-nums tracking-tight mt-1"
        style={{ color }}
      >
        {cents == null ? "—" : formatBRL(cents)}
      </div>
      {hint && <div className="text-[11.5px] text-[var(--color-ink-subtle)] mt-0.5">{hint}</div>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={selected} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

// ── Recebíveis widget ────────────────────────────────────────────────────

function RecebiveisWidget({
  receb,
  className,
}: {
  receb: RecebiveisProximos;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={className}>
      <div className="eyebrow mb-1">Recebíveis previstos</div>
      <h3 className="text-[16px] font-medium font-sans tracking-tight mb-3">
        Próximos {receb.dias} dias
      </h3>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-[24px] font-display font-medium tabular-nums tracking-tight text-[var(--color-ink)]">
          {formatBRL(receb.total_cents)}
        </span>
        <span className="text-[12.5px] text-[var(--color-ink-muted)]">
          {receb.itens.length} lançamento(s)
        </span>
      </div>
      {receb.itens.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
          >
            <CaretDown
              weight="bold"
              className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
            />
            {open ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
          {open && (
            <ul className="mt-3 rounded-[0.875rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
              {receb.itens.map((it, idx) => (
                <li
                  key={`${it.lancamento_id}-${it.parcela_numero ?? "a"}-${idx}`}
                  className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[var(--color-hairline)] last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/lancamentos/${it.lancamento_id}`}
                      className="text-[13px] font-medium text-[var(--color-ink)] truncate hover:text-[var(--color-accent)] block"
                    >
                      {it.descricao || tipoLabel(it.tipo)}
                      {it.parcela_numero != null && (
                        <span className="text-[var(--color-ink-muted)] font-normal">
                          {" "}
                          · parcela {it.parcela_numero}
                        </span>
                      )}
                    </Link>
                    <div className="text-[11.5px] text-[var(--color-ink-muted)] truncate">
                      {it.cliente_nome} · vence {formatDateBR(it.data_prevista)}
                    </div>
                  </div>
                  <span className="text-[13px] font-medium tabular-nums shrink-0">
                    {formatBRL(it.valor_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

// ── Inadimplência table ──────────────────────────────────────────────────

function InadimplenciaTable({ itens }: { itens: InadimplenciaItem[] }) {
  const [limit, setLimit] = useState(50);

  if (itens.length === 0) {
    return (
      <EmptyState
        icon={<TrendUp weight="light" />}
        title="Nenhuma inadimplência"
        description="Todos os recebíveis com vencimento passado estão quitados."
      />
    );
  }

  const visible = itens.slice(0, limit);
  const totalAtraso = itens.reduce((acc, i) => acc + i.valor_cents, 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-[13px] text-[var(--color-ink-muted)]">
        <TrendDown weight="light" className="w-4 h-4 text-[var(--color-critical)]" />
        {itens.length} recebível(is) em atraso, somando{" "}
        <strong className="text-[var(--color-critical)]">{formatBRL(totalAtraso)}</strong>.
      </div>
      <ul className="rounded-[0.875rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
        {visible.map((it, idx) => (
          <li
            key={`${it.lancamento_id}-${it.parcela_numero ?? "a"}-${idx}`}
            className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-hairline)] last:border-b-0"
          >
            <div className="flex-1 min-w-0">
              <Link
                to={`/lancamentos/${it.lancamento_id}`}
                className="text-[13.5px] font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
              >
                {it.cliente_nome}
              </Link>
              <div className="text-[11.5px] text-[var(--color-ink-muted)] truncate">
                {it.contrato_codigo && `${it.contrato_codigo} · `}
                {it.processo_numero && `proc. ${it.processo_numero} · `}
                vencido em {formatDateBR(it.data_prevista)}
                {it.parcela_numero != null && ` · parcela ${it.parcela_numero}`}
              </div>
            </div>
            <span className="text-[11.5px] font-medium text-[var(--color-critical)] tabular-nums shrink-0">
              {it.dias_atrasado} dia(s)
            </span>
            <span className="text-[13.5px] font-medium tabular-nums shrink-0 w-[110px] text-right">
              {formatBRL(it.valor_cents)}
            </span>
          </li>
        ))}
      </ul>
      {itens.length > limit && (
        <div className="mt-3 text-center">
          <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + 50)}>
            Ver mais ({itens.length - limit} restante(s))
          </Button>
        </div>
      )}
    </div>
  );
}
