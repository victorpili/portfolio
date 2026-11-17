import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowSquareOut, Calendar, FileText, IdentificationCard,
  Briefcase, Buildings, PencilSimple, Trash, UserCircle, Tag, ChartLineUp,
} from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { LancamentosSection } from "../../lancamentos/components/LancamentosSection";
import { AgendaSection } from "../../agenda/components/AgendaSection";
import { useToast } from "../../../components/ui/Toast";
import { formatBRL } from "../../../lib/format/currency";
import { formatDateBR } from "../../../lib/format/dates";
import { clientesGet } from "../../clientes/api";
import { processosGet } from "../../processos/api";
import { displayNumeroProcesso, naturezaLabel } from "../../processos/components/numero";
import { lookupList, type LookupRow } from "../../cadastros/api";
import type { Cliente } from "../../clientes/types";
import type { Processo } from "../../processos/types";
import {
  contratosDelete, contratosGet, contratosResumoFinanceiro,
} from "../api";
import type { Contrato, ContratoResumoFinanceiro } from "../types";
import { StatusContratoBadge } from "../components/StatusContratoBadge";

export function ContratoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [processo, setProcesso] = useState<Processo | null>(null);
  const [areas, setAreas] = useState<LookupRow[]>([]);
  const [tipos, setTipos] = useState<LookupRow[]>([]);
  const [resumo, setResumo] = useState<ContratoResumoFinanceiro | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        const c = await contratosGet(id);
        if (!c) {
          toast.error("Contrato não encontrado");
          navigate("/contratos");
          return;
        }
        setContrato(c);
        const [cli, proc, ad, tc, res] = await Promise.all([
          clientesGet(c.cliente_id),
          c.processo_id ? processosGet(c.processo_id) : Promise.resolve(null),
          lookupList("areas_direito"),
          lookupList("tipos_contrato"),
          contratosResumoFinanceiro(c.id),
        ]);
        setCliente(cli);
        setProcesso(proc);
        setAreas(ad);
        setTipos(tc);
        setResumo(res);
      } catch (e) {
        toast.error("Falha ao carregar contrato", String((e as Error).message ?? e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDelete() {
    if (!contrato) return;
    try {
      await contratosDelete(contrato.id);
      toast.success("Contrato removido");
      navigate("/contratos");
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
  if (!contrato) return null;

  const areaNome = areas.find((a) => a.id === contrato.area_direito_id);
  const tipoNome = tipos.find((t) => t.id === contrato.tipo_contrato_id);
  const isPF = cliente?.tipo === "pf";

  return (
    <>
      <PageHeader
        eyebrow={`Contrato · ${contrato.codigo}`}
        title={contrato.nome}
        description={cliente ? `Cliente: ${cliente.nome}` : undefined}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="md"
              type="button"
              icon={<ArrowLeft weight="light" />}
              onClick={() => navigate("/contratos")}
            >
              Lista
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<PencilSimple weight="light" />}
              onClick={() => navigate(`/contratos/${contrato.id}/editar`)}
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
        {/* Financial summary — three vertical KPI cards */}
        <Card className="col-span-12 lg:col-span-4" innerClassName="!p-7">
          <div className="eyebrow mb-4">Resumo financeiro</div>
          <ResumoLine
            label="Faturado"
            value={resumo?.total_faturado_cents ?? 0}
            tone="default"
            hint="Soma do faturamento previsto pelos lançamentos vinculados"
          />
          <ResumoLine
            label="Recebido"
            value={resumo?.total_recebido_cents ?? 0}
            tone="positive"
            hint="Lançamentos quitados"
          />
          <ResumoLine
            label="Em aberto"
            value={resumo?.total_em_aberto_cents ?? 0}
            tone="warning"
            hint="Pendentes + parcialmente pagos + inadimplentes"
          />
          <p className="text-[11.5px] text-[var(--color-ink-subtle)] leading-relaxed mt-5 pt-4 border-t border-[var(--color-hairline)]">
            Os totais começam em zero e passam a refletir o financeiro do contrato a
            partir do Módulo 4 (Lançamentos).
          </p>
        </Card>

        {/* Metadata */}
        <Card className="col-span-12 lg:col-span-8" innerClassName="!p-7">
          <div className="flex items-start justify-between mb-5">
            <div className="eyebrow">Dados do contrato</div>
            <StatusContratoBadge status={contrato.status} />
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Detail
              icon={<Tag weight="light" />}
              label="Código"
              value={<span className="font-mono tabular-nums tracking-tight">{contrato.codigo}</span>}
            />
            <Detail
              icon={<ChartLineUp weight="light" />}
              label="Valor base"
              value={
                <span className="text-[15px] font-medium tabular-nums">
                  {formatBRL(contrato.valor_base)}
                </span>
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
            {areaNome && (
              <Detail
                icon={<IdentificationCard weight="light" />}
                label="Área do direito"
                value={areaNome.nome + (areaNome.ativo === 0 ? " (inativo)" : "")}
              />
            )}
            {tipoNome && (
              <Detail
                icon={<FileText weight="light" />}
                label="Tipo de contrato"
                value={tipoNome.nome + (tipoNome.ativo === 0 ? " (inativo)" : "")}
              />
            )}
            <Detail
              icon={<Calendar weight="light" />}
              label="Data de início"
              value={formatDateBR(contrato.data_inicio)}
            />
            {contrato.data_encerramento && (
              <Detail
                icon={<Calendar weight="light" />}
                label="Data de encerramento"
                value={formatDateBR(contrato.data_encerramento)}
              />
            )}
            {contrato.link_documentos && (
              <Detail
                icon={<ArrowSquareOut weight="light" />}
                label="Documentos"
                value={
                  <button
                    type="button"
                    onClick={() => openExternal(contrato.link_documentos!)}
                    className="text-[var(--color-accent)] hover:underline underline-offset-4 inline-flex items-center gap-1"
                  >
                    Abrir pasta externa
                  </button>
                }
              />
            )}
          </dl>
        </Card>

        {/* Processo vinculado */}
        {processo && (
          <Card className="col-span-12">
            <div className="flex items-start justify-between mb-4">
              <div className="eyebrow">Processo vinculado</div>
              <Badge tone={processo.natureza === "judicial" ? "info" : "neutral"}>
                {naturezaLabel(processo.natureza)}
              </Badge>
            </div>
            <Link
              to={`/processos/${processo.id}`}
              className="group flex items-center gap-5 -mx-2 px-2 py-3 rounded transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                <Briefcase weight="light" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-[var(--color-ink)] truncate">
                  {displayNumeroProcesso(processo) ?? "Sem número"}
                </div>
                <div className="text-[12.5px] text-[var(--color-ink-muted)] truncate">
                  {processo.parte_adversa
                    ? `${processo.natureza === "judicial" ? "vs." : "·"} ${processo.parte_adversa}`
                    : processo.vara ?? "—"}
                </div>
              </div>
            </Link>
          </Card>
        )}

        {/* Observações */}
        {contrato.observacoes && (
          <Card className="col-span-12">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                <FileText weight="light" />
              </div>
              <div className="flex-1">
                <div className="eyebrow mb-2">Observações</div>
                <p className="text-[14px] leading-relaxed text-[var(--color-ink-soft)] whitespace-pre-wrap">
                  {contrato.observacoes}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Lançamentos */}
        <Card className="col-span-12">
          <LancamentosSection
            context={{ kind: "contrato", contratoId: contrato.id, clienteId: contrato.cliente_id }}
          />
        </Card>

        {/* Agenda */}
        <Card className="col-span-12">
          <AgendaSection
            context={{ kind: "contrato", contratoId: contrato.id, clienteId: contrato.cliente_id }}
          />
        </Card>

        <div className="col-span-12 flex items-center gap-5 text-[11.5px] text-[var(--color-ink-subtle)] pt-2 pb-6">
          <span>Criado em {formatDateBR(contrato.criado_em)}</span>
          <span className="text-[var(--color-ink-subtle)]">·</span>
          <span>Última atualização em {formatDateBR(contrato.atualizado_em)}</span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir contrato?"
        description={
          <>
            Esta ação remove permanentemente o contrato <strong>{contrato.codigo}</strong>.
            Lançamentos vinculados (quando o Módulo 4 existir) precisam ser tratados antes.
          </>
        }
        confirmLabel="Excluir contrato"
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

function ResumoLine({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "default" | "positive" | "warning";
  hint: string;
}) {
  const color =
    tone === "positive"
      ? "var(--color-positive)"
      : tone === "warning"
        ? "var(--color-warning)"
        : "var(--color-ink)";
  return (
    <div className="py-3 first:pt-0 last:pb-0 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-[var(--color-hairline)]">
      <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">{label}</div>
      <div
        className="text-[22px] font-display font-medium tabular-nums tracking-tight mt-1"
        style={{ color }}
      >
        {formatBRL(value)}
      </div>
      <div className="text-[11.5px] text-[var(--color-ink-subtle)] mt-0.5 leading-relaxed">{hint}</div>
    </div>
  );
}
