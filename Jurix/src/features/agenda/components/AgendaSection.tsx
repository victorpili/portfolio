import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarBlank, Plus } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { cn } from "../../../lib/cn";
import { agendaDelete, agendaListByEntity, agendaSetStatus } from "../api";
import type { AgendaEventoRow, StatusEvento } from "../types";
import { EventoFormDialog } from "./EventoFormDialog";
import { EventoListItem } from "./EventoListItem";

export type AgendaContext =
  | { kind: "cliente"; clienteId: string }
  | { kind: "processo"; processoId: string; clienteId: string }
  | { kind: "contrato"; contratoId: string; clienteId: string };

export function AgendaSection({ context }: { context: AgendaContext }) {
  const toast = useToast();
  const [rows, setRows] = useState<AgendaEventoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgendaEventoRow | null>(null);

  const entityId =
    context.kind === "cliente"
      ? context.clienteId
      : context.kind === "processo"
        ? context.processoId
        : context.contratoId;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await agendaListByEntity(context.kind, entityId));
    } catch (e) {
      toast.error("Falha ao carregar a agenda", String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }, [context.kind, entityId, toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const preset = useMemo(() => {
    if (context.kind === "cliente") return { cliente_id: context.clienteId };
    if (context.kind === "processo")
      return { processo_id: context.processoId, cliente_id: context.clienteId };
    return { contrato_id: context.contratoId, cliente_id: context.clienteId };
  }, [context]);

  const visible = showAll ? rows : rows.filter((r) => r.status === "pendente");
  const hiddenCount = rows.length - rows.filter((r) => r.status === "pendente").length;

  async function handleSetStatus(id: string, status: StatusEvento) {
    try {
      await agendaSetStatus(id, status);
      await refresh();
    } catch (e) {
      toast.error("Falha ao atualizar status", String((e as Error).message ?? e));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await agendaDelete(deleteTarget.id);
      toast.success("Evento excluído");
      await refresh();
    } catch (e) {
      toast.error("Falha ao excluir", String((e as Error).message ?? e));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1.5">Agenda</div>
          <h3 className="text-[16px] font-medium font-sans tracking-tight">Eventos vinculados</h3>
        </div>
        <div className="flex items-center gap-2">
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className={cn(
                "px-3 py-1 rounded-full text-[12px] font-medium transition-colors ring-1 ring-inset",
                showAll
                  ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)] ring-[#cbd5e0]"
                  : "bg-[var(--color-surface)] text-[var(--color-ink-muted)] ring-[var(--color-hairline-strong)] hover:text-[var(--color-ink)]",
              )}
            >
              {showAll ? "Só pendentes" : `Ver concluídos/cancelados (${hiddenCount})`}
            </button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus weight="bold" />}
            onClick={() => {
              setEditId(null);
              setDialogOpen(true);
            }}
          >
            Novo evento
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CalendarBlank weight="light" />}
          title="Sem eventos vinculados"
          description="Agende audiências, prazos e reuniões — os vínculos já vêm preenchidos a partir deste contexto."
        />
      ) : (
        <ul className="rounded-[1rem] ring-1 ring-[var(--color-hairline)] overflow-hidden">
          {visible.map((ev) => (
            <EventoListItem
              key={ev.id}
              evento={ev}
              showDate
              onEdit={(id) => {
                setEditId(id);
                setDialogOpen(true);
              }}
              onDelete={setDeleteTarget}
              onSetStatus={handleSetStatus}
            />
          ))}
        </ul>
      )}

      <EventoFormDialog
        open={dialogOpen}
        eventoId={editId}
        preset={preset}
        lockContext
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir evento"
        description={
          <>
            Excluir <strong className="text-[var(--color-ink)]">{deleteTarget?.titulo}</strong> da
            agenda? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
