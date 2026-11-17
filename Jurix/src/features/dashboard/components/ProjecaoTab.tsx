import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flask, Warning } from "@phosphor-icons/react";
import { Card } from "../../../components/ui/Card";
import { Field } from "../../../components/ui/Input";
import { Combobox, type ComboboxOption } from "../../../components/ui/Combobox";
import { CurrencyInput } from "../../../components/ui/CurrencyInput";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { cn } from "../../../lib/cn";
import { formatBRL } from "../../../lib/format/currency";
import { TIPO_LABELS } from "../../lancamentos/components/labels";
import type { TipoLancamento } from "../../lancamentos/types";
import { dashboardProjecao, simular } from "../api";
import type {
  HorizonteProjecao,
  IndicadorProjecao,
  ProjecaoResult,
  SimuladorModo,
} from "../types";

const tipoLabel = (t: string): string => TIPO_LABELS[t as TipoLancamento] ?? t;

const MODOS: { value: SimuladorModo; label: string }[] = [
  { value: "novo_contrato", label: "Novo contrato mensalista" },
  { value: "despesa_fixa", label: "Aumento de despesa fixa" },
  { value: "perda_cliente", label: "Perda de cliente" },
];

const INDICADOR: Record<IndicadorProjecao, { label: string; tone: string; bg: string }> = {
  saudavel: { label: "Saudável", tone: "var(--color-positive)", bg: "var(--color-positive-soft)" },
  atencao: { label: "Atenção", tone: "var(--color-warning)", bg: "var(--color-warning-soft)" },
  critico: { label: "Crítico", tone: "var(--color-critical)", bg: "var(--color-critical-soft)" },
};

export function ProjecaoTab() {
  const toast = useToast();
  const [projecao, setProjecao] = useState<ProjecaoResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await dashboardProjecao();
        if (!cancelled) setProjecao(result);
      } catch (e) {
        if (!cancelled) toast.error("Falha ao carregar a projeção", String((e as Error).message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (loading || !projecao) {
    return (
      <div className="py-24 text-center text-sm text-[var(--color-ink-muted)]">
        Calculando projeção…
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-7">
      <div className="col-span-12">
        <div className="eyebrow mb-1">Projeção</div>
        <p className="text-[13.5px] text-[var(--color-ink-muted)] leading-relaxed max-w-2xl">
          Soma determinística dos lançamentos futuros pendentes. Entradas não garantidas são
          ponderadas pela chance de êxito do processo vinculado.
        </p>
      </div>

      {projecao.horizontes.map((h) => (
        <HorizonteCard key={h.meses} h={h} />
      ))}

      {projecao.sem_chance.length > 0 && (
        <Card className="col-span-12">
          <div className="flex items-start gap-3 mb-4">
            <Warning weight="light" className="w-5 h-5 text-[var(--color-warning)] shrink-0 mt-0.5" />
            <div>
              <div className="eyebrow mb-1">Sem chance de êxito atribuída</div>
              <p className="text-[13px] text-[var(--color-ink-muted)] leading-relaxed">
                Estes lançamentos não garantidos foram <strong>excluídos</strong> da projeção
                ponderada por não terem um processo com chance de êxito. Atribua a chance no
                processo para incluí-los.
              </p>
            </div>
          </div>
          <ul className="rounded-[0.875rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
            {projecao.sem_chance.map((item) => (
              <li
                key={item.lancamento_id}
                className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-hairline)] last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-[var(--color-ink)] truncate">
                    {item.descricao || tipoLabel(item.tipo)}
                  </div>
                  <div className="text-[11.5px] text-[var(--color-ink-muted)] truncate">
                    {item.cliente_nome}
                  </div>
                </div>
                <span className="text-[13px] font-medium tabular-nums shrink-0">
                  {formatBRL(item.valor_cents)}
                </span>
                {item.processo_id ? (
                  <Link
                    to={`/processos/${item.processo_id}/editar`}
                    className="text-[12.5px] font-medium text-[var(--color-accent)] hover:underline underline-offset-4 shrink-0"
                  >
                    Atribuir chance
                  </Link>
                ) : (
                  <span className="text-[11.5px] text-[var(--color-ink-subtle)] shrink-0">
                    sem processo
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="col-span-12">
        <Simulador projecao={projecao} />
      </Card>
    </div>
  );
}

function HorizonteCard({ h }: { h: HorizonteProjecao }) {
  const positivo = h.resultado_cents >= 0;
  return (
    <Card className="col-span-12 lg:col-span-4">
      <div className="eyebrow mb-3">{h.meses} meses</div>
      <Row label="Entradas garantidas" cents={h.garantidas_cents} color="var(--color-positive)" />
      <Row
        label="Não garantidas (ponderadas)"
        cents={h.nao_garantidas_ponderadas_cents}
        color="var(--color-ink-soft)"
      />
      <Row label="Saídas previstas" cents={-h.saidas_cents} color="var(--color-critical)" />
      <div className="border-t border-[var(--color-hairline)] mt-2 pt-3 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
          Resultado projetado
        </span>
        <span
          className="text-[20px] font-display font-medium tabular-nums tracking-tight"
          style={{ color: positivo ? "var(--color-positive)" : "var(--color-critical)" }}
        >
          {formatBRL(h.resultado_cents)}
        </span>
      </div>
    </Card>
  );
}

function Row({ label, cents, color }: { label: string; cents: number; color: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-[12.5px] text-[var(--color-ink-muted)]">{label}</span>
      <span className="text-[13.5px] font-medium tabular-nums" style={{ color }}>
        {formatBRL(cents)}
      </span>
    </div>
  );
}

// ── Simulador ────────────────────────────────────────────────────────────

function Simulador({ projecao }: { projecao: ProjecaoResult }) {
  const [modo, setModo] = useState<SimuladorModo>("novo_contrato");
  const [valorCents, setValorCents] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState("");

  function switchModo(next: SimuladorModo) {
    setModo(next);
    setValorCents(null);
    setClienteId("");
  }

  const clienteOptions = useMemo<ComboboxOption[]>(
    () =>
      projecao.por_cliente.map((c) => ({
        value: c.cliente_id,
        label: c.cliente_nome,
        meta: formatBRL(c.contrib[12]),
      })),
    [projecao.por_cliente],
  );

  const hasParam =
    modo === "perda_cliente" ? Boolean(clienteId) : (valorCents ?? 0) > 0;

  const result = useMemo(() => {
    if (!hasParam) return null;
    return simular(projecao, modo, {
      valorMensalCents: valorCents ?? 0,
      clienteId,
    });
  }, [projecao, modo, valorCents, clienteId, hasParam]);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <Flask weight="light" className="w-5 h-5 text-[var(--color-accent)]" />
        <h2 className="text-xl font-medium tracking-tight font-display">Simulador</h2>
      </div>
      <p className="text-[13px] text-[var(--color-ink-muted)] mb-5">
        Compare um cenário hipotético com a projeção atual. Uma simulação ativa por vez.
      </p>

      <div className="grid grid-cols-12 gap-7">
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            {MODOS.map((m) => (
              <label
                key={m.value}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[0.875rem] cursor-pointer ring-1 ring-inset transition-colors",
                  modo === m.value
                    ? "bg-[var(--color-accent-soft)] ring-[#cbd5e0]"
                    : "bg-[var(--color-surface)] ring-[var(--color-hairline-strong)] hover:bg-[var(--color-surface-muted)]",
                )}
              >
                <input
                  type="radio"
                  name="simulador-modo"
                  checked={modo === m.value}
                  onChange={() => switchModo(m.value)}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-[13.5px] font-medium text-[var(--color-ink)]">{m.label}</span>
              </label>
            ))}
          </div>

          {modo === "perda_cliente" ? (
            <Field label="Cliente a remover" required>
              <Combobox
                value={clienteId}
                onChange={setClienteId}
                options={clienteOptions}
                placeholder="Selecione o cliente"
                emptyMessage="Nenhum cliente com receita projetada"
              />
            </Field>
          ) : (
            <Field
              label={modo === "novo_contrato" ? "Valor mensal do contrato" : "Aumento mensal da despesa"}
              required
            >
              <CurrencyInput valueCents={valorCents} onValueChange={setValorCents} />
            </Field>
          )}
        </div>

        <div className="col-span-12 lg:col-span-7">
          {!result ? (
            <EmptyState
              icon={<Flask weight="light" />}
              title="Defina os parâmetros"
              description="Informe o valor ou o cliente para ver o impacto na projeção."
            />
          ) : (
            <div>
              <div className="rounded-[1rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
                <div className="grid grid-cols-4 bg-[var(--color-surface-muted)] text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
                  <div className="px-3 py-2">Horizonte</div>
                  <div className="px-3 py-2 text-right">Baseline</div>
                  <div className="px-3 py-2 text-right">Delta</div>
                  <div className="px-3 py-2 text-right">Novo resultado</div>
                </div>
                {[3, 6, 12].map((m) => (
                  <div
                    key={m}
                    className="grid grid-cols-4 border-t border-[var(--color-hairline)] text-[13px] tabular-nums"
                  >
                    <div className="px-3 py-2.5 font-medium">{m} meses</div>
                    <div className="px-3 py-2.5 text-right text-[var(--color-ink-muted)]">
                      {formatBRL(result.baseline[m])}
                    </div>
                    <div
                      className="px-3 py-2.5 text-right font-medium"
                      style={{
                        color:
                          result.delta[m] >= 0
                            ? "var(--color-positive)"
                            : "var(--color-critical)",
                      }}
                    >
                      {result.delta[m] >= 0 ? "+" : ""}
                      {formatBRL(result.delta[m])}
                    </div>
                    <div
                      className="px-3 py-2.5 text-right font-medium"
                      style={{
                        color:
                          result.novo[m] >= 0
                            ? "var(--color-ink)"
                            : "var(--color-critical)",
                      }}
                    >
                      {formatBRL(result.novo[m])}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-4 flex items-center gap-3 rounded-[1rem] px-4 py-3"
                style={{ background: INDICADOR[result.indicador].bg }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: INDICADOR[result.indicador].tone }}
                />
                <span
                  className="text-[13.5px] font-medium"
                  style={{ color: INDICADOR[result.indicador].tone }}
                >
                  Cenário {INDICADOR[result.indicador].label.toLowerCase()}
                </span>
                <span className="text-[12.5px] text-[var(--color-ink-muted)]">
                  — avaliado pelo resultado projetado de 12 meses.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
