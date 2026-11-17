import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, FloppyDisk, X } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Field, Input, Textarea } from "../../../components/ui/Input";
import { Combobox, type ComboboxOption } from "../../../components/ui/Combobox";
import { useToast } from "../../../components/ui/Toast";
import { ValidationError } from "../../../lib/errors";
import { todayIso } from "../../../lib/format/dates";
import { clientesList } from "../../clientes/api";
import { processosList } from "../../processos/api";
import { contratosList } from "../../contratos/api";
import { displayNumeroProcesso } from "../../processos/components/numero";
import { lookupList } from "../../cadastros/api";
import type { ClienteListRow } from "../../clientes/types";
import type { ProcessoListRow } from "../../processos/types";
import type { ContratoListRow } from "../../contratos/types";
import { agendaCreate, agendaGet, agendaUpdate } from "../api";
import type { AgendaEventoInput, StatusEvento } from "../types";
import { joinDataHora, splitDataHora } from "./calendar";

interface FormState {
  titulo: string;
  tipo_evento_id: string;
  date: string;
  time: string;
  alerta_dias: string;
  cliente_id: string;
  processo_id: string;
  contrato_id: string;
  status: StatusEvento;
  descricao: string;
}

const emptyState = (): FormState => ({
  titulo: "",
  tipo_evento_id: "",
  date: todayIso(),
  time: "08:00",
  alerta_dias: "1",
  cliente_id: "",
  processo_id: "",
  contrato_id: "",
  status: "pendente",
  descricao: "",
});

const STATUS_OPTIONS: ComboboxOption[] = [
  { value: "pendente", label: "Pendente", dotColor: "var(--color-accent)" },
  { value: "concluido", label: "Concluído", dotColor: "var(--color-positive)" },
  { value: "cancelado", label: "Cancelado", dotColor: "var(--color-ink-subtle)" },
];

export interface EventoFormDialogProps {
  open: boolean;
  /** When set, the dialog edits an existing event. */
  eventoId?: string | null;
  /** Pre-selected links when opened from a cliente/processo/contrato detail. */
  preset?: { cliente_id?: string; processo_id?: string; contrato_id?: string };
  /** Lock the preset link fields (used when opened from a detail screen). */
  lockContext?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EventoFormDialog({
  open,
  eventoId,
  preset,
  lockContext,
  onClose,
  onSaved,
}: EventoFormDialogProps) {
  const toast = useToast();
  const isEditing = Boolean(eventoId);

  const [state, setState] = useState<FormState>(emptyState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [tipos, setTipos] = useState<{ id: string; nome: string; ativo: number }[]>([]);
  const [clientes, setClientes] = useState<ClienteListRow[]>([]);
  const [processos, setProcessos] = useState<ProcessoListRow[]>([]);
  const [contratos, setContratos] = useState<ContratoListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErrors({});
    (async () => {
      try {
        const [ts, cs, ps, cts] = await Promise.all([
          lookupList("tipos_evento"),
          clientesList({ status_relacionamento: "all" }),
          processosList(),
          contratosList(),
        ]);
        if (cancelled) return;
        setTipos(ts);
        setClientes(cs);
        setProcessos(ps);
        setContratos(cts);

        if (eventoId) {
          const ev = await agendaGet(eventoId);
          if (cancelled) return;
          if (!ev) {
            toast.error("Evento não encontrado");
            onClose();
            return;
          }
          const { date, time } = splitDataHora(ev.data_hora);
          setState({
            titulo: ev.titulo,
            tipo_evento_id: ev.tipo_evento_id,
            date,
            time,
            alerta_dias: String(ev.alerta_dias),
            cliente_id: ev.cliente_id ?? "",
            processo_id: ev.processo_id ?? "",
            contrato_id: ev.contrato_id ?? "",
            status: ev.status,
            descricao: ev.descricao ?? "",
          });
        } else {
          setState({
            ...emptyState(),
            cliente_id: preset?.cliente_id ?? "",
            processo_id: preset?.processo_id ?? "",
            contrato_id: preset?.contrato_id ?? "",
          });
        }
      } catch (e) {
        if (!cancelled) toast.error("Falha ao carregar o formulário", String((e as Error).message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventoId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function changeProcesso(next: string) {
    setState((prev) => {
      if (!next) return { ...prev, processo_id: "" };
      const processo = processos.find((p) => p.id === next);
      const clienteId = processo?.cliente_id ?? prev.cliente_id;

      // Auto-fill the contrato when the processo has exactly one linked contrato;
      // otherwise keep the current one only if it still matches the cliente.
      const linked = contratos.filter((c) => c.processo_id === next);
      let contratoId = prev.contrato_id;
      if (linked.length === 1) {
        contratoId = linked[0].id;
      } else {
        const current = contratos.find((c) => c.id === contratoId);
        if (current && current.cliente_id !== clienteId) contratoId = "";
      }

      return { ...prev, processo_id: next, cliente_id: clienteId, contrato_id: contratoId };
    });
    setErrors((prev) => ({ ...prev, processo_id: undefined, cliente_id: undefined }));
  }

  function changeCliente(next: string) {
    setState((prev) => {
      const processo = processos.find((p) => p.id === prev.processo_id);
      const contrato = contratos.find((c) => c.id === prev.contrato_id);
      return {
        ...prev,
        cliente_id: next,
        processo_id: processo && processo.cliente_id !== next ? "" : prev.processo_id,
        contrato_id: contrato && contrato.cliente_id !== next ? "" : prev.contrato_id,
      };
    });
    setErrors((prev) => ({ ...prev, cliente_id: undefined }));
  }

  const tipoOptions = useMemo<ComboboxOption[]>(
    () =>
      tipos
        .filter((t) => t.ativo === 1 || t.id === state.tipo_evento_id)
        .map((t) => ({
          value: t.id,
          label: t.nome,
          meta: t.ativo === 0 ? "inativo" : undefined,
        })),
    [tipos, state.tipo_evento_id],
  );

  const clienteOptions = useMemo<ComboboxOption[]>(
    () => clientes.map((c) => ({ value: c.id, label: c.nome })),
    [clientes],
  );

  const processoOptions = useMemo<ComboboxOption[]>(
    () =>
      processos
        .filter((p) => !state.cliente_id || p.cliente_id === state.cliente_id)
        .map((p) => ({
          value: p.id,
          label: displayNumeroProcesso(p) ?? "Processo sem número",
          meta: p.cliente_nome,
        })),
    [processos, state.cliente_id],
  );

  const contratoOptions = useMemo<ComboboxOption[]>(
    () =>
      contratos
        .filter((c) => !state.cliente_id || c.cliente_id === state.cliente_id)
        .map((c) => ({ value: c.id, label: `${c.codigo} — ${c.nome}`, meta: c.cliente_nome })),
    [contratos, state.cliente_id],
  );

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!state.titulo.trim()) next.titulo = "Informe um título.";
    if (!state.tipo_evento_id) next.tipo_evento_id = "Selecione o tipo.";
    if (!state.date) next.date = "Informe a data.";
    if (!state.time) next.time = "Informe a hora.";
    const alerta = Number(state.alerta_dias);
    if (!Number.isInteger(alerta) || alerta < 0 || alerta > 365) {
      next.alerta_dias = "Use um número entre 0 e 365.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const input: AgendaEventoInput = {
      titulo: state.titulo.trim(),
      tipo_evento_id: state.tipo_evento_id,
      data_hora: joinDataHora(state.date, state.time),
      cliente_id: state.cliente_id || null,
      processo_id: state.processo_id || null,
      contrato_id: state.contrato_id || null,
      alerta_dias: Number(state.alerta_dias),
      status: state.status,
      descricao: state.descricao.trim() || null,
    };

    setSaving(true);
    try {
      if (isEditing && eventoId) {
        await agendaUpdate(eventoId, input);
        toast.success("Evento atualizado");
      } else {
        await agendaCreate(input);
        toast.success("Evento criado");
      }
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ValidationError) {
        toast.error("Validação", err.message);
        if (err.field) {
          const map: Record<string, keyof FormState> = {
            titulo: "titulo",
            tipo_evento_id: "tipo_evento_id",
            data_hora: "date",
            alerta_dias: "alerta_dias",
            cliente_id: "cliente_id",
            processo_id: "processo_id",
            status: "status",
          };
          const field = map[err.field];
          if (field) setErrors((prev) => ({ ...prev, [field]: err.message }));
        }
      } else {
        toast.error("Erro ao salvar", String((err as Error).message ?? err));
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const lockCliente = Boolean(lockContext && preset?.cliente_id) || Boolean(state.processo_id);
  const lockProcesso = Boolean(lockContext && preset?.processo_id);
  const lockContrato = Boolean(lockContext && preset?.contrato_id);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[1.5rem] bg-[var(--color-surface-muted)] p-1.5 ring-1 ring-[var(--color-hairline)] shadow-ambient max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-[var(--color-surface)] flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-4 px-7 pt-6 pb-4 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                <CalendarPlus weight="light" />
              </span>
              <h3 className="text-[18px] font-medium tracking-tight font-sans">
                {isEditing ? "Editar evento" : "Novo evento"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)] transition-colors [&_svg]:w-4 [&_svg]:h-4"
            >
              <X weight="bold" />
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
              <div className="px-7 py-6 overflow-y-auto flex flex-col gap-4">
                <Field label="Título" required error={errors.titulo}>
                  <Input
                    value={state.titulo}
                    onChange={(e) => set("titulo", e.target.value)}
                    placeholder="Ex.: Audiência de instrução e julgamento"
                    invalid={!!errors.titulo}
                    autoFocus
                  />
                </Field>

                <Field label="Tipo de evento" required error={errors.tipo_evento_id}>
                  <Combobox
                    value={state.tipo_evento_id}
                    onChange={(v) => set("tipo_evento_id", v)}
                    options={tipoOptions}
                    placeholder="Selecione o tipo"
                    emptyMessage="Nenhum tipo cadastrado — veja Configurações"
                    invalid={!!errors.tipo_evento_id}
                  />
                </Field>

                <div className="grid grid-cols-12 gap-4">
                  <Field label="Data" required error={errors.date} className="col-span-5">
                    <Input
                      type="date"
                      value={state.date}
                      onChange={(e) => set("date", e.target.value)}
                      invalid={!!errors.date}
                    />
                  </Field>
                  <Field label="Hora" required error={errors.time} className="col-span-3">
                    <Input
                      type="time"
                      value={state.time}
                      onChange={(e) => set("time", e.target.value)}
                      invalid={!!errors.time}
                    />
                  </Field>
                  <Field
                    label="Alerta (dias antes)"
                    error={errors.alerta_dias}
                    hint={errors.alerta_dias ? undefined : "0–365"}
                    className="col-span-4"
                  >
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      step={1}
                      value={state.alerta_dias}
                      onChange={(e) => set("alerta_dias", e.target.value)}
                      invalid={!!errors.alerta_dias}
                    />
                  </Field>
                </div>

                <div className="border-t border-[var(--color-hairline)] pt-4">
                  <div className="eyebrow mb-3">Vínculos (opcionais)</div>
                  <div className="flex flex-col gap-4">
                    <Field
                      label="Processo"
                      hint={state.processo_id ? "O cliente é definido pelo processo." : undefined}
                    >
                      <Combobox
                        value={state.processo_id}
                        onChange={changeProcesso}
                        options={processoOptions}
                        placeholder="Vincular a um processo"
                        emptyMessage="Nenhum processo disponível"
                        disabled={lockProcesso}
                        allowClear
                      />
                    </Field>
                    <Field label="Cliente" error={errors.cliente_id}>
                      <Combobox
                        value={state.cliente_id}
                        onChange={changeCliente}
                        options={clienteOptions}
                        placeholder="Vincular a um cliente"
                        emptyMessage="Nenhum cliente encontrado"
                        disabled={lockCliente}
                        invalid={!!errors.cliente_id}
                        allowClear
                      />
                    </Field>
                    <Field label="Contrato">
                      <Combobox
                        value={state.contrato_id}
                        onChange={(v) => set("contrato_id", v)}
                        options={contratoOptions}
                        placeholder="Vincular a um contrato"
                        emptyMessage="Nenhum contrato disponível"
                        disabled={lockContrato}
                        allowClear
                      />
                    </Field>
                  </div>
                </div>

                {isEditing && (
                  <Field label="Status">
                    <Combobox
                      value={state.status}
                      onChange={(v) => set("status", (v || "pendente") as StatusEvento)}
                      options={STATUS_OPTIONS}
                      placeholder="Status do evento"
                    />
                  </Field>
                )}

                <Field label="Descrição">
                  <Textarea
                    value={state.descricao}
                    onChange={(e) => set("descricao", e.target.value)}
                    placeholder="Notas, local, partes envolvidas…"
                  />
                </Field>
              </div>

              <div className="px-7 py-4 border-t border-[var(--color-hairline)] flex items-center justify-end gap-2.5">
                <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={saving}
                  icon={<FloppyDisk weight="light" />}
                >
                  {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar evento"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
