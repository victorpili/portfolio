import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Plus, Receipt } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { formatBRL } from "../../../lib/format/currency";
import { formatDateBR } from "../../../lib/format/dates";
import {
  contratosListByCliente, contratosListByProcesso,
} from "../api";
import { StatusContratoBadge } from "./StatusContratoBadge";
import type { Contrato } from "../types";

interface ContratosSectionProps {
  context: { kind: "cliente"; clienteId: string } | { kind: "processo"; processoId: string; clienteId: string };
}

export function ContratosSection({ context }: ContratosSectionProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list =
          context.kind === "cliente"
            ? await contratosListByCliente(context.clienteId)
            : await contratosListByProcesso(context.processoId);
        setContratos(list);
      } catch (e) {
        toast.error("Falha ao carregar contratos", String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [context, toast]);

  const clienteId = context.kind === "cliente" ? context.clienteId : context.clienteId;
  const newHref = `/contratos/novo?cliente_id=${clienteId}`;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1.5">Contratos</div>
          <h3 className="text-[16px] font-medium font-sans tracking-tight">
            {context.kind === "cliente" ? "Engajamentos com este cliente" : "Contratos vinculados a este processo"}
          </h3>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus weight="bold" />}
          onClick={() => navigate(newHref)}
        >
          Novo contrato
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
      ) : contratos.length === 0 ? (
        <EmptyState
          icon={<Receipt weight="light" />}
          title={context.kind === "cliente" ? "Sem contratos cadastrados" : "Nenhum contrato vinculado"}
          description={
            context.kind === "cliente"
              ? "Cadastre o primeiro contrato para começar a acompanhar receita e lançamentos."
              : "Você pode vincular contratos a este processo na tela de edição do contrato."
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-hairline)] -mx-1">
          {contratos.map((c) => (
            <li key={c.id}>
              <Link
                to={`/contratos/${c.id}`}
                className="group flex items-center gap-5 px-1 py-3.5 transition-colors hover:bg-[var(--color-surface-muted)] rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <span className="font-mono text-[12px] text-[var(--color-ink-muted)] tabular-nums">
                      {c.codigo}
                    </span>
                    <span className="text-[var(--color-ink-subtle)]">·</span>
                    <span className="text-[13.5px] font-medium text-[var(--color-ink)] truncate">
                      {c.nome}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--color-ink-muted)]">
                    Início {formatDateBR(c.data_inicio)}
                    {c.data_encerramento ? ` · Fim ${formatDateBR(c.data_encerramento)}` : ""}
                  </div>
                </div>

                <span className="text-[12.5px] tabular-nums text-[var(--color-ink-soft)]">
                  {formatBRL(c.valor_base)}
                </span>

                <StatusContratoBadge status={c.status} />

                <ArrowUpRight
                  weight="light"
                  className="w-4 h-4 text-[var(--color-ink-subtle)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:text-[var(--color-ink-soft)]"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
