import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MagnifyingGlass, Plus, Briefcase, ArrowUpRight, Scales,
} from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Input } from "../../../components/ui/Input";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { formatBRL } from "../../../lib/format/currency";
import { cn } from "../../../lib/cn";
import { processosList } from "../api";
import type { ProcessoListRow, StatusProcesso } from "../types";
import { StatusProcessoBadge } from "../components/StatusProcessoBadge";
import { faseDisplay } from "../components/faseLabels";
import { displayNumeroProcesso } from "../components/numero";
import { Badge } from "../../../components/ui/Badge";

type StatusFilter = StatusProcesso | "all";

export function ProcessosListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("em_andamento");
  const [rows, setRows] = useState<ProcessoListRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      setRows(await processosList({ search, status }));
    } catch (e) {
      toast.error("Falha ao carregar processos", String((e as Error).message ?? e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const t = setTimeout(refresh, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const counts = useMemo(() => {
    if (!rows) return { total: 0, em_andamento: 0, encerrado: 0, suspenso: 0 };
    return {
      total: rows.length,
      em_andamento: rows.filter((r) => r.status === "em_andamento").length,
      encerrado: rows.filter((r) => r.status === "encerrado").length,
      suspenso: rows.filter((r) => r.status === "suspenso").length,
    };
  }, [rows]);

  return (
    <>
      <PageHeader
        eyebrow="Casos"
        title="Processos"
        description="Processos judiciais vinculados aos clientes. Número CNJ formatado automaticamente; chance de êxito alimenta a projeção financeira."
        actions={
          <Button
            variant="primary"
            size="md"
            trailingIcon={<Plus weight="bold" />}
            onClick={() => navigate("/processos/novo")}
          >
            Novo processo
          </Button>
        }
      />

      <div className="bezel-shell mb-7">
        <div className="bezel-inner !p-0">
          <div className="flex items-center gap-4 p-4 border-b border-[var(--color-hairline)]">
            <div className="relative flex-1">
              <MagnifyingGlass
                weight="light"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--color-ink-muted)] pointer-events-none"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por número, cliente, parte adversa, vara/órgão ou tribunal"
                className="!pl-10 !bg-transparent !ring-0 !rounded-md !py-2 focus:!ring-0"
                aria-label="Buscar processos"
              />
            </div>
            <FilterChips
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: "em_andamento", label: "Em andamento" },
                { value: "suspenso", label: "Suspensos" },
                { value: "encerrado", label: "Encerrados" },
                { value: "all", label: "Todos" },
              ]}
            />
          </div>

          <div className="px-5 py-3 flex items-center gap-5 text-[12px] text-[var(--color-ink-muted)]">
            <span>
              <strong className="text-[var(--color-ink)] font-medium">{counts.total}</strong>{" "}
              {counts.total === 1 ? "processo" : "processos"}
            </span>
            <span className="text-[var(--color-ink-subtle)]">·</span>
            <span>{counts.em_andamento} em andamento</span>
            <span>{counts.suspenso} suspensos</span>
            <span>{counts.encerrado} encerrados</span>
          </div>

          {loading && rows === null ? (
            <div className="py-20 text-center text-[var(--color-ink-muted)] text-sm">Carregando…</div>
          ) : rows && rows.length === 0 ? (
            <EmptyState
              icon={<Scales weight="light" />}
              title={search ? "Nenhum processo encontrado" : "Sem processos cadastrados"}
              description={
                search
                  ? "Tente outro termo ou troque o filtro de status."
                  : "Cadastre o primeiro processo para começar a acompanhar prazos, valores e projeções."
              }
              action={
                !search && (
                  <Button
                    variant="primary"
                    size="sm"
                    trailingIcon="auto"
                    onClick={() => navigate("/processos/novo")}
                  >
                    Cadastrar processo
                  </Button>
                )
              }
            />
          ) : (
            <ul>
              {rows!.map((row) => (
                <ProcessoRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function ProcessoRow({ row }: { row: ProcessoListRow }) {
  const numero = displayNumeroProcesso(row);
  const isAdministrativo = row.natureza === "administrativo";
  return (
    <li className="border-b border-[var(--color-hairline)] last:border-b-0">
      <Link
        to={`/processos/${row.id}`}
        className="flex items-center gap-5 px-5 py-4 transition-colors duration-200 hover:bg-[var(--color-surface-muted)] group"
      >
        <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5">
          <Briefcase weight="light" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-0.5">
            <span className="text-[14px] font-medium text-[var(--color-ink)] truncate">
              {numero ?? (isAdministrativo ? "Sem número" : "CNJ não informado")}
            </span>
            {isAdministrativo && (
              <Badge tone="neutral" className="!py-[1px] !text-[10px]">
                Administrativo
              </Badge>
            )}
            <span className="text-[11.5px] text-[var(--color-ink-subtle)]">·</span>
            <span className="text-[12.5px] text-[var(--color-ink-muted)] truncate">
              {row.cliente_nome}
            </span>
          </div>
          <div className="text-[12.5px] text-[var(--color-ink-muted)] flex items-center gap-3 flex-wrap">
            <span>{faseDisplay(row)}</span>
            {row.parte_adversa && (
              <>
                <span className="text-[var(--color-ink-subtle)]">·</span>
                <span className="truncate">vs. {row.parte_adversa}</span>
              </>
            )}
            {row.tribunal && (
              <>
                <span className="text-[var(--color-ink-subtle)]">·</span>
                <span>{row.tribunal}</span>
              </>
            )}
          </div>
        </div>

        {row.valor_causa != null && (
          <div className="text-right shrink-0">
            <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
              Valor da causa
            </div>
            <div className="text-[13.5px] font-medium tabular-nums text-[var(--color-ink)]">
              {formatBRL(row.valor_causa)}
            </div>
          </div>
        )}

        <StatusProcessoBadge status={row.status} />

        <ArrowUpRight
          weight="light"
          className="w-4 h-4 text-[var(--color-ink-subtle)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:text-[var(--color-ink-soft)]"
        />
      </Link>
    </li>
  );
}

interface FilterChipsProps<T extends string> {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}

function FilterChips<T extends string>({ label, value, onChange, options }: FilterChipsProps<T>) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">{label}</span>
      <div className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-surface-muted)] p-0.5 ring-1 ring-inset ring-[var(--color-hairline)]">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1 rounded-full text-[12px] font-medium transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
              value === opt.value
                ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_0_var(--color-hairline)] ring-1 ring-[var(--color-hairline)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
