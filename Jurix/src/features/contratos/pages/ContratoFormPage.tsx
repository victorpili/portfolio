import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowsClockwise, CaretRight, FloppyDisk } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Field, Input, Textarea } from "../../../components/ui/Input";
import { Combobox, type ComboboxOption } from "../../../components/ui/Combobox";
import { CurrencyInput } from "../../../components/ui/CurrencyInput";
import { useToast } from "../../../components/ui/Toast";
import { ConflictError, ValidationError } from "../../../lib/errors";
import { clientesList } from "../../clientes/api";
import { processosListByCliente } from "../../processos/api";
import { lookupList, type LookupRow } from "../../cadastros/api";
import type { Cliente } from "../../clientes/types";
import type { Processo } from "../../processos/types";
import { contratosCreate, contratosGet, contratosUpdate, previewNextCodigo } from "../api";
import type { ContratoInput, StatusContrato } from "../types";
import { displayNumeroProcesso } from "../../processos/components/numero";

interface FormState {
  codigo: string;
  nome: string;
  cliente_id: string;
  processo_id: string;
  area_direito_id: string;
  tipo_contrato_id: string;
  valor_base_cents: number | null;
  data_inicio: string;
  data_encerramento: string;
  status: StatusContrato;
  link_documentos: string;
  observacoes: string;
}

const emptyState: FormState = {
  codigo: "",
  nome: "",
  cliente_id: "",
  processo_id: "",
  area_direito_id: "",
  tipo_contrato_id: "",
  valor_base_cents: null,
  data_inicio: "",
  data_encerramento: "",
  status: "ativo",
  link_documentos: "",
  observacoes: "",
};

function toInput(state: FormState, isEditing: boolean): ContratoInput {
  return {
    codigo: isEditing ? state.codigo.trim() : (state.codigo.trim() || null),
    nome: state.nome.trim(),
    cliente_id: state.cliente_id,
    processo_id: state.processo_id || null,
    area_direito_id: state.area_direito_id,
    tipo_contrato_id: state.tipo_contrato_id,
    valor_base: state.valor_base_cents ?? 0,
    data_inicio: state.data_inicio,
    data_encerramento: state.data_encerramento || null,
    status: state.status,
    link_documentos: state.link_documentos.trim() || null,
    observacoes: state.observacoes.trim() || null,
  };
}

const STATUS_OPTIONS: ComboboxOption[] = [
  { value: "ativo", label: "Ativo" },
  { value: "suspenso", label: "Suspenso" },
  { value: "inativo", label: "Inativo" },
];

export function ContratoFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const queryClienteId = useMemo(
    () => new URLSearchParams(location.search).get("cliente_id") ?? "",
    [location.search],
  );

  const [state, setState] = useState<FormState>({ ...emptyState, cliente_id: queryClienteId });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [processosOfCliente, setProcessosOfCliente] = useState<Processo[]>([]);
  const [areas, setAreas] = useState<LookupRow[]>([]);
  const [tipos, setTipos] = useState<LookupRow[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [cs, ad, tc] = await Promise.all([
          clientesList({ status_relacionamento: "all" }),
          lookupList("areas_direito"),
          lookupList("tipos_contrato"),
        ]);
        setClientes(cs);
        setAreas(ad);
        setTipos(tc);

        if (isEditing && id) {
          const c = await contratosGet(id);
          if (!c) {
            toast.error("Contrato não encontrado");
            navigate("/contratos");
            return;
          }
          setState({
            codigo: c.codigo,
            nome: c.nome,
            cliente_id: c.cliente_id,
            processo_id: c.processo_id ?? "",
            area_direito_id: c.area_direito_id,
            tipo_contrato_id: c.tipo_contrato_id,
            valor_base_cents: c.valor_base,
            data_inicio: c.data_inicio,
            data_encerramento: c.data_encerramento ?? "",
            status: c.status,
            link_documentos: c.link_documentos ?? "",
            observacoes: c.observacoes ?? "",
          });
        } else {
          // New: suggest CTR-YYYY-NNNN for the current year as a starting point.
          const suggested = await previewNextCodigo();
          setState((prev) => ({ ...prev, codigo: suggested }));
        }
      } catch (e) {
        toast.error("Falha ao carregar contrato", String((e as Error).message ?? e));
      } finally {
        setLoadingInitial(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // When the cliente changes, fetch processos for that cliente (for the processo combobox).
  useEffect(() => {
    if (!state.cliente_id) {
      setProcessosOfCliente([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await processosListByCliente(state.cliente_id);
        if (!cancelled) setProcessosOfCliente(list);
      } catch (e) {
        if (!cancelled) toast.error("Falha ao carregar processos do cliente", String((e as Error).message ?? e));
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

  function changeCliente(next: string) {
    setState((prev) => ({
      ...prev,
      cliente_id: next,
      // When the cliente changes, clear processo_id since it likely belongs to another cliente.
      processo_id: next && next === prev.cliente_id ? prev.processo_id : "",
    }));
    setErrors((prev) => ({ ...prev, cliente_id: undefined, processo_id: undefined }));
  }

  async function regenerateCodigo() {
    try {
      const yr = state.data_inicio ? Number(state.data_inicio.slice(0, 4)) : new Date().getFullYear();
      const suggested = await previewNextCodigo(yr);
      setState((prev) => ({ ...prev, codigo: suggested }));
      setErrors((prev) => ({ ...prev, codigo: undefined }));
    } catch (e) {
      toast.error("Falha ao gerar código", String((e as Error).message ?? e));
    }
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!state.cliente_id) next.cliente_id = "Selecione o cliente.";
    if (!state.area_direito_id) next.area_direito_id = "Selecione a área.";
    if (!state.tipo_contrato_id) next.tipo_contrato_id = "Selecione o tipo.";
    if (!state.nome.trim()) next.nome = "Informe um nome para o contrato.";
    if (state.valor_base_cents == null) next.valor_base_cents = "Informe o valor base.";
    if (!state.data_inicio) next.data_inicio = "Informe a data de início.";
    if (
      state.data_inicio &&
      state.data_encerramento &&
      state.data_encerramento < state.data_inicio
    ) {
      next.data_encerramento = "Data de encerramento não pode ser anterior à data de início.";
    }
    if (isEditing && !state.codigo.trim()) next.codigo = "Código é obrigatório ao editar.";
    if (state.link_documentos.trim()) {
      try {
        new URL(state.link_documentos);
      } catch {
        next.link_documentos = "URL inválida.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const input = toInput(state, isEditing);
      if (isEditing && id) {
        await contratosUpdate(id, input);
        toast.success("Contrato atualizado");
        navigate(`/contratos/${id}`);
      } else {
        const created = await contratosCreate(input);
        toast.success("Contrato criado");
        navigate(`/contratos/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ConflictError) {
        toast.error("Conflito", e.message);
        setErrors((prev) => ({ ...prev, codigo: e.message }));
      } else if (e instanceof ValidationError) {
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

  const processoOptions = useMemo<ComboboxOption[]>(
    () =>
      processosOfCliente.map((p) => ({
        value: p.id,
        label: displayNumeroProcesso(p) ?? "Sem número",
        meta:
          p.natureza === "administrativo"
            ? "administrativo"
            : p.parte_adversa
              ? `vs. ${p.parte_adversa}`
              : undefined,
      })),
    [processosOfCliente],
  );

  const areaOptions = useMemo<ComboboxOption[]>(
    () =>
      areas
        .filter((o) => o.ativo === 1 || o.id === state.area_direito_id)
        .map((o) => ({
          value: o.id,
          label: o.nome,
          meta: o.ativo === 0 ? "inativo" : undefined,
        })),
    [areas, state.area_direito_id],
  );

  const tipoOptions = useMemo<ComboboxOption[]>(
    () =>
      tipos
        .filter((o) => o.ativo === 1 || o.id === state.tipo_contrato_id)
        .map((o) => ({
          value: o.id,
          label: o.nome,
          meta: o.ativo === 0 ? "inativo" : undefined,
        })),
    [tipos, state.tipo_contrato_id],
  );

  if (loadingInitial) {
    return <div className="py-20 text-center text-[var(--color-ink-muted)]">Carregando contrato…</div>;
  }

  const lockCliente = Boolean(queryClienteId) && !isEditing;

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        eyebrow={isEditing ? "Editando" : "Novo contrato"}
        title={isEditing ? state.nome || "Contrato" : "Novo contrato"}
        description={
          isEditing
            ? "Atualize os dados do contrato. O código pode ser editado, mas precisa permanecer único."
            : "Vincule o contrato a um cliente e, opcionalmente, a um processo. O código é gerado automaticamente como CTR-AAAA-NNNN, mas você pode editá-lo."
        }
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
              {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar contrato"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-7">
        <Card className="col-span-12 lg:col-span-7">
          <div className="eyebrow mb-5">Identificação</div>
          <div className="grid grid-cols-12 gap-4">
            <Field label="Código" required error={errors.codigo} className="col-span-7">
              <div className="flex items-center gap-2">
                <Input
                  value={state.codigo}
                  onChange={(e) => set("codigo", e.target.value)}
                  placeholder="CTR-2026-0001"
                  invalid={Boolean(errors.codigo)}
                  className="font-mono tabular-nums"
                />
                {!isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<ArrowsClockwise weight="light" />}
                    onClick={regenerateCodigo}
                    aria-label="Regerar código"
                    className="shrink-0"
                  >
                    Sugerir
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Status" className="col-span-5">
              <Combobox
                value={state.status}
                onChange={(v) => set("status", (v || "ativo") as StatusContrato)}
                options={STATUS_OPTIONS}
                placeholder="Selecione o status"
              />
            </Field>

            <Field label="Nome do contrato" required error={errors.nome} className="col-span-12">
              <Input
                value={state.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex.: Honorário mensal — Direito Trabalhista"
                invalid={Boolean(errors.nome)}
              />
            </Field>

            <Field label="Cliente" required error={errors.cliente_id} className="col-span-12">
              <Combobox
                value={state.cliente_id}
                onChange={changeCliente}
                options={clienteOptions}
                placeholder="Digite o nome para buscar"
                emptyMessage="Nenhum cliente encontrado"
                disabled={lockCliente}
                invalid={Boolean(errors.cliente_id)}
              />
            </Field>
            {lockCliente && (
              <div className="col-span-12 -mt-2 text-[12px] text-[var(--color-ink-muted)]">
                Cliente pré-selecionado a partir do contexto. <button
                  type="button"
                  className="text-[var(--color-accent)] hover:underline"
                  onClick={() => navigate(location.pathname)}
                >
                  Trocar
                </button>
              </div>
            )}

            <Field
              label="Processo vinculado"
              error={errors.processo_id}
              hint={
                state.cliente_id
                  ? processoOptions.length > 0
                    ? "Apenas processos do cliente selecionado."
                    : "Este cliente ainda não possui processos cadastrados."
                  : "Selecione um cliente para listar os processos disponíveis."
              }
              className="col-span-12"
            >
              <Combobox
                value={state.processo_id}
                onChange={(v) => set("processo_id", v)}
                options={processoOptions}
                placeholder={
                  state.cliente_id
                    ? "Buscar processo do cliente (opcional)"
                    : "Selecione um cliente primeiro"
                }
                emptyMessage="Nenhum processo disponível"
                disabled={!state.cliente_id || processoOptions.length === 0}
                allowClear
              />
            </Field>
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <div className="eyebrow mb-5">Classificação & valor</div>
          <div className="flex flex-col gap-4">
            <Field label="Área do direito" required error={errors.area_direito_id}>
              <Combobox
                value={state.area_direito_id}
                onChange={(v) => set("area_direito_id", v)}
                options={areaOptions}
                placeholder="Digite para buscar"
                emptyMessage="Nenhuma área corresponde"
                invalid={Boolean(errors.area_direito_id)}
              />
            </Field>

            <Field label="Tipo de contrato" required error={errors.tipo_contrato_id}>
              <Combobox
                value={state.tipo_contrato_id}
                onChange={(v) => set("tipo_contrato_id", v)}
                options={tipoOptions}
                placeholder="Digite para buscar"
                emptyMessage="Nenhum tipo corresponde"
                invalid={Boolean(errors.tipo_contrato_id)}
              />
            </Field>

            <Field
              label="Valor base"
              required
              error={errors.valor_base_cents}
              hint="Referência financeira do contrato — alimenta projeções e métricas."
            >
              <CurrencyInput
                valueCents={state.valor_base_cents}
                onValueChange={(c) => set("valor_base_cents", c)}
                invalid={Boolean(errors.valor_base_cents)}
              />
            </Field>
          </div>
        </Card>

        <Card className="col-span-12">
          <div className="eyebrow mb-5">Vigência</div>
          <div className="grid grid-cols-12 gap-4">
            <Field label="Data de início" required error={errors.data_inicio} className="col-span-6">
              <Input
                type="date"
                value={state.data_inicio}
                onChange={(e) => set("data_inicio", e.target.value)}
                invalid={Boolean(errors.data_inicio)}
              />
            </Field>
            <Field
              label="Data de encerramento"
              error={errors.data_encerramento}
              hint="Opcional. Quando aplicável, alimenta análises de portfólio."
              className="col-span-6"
            >
              <Input
                type="date"
                value={state.data_encerramento}
                onChange={(e) => set("data_encerramento", e.target.value)}
                invalid={Boolean(errors.data_encerramento)}
              />
            </Field>
          </div>
        </Card>

        <Card className="col-span-12">
          <div className="eyebrow mb-5">Documentos & observações</div>
          <div className="flex flex-col gap-4">
            <Field
              label="Link para documentos"
              error={errors.link_documentos}
              hint="URL externa (Drive, OneDrive, pasta de rede). Abre no navegador padrão."
            >
              <Input
                type="url"
                placeholder="https://"
                value={state.link_documentos}
                onChange={(e) => set("link_documentos", e.target.value)}
                invalid={Boolean(errors.link_documentos)}
              />
            </Field>
            <Field label="Observações">
              <Textarea
                rows={4}
                value={state.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                placeholder="Notas sobre escopo, condições, gatilhos de honorários"
              />
            </Field>
          </div>
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
            {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar contrato"}
          </Button>
        </div>
      </div>
    </form>
  );
}
