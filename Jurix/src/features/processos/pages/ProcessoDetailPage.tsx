import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowSquareOut, Briefcase, Calendar, FileText, Gavel,
  IdentificationCard, PencilSimple, Scales, Target, Trash, UserCircle, Buildings,
} from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { LancamentosSection } from "../../lancamentos/components/LancamentosSection";
import { useToast } from "../../../components/ui/Toast";
import { formatBRL } from "../../../lib/format/currency";
import { formatDateBR } from "../../../lib/format/dates";
import { clientesGet } from "../../clientes/api";
import type { Cliente } from "../../clientes/types";
import { processosDelete, processosGet } from "../api";
import type { Processo } from "../types";
import { StatusProcessoBadge } from "../components/StatusProcessoBadge";
import { faseDisplay } from "../components/faseLabels";
import { displayNumeroProcesso, naturezaLabel } from "../components/numero";
import { Badge } from "../../../components/ui/Badge";
import { ContratosSection } from "../../contratos/components/ContratosSection";
import { AgendaSection } from "../../agenda/components/AgendaSection";

export function ProcessoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const p = await processosGet(id);
        if (!p) {
          toast.error("Processo não encontrado");
          navigate("/processos");
          return;
        }
        setProcesso(p);
        const c = await clientesGet(p.cliente_id);
        setCliente(c);
      } catch (e) {
        toast.error("Falha ao carregar processo", String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDelete() {
    if (!processo) return;
    try {
      await processosDelete(processo.id);
      toast.success("Processo removido");
      navigate("/processos");
    } catch (e) {
      toast.error("Erro ao excluir", String((e as Error).message ?? e));
    }
  }

  async function openExternal(url: string) {
    try {
      await openUrl(url);
    } catch (e) {
      toast.error("Não foi possível abrir o link", String((e as Error).message ?? e));
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[var(--color-ink-muted)]">Carregando…</div>;
  }
  if (!processo) return null;

  const numero = displayNumeroProcesso(processo);
  const isPF = cliente?.tipo === "pf";
  const isJudicial = processo.natureza === "judicial";

  return (
    <>
      <PageHeader
        eyebrow={`Processo ${naturezaLabel(processo.natureza).toLowerCase()}`}
        title={numero ?? (isJudicial ? "CNJ não informado" : "Sem número")}
        description={
          processo.parte_adversa
            ? `${cliente?.nome ?? "Cliente"} ${isJudicial ? "vs." : "·"} ${processo.parte_adversa}`
            : cliente?.nome ?? undefined
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="md"
              type="button"
              icon={<ArrowLeft weight="light" />}
              onClick={() => navigate("/processos")}
            >
              Lista
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<PencilSimple weight="light" />}
              onClick={() => navigate(`/processos/${processo.id}/editar`)}
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="md"
              icon={<Trash weight="light" />}
              onClick={() => setConfirmDelete(true)}
            >
              Excluir
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-12 gap-7">
        {/* Status & financial summary */}
        <Card className="col-span-12 lg:col-span-4" innerClassName="!p-7">
          <div className="eyebrow mb-4">Situação</div>
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1.5">
                Natureza
              </div>
              <Badge tone={isJudicial ? "info" : "neutral"}>
                {naturezaLabel(processo.natureza)}
              </Badge>
            </div>

            <div className="border-t border-[var(--color-hairline)] pt-4">
              <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1.5">
                Status processual
              </div>
              <StatusProcessoBadge status={processo.status} />
            </div>

            <div className="border-t border-[var(--color-hairline)] pt-4">
              <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1.5">
                Fase atual
              </div>
              <div className="text-[14px] text-[var(--color-ink)]">{faseDisplay(processo)}</div>
            </div>

            {processo.chance_exito != null && (
              <div className="border-t border-[var(--color-hairline)] pt-4">
                <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-2">
                  Chance de êxito
                </div>
                <ChanceExitoBar value={processo.chance_exito} />
              </div>
            )}

            {processo.valor_causa != null && (
              <div className="border-t border-[var(--color-hairline)] pt-4">
                <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1">
                  Valor da causa
                </div>
                <div className="text-[18px] font-medium tabular-nums tracking-tight font-display text-[var(--color-ink)]">
                  {formatBRL(processo.valor_causa)}
                </div>
              </div>
            )}

            {processo.link_documentos && (
              <div className="border-t border-[var(--color-hairline)] pt-4">
                <button
                  type="button"
                  onClick={() => openExternal(processo.link_documentos!)}
                  className="group inline-flex items-center gap-2 text-[13px] font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
                >
                  <ArrowSquareOut weight="light" className="w-4 h-4" />
                  Abrir pasta de documentos
                </button>
                <p className="text-[11.5px] text-[var(--color-ink-muted)] mt-1.5 truncate" title={processo.link_documentos}>
                  {processo.link_documentos}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Metadata */}
        <Card className="col-span-12 lg:col-span-8" innerClassName="!p-7">
          <div className="eyebrow mb-5">Dados do processo</div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Detail
              icon={<Briefcase weight="light" />}
              label={isJudicial ? "Número CNJ" : "Número do processo"}
              value={
                numero ? (
                  <span
                    className={isJudicial ? "font-mono tabular-nums tracking-tight" : undefined}
                  >
                    {numero}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            {cliente && (
              <Detail
                icon={isPF ? <UserCircle weight="light" /> : <Buildings weight="light" />}
                label="Cliente"
                value={
                  <Link
                    to={`/clientes/${cliente.id}`}
                    className="text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    {cliente.nome}
                  </Link>
                }
              />
            )}
            {processo.tribunal && (
              <Detail
                icon={<Scales weight="light" />}
                label={isJudicial ? "Tribunal" : "Esfera / Instância"}
                value={processo.tribunal}
              />
            )}
            {processo.vara && (
              <Detail
                icon={<Gavel weight="light" />}
                label={isJudicial ? "Vara" : "Setor / Órgão"}
                value={processo.vara}
              />
            )}
            {processo.comarca && (
              <Detail
                icon={<Target weight="light" />}
                label={isJudicial ? "Comarca" : "Unidade / Localidade"}
                value={processo.comarca}
              />
            )}
            {processo.parte_adversa && (
              <Detail
                icon={<UserCircle weight="light" />}
                label={isJudicial ? "Parte adversa" : "Outra parte / interessado"}
                value={processo.parte_adversa}
              />
            )}
            {processo.advogado_adversario && (
              <Detail
                icon={<IdentificationCard weight="light" />}
                label={isJudicial ? "Advogado adverso" : "Procurador / responsável"}
                value={
                  processo.oab_adversario
                    ? `${processo.advogado_adversario} (${processo.oab_adversario})`
                    : processo.advogado_adversario
                }
              />
            )}
          </dl>
        </Card>

        {/* Observações */}
        {processo.observacoes && (
          <Card className="col-span-12">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                <FileText weight="light" />
              </div>
              <div className="flex-1">
                <div className="eyebrow mb-2">Observações</div>
                <p className="text-[14px] leading-relaxed text-[var(--color-ink-soft)] whitespace-pre-wrap">
                  {processo.observacoes}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Agenda */}
        <Card className="col-span-12">
          <AgendaSection
            context={{ kind: "processo", processoId: processo.id, clienteId: processo.cliente_id }}
          />
        </Card>

        {/* Contratos vinculados ao processo */}
        <Card className="col-span-12">
          <ContratosSection
            context={{ kind: "processo", processoId: processo.id, clienteId: processo.cliente_id }}
          />
        </Card>

        {/* Lançamentos */}
        <Card className="col-span-12">
          <LancamentosSection
            context={{ kind: "processo", processoId: processo.id, clienteId: processo.cliente_id }}
          />
        </Card>

        {/* Timestamps */}
        <div className="col-span-12 flex items-center gap-5 text-[11.5px] text-[var(--color-ink-subtle)] pt-2 pb-6">
          <span><Calendar weight="light" className="inline w-3.5 h-3.5 mr-1" />Criado em {formatDateBR(processo.criado_em)}</span>
          <span className="text-[var(--color-ink-subtle)]">·</span>
          <span>Última atualização em {formatDateBR(processo.atualizado_em)}</span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir processo?"
        description="Esta ação remove o processo permanentemente. Lançamentos e contratos vinculados (quando esses módulos existirem) podem ser afetados."
        confirmLabel="Excluir processo"
        tone="danger"
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4 mt-0.5">
        {icon}
      </div>
      <div>
        <dt className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">{label}</dt>
        <dd className="text-[14px] text-[var(--color-ink)] mt-0.5">{value}</dd>
      </div>
    </div>
  );
}

function ChanceExitoBar({ value }: { value: number }) {
  const tone = value >= 70 ? "var(--color-positive)" : value >= 40 ? "var(--color-warning)" : "var(--color-critical)";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[24px] font-display font-medium tabular-nums tracking-tight" style={{ color: tone }}>
          {value}%
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-surface-muted)] overflow-hidden ring-1 ring-inset ring-[var(--color-hairline)]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ width: `${Math.max(2, value)}%`, backgroundColor: tone }}
        />
      </div>
    </div>
  );
}
