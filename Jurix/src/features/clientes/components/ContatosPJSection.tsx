import { useEffect, useState } from "react";
import { Plus, PencilSimple, Trash, UserCircleGear } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Field, Input, Textarea } from "../../../components/ui/Input";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { EmptyState } from "../../../components/ui/EmptyState";
import { maskPhone, formatPhone } from "../../../lib/format/documents";
import { contatosPjCreate, contatosPjDelete, contatosPjList, contatosPjUpdate } from "../api";
import type { ContatoPJ } from "../types";

export function ContatosPJSection({ clienteId }: { clienteId: string }) {
  const toast = useToast();
  const [contatos, setContatos] = useState<ContatoPJ[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContatoPJ | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContatoPJ | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setContatos(await contatosPjList(clienteId));
    } catch (e) {
      toast.error("Falha ao carregar contatos", String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const handleSave = async (data: Omit<ContatoPJ, "id" | "criado_em">) => {
    try {
      if (editing) {
        await contatosPjUpdate(editing.id, data);
        toast.success("Contato atualizado");
      } else {
        await contatosPjCreate(data);
        toast.success("Contato adicionado");
      }
      setEditing(null);
      setCreating(false);
      await load();
    } catch (e) {
      toast.error("Erro ao salvar contato", String((e as Error).message ?? e));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await contatosPjDelete(deleteTarget.id);
      toast.success("Contato removido");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error("Erro ao remover", String((e as Error).message ?? e));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1.5">Contatos</div>
          <h3 className="text-[16px] font-medium font-sans tracking-tight">Pessoas de contato na empresa</h3>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus weight="bold" />}
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          Adicionar contato
        </Button>
      </div>

      {creating || editing ? (
        <ContatoForm
          initial={editing}
          clienteId={clienteId}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={handleSave}
        />
      ) : null}

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
      ) : contatos.length === 0 ? (
        <EmptyState
          icon={<UserCircleGear weight="light" />}
          title="Sem contatos cadastrados"
          description="Adicione diretores, sócios ou interlocutores responsáveis pela relação com este cliente."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-hairline)] -mx-1">
          {contatos.map((c) => (
            <li key={c.id} className="px-1 py-3.5 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-medium text-[var(--color-ink)]">{c.nome}</span>
                  {c.cargo && (
                    <span className="text-[12.5px] text-[var(--color-ink-muted)]">· {c.cargo}</span>
                  )}
                </div>
                <div className="text-[12.5px] text-[var(--color-ink-muted)] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {c.email && <span>{c.email}</span>}
                  {c.telefone && <span>{formatPhone(c.telefone)}</span>}
                </div>
                {c.observacoes && (
                  <p className="text-[12.5px] text-[var(--color-ink-soft)] mt-1.5 leading-relaxed">
                    {c.observacoes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PencilSimple weight="light" />}
                  onClick={() => {
                    setEditing(c);
                    setCreating(false);
                  }}
                  aria-label="Editar"
                  className="!h-8 !w-8 !px-0 !min-w-0"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash weight="light" />}
                  onClick={() => setDeleteTarget(c)}
                  aria-label="Remover"
                  className="!h-8 !w-8 !px-0 !min-w-0 hover:!text-[var(--color-critical)]"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remover contato?"
        description={
          deleteTarget ? (
            <span>
              Esta ação removerá <strong>{deleteTarget.nome}</strong> dos contatos deste cliente.
              Ela não afeta processos, contratos ou lançamentos.
            </span>
          ) : null
        }
        confirmLabel="Remover"
        tone="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

interface ContatoFormProps {
  initial: ContatoPJ | null;
  clienteId: string;
  onCancel: () => void;
  onSave: (data: Omit<ContatoPJ, "id" | "criado_em">) => void | Promise<void>;
}

function ContatoForm({ initial, clienteId, onCancel, onSave }: ContatoFormProps) {
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [cargo, setCargo] = useState(initial?.cargo ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ? maskPhone(initial.telefone) : "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [nomeError, setNomeError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setNomeError("Informe o nome.");
      return;
    }
    await onSave({
      cliente_id: clienteId,
      nome: nome.trim(),
      cargo: cargo.trim() || null,
      email: email.trim() || null,
      telefone: telefone || null,
      observacoes: observacoes.trim() || null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-[1rem] bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] p-5"
    >
      <div className="grid grid-cols-12 gap-4">
        <Field label="Nome" required error={nomeError} className="col-span-7">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
              if (nomeError) setNomeError(null);
            }}
            invalid={Boolean(nomeError)}
          />
        </Field>
        <Field label="Cargo" className="col-span-5">
          <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Diretor Financeiro" />
        </Field>
        <Field label="Email" className="col-span-7">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Telefone" className="col-span-5">
          <Input
            inputMode="tel"
            value={telefone}
            onChange={(e) => setTelefone(maskPhone(e.target.value))}
          />
        </Field>
        <Field label="Observações" className="col-span-12">
          <Textarea
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Notas internas sobre esta pessoa"
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" type="submit">
          {initial ? "Salvar contato" : "Adicionar contato"}
        </Button>
      </div>
    </form>
  );
}
