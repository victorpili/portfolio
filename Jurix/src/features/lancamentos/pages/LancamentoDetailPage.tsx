import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, PencilSimple, Trash, Prohibit, ArrowCounterClockwise, CheckCircle,
  UserCircle, Buildings, Briefcase, Receipt, FileText, Calendar, Tag, Wallet,
} from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { Input } from "../../../components/ui/Input";
import { formatBRL } from "../../../lib/format/currency";
import { formatDateBR, todayIso } from "../../../lib/format/dates";
import { clientesGet } from "../../clientes/api";
import { contratosGet } from "../../contratos/api";
import { processosGet } from "../../processos/api";
import { displayNumeroProcesso } from "../../processos/components/numero";
import { lookupList } from "../../cadastros/api";
import {
  lancamentosCancelar, lancamentosDelete, lancamentosGet, lancamentosMarcarPagoAvista,
  lancamentosReativar, parcelasDesmarcarPago, parcelasMarcarPago,
} from "../api";
import type { LancamentoComParcelas } from "../types";
import { StatusPagamentoBadge } from "../components/StatusPagamentoBadge";
import { ParcelasTable } from "../components/ParcelasTable";
import { NATUREZA_LABELS, TIPO_LABELS } from "../components/labels";

export function LancamentoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [lanc, setLanc] = useState<LancamentoComParcelas | null>(null);
  const [clienteNome, setClienteNome] = useState<string | null>(null);
  const [contratoLabel, setContratoLabel] = useState<string | null>(null);
  const [processoLabel, setProcessoLabel] = useState<string | null>(null);
  const [centroCustoNome, setCentroCustoNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [avistaPayDate, setAvistaPayDate] = useState(todayIso());

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const l = await lancamentosGet(id);
      if (!l) {
        toast.error("Lançamento não encontrado");
        navigate("/lancamentos");
        return;
      }
      setLanc(l);
      setAvistaPayDate(l.data_pagamento ?? todayIso());
      const [cli, ct, pr, centros] = await Promise.all([
        clientesGet(l.cliente_id),
        l.contrato_id ? contratosGet(l.contrato_id) : Promise.resolve(null),
        l.processo_id ? processosGet(l.processo_id) : Promise.resolve(null),
        l.centro_custo_id ? lookupList("centros_custo") : Promise.resolve([]),
      ]);
      setClienteNome(cli?.nome ?? null);
      setContratoLabel(ct ? `${ct.codigo} — ${ct.nome}` : null);
      setProcessoLabel(pr ? (displayNumeroProcesso(pr) ?? "Sem número") : null);
      setCentroCustoNome(
        l.centro_custo_id ? (centros.find((c) => c.id === l.centro_custo_id)?.nome ?? null) : null,
      );
    } catch (e) {
      toast.error("Falha ao carregar lançamento", String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDelete() {
    if (!lanc) return;
    try {
      await lancamentosDelete(lanc.id);
      toast.success("Lançamento removido");
      navigate("/lancamentos");
    } catch (e) {
      toast.error("Erro ao excluir", String((e as Error).message ?? e));
    }
  }

  async function run(action: () => Promise<void>, successMsg: string) {
    try {
      await action();
      toast.success(successMsg);
      await load();
    } catch (e) {
      toast.error("Erro", String((e as Error).message ?? e));
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[var(--color-ink-muted)]">Carregando…</div>;
  }
  if (!lanc) return null;

  const isEntrada = lanc.natureza === "entrada";
  const isParcelado = lanc.forma_pagamento === "parcelado";
  const isCancelado = lanc.status_pagamento === "cancelado";
  const valorTotal = isParcelado
    ? lanc.parcelas.reduce((s, p) => s + p.valor, 0)
    : lanc.valor;
  const recebido = isParcelado
    ? lanc.parcelas.filter((p) => p.status === "pago").reduce((s, p) => s + p.valor, 0)
    : lanc.status_pagamento === "pago"
      ? lanc.valor
      : 0;

  // Effective status for an avista lancamento.
  const avistaEfetivo =
    !isParcelado && lanc.status_pagamento === "pendente" && lanc.data_prevista && lanc.data_prevista < todayIso()
      ? "inadimplente"
      : lanc.status_pagamento;

  return (
    <>
      <PageHeader
        eyebrow={`${NATUREZA_LABELS[lanc.natureza]} · ${TIPO_LABELS[lanc.tipo]}`}
        title={lanc.descricao || TIPO_LABELS[lanc.tipo]}
        description={clienteNome ?? undefined}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="md"
              type="button"
              icon={<ArrowLeft weight="light" />}
              onClick={() => navigate("/lancamentos")}
            >
              Lista
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<PencilSimple weight="light" />}
              onClick={() => navigate(`/lancamentos/${lanc.id}/editar`)}
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
        {/* Resumo */}
        <Card className="col-span-12 lg:col-span-4" innerClassName="!p-7">
          <div className="eyebrow mb-4">Resumo</div>
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1.5">
                Status
              </div>
              <StatusPagamentoBadge status={isParcelado ? lanc.status_pagamento : avistaEfetivo} />
            </div>
            <div className="border-t border-[var(--color-hairline)] pt-4">
              <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1">
                {isParcelado ? "Valor total do parcelamento" : "Valor"}
              </div>
              <div
                className="text-[24px] font-display font-medium tabular-nums tracking-tight"
                style={{
                  color: isEntrada ? "var(--color-positive)" : "var(--color-critical)",
                }}
              >
                {isEntrada ? "+" : "−"}
                {formatBRL(valorTotal)}
              </div>
              {isParcelado && (
                <div className="text-[12px] text-[var(--color-ink-muted)] mt-0.5">
                  {lanc.num_parcelas} × {formatBRL(lanc.valor)}
                </div>
              )}
            </div>
            <div className="border-t border-[var(--color-hairline)] pt-4">
              <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1">
                Recebido / pago
              </div>
              <div className="text-[16px] font-medium tabular-nums text-[var(--color-positive)]">
                {formatBRL(recebido)}
              </div>
            </div>

            {/* Cancel / reactivate */}
            <div className="border-t border-[var(--color-hairline)] pt-4">
              {isCancelado ? (
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  icon={<ArrowCounterClockwise weight="light" />}
                  onClick={() => run(() => lancamentosReativar(lanc.id), "Lançamento reativado")}
                >
                  Reativar lançamento
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  icon={<Prohibit weight="light" />}
                  onClick={() => run(() => lancamentosCancelar(lanc.id), "Lançamento cancelado")}
                  className="hover:!text-[var(--color-critical)]"
                >
                  Cancelar lançamento
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Detalhes */}
        <Card className="col-span-12 lg:col-span-8" innerClassName="!p-7">
          <div className="eyebrow mb-5">Detalhes</div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Detail icon={<Tag weight="light" />} label="Tipo" value={TIPO_LABELS[lanc.tipo]} />
            <Detail
              icon={<Wallet weight="light" />}
              label="Forma de pagamento"
              value={isParcelado ? `Parcelado em ${lanc.num_parcelas}x` : "À vista"}
            />
            {clienteNome && (
              <Detail
                icon={<UserCircle weight="light" />}
                label="Cliente"
                value={
                  <Link
                    to={`/clientes/${lanc.cliente_id}`}
                    className="text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    {clienteNome}
                  </Link>
                }
              />
            )}
            {contratoLabel && (
              <Detail
                icon={<Receipt weight="light" />}
                label="Contrato"
                value={
                  <Link
                    to={`/contratos/${lanc.contrato_id}`}
                    className="text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    {contratoLabel}
                  </Link>
                }
              />
            )}
            {processoLabel && (
              <Detail
                icon={<Briefcase weight="light" />}
                label="Processo"
                value={
                  <Link
                    to={`/processos/${lanc.processo_id}`}
                    className="text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    {processoLabel}
                  </Link>
                }
              />
            )}
            {centroCustoNome && (
              <Detail icon={<Buildings weight="light" />} label="Centro de custo" value={centroCustoNome} />
            )}
            <Detail
              icon={<CheckCircle weight="light" />}
              label={isEntrada ? "Receita garantida" : "Despesa garantida"}
              value={lanc.garantido === 1 ? "Sim" : isEntrada ? "Não" : "Incerta"}
            />
            {!isParcelado && lanc.data_prevista && (
              <Detail
                icon={<Calendar weight="light" />}
                label="Data prevista"
                value={formatDateBR(lanc.data_prevista)}
              />
            )}
            {!isParcelado && lanc.data_pagamento && (
              <Detail
                icon={<Calendar weight="light" />}
                label="Data do pagamento"
                value={formatDateBR(lanc.data_pagamento)}
              />
            )}
            {lanc.numero_documento && (
              <Detail
                icon={<FileText weight="light" />}
                label="Documento"
                value={lanc.numero_documento}
              />
            )}
          </dl>

          {/* Avista payment action */}
          {!isParcelado && !isCancelado && lanc.status_pagamento !== "pago" && (
            <div className="mt-6 pt-5 border-t border-[var(--color-hairline)] flex items-center gap-3 flex-wrap">
              <span className="text-[13px] text-[var(--color-ink-soft)]">Registrar pagamento:</span>
              <Input
                type="date"
                value={avistaPayDate}
                onChange={(e) => setAvistaPayDate(e.target.value)}
                className="!py-1.5 !w-[150px] !text-[13px]"
                aria-label="Data do pagamento"
              />
              <Button
                variant="secondary"
                size="sm"
                type="button"
                icon={<CheckCircle weight="light" />}
                onClick={() =>
                  run(
                    () => lancamentosMarcarPagoAvista(lanc.id, avistaPayDate),
                    "Pagamento registrado",
                  )
                }
              >
                Marcar como pago
              </Button>
            </div>
          )}

          {/* Avista — edit the payment date once paid */}
          {!isParcelado && !isCancelado && lanc.status_pagamento === "pago" && (
            <div className="mt-6 pt-5 border-t border-[var(--color-hairline)] flex items-center gap-3 flex-wrap">
              <span className="text-[13px] text-[var(--color-ink-soft)]">Pago em:</span>
              <Input
                type="date"
                value={avistaPayDate}
                onChange={(e) => setAvistaPayDate(e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v && v !== lanc.data_pagamento) {
                    run(
                      () => lancamentosMarcarPagoAvista(lanc.id, v),
                      "Data de pagamento atualizada",
                    );
                  }
                }}
                className="!py-1.5 !w-[150px] !text-[13px]"
                aria-label="Data do pagamento"
              />
            </div>
          )}
        </Card>

        {/* Parcelas */}
        {isParcelado && (
          <Card className="col-span-12">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="eyebrow mb-1.5">Parcelas</div>
                <h3 className="text-[16px] font-medium font-sans tracking-tight">
                  {lanc.parcelas.filter((p) => p.status === "pago").length} de{" "}
                  {lanc.parcelas.length} pagas
                </h3>
              </div>
            </div>
            <ParcelasTable
              parcelas={lanc.parcelas}
              actionsEnabled={!isCancelado}
              onMarcarPago={(pid, data) =>
                run(() => parcelasMarcarPago(pid, data), "Pagamento registrado")
              }
              onDesmarcarPago={(pid) =>
                run(() => parcelasDesmarcarPago(pid), "Pagamento desfeito")
              }
            />
            {isCancelado && (
              <p className="mt-3 text-[12.5px] text-[var(--color-ink-muted)]">
                Lançamento cancelado — reative-o para registrar pagamentos de parcelas.
              </p>
            )}
          </Card>
        )}

        {/* Observações */}
        {lanc.observacoes && (
          <Card className="col-span-12">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                <FileText weight="light" />
              </div>
              <div className="flex-1">
                <div className="eyebrow mb-2">Observações</div>
                <p className="text-[14px] leading-relaxed text-[var(--color-ink-soft)] whitespace-pre-wrap">
                  {lanc.observacoes}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="col-span-12 flex items-center gap-5 text-[11.5px] text-[var(--color-ink-subtle)] pt-2 pb-6">
          <span>Criado em {formatDateBR(lanc.criado_em)}</span>
          <span className="text-[var(--color-ink-subtle)]">·</span>
          <span>Última atualização em {formatDateBR(lanc.atualizado_em)}</span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir lançamento?"
        description={
          <>
            Esta ação remove o lançamento{" "}
            <strong>{lanc.descricao || TIPO_LABELS[lanc.tipo]}</strong>
            {isParcelado ? " e todas as suas parcelas" : ""}. A ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir lançamento"
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
