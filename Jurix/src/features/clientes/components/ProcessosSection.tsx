import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Plus, Scales } from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { formatBRL } from "../../../lib/format/currency";
import { processosListByCliente } from "../../processos/api";
import { StatusProcessoBadge } from "../../processos/components/StatusProcessoBadge";
import { faseDisplay } from "../../processos/components/faseLabels";
import { displayNumeroProcesso } from "../../processos/components/numero";
import { Badge } from "../../../components/ui/Badge";
import type { Processo } from "../../processos/types";

export function ProcessosSection({ clienteId }: { clienteId: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setProcessos(await processosListByCliente(clienteId));
      } catch (e) {
        toast.error("Falha ao carregar processos", String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
  }, [clienteId, toast]);

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1.5">Processos</div>
          <h3 className="text-[16px] font-medium font-sans tracking-tight">
            Casos judiciais vinculados
          </h3>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus weight="bold" />}
          onClick={() => navigate(`/processos/novo?cliente_id=${clienteId}`)}
        >
          Novo processo
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-[var(--color-ink-muted)]">Carregando…</div>
      ) : processos.length === 0 ? (
        <EmptyState
          icon={<Scales weight="light" />}
          title="Sem processos cadastrados"
          description="Vincule audiências, prazos e valores ao cadastrar o primeiro processo deste cliente."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-hairline)] -mx-1">
          {processos.map((p) => {
            const numero = displayNumeroProcesso(p);
            const isAdministrativo = p.natureza === "administrativo";
            return (
            <li key={p.id}>
              <Link
                to={`/processos/${p.id}`}
                className="group flex items-center gap-5 px-1 py-3.5 transition-colors hover:bg-[var(--color-surface-muted)] rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-0.5">
                    <span className="text-[13.5px] font-medium text-[var(--color-ink)] truncate">
                      {numero ?? (isAdministrativo ? "Sem número" : "CNJ não informado")}
                    </span>
                    {isAdministrativo && (
                      <Badge tone="neutral" className="!py-[1px] !text-[10px]">
                        Admin
                      </Badge>
                    )}
                    <span className="text-[var(--color-ink-subtle)]">·</span>
                    <span className="text-[12.5px] text-[var(--color-ink-muted)]">
                      {faseDisplay(p)}
                    </span>
                  </div>
                  {p.parte_adversa && (
                    <div className="text-[12.5px] text-[var(--color-ink-muted)] truncate">
                      {isAdministrativo ? "" : "vs. "}{p.parte_adversa}
                    </div>
                  )}
                </div>

                {p.valor_causa != null && (
                  <span className="text-[12.5px] tabular-nums text-[var(--color-ink-soft)]">
                    {formatBRL(p.valor_causa)}
                  </span>
                )}

                <StatusProcessoBadge status={p.status} />

                <ArrowUpRight
                  weight="light"
                  className="w-4 h-4 text-[var(--color-ink-subtle)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:text-[var(--color-ink-soft)]"
                />
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
