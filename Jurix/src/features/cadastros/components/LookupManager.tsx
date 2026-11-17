import { useEffect, useRef, useState } from "react";
import { Check, PencilSimple, Plus, Trash, X, Tag, Prohibit } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { Badge } from "../../../components/ui/Badge";
import { cn } from "../../../lib/cn";
import { ConflictError, DeleteBlockedError, ValidationError } from "../../../lib/errors";
import {
  lookupCreate,
  lookupDelete,
  lookupList,
  lookupToggleAtivo,
  lookupUpdate,
  type LookupRow,
  type LookupTable,
} from "../api";

interface LookupManagerProps {
  table: LookupTable;
  /** Singular noun for the "Adicionar" placeholder, e.g. "área do direito". */
  itemNoun: string;
}

export function LookupManager({ table, itemNoun }: LookupManagerProps) {
  const toast = useToast();
  const [rows, setRows] = useState<LookupRow[] | null>(null);

  const [newNome, setNewNome] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LookupRow | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setRows(await lookupList(table));
    } catch (e) {
      toast.error("Falha ao carregar", String((e as Error).message ?? e));
      setRows([]);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const handleAdd = async () => {
    const nome = newNome.trim();
    if (!nome) {
      setAddError("Informe um nome.");
      return;
    }
    setAdding(true);
    try {
      await lookupCreate(table, nome);
      setNewNome("");
      setAddError(null);
      toast.success("Item adicionado");
      await refresh();
    } catch (e) {
      if (e instanceof ConflictError || e instanceof ValidationError) {
        setAddError(e.message);
      } else {
        toast.error("Falha ao adicionar", String((e as Error).message ?? e));
      }
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (row: LookupRow) => {
    setEditingId(row.id);
    setEditNome(row.nome);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNome("");
    setEditError(null);
  };

  const saveEdit = async (row: LookupRow) => {
    const nome = editNome.trim();
    if (!nome) {
      setEditError("Informe um nome.");
      return;
    }
    if (nome === row.nome) {
      cancelEdit();
      return;
    }
    try {
      await lookupUpdate(table, row.id, nome);
      cancelEdit();
      toast.success("Item atualizado");
      await refresh();
    } catch (e) {
      if (e instanceof ConflictError || e instanceof ValidationError) {
        setEditError(e.message);
      } else {
        toast.error("Falha ao atualizar", String((e as Error).message ?? e));
      }
    }
  };

  const toggleAtivo = async (row: LookupRow) => {
    try {
      await lookupToggleAtivo(table, row.id);
      await refresh();
    } catch (e) {
      toast.error("Falha ao alterar status", String((e as Error).message ?? e));
    }
  };

  const confirmDelete = async () => {
    const row = deleteTarget;
    if (!row) return;
    try {
      await lookupDelete(table, row.id);
      toast.success("Item excluído");
      await refresh();
    } catch (e) {
      if (e instanceof DeleteBlockedError) {
        setBlockedMessage(e.message);
      } else {
        toast.error("Falha ao excluir", String((e as Error).message ?? e));
      }
    }
  };

  return (
    <div>
      {/* Adicionar */}
      <div className="flex items-start gap-3 mb-6">
        <div className="flex-1">
          <Input
            value={newNome}
            onChange={(e) => {
              setNewNome(e.target.value);
              if (addError) setAddError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder={`Adicionar ${itemNoun}…`}
            invalid={!!addError}
            aria-label={`Nova ${itemNoun}`}
          />
          {addError && (
            <p className="text-[12px] text-[var(--color-critical)] mt-1.5">{addError}</p>
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          icon={<Plus weight="bold" />}
          onClick={handleAdd}
          disabled={adding}
        >
          Adicionar
        </Button>
      </div>

      {/* Lista */}
      {rows === null ? (
        <div className="py-16 text-center text-[var(--color-ink-muted)] text-sm">Carregando…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Tag weight="light" />}
          title="Nenhum item cadastrado"
          description={`Use o campo acima para adicionar a primeira ${itemNoun}.`}
        />
      ) : (
        <ul className="rounded-[1rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
          {rows.map((row) => (
            <LookupRowItem
              key={row.id}
              row={row}
              editing={editingId === row.id}
              editNome={editNome}
              editError={editError}
              onEditNomeChange={(v) => {
                setEditNome(v);
                if (editError) setEditError(null);
              }}
              onStartEdit={() => startEdit(row)}
              onCancelEdit={cancelEdit}
              onSaveEdit={() => saveEdit(row)}
              onToggleAtivo={() => toggleAtivo(row)}
              onDelete={() => setDeleteTarget(row)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir item"
        description={
          <>
            Tem certeza que deseja excluir{" "}
            <strong className="text-[var(--color-ink)]">{deleteTarget?.nome}</strong>? Esta ação não
            pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <BlockedDialog message={blockedMessage} onClose={() => setBlockedMessage(null)} />
    </div>
  );
}

interface LookupRowItemProps {
  row: LookupRow;
  editing: boolean;
  editNome: string;
  editError: string | null;
  onEditNomeChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggleAtivo: () => void;
  onDelete: () => void;
}

function LookupRowItem({
  row,
  editing,
  editNome,
  editError,
  onEditNomeChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleAtivo,
  onDelete,
}: LookupRowItemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ativo = row.ativo === 1;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-hairline)] last:border-b-0 bg-[var(--color-surface)]">
      {editing ? (
        <div className="flex-1">
          <Input
            ref={inputRef}
            value={editNome}
            onChange={(e) => onEditNomeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSaveEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            invalid={!!editError}
            className="!py-1.5"
            aria-label="Editar nome"
          />
          {editError && (
            <p className="text-[12px] text-[var(--color-critical)] mt-1">{editError}</p>
          )}
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          <span
            className={cn(
              "text-[14px] truncate",
              ativo ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]",
            )}
          >
            {row.nome}
          </span>
          {!ativo && <Badge tone="neutral">inativo</Badge>}
        </div>
      )}

      {editing ? (
        <div className="flex items-center gap-1 shrink-0">
          <IconButton label="Salvar" onClick={onSaveEdit} tone="accent">
            <Check weight="bold" />
          </IconButton>
          <IconButton label="Cancelar" onClick={onCancelEdit}>
            <X weight="bold" />
          </IconButton>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={ativo}
            onChange={onToggleAtivo}
            label={ativo ? `Desativar ${row.nome}` : `Ativar ${row.nome}`}
          />
          <IconButton label={`Editar ${row.nome}`} onClick={onStartEdit}>
            <PencilSimple weight="light" />
          </IconButton>
          <IconButton label={`Excluir ${row.nome}`} onClick={onDelete} tone="danger">
            <Trash weight="light" />
          </IconButton>
        </div>
      )}
    </li>
  );
}

function IconButton({
  children,
  label,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger" | "accent";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "w-8 h-8 rounded-full inline-flex items-center justify-center transition-colors duration-200",
        "[&_svg]:w-[16px] [&_svg]:h-[16px]",
        tone === "danger"
          ? "text-[var(--color-ink-subtle)] hover:bg-[var(--color-critical-soft)] hover:text-[var(--color-critical)]"
          : tone === "accent"
            ? "text-[var(--color-canvas)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]"
            : "text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
      )}
    >
      {children}
    </button>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full mr-1",
        "transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)]",
        checked
          ? "bg-[var(--color-accent)]"
          : "bg-[var(--color-surface-sunken)] ring-1 ring-inset ring-[var(--color-hairline-strong)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm",
          "transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

function BlockedDialog({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[1.5rem] bg-[var(--color-surface-muted)] p-1.5 ring-1 ring-[var(--color-hairline)] shadow-ambient"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-[var(--color-surface)] p-7">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-9 h-9 rounded-full bg-[var(--color-warning-soft)] text-[var(--color-warning)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
              <Prohibit weight="light" />
            </span>
            <h3 className="text-[18px] font-medium tracking-tight font-sans">
              Não é possível excluir
            </h3>
          </div>
          <p className="text-[14px] text-[var(--color-ink-muted)] leading-relaxed">{message}</p>
          <div className="mt-6 flex items-center justify-end">
            <Button variant="primary" size="sm" onClick={onClose}>
              Entendi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
