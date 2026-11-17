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
import { maskCNJ, onlyDigits } from "../../../lib/format/documents";
import { ConflictError, ValidationError } from "../../../lib/errors";
import { cn } from "../../../lib/cn";
import { clientesList } from "../../clientes/api";
import type { Cliente } from "../../clientes/types";
import { processosCreate, processosGet, processosUpdate } from "../api";
import type {
  FaseProcesso,
  NaturezaProcesso,
  ProcessoInput,
  StatusProcesso,
} from "../types";
import { FASE_OPTIONS } from "../components/faseLabels";

interface FormState {
  cliente_id: string;
  natureza: NaturezaProcesso;
  numero_processo: string;
  vara: string;
  tribunal: string;
  comarca: string;
  fase: FaseProcesso;
  fase_custom: string;
  parte_adversa: string;
  advogado_adversario: string;
  oab_adversario: string;
  valor_causa_cents: number | null;
  chance_exito: string;
  link_documentos: string;
  status: StatusProcesso;
  observacoes: string;
}

const emptyState: FormState = {
  cliente_id: "",
  natureza: "judicial",
  numero_processo: "",
  vara: "",
  tribunal: "",
  comarca: "",
  fase: "conhecimento",
  fase_custom: "",
  parte_adversa: "",
  advogado_adversario: "",
  oab_adversario: "",
  valor_causa_cents: null,
  chance_exito: "",
  link_documentos: "",
  status: "em_andamento",
  observacoes: "",
};

function toInput(state: FormState): ProcessoInput {
  return {
    cliente_id: state.cliente_id,
    natureza: state.natureza,
    numero_processo:
      state.natureza === "judicial"
        ? state.numero_processo
          ? onlyDigits(state.numero_processo)
          : null
        : state.numero_processo.trim() || null,
    vara: state.vara.trim() || null,
    tribunal: state.tribunal.trim() || null,
    comarca: state.comarca.trim() || null,
    fase: state.fase,
    fase_custom: state.fase === "outro" ? (state.fase_custom.trim() || null) : null,
    parte_adversa: state.parte_adversa.trim() || null,
    advogado_adversario: state.advogado_adversario.trim() || null,
    oab_adversario: state.oab_adversario.trim() || null,
    valor_causa: state.valor_causa_cents,
    chance_exito: state.chance_exito.trim() ? Number(state.chance_exito) : null,
    link_documentos: state.link_documentos.trim() || null,
    status: state.status,
    observacoes: state.observacoes.trim() || null,
  };
}

const FASE_COMBOBOX = FASE_OPTIONS.map((f) => ({ value: f.value, label: f.label }));
const STATUS_COMBOBOX: ComboboxOption[] = [
  { value: "em_andamento", label: "Em andamento", dotColor: "var(--color-positive)" },
  { value: "suspenso", label: "Suspenso", dotColor: "var(--color-warning)" },
  { value: "encerrado", label: "Encerrado", dotColor: "var(--color-critical)" },
];

export function ProcessoFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const queryClienteId = useMemo(() => {
    return new URLSearchParams(location.search).get("cliente_id") ?? "";
  }, [location.search]);

  const [state, setState] = useState<FormState>({ ...emptyState, cliente_id: queryClienteId });
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    (async () => {
      try {
        const list = await clientesList({ status_relacionamento: "all" });
        setClientes(list);
      } catch (e) {
        toast.error("Falha ao carregar clientes", String((e as Error).message ?? e));
      }
      if (isEditing && id) {
        try {
          const p = await processosGet(id);
          if (!p) {
            toast.error("Processo não encontrado");
            navigate("/processos");
            return;
          }
          setState({
            cliente_id: p.cliente_id,
            natureza: p.natureza,
            numero_processo:
              p.numero_processo
                ? p.natureza === "judicial"
                  ? maskCNJ(p.numero_processo)
                  : p.numero_processo
                : "",
            vara: p.vara ?? "",
            tribunal: p.tribunal ?? "",
            comarca: p.comarca ?? "",
            fase: p.fase,
            fase_custom: p.fase_custom ?? "",
            parte_adversa: p.parte_adversa ?? "",
            advogado_adversario: p.advogado_adversario ?? "",
            oab_adversario: p.oab_adversario ?? "",
            valor_causa_cents: p.valor_causa,
            chance_exito: p.chance_exito != null ? String(p.chance_exito) : "",
            link_documentos: p.link_documentos ?? "",
            status: p.status,
            observacoes: p.observacoes ?? "",
          });
        } catch (e) {
          toast.error("Falha ao carregar processo", String((e as Error).message ?? e));
        } finally {
          setLoadingInitial(false);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  function switchNatureza(next: NaturezaProcesso) {
    setState((prev) => ({
      ...prev,
      natureza: next,
      // Clear the number when switching, since the format is incompatible.
      numero_processo: prev.natureza === next ? prev.numero_processo : "",
    }));
    setErrors((prev) => ({ ...prev, numero_processo: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!state.cliente_id) next.cliente_id = "Selecione o cliente.";
    if (state.natureza === "judicial" && state.numero_processo) {
      if (onlyDigits(state.numero_processo).length !== 20) {
        next.numero_processo = "CNJ deve ter 20 dígitos.";
      }
    }
    if (state.fase === "outro" && !state.fase_custom.trim()) {
      next.fase_custom = "Informe o nome da fase customizada.";
    }
    if (state.chance_exito.trim()) {
      const n = Number(state.chance_exito);
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        next.chance_exito = "Inteiro entre 0 e 100.";
      }
    }
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
      const input = toInput(state);
      if (isEditing && id) {
        await processosUpdate(id, input);
        toast.success("Processo atualizado");
        navigate(`/processos/${id}`);
      } else {
        const created = await processosCreate(input);
        toast.success("Processo criado");
        navigate(`/processos/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ConflictError) {
        toast.error("Conflito", e.message);
        setErrors((prev) => ({ ...prev, numero_processo: e.message }));
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

  const clienteOptions = useMemo(
    () =>
      clientes.map((c) => ({
        value: c.id,
        label: c.nome,
        meta: c.status_relacionamento === "inativo" ? "inativo" : undefined,
      })),
    [clientes],
  );

  if (loadingInitial) {
    return <div className="py-20 text-center text-[var(--color-ink-muted)]">Carregando processo…</div>;
  }

  const isJudicial = state.natureza === "judicial";
  const lockCliente = Boolean(queryClienteId) && !isEditing;

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        eyebrow={isEditing ? "Editando" : "Novo processo"}
        title={isEditing ? "Editar processo" : "Novo processo"}
        description="Vincule o processo a um cliente e capture os metadados procedimentais. Processos judiciais usam máscara CNJ; administrativos têm número livre."
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
              {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar processo"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-7">
        {/* Natureza toggle */}
        <Card className="col-span-12">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div>
              <div className="eyebrow mb-2">Natureza do processo</div>
              <p className="text-[13.5px] text-[var(--color-ink-muted)] leading-relaxed max-w-lg">
                Judiciais usam o número CNJ padronizado de 20 dígitos. Administrativos
                aceitam qualquer formato de número (NUP, protocolo, processo SEI, etc.).
              </p>
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-muted)] p-0.5 ring-1 ring-inset ring-[var(--color-hairline)] shrink-0">
              {(["judicial", "administrativo"] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => switchNatureza(n)}
                  className={cn(
                    "px-5 py-1.5 rounded-full text-[12.5px] font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    state.natureza === n
                      ? "bg-[var(--color-surface)] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                      : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
                  )}
                >
                  {n === "judicial" ? "Judicial" : "Administrativo"}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-7">
          <div className="eyebrow mb-5">Identificação</div>
          <div className="grid grid-cols-12 gap-4">
            <Field label="Cliente" required error={errors.cliente_id} className="col-span-12">
              <Combobox
                value={state.cliente_id}
                onChange={(v) => set("cliente_id", v)}
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
              label={isJudicial ? "Número CNJ" : "Número do processo administrativo"}
              error={errors.numero_processo}
              hint={
                isJudicial
                  ? "20 dígitos. A máscara é aplicada conforme você digita."
                  : "Formato livre — protocolo, NUP, processo SEI, etc."
              }
              className="col-span-12"
            >
              <Input
                inputMode={isJudicial ? "numeric" : "text"}
                placeholder={
                  isJudicial ? "0000000-00.0000.0.00.0000" : "Ex.: 13864.722222/2024-99"
                }
                value={state.numero_processo}
                onChange={(e) =>
                  set(
                    "numero_processo",
                    isJudicial ? maskCNJ(e.target.value) : e.target.value,
                  )
                }
                invalid={Boolean(errors.numero_processo)}
              />
            </Field>

            <Field label={isJudicial ? "Vara" : "Setor / Órgão"} className="col-span-6">
              <Input
                value={state.vara}
                onChange={(e) => set("vara", e.target.value)}
                placeholder={isJudicial ? "Ex.: 2ª Vara Cível" : "Ex.: Receita Federal"}
              />
            </Field>
            <Field label={isJudicial ? "Tribunal" : "Esfera / Instância"} className="col-span-6">
              <Input
                value={state.tribunal}
                onChange={(e) => set("tribunal", e.target.value)}
                placeholder={isJudicial ? "Ex.: TJSP" : "Ex.: Federal"}
              />
            </Field>
            <Field label={isJudicial ? "Comarca" : "Unidade / Localidade"} className="col-span-12">
              <Input
                value={state.comarca}
                onChange={(e) => set("comarca", e.target.value)}
                placeholder={isJudicial ? "Ex.: Comarca de São Paulo" : "Ex.: DRF/SP"}
              />
            </Field>

            <Field label="Fase" className={state.fase === "outro" ? "col-span-5" : "col-span-12"}>
              <Combobox
                value={state.fase}
                onChange={(v) => {
                  const next = (v || "conhecimento") as FaseProcesso;
                  set("fase", next);
                  if (next !== "outro") setState((prev) => ({ ...prev, fase_custom: "" }));
                }}
                options={FASE_COMBOBOX}
                placeholder="Selecione a fase"
              />
            </Field>
            {state.fase === "outro" && (
              <Field label="Nome da fase" required error={errors.fase_custom} className="col-span-7">
                <Input
                  value={state.fase_custom}
                  onChange={(e) => set("fase_custom", e.target.value)}
                  placeholder="Ex.: Cumprimento de sentença"
                  invalid={Boolean(errors.fase_custom)}
                />
              </Field>
            )}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <div className="eyebrow mb-5">Status & valores</div>
          <div className="flex flex-col gap-4">
            <Field label="Status">
              <Combobox
                value={state.status}
                onChange={(v) => set("status", (v || "em_andamento") as StatusProcesso)}
                options={STATUS_COMBOBOX}
                placeholder="Selecione o status"
              />
            </Field>

            <Field label="Valor da causa" hint="Opcional. Alimenta análises agregadas.">
              <CurrencyInput
                valueCents={state.valor_causa_cents}
                onValueChange={(c) => set("valor_causa_cents", c)}
              />
            </Field>

            <Field
              label="Chance de êxito (%)"
              error={errors.chance_exito}
              hint="0–100. Usado para ponderar receitas não garantidas na projeção."
            >
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={state.chance_exito}
                  onChange={(e) => set("chance_exito", e.target.value)}
                  invalid={Boolean(errors.chance_exito)}
                  className="!w-24"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={state.chance_exito ? Number(state.chance_exito) : 0}
                  onChange={(e) => set("chance_exito", e.target.value)}
                  className={cn(
                    "flex-1 accent-[var(--color-accent)]",
                    !state.chance_exito && "opacity-50",
                  )}
                  aria-label="Chance de êxito"
                />
              </div>
            </Field>
          </div>
        </Card>

        <Card className="col-span-12">
          <div className="eyebrow mb-5">Parte adversa</div>
          <div className="grid grid-cols-12 gap-4">
            <Field
              label={isJudicial ? "Nome da parte adversa" : "Outra parte / interessado"}
              className="col-span-12 lg:col-span-6"
            >
              <Input
                value={state.parte_adversa}
                onChange={(e) => set("parte_adversa", e.target.value)}
              />
            </Field>
            <Field
              label={isJudicial ? "Advogado adverso" : "Procurador / responsável"}
              className="col-span-12 lg:col-span-4"
            >
              <Input
                value={state.advogado_adversario}
                onChange={(e) => set("advogado_adversario", e.target.value)}
              />
            </Field>
            <Field label={isJudicial ? "OAB" : "Identificação"} className="col-span-12 lg:col-span-2">
              <Input
                value={state.oab_adversario}
                onChange={(e) => set("oab_adversario", e.target.value)}
                placeholder={isJudicial ? "OAB/SP 000.000" : "Matrícula / SIAPE"}
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
              hint="URL externa (Google Drive, OneDrive, pasta de rede). Abre no navegador padrão."
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
                placeholder="Anotações de estratégia, andamento, contexto"
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
            {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar processo"}
          </Button>
        </div>
      </div>
    </form>
  );
}

