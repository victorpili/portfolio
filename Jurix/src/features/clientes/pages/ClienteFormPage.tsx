import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CaretRight, FloppyDisk, Plus, Trash } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Field, Input, Textarea } from "../../../components/ui/Input";
import { Combobox, type ComboboxOption } from "../../../components/ui/Combobox";
import { useToast } from "../../../components/ui/Toast";
import {
  isValidCPF,
  isValidCNPJ,
  maskCEP,
  maskCNPJ,
  maskCPF,
  maskPhone,
  onlyDigits,
} from "../../../lib/format/documents";
import { cn } from "../../../lib/cn";
import { ConflictError, ValidationError } from "../../../lib/errors";
import { lookupList, type LookupRow } from "../../cadastros/api";
import {
  clientesCreate,
  clientesGet,
  clientesList,
  clientesUpdate,
  inscricoesEstaduaisList,
  inscricoesEstaduaisSync,
} from "../api";
import type {
  Cliente,
  ClienteInput,
  InscricaoEstadualDraft,
  TipoCliente,
  TipoUnidade,
} from "../types";

const UFS: { value: string; label: string }[] = [
  { value: "AC", label: "AC — Acre" },
  { value: "AL", label: "AL — Alagoas" },
  { value: "AM", label: "AM — Amazonas" },
  { value: "AP", label: "AP — Amapá" },
  { value: "BA", label: "BA — Bahia" },
  { value: "CE", label: "CE — Ceará" },
  { value: "DF", label: "DF — Distrito Federal" },
  { value: "ES", label: "ES — Espírito Santo" },
  { value: "GO", label: "GO — Goiás" },
  { value: "MA", label: "MA — Maranhão" },
  { value: "MG", label: "MG — Minas Gerais" },
  { value: "MS", label: "MS — Mato Grosso do Sul" },
  { value: "MT", label: "MT — Mato Grosso" },
  { value: "PA", label: "PA — Pará" },
  { value: "PB", label: "PB — Paraíba" },
  { value: "PE", label: "PE — Pernambuco" },
  { value: "PI", label: "PI — Piauí" },
  { value: "PR", label: "PR — Paraná" },
  { value: "RJ", label: "RJ — Rio de Janeiro" },
  { value: "RN", label: "RN — Rio Grande do Norte" },
  { value: "RO", label: "RO — Rondônia" },
  { value: "RR", label: "RR — Roraima" },
  { value: "RS", label: "RS — Rio Grande do Sul" },
  { value: "SC", label: "SC — Santa Catarina" },
  { value: "SE", label: "SE — Sergipe" },
  { value: "SP", label: "SP — São Paulo" },
  { value: "TO", label: "TO — Tocantins" },
];

interface FormState {
  tipo: TipoCliente;
  nome: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  cnpj: string;
  data_fundacao: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  origem_id: string;
  status_relacionamento: "ativo" | "inativo";
  observacoes: string;
  // PJ-only
  tipo_unidade: TipoUnidade;
  matriz_id: string;
  inscricoes: InscricaoEstadualDraft[];
}

const emptyState: FormState = {
  tipo: "pf",
  nome: "",
  cpf: "",
  rg: "",
  data_nascimento: "",
  cnpj: "",
  data_fundacao: "",
  email: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  origem_id: "",
  status_relacionamento: "ativo",
  observacoes: "",
  tipo_unidade: "matriz",
  matriz_id: "",
  inscricoes: [],
};

function fromCliente(c: Cliente): FormState {
  return {
    tipo: c.tipo,
    nome: c.nome,
    cpf: c.cpf ? maskCPF(c.cpf) : "",
    rg: c.rg ?? "",
    data_nascimento: c.data_nascimento ?? "",
    cnpj: c.cnpj ? maskCNPJ(c.cnpj) : "",
    data_fundacao: c.data_fundacao ?? "",
    email: c.email ?? "",
    telefone: c.telefone ? maskPhone(c.telefone) : "",
    cep: c.cep ? maskCEP(c.cep) : "",
    logradouro: c.logradouro ?? "",
    numero: c.numero ?? "",
    complemento: c.complemento ?? "",
    bairro: c.bairro ?? "",
    cidade: c.cidade ?? "",
    estado: c.estado ?? "",
    origem_id: c.origem_id ?? "",
    status_relacionamento: c.status_relacionamento,
    observacoes: c.observacoes ?? "",
    // Old PJ rows have NULL tipo_unidade — treat as matriz.
    tipo_unidade: c.tipo_unidade ?? "matriz",
    matriz_id: c.matriz_id ?? "",
    inscricoes: [],
  };
}

function toInput(state: FormState): ClienteInput {
  const isPF = state.tipo === "pf";
  return {
    tipo: state.tipo,
    nome: state.nome.trim(),
    cpf: isPF ? (state.cpf ? onlyDigits(state.cpf) : null) : null,
    rg: isPF ? (state.rg.trim() || null) : null,
    data_nascimento: isPF ? (state.data_nascimento || null) : null,
    cnpj: !isPF ? (state.cnpj ? onlyDigits(state.cnpj) : null) : null,
    data_fundacao: !isPF ? (state.data_fundacao || null) : null,
    email: state.email.trim() || null,
    telefone: state.telefone ? onlyDigits(state.telefone) : null,
    cep: state.cep ? onlyDigits(state.cep) : null,
    logradouro: state.logradouro.trim() || null,
    numero: state.numero.trim() || null,
    complemento: state.complemento.trim() || null,
    bairro: state.bairro.trim() || null,
    cidade: state.cidade.trim() || null,
    estado: state.estado || null,
    origem_id: state.origem_id || null,
    status_relacionamento: state.status_relacionamento,
    observacoes: state.observacoes.trim() || null,
    tipo_unidade: isPF ? null : state.tipo_unidade,
    matriz_id: !isPF && state.tipo_unidade === "filial" ? (state.matriz_id || null) : null,
  };
}

export function ClienteFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [state, setState] = useState<FormState>(emptyState);
  const [origens, setOrigens] = useState<LookupRow[]>([]);
  const [allClientes, setAllClientes] = useState<Cliente[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    (async () => {
      try {
        const [origensList, clientesAll] = await Promise.all([
          lookupList("origens"),
          clientesList({ status_relacionamento: "all" }),
        ]);
        setOrigens(origensList);
        setAllClientes(clientesAll);
      } catch (e) {
        toast.error("Falha ao carregar dados do formulário", String((e as Error).message ?? e));
      }
      if (isEditing && id) {
        try {
          const c = await clientesGet(id);
          if (!c) {
            toast.error("Cliente não encontrado");
            navigate("/clientes");
            return;
          }
          const base = fromCliente(c);
          if (c.tipo === "pj") {
            const insc = await inscricoesEstaduaisList(c.id);
            base.inscricoes = insc.map((i) => ({ estado: i.estado, inscricao: i.inscricao }));
          }
          setState(base);
        } catch (e) {
          toast.error("Falha ao carregar cliente", String((e as Error).message ?? e));
        }
      }
      setLoadingInitial(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const availableOrigens = useMemo(
    () => origens.filter((o) => o.ativo === 1 || o.id === state.origem_id),
    [origens, state.origem_id],
  );

  // Eligible matrizes: PJ clients that are not filiais themselves, excluding self.
  const matrizOptions = useMemo<ComboboxOption[]>(
    () =>
      allClientes
        .filter((c) => c.tipo === "pj" && c.tipo_unidade !== "filial" && c.id !== id)
        .map((c) => ({ value: c.id, label: c.nome })),
    [allClientes, id],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  function switchTipo(newTipo: TipoCliente) {
    setState((prev) => ({
      ...prev,
      tipo: newTipo,
      cpf: newTipo === "pf" ? prev.cpf : "",
      rg: newTipo === "pf" ? prev.rg : "",
      data_nascimento: newTipo === "pf" ? prev.data_nascimento : "",
      cnpj: newTipo === "pj" ? prev.cnpj : "",
      data_fundacao: newTipo === "pj" ? prev.data_fundacao : "",
      // PJ-only data is reset when switching to PF.
      tipo_unidade: newTipo === "pj" ? prev.tipo_unidade : "matriz",
      matriz_id: newTipo === "pj" ? prev.matriz_id : "",
      inscricoes: newTipo === "pj" ? prev.inscricoes : [],
    }));
    setErrors({});
  }

  function switchUnidade(next: TipoUnidade) {
    setState((prev) => ({
      ...prev,
      tipo_unidade: next,
      matriz_id: next === "filial" ? prev.matriz_id : "",
    }));
    setErrors((prev) => ({ ...prev, tipo_unidade: undefined, matriz_id: undefined }));
  }

  // ── Inscrições estaduais helpers ─────────────────────────────────────
  function addInscricao() {
    setState((prev) => ({
      ...prev,
      inscricoes: [...prev.inscricoes, { estado: "", inscricao: "" }],
    }));
  }
  function updateInscricao(idx: number, patch: Partial<InscricaoEstadualDraft>) {
    setState((prev) => ({
      ...prev,
      inscricoes: prev.inscricoes.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }));
    if (errors.inscricoes) setErrors((prev) => ({ ...prev, inscricoes: undefined }));
  }
  function removeInscricao(idx: number) {
    setState((prev) => ({
      ...prev,
      inscricoes: prev.inscricoes.filter((_, i) => i !== idx),
    }));
    if (errors.inscricoes) setErrors((prev) => ({ ...prev, inscricoes: undefined }));
  }
  function ufOptionsForRow(idx: number): { value: string; label: string }[] {
    const usedElsewhere = new Set(
      state.inscricoes.filter((_, i) => i !== idx).map((r) => r.estado).filter(Boolean),
    );
    return UFS.filter((uf) => !usedElsewhere.has(uf.value));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!state.nome.trim()) next.nome = "Informe o nome.";

    if (state.tipo === "pf") {
      if (state.cpf && onlyDigits(state.cpf).length !== 11) {
        next.cpf = "CPF deve ter 11 dígitos.";
      } else if (state.cpf && !isValidCPF(state.cpf)) {
        next.cpf = "CPF inválido (dígitos verificadores).";
      }
    } else {
      if (state.cnpj && onlyDigits(state.cnpj).length !== 14) {
        next.cnpj = "CNPJ deve ter 14 dígitos.";
      } else if (state.cnpj && !isValidCNPJ(state.cnpj)) {
        next.cnpj = "CNPJ inválido (dígitos verificadores).";
      }
      if (state.tipo_unidade === "filial" && !state.matriz_id) {
        next.matriz_id = "Selecione a matriz desta filial.";
      }
      // Inscrições estaduais
      const seen = new Set<string>();
      for (const row of state.inscricoes) {
        const estado = row.estado.trim();
        const inscricao = row.inscricao.trim();
        if (!estado && !inscricao) continue; // fully blank rows are dropped on save
        if (!estado) {
          next.inscricoes = "Selecione o estado em todas as inscrições estaduais.";
          break;
        }
        if (!inscricao) {
          next.inscricoes = "Preencha o número em todas as inscrições estaduais.";
          break;
        }
        if (seen.has(estado)) {
          next.inscricoes = `Há mais de uma inscrição estadual para ${estado}.`;
          break;
        }
        seen.add(estado);
      }
    }

    if (state.email && !/^\S+@\S+\.\S+$/.test(state.email)) {
      next.email = "Email inválido.";
    }
    if (state.cep && onlyDigits(state.cep).length !== 8) {
      next.cep = "CEP deve ter 8 dígitos.";
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
      const inscricoes = state.tipo === "pj" ? state.inscricoes : [];
      if (isEditing && id) {
        await clientesUpdate(id, input);
        await inscricoesEstaduaisSync(id, inscricoes);
        toast.success("Cliente atualizado");
        navigate(`/clientes/${id}`);
      } else {
        const created = await clientesCreate(input);
        await inscricoesEstaduaisSync(created.id, inscricoes);
        toast.success("Cliente criado");
        navigate(`/clientes/${created.id}`);
      }
    } catch (e) {
      if (e instanceof ConflictError) {
        toast.error("Conflito", e.message);
        setErrors((prev) => ({ ...prev, [state.tipo === "pf" ? "cpf" : "cnpj"]: e.message }));
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

  if (loadingInitial) {
    return (
      <div className="py-20 text-center text-[var(--color-ink-muted)]">Carregando cliente…</div>
    );
  }

  const isPJ = state.tipo === "pj";

  return (
    <form onSubmit={handleSubmit}>
      <PageHeader
        eyebrow={isEditing ? "Editando" : "Novo cadastro"}
        title={isEditing ? state.nome || "Cliente" : "Novo cliente"}
        description={
          isEditing
            ? "Atualize os dados do cadastro. Documentos com formatação só são salvos como dígitos."
            : "Pessoas físicas e jurídicas. Os campos visíveis mudam conforme o tipo selecionado."
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
              {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar cliente"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-7">
        {/* Tipo selector */}
        <Card className="col-span-12">
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="eyebrow mb-2">Tipo de cliente</div>
              <p className="text-[13.5px] text-[var(--color-ink-muted)] leading-relaxed">
                Os campos específicos de PF e PJ aparecem conforme o tipo selecionado.
              </p>
            </div>
            <PillToggle
              value={state.tipo}
              onChange={switchTipo}
              options={[
                { value: "pf", label: "Pessoa Física" },
                { value: "pj", label: "Pessoa Jurídica" },
              ]}
            />
          </div>
        </Card>

        {/* Identification */}
        <Card className="col-span-12 lg:col-span-7">
          <div className="eyebrow mb-5">Identificação</div>
          <div className="grid grid-cols-12 gap-4">
            <Field
              label={isPJ ? "Razão social" : "Nome completo"}
              required
              error={errors.nome}
              className="col-span-12"
            >
              <Input
                value={state.nome}
                onChange={(e) => set("nome", e.target.value)}
                invalid={Boolean(errors.nome)}
                autoFocus
              />
            </Field>

            {!isPJ ? (
              <>
                <Field label="CPF" error={errors.cpf} className="col-span-6">
                  <Input
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={state.cpf}
                    onChange={(e) => set("cpf", maskCPF(e.target.value))}
                    invalid={Boolean(errors.cpf)}
                  />
                </Field>
                <Field label="RG" className="col-span-6">
                  <Input value={state.rg} onChange={(e) => set("rg", e.target.value)} />
                </Field>
                <Field label="Data de nascimento" className="col-span-6">
                  <Input
                    type="date"
                    value={state.data_nascimento}
                    onChange={(e) => set("data_nascimento", e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="CNPJ" error={errors.cnpj} className="col-span-6">
                  <Input
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    value={state.cnpj}
                    onChange={(e) => set("cnpj", maskCNPJ(e.target.value))}
                    invalid={Boolean(errors.cnpj)}
                  />
                </Field>
                <Field label="Data de fundação" className="col-span-6">
                  <Input
                    type="date"
                    value={state.data_fundacao}
                    onChange={(e) => set("data_fundacao", e.target.value)}
                  />
                </Field>

                {/* Matriz / Filial */}
                <div className="col-span-12 flex items-center justify-between gap-4 flex-wrap pt-1">
                  <div>
                    <div className="text-[12.5px] font-medium text-[var(--color-ink-soft)]">
                      Unidade
                    </div>
                    <p className="text-[12px] text-[var(--color-ink-muted)] mt-0.5">
                      Indique se esta empresa é a matriz ou uma filial.
                    </p>
                  </div>
                  <PillToggle
                    value={state.tipo_unidade}
                    onChange={switchUnidade}
                    options={[
                      { value: "matriz", label: "Matriz" },
                      { value: "filial", label: "Filial" },
                    ]}
                  />
                </div>

                {state.tipo_unidade === "filial" && (
                  <Field
                    label="Matriz"
                    required
                    error={errors.matriz_id}
                    hint={
                      matrizOptions.length === 0
                        ? "Nenhuma matriz PJ disponível. Cadastre a matriz primeiro."
                        : undefined
                    }
                    className="col-span-12"
                  >
                    <Combobox
                      value={state.matriz_id}
                      onChange={(v) => set("matriz_id", v)}
                      options={matrizOptions}
                      placeholder="Digite para buscar a matriz"
                      emptyMessage="Nenhuma matriz encontrada"
                      invalid={Boolean(errors.matriz_id)}
                      allowClear
                    />
                  </Field>
                )}
              </>
            )}

            <Field label="Origem" className="col-span-6">
              <Combobox
                value={state.origem_id}
                onChange={(v) => set("origem_id", v)}
                options={availableOrigens.map((o) => ({
                  value: o.id,
                  label: o.nome,
                  meta: o.ativo === 0 ? "inativo" : undefined,
                }))}
                placeholder="Digite para buscar uma origem"
                emptyMessage="Nenhuma origem corresponde"
                allowClear
              />
            </Field>

            <Field label="Status do relacionamento" className="col-span-6">
              <Combobox
                value={state.status_relacionamento}
                onChange={(v) =>
                  set("status_relacionamento", (v || "ativo") as "ativo" | "inativo")
                }
                options={[
                  { value: "ativo", label: "Ativo" },
                  { value: "inativo", label: "Inativo" },
                ]}
                placeholder="Selecione"
              />
            </Field>
          </div>
        </Card>

        {/* Contact */}
        <Card className="col-span-12 lg:col-span-5">
          <div className="eyebrow mb-5">Contato</div>
          <div className="flex flex-col gap-4">
            <Field label="Email" error={errors.email}>
              <Input
                type="email"
                placeholder="cliente@exemplo.com"
                value={state.email}
                onChange={(e) => set("email", e.target.value)}
                invalid={Boolean(errors.email)}
              />
            </Field>
            <Field label="Telefone">
              <Input
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={state.telefone}
                onChange={(e) => set("telefone", maskPhone(e.target.value))}
              />
            </Field>
          </div>
        </Card>

        {/* Inscrições Estaduais — PJ only */}
        {isPJ && (
          <Card className="col-span-12">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="eyebrow mb-1.5">Inscrições Estaduais</div>
                <h3 className="text-[15px] font-medium font-sans tracking-tight">
                  Uma inscrição por estado
                </h3>
              </div>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                icon={<Plus weight="bold" />}
                onClick={addInscricao}
              >
                Adicionar inscrição
              </Button>
            </div>

            {errors.inscricoes && (
              <div className="mb-3 text-[12.5px] text-[var(--color-critical)]">
                {errors.inscricoes}
              </div>
            )}

            {state.inscricoes.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-muted)] py-2">
                Nenhuma inscrição estadual cadastrada. Use o botão acima para incluir.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {state.inscricoes.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-12 sm:col-span-4">
                      <Combobox
                        value={row.estado}
                        onChange={(v) => updateInscricao(idx, { estado: v })}
                        options={ufOptionsForRow(idx)}
                        placeholder="Estado"
                        emptyMessage="UF não encontrada"
                      />
                    </div>
                    <div className="col-span-11 sm:col-span-7">
                      <Input
                        value={row.inscricao}
                        onChange={(e) => updateInscricao(idx, { inscricao: e.target.value })}
                        placeholder="Número da inscrição estadual"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={<Trash weight="light" />}
                        onClick={() => removeInscricao(idx)}
                        aria-label="Remover inscrição"
                        className="!h-9 !w-9 !px-0 !min-w-0 hover:!text-[var(--color-critical)]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Address */}
        <Card className="col-span-12">
          <div className="eyebrow mb-5">Endereço</div>
          <div className="grid grid-cols-12 gap-4">
            <Field label="CEP" error={errors.cep} className="col-span-3">
              <Input
                inputMode="numeric"
                placeholder="00000-000"
                value={state.cep}
                onChange={(e) => set("cep", maskCEP(e.target.value))}
                invalid={Boolean(errors.cep)}
              />
            </Field>
            <Field label="Logradouro" className="col-span-7">
              <Input value={state.logradouro} onChange={(e) => set("logradouro", e.target.value)} />
            </Field>
            <Field label="Número" className="col-span-2">
              <Input value={state.numero} onChange={(e) => set("numero", e.target.value)} />
            </Field>

            <Field label="Complemento" className="col-span-4">
              <Input value={state.complemento} onChange={(e) => set("complemento", e.target.value)} />
            </Field>
            <Field label="Bairro" className="col-span-4">
              <Input value={state.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </Field>
            <Field label="Cidade" className="col-span-3">
              <Input value={state.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </Field>
            <Field label="UF" className="col-span-1">
              <Combobox
                value={state.estado}
                onChange={(v) => set("estado", v)}
                options={UFS}
                placeholder="—"
                emptyMessage="Não encontrado"
                allowClear
              />
            </Field>
          </div>
        </Card>

        {/* Notes */}
        <Card className="col-span-12">
          <div className="eyebrow mb-5">Observações</div>
          <Textarea
            rows={4}
            value={state.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
            placeholder="Informações relevantes — preferências de contato, contexto da relação, etc."
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
            {saving ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar cliente"}
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
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-muted)] p-0.5 ring-1 ring-inset ring-[var(--color-hairline)] shrink-0">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-5 py-1.5 rounded-full text-[12.5px] font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
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
