import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CaretRight, FloppyDisk } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Field, Input, Textarea } from "../../../components/ui/Input";
import { Combobox, type ComboboxOption } from "../../../components/ui/Combobox";
import { CurrencyInput } from "../../../components/ui/CurrencyInput";
import { useToast } from "../../../components/ui/Toast";
import { cn } from "../../../lib/cn";
import { ValidationError } from "../../../lib/errors";
import { todayIso } from "../../../lib/format/dates";
import { clientesList } from "../../clientes/api";
import { contratosListByCliente } from "../../contratos/api";
import { processosListByCliente } from "../../processos/api";
import { displayNumeroProcesso } from "../../processos/components/numero";
import { lookupList, type LookupRow } from "../../cadastros/api";
import type { Cliente } from "../../clientes/types";
import type { Contrato } from "../../contratos/types";
import type { Processo } from "../../processos/types";
import { lancamentosCreate, lancamentosGet, lancamentosUpdate } from "../api";
import type {
  FormaPagamento,
  LancamentoInput,
  Natureza,
  StatusPagamento,
  TipoLancamento,
} from "../types";
import { TIPO_OPTIONS_ENTRADA, TIPO_OPTIONS_SAIDA } from "../components/labels";
import { ParcelasPreview } from "../components/ParcelasPreview";

interface FormState {
  natureza: Natureza;
  tipo: TipoLancamento;
  descricao: string;
  cliente_id: string;
  contrato_id: string;
  processo_id: string;
  centro_custo_id: string;
  garantido: boolean;
  forma_pagamento: FormaPagamento;
  valor_cents: number | null;
  num_parcelas: string;
  data_primeira_parcela: string;
  data_prevista: string;
  data_pagamento: string;
  status_pagamento: StatusPagamento;
  numero_documento: string;
  observacoes: string;
}

const emptyState: FormState = {
  natureza: "entrada",
  tipo: "mensalidade",
  descricao: "",
  cliente_id: "",
  contrato_id: "",
  processo_id: "",
  centro_custo_id: "",
  garantido: false,
  forma_pagamento: "avista",
  valor_cents: null,
  num_parcelas: "2",
  data_primeira_parcela: "",
  data_prevista: "",
  data_pagamento: "",
  status_pagamento: "pendente",
  numero_documento: "",
  observacoes: "",
};

const STATUS_AVISTA_OPTIONS: ComboboxOption[] = [
  { value: "pendente", label: "Pendente", dotColor: "var(--color-ink-subtle)" },
  { value: "pago", label: "Pago", dotColor: "var(--color-positive)" },
  { value: "inadimplente", label: "Inadimplente", dotColor: "var(--color-critical)" },
  { value: "cancelado", label: "Cancelado", dotColor: "var(--color-ink-subtle)" },
];

function isGarantidoLocked(tipo: TipoLancamento): boolean {
  return tipo === "sucumbencia" || tipo === "acordo";
}

function toInput(state: FormState): LancamentoInput {
  const isParcelado = state.forma_pagamento === "parcelado";
  return {
    descricao: state.descricao.trim() || null,
    natureza: state.natureza,
    cliente_id: state.cliente_id,
    contrato_id: state.contrato_id || null,
    processo_id: state.processo_id || null,
    tipo: state.tipo,
    centro_custo_id: state.natureza === "saida" ? (state.centro_custo_id || null) : null,
    garantido: !isGarantidoLocked(state.tipo) && state.garantido,
    forma_pagamento: state.forma_pagamento,
    num_parcelas: isParcelado ? Number(state.num_parcelas) : null,
    valor: state.valor_cents ?? 0,
    data_prevista: isParcelado ? null : (state.data_prevista || null),
    data_primeira_parcela: isParcelado ? (state.data_primeira_parcela || null) : null,
    data_pagamento: isParcelado ? null : (state.data_pagamento || null),
    status_pagamento: state.status_pagamento,
    numero_documento: state.numero_documento.trim() || null,
    observacoes: state.observacoes.trim() || null,
  };
}

export function LancamentoFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryCliente = query.get("cliente_id") ?? "";
  const queryContrato = query.get("contrato_id") ?? "";
  const queryProcesso = query.get("processo_id") ?? "";

  const [state, setState] = useState<FormState>({
    ...emptyState,
    cliente_id: queryCliente,
    contrato_id: queryContrato,
    processo_id: queryProcesso,
  });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<LookupRow[]>([]);
  const [structureLocked, setStructureLocked] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    (async () => {
      try {
        const [cs, cc] = await Promise.all([
          clientesList({ status_relacionamento: "all" }),
          lookupList("centros_custo"),
        ]);
        setClientes(cs);
        setCentrosCusto(cc);

        if (isEditing && id) {
          const l = await lancamentosGet(id);
          if (!l) {
            toast.error("Lançamento não encontrado");
            navigate("/lancamentos");
            return;
          }
          const primeira = l.parcelas.find((p) => p.numero === 1)?.data_prevista ?? "";
          setStructureLocked(l.parcelas.some((p) => p.status === "pago"));
          setState({
            natureza: l.natureza,
            tipo: l.tipo,
            descricao: l.descricao ?? "",
            cliente_id: l.cliente_id,
            contrato_id: l.contrato_id ?? "",
            processo_id: l.processo_id ?? "",
            centro_custo_id: l.centro_custo_id ?? "",
            garantido: l.garantido === 1,
            forma_pagamento: l.forma_pagamento,
            valor_cents: l.valor,
            num_parcelas: l.num_parcelas != null ? String(l.num_parcelas) : "2",
            data_primeira_parcela: primeira,
            data_prevista: l.data_prevista ?? "",
            data_pagamento: l.data_pagamento ?? "",
            status_pagamento: l.status_pagamento,
            numero_documento: l.numero_documento ?? "",
            observacoes: l.observacoes ?? "",
          });
        }
      } catch (e) {
        toast.error("Falha ao carregar o formulário", String((e as Error).message ?? e));
      } finally {
        setLoadingInitial(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load the chosen cliente's contratos and processos.
  useEffect(() => {
    if (!state.cliente_id) {
      setContratos([]);
      setProcessos([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [cts, prs] = await Promise.all([
          contratosListByCliente(state.cliente_id),
          processosListByCliente(state.cliente_id),
        ]);
        if (!cancelled) {
          setContratos(cts);
          setProcessos(prs);
        }
      } catch (e) {
        if (!cancelled) toast.error("Falha ao carregar vínculos", String((e as Error).message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cliente_id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function switchNatureza(next: Natureza) {
    setState((prev) => ({
      ...prev,
      natureza: next,
      tipo: next === "entrada" ? "mensalidade" : "despesa_escritorio",
      centro_custo_id: next === "saida" ? prev.centro_custo_id : "",
      // Entradas começam não garantidas; saídas começam garantidas (despesas costumam ser certas).
      garantido: next === "saida",
    }));
    setErrors({});
  }

  function switchForma(next: FormaPagamento) {
    setState((prev) => ({ ...prev, forma_pagamento: next }));
    setErrors((prev) => ({
      ...prev,
      data_prevista: undefined,
      data_primeira_parcela: undefined,
      num_parcelas: undefined,
    }));
  }

  function changeCliente(next: string) {
    setState((prev) => ({
      ...prev,
      cliente_id: next,
      contrato_id: next === prev.cliente_id ? prev.contrato_id : "",
      processo_id: next === prev.cliente_id ? prev.processo_id : "",
    }));
    setErrors((prev) => ({ ...prev, cliente_id: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!state.cliente_id) next.cliente_id = "Selecione o cliente.";
    if (state.natureza === "saida" && !state.centro_custo_id) {
      next.centro_custo_id = "Centro de custo é obrigatório para saídas.";
    }
    if (state.valor_cents == null || state.valor_cents <= 0) {
      next.valor_cents = "Informe um valor maior que zero.";
    }
    if (state.forma_pagamento === "parcelado") {
      const n = Number(state.num_parcelas);
      if (!Number.isInteger(n) || n < 2) next.num_parcelas = "Mínimo de 2 parcelas.";
      if (!state.data_primeira_parcela) {
        next.data_primeira_parcela = "Informe a data da primeira parcela.";
      }
    } else {
      if (!state.data_prevista) next.data_prevista = "Informe a data prevista.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const input = toInput(state);
      if (isEditing && id) {
        await lancamentosUpdate(id, input);
        toast.success("Lançamento atualizado");
        navigate(`/lancamentos/${id}`);
      } else {
        const created = await lancamentosCreate(input);
        toast.success("Lançamento criado");
        navigate(`/lancamentos/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ValidationError) {
        toast.error("Validação", e.message);
        if (e.field) setErrors((prev) => ({ ...prev, [e.field as keyof FormState]: e.message }));
      } else {
        toast.error("Erro ao salvar", String((e as Error).message ?? e));
      }
    } finally {
      setSaving(false);
    }
  }

  const clienteOptions = useMemo<ComboboxOption[]>(
    () =>
      clientes.map((c) => ({
        value: c.id,
        label: c.nome,
        meta: c.status_relacionamento === "inativo" ? "inativo" : undefined,
      })),
    [clientes],
  );
  const contratoOptions = useMemo<ComboboxOption[]>(
    () => contratos.map((c) => ({ value: c.id, label: `${c.codigo} — ${c.nome}` })),
    [contratos],
  );
  const processoOptions = useMemo<ComboboxOption[]>(
    () =>
      processos.map((p) => ({
        value: p.id,
        label: displayNumeroProcesso(p) ?? "Sem número",
        meta: p.natureza === "administrativo" ? "administrativo" : undefined,
      })),
    [processos],
  );
  const centroCustoOptions = useMemo<ComboboxOption[]>(
    () =>
      centrosCusto
        .filter((o) => o.ativo === 1 || o.id === state.centro_custo_id)
        .map((o) => ({ value: o.id, label: o.nome, meta: o.ativo === 0 ? "inativo" : undefined })),
    [centrosCusto, state.centro_custo_id],
  );
  const tipoOptions = state.natureza === "entrada" ? TIPO_OPTIONS_ENTRADA : TIPO_OPTIONS_SAIDA;

  if (loadingInitial) {
    return <div className="py-20 text-center text-[var(--color-ink-muted)]">Carregando…</div>;
  }

  const isParcelado = state.forma_pagamento === "parcelado";
  const garantidoLocked = isGarantidoLocked(state.tipo);
  const lockCliente = Boolean(queryCliente) && !isEditing;

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        eyebrow={isEditing ? "Editando" : "Novo lançamento"}
        title={isEditing ? "Editar lançamento" : "Novo lançamento"}
        description="Entradas e saídas financeiras. Parcelados geram parcelas automaticamente no mesmo dia de cada mês."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="md"
              type="button"
              icon={<ArrowLeft weight="light" />}
              onClick={() => navigate(-1)}
            >
              Voltar
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={saving}
              icon={<FloppyDisk weight="light" />}
            >
              {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar lançamento"}
            </Button>
          </div>
        }
      />

      {structureLocked && (
        <div className="mb-6 rounded-[1rem] bg-[var(--color-warning-soft)] ring-1 ring-[#e7d8b3] px-4 py-3 text-[13px] text-[var(--color-warning)]">
          Este lançamento parcelado já tem parcelas pagas. Valor, número de parcelas, forma de
          pagamento e a data da primeira parcela ficam bloqueados.
        </div>
      )}

      <div className="grid grid-cols-12 gap-7">
        {/* Natureza */}
        <Card className="col-span-12">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div className="eyebrow mb-2">Natureza</div>
              <p className="text-[13.5px] text-[var(--color-ink-muted)] leading-relaxed">
                Entradas são receitas; saídas são despesas e custas. O tipo e os campos mudam conforme a escolha.
              </p>
            </div>
            <PillToggle
              value={state.natureza}
              onChange={switchNatureza}
              disabled={isEditing}
              options={[
                { value: "entrada", label: "Entrada" },
                { value: "saida", label: "Saída" },
              ]}
            />
          </div>
        </Card>

        {/* Classificação */}
        <Card className="col-span-12 lg:col-span-7">
          <div className="eyebrow mb-5">Classificação</div>
          <div className="grid grid-cols-12 gap-4">
            <Field label="Tipo" required className="col-span-6">
              <Combobox
                value={state.tipo}
                onChange={(v) => set("tipo", v as TipoLancamento)}
                options={tipoOptions}
                placeholder="Selecione o tipo"
              />
            </Field>

            {state.natureza === "saida" && (
              <Field
                label="Centro de custo"
                required
                error={errors.centro_custo_id}
                className="col-span-6"
              >
                <Combobox
                  value={state.centro_custo_id}
                  onChange={(v) => set("centro_custo_id", v)}
                  options={centroCustoOptions}
                  placeholder="Selecione o centro de custo"
                  emptyMessage="Nenhum centro de custo"
                  invalid={Boolean(errors.centro_custo_id)}
                />
              </Field>
            )}

            <Field
              label={state.natureza === "entrada" ? "Receita garantida?" : "Despesa garantida?"}
              hint={
                garantidoLocked
                  ? "Sucumbência e acordo são sempre não garantidos."
                  : state.natureza === "entrada"
                    ? "Não garantidas são ponderadas pela chance de êxito na projeção."
                    : "Despesas incertas entram apenas no pior cenário do dashboard."
              }
              className="col-span-6"
            >
              <PillToggle
                value={state.garantido && !garantidoLocked ? "sim" : "nao"}
                onChange={(v) => set("garantido", v === "sim")}
                disabled={garantidoLocked}
                options={[
                  { value: "sim", label: "Garantida" },
                  { value: "nao", label: state.natureza === "entrada" ? "Não garantida" : "Incerta" },
                ]}
              />
            </Field>

            <Field label="Descrição" className="col-span-12">
              <Input
                value={state.descricao}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Ex.: Honorário mensal de maio"
              />
            </Field>

            <Field label="Cliente" required error={errors.cliente_id} className="col-span-12">
              <Combobox
                value={state.cliente_id}
                onChange={changeCliente}
                options={clienteOptions}
                placeholder="Digite para buscar o cliente"
                emptyMessage="Nenhum cliente encontrado"
                disabled={lockCliente}
                invalid={Boolean(errors.cliente_id)}
              />
            </Field>

            <Field
              label="Contrato"
              hint={state.cliente_id ? undefined : "Selecione um cliente primeiro."}
              className="col-span-6"
            >
              <Combobox
                value={state.contrato_id}
                onChange={(v) => set("contrato_id", v)}
                options={contratoOptions}
                placeholder="Vincular contrato (opcional)"
                emptyMessage="Nenhum contrato disponível"
                disabled={!state.cliente_id || contratoOptions.length === 0}
                allowClear
              />
            </Field>
            <Field
              label="Processo"
              hint={state.cliente_id ? undefined : "Selecione um cliente primeiro."}
              className="col-span-6"
            >
              <Combobox
                value={state.processo_id}
                onChange={(v) => set("processo_id", v)}
                options={processoOptions}
                placeholder="Vincular processo (opcional)"
                emptyMessage="Nenhum processo disponível"
                disabled={!state.cliente_id || processoOptions.length === 0}
                allowClear
              />
            </Field>
          </div>
        </Card>

        {/* Valores & pagamento */}
        <Card className="col-span-12 lg:col-span-5">
          <div className="eyebrow mb-5">Valores & pagamento</div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
                Forma de pagamento
              </span>
              <div>
                <PillToggle
                  value={state.forma_pagamento}
                  onChange={switchForma}
                  disabled={structureLocked}
                  options={[
                    { value: "avista", label: "À vista" },
                    { value: "parcelado", label: "Parcelado" },
                  ]}
                />
              </div>
            </div>

            <Field
              label={isParcelado ? "Valor de cada parcela" : "Valor total"}
              required
              error={errors.valor_cents}
            >
              <CurrencyInput
                valueCents={state.valor_cents}
                onValueChange={(c) => set("valor_cents", c)}
                invalid={Boolean(errors.valor_cents)}
                disabled={structureLocked}
              />
            </Field>

            {isParcelado ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nº de parcelas" required error={errors.num_parcelas}>
                  <Input
                    type="number"
                    min={2}
                    step={1}
                    value={state.num_parcelas}
                    onChange={(e) => set("num_parcelas", e.target.value)}
                    invalid={Boolean(errors.num_parcelas)}
                    disabled={structureLocked}
                  />
                </Field>
                <Field
                  label="1ª parcela"
                  required
                  error={errors.data_primeira_parcela}
                >
                  <Input
                    type="date"
                    value={state.data_primeira_parcela}
                    onChange={(e) => set("data_primeira_parcela", e.target.value)}
                    invalid={Boolean(errors.data_primeira_parcela)}
                    disabled={structureLocked}
                  />
                </Field>
              </div>
            ) : (
              <>
                <Field label="Data prevista" required error={errors.data_prevista}>
                  <Input
                    type="date"
                    value={state.data_prevista}
                    onChange={(e) => set("data_prevista", e.target.value)}
                    invalid={Boolean(errors.data_prevista)}
                  />
                </Field>
                <Field label="Status do pagamento">
                  <Combobox
                    value={state.status_pagamento}
                    onChange={(v) => set("status_pagamento", (v || "pendente") as StatusPagamento)}
                    options={STATUS_AVISTA_OPTIONS}
                    placeholder="Selecione o status"
                  />
                </Field>
                {state.status_pagamento === "pago" && (
                  <Field label="Data do pagamento" hint="Se vazio, assume a data de hoje.">
                    <Input
                      type="date"
                      value={state.data_pagamento || todayIso()}
                      onChange={(e) => set("data_pagamento", e.target.value)}
                    />
                  </Field>
                )}
              </>
            )}

            <Field label="Número do documento" hint="NF, RPA, recibo — texto livre.">
              <Input
                value={state.numero_documento}
                onChange={(e) => set("numero_documento", e.target.value)}
                placeholder="Ex.: NF 1234-A"
              />
            </Field>
          </div>
        </Card>

        {/* Parcelas preview */}
        {isParcelado && (
          <Card className="col-span-12">
            <div className="eyebrow mb-4">Cronograma de parcelas</div>
            <ParcelasPreview
              dataPrimeira={state.data_primeira_parcela}
              numParcelas={Number(state.num_parcelas) || 0}
              valorCents={state.valor_cents}
            />
          </Card>
        )}

        {/* Observações */}
        <Card className="col-span-12">
          <div className="eyebrow mb-5">Observações</div>
          <Textarea
            rows={3}
            value={state.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
            placeholder="Notas internas sobre este lançamento"
          />
        </Card>

        <div className="col-span-12 flex items-center justify-end gap-2.5 pb-4">
          <Button variant="ghost" size="md" type="button" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={saving}
            trailingIcon={<CaretRight weight="bold" />}
          >
            {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function PillToggle<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-muted)] p-0.5 ring-1 ring-inset ring-[var(--color-hairline)] shrink-0",
        disabled && "opacity-60",
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-5 py-1.5 rounded-full text-[12.5px] font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
            disabled && "cursor-not-allowed",
            value === opt.value
              ? "bg-[var(--color-surface)] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
              : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
