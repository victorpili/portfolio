import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  PencilSimple, Trash, ArrowLeft, EnvelopeSimple, Phone, MapPin,
  IdentificationCard, Buildings, UserCircle, Calendar, FileText, ToggleLeft, ToggleRight,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";
import { formatCEP, formatCNPJ, formatCPF, formatPhone } from "../../../lib/format/documents";
import { formatDateBR } from "../../../lib/format/dates";
import { DeleteBlockedError } from "../../../lib/errors";
import { lookupList, type LookupRow } from "../../cadastros/api";
import {
  clientesDelete, clientesGet, clientesListFiliais, clientesStatusFinanceiro,
  clientesUpdate, inscricoesEstaduaisList,
} from "../api";
import type { Cliente, InscricaoEstadual, StatusFinanceiro } from "../types";
import { StatusFinanceiroBadge } from "../components/StatusFinanceiroBadge";
import { ContatosPJSection } from "../components/ContatosPJSection";
import { ProcessosSection } from "../components/ProcessosSection";
import { ContratosSection } from "../../contratos/components/ContratosSection";
import { LancamentosSection } from "../../lancamentos/components/LancamentosSection";
import { AgendaSection } from "../../agenda/components/AgendaSection";

export function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [status, setStatus] = useState<StatusFinanceiro>("sem_movimentacao");
  const [origens, setOrigens] = useState<LookupRow[]>([]);
  const [inscricoes, setInscricoes] = useState<InscricaoEstadual[]>([]);
  const [filiais, setFiliais] = useState<Cliente[]>([]);
  const [matrizCliente, setMatrizCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const c = await clientesGet(id);
      if (!c) {
        toast.error("Cliente não encontrado");
        navigate("/clientes");
        return;
      }
      const isPJ = c.tipo === "pj";
      const [st, origs, insc, fil, matriz] = await Promise.all([
        clientesStatusFinanceiro(id),
        lookupList("origens"),
        isPJ ? inscricoesEstaduaisList(c.id) : Promise.resolve([] as InscricaoEstadual[]),
        isPJ ? clientesListFiliais(c.id) : Promise.resolve([] as Cliente[]),
        isPJ && c.tipo_unidade === "filial" && c.matriz_id
          ? clientesGet(c.matriz_id)
          : Promise.resolve(null),
      ]);
      setCliente(c);
      setStatus(st);
      setOrigens(origs);
      setInscricoes(insc);
      setFiliais(fil);
      setMatrizCliente(matriz);
    } catch (e) {
      toast.error("Falha ao carregar cliente", String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDelete() {
    if (!cliente) return;
    try {
      await clientesDelete(cliente.id);
      toast.success("Cliente removido");
      navigate("/clientes");
    } catch (e) {
      if (e instanceof DeleteBlockedError) {
        toast.error("Não foi possível excluir", e.message);
      } else {
        toast.error("Erro ao excluir", String((e as Error).message ?? e));
      }
    }
  }

  async function toggleRelacionamento() {
    if (!cliente) return;
    setTogglingStatus(true);
    try {
      const next = cliente.status_relacionamento === "ativo" ? "inativo" : "ativo";
      await clientesUpdate(cliente.id, {
        tipo: cliente.tipo,
        nome: cliente.nome,
        cpf: cliente.cpf,
        rg: cliente.rg,
        data_nascimento: cliente.data_nascimento,
        cnpj: cliente.cnpj,
        data_fundacao: cliente.data_fundacao,
        email: cliente.email,
        telefone: cliente.telefone,
        cep: cliente.cep,
        logradouro: cliente.logradouro,
        numero: cliente.numero,
        complemento: cliente.complemento,
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        origem_id: cliente.origem_id,
        status_relacionamento: next,
        observacoes: cliente.observacoes,
        tipo_unidade: cliente.tipo_unidade,
        matriz_id: cliente.matriz_id,
      });
      toast.success(next === "ativo" ? "Cliente reativado" : "Cliente inativado");
      await load();
    } catch (e) {
      toast.error("Falha ao alterar status", String((e as Error).message ?? e));
    } finally {
      setTogglingStatus(false);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-[var(--color-ink-muted)]">Carregando…</div>;
  }
  if (!cliente) return null;

  const isPF = cliente.tipo === "pf";
  const document = isPF ? formatCPF(cliente.cpf) : formatCNPJ(cliente.cnpj);
  const origemNome = origens.find((o) => o.id === cliente.origem_id)?.nome ?? null;
  const enderecoFull = formatEndereco(cliente);

  return (
    <>
      <PageHeader
        eyebrow={isPF ? "Pessoa física" : "Pessoa jurídica"}
        title={cliente.nome}
        description={document ? `Documento: ${document}` : undefined}
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="md"
              type="button"
              icon={<ArrowLeft weight="light" />}
              onClick={() => navigate("/clientes")}
            >
              Lista
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<PencilSimple weight="light" />}
              onClick={() => navigate(`/clientes/${cliente.id}/editar`)}
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
        {/* Status panel */}
        <Card className="col-span-12 lg:col-span-4" innerClassName="!p-7">
          <div className="eyebrow mb-3">Situação</div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1.5">
                Financeira
              </div>
              <StatusFinanceiroBadge status={status} />
              <p className="text-[12px] text-[var(--color-ink-muted)] mt-2 leading-relaxed">
                Calculado a partir dos lançamentos vinculados.
              </p>
            </div>
            <div className="border-t border-[var(--color-hairline)] pt-4">
              <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1.5">
                Relacionamento
              </div>
              <div className="flex items-center justify-between gap-3">
                <Badge tone={cliente.status_relacionamento === "ativo" ? "info" : "neutral"}>
                  {cliente.status_relacionamento === "ativo" ? "Ativo" : "Inativo"}
                </Badge>
                <button
                  type="button"
                  disabled={togglingStatus}
                  onClick={toggleRelacionamento}
                  className="text-[12.5px] font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors inline-flex items-center gap-1.5"
                >
                  {cliente.status_relacionamento === "ativo" ? (
                    <ToggleRight weight="light" className="w-5 h-5" />
                  ) : (
                    <ToggleLeft weight="light" className="w-5 h-5" />
                  )}
                  {cliente.status_relacionamento === "ativo" ? "Inativar" : "Reativar"}
                </button>
              </div>
            </div>
            {!isPF && (
              <div className="border-t border-[var(--color-hairline)] pt-4">
                <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1.5">
                  Unidade
                </div>
                {cliente.tipo_unidade === "filial" ? (
                  <div>
                    <Badge tone="neutral">Filial</Badge>
                    {matrizCliente && (
                      <div className="text-[12.5px] text-[var(--color-ink-muted)] mt-2">
                        Matriz:{" "}
                        <Link
                          to={`/clientes/${matrizCliente.id}`}
                          className="text-[var(--color-accent)] hover:underline underline-offset-4"
                        >
                          {matrizCliente.nome}
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <Badge tone="info">Matriz</Badge>
                )}
              </div>
            )}
            {origemNome && (
              <div className="border-t border-[var(--color-hairline)] pt-4">
                <div className="text-[11.5px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)] mb-1.5">
                  Origem
                </div>
                <div className="text-[14px] text-[var(--color-ink)]">{origemNome}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Identification & metadata */}
        <Card className="col-span-12 lg:col-span-8" innerClassName="!p-7">
          <div className="eyebrow mb-5">Dados cadastrais</div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
            <Detail
              icon={isPF ? <UserCircle weight="light" /> : <Buildings weight="light" />}
              label={isPF ? "Nome" : "Razão social"}
              value={cliente.nome}
            />
            {document && (
              <Detail
                icon={<IdentificationCard weight="light" />}
                label={isPF ? "CPF" : "CNPJ"}
                value={<span className="font-mono tabular-nums tracking-tight">{document}</span>}
              />
            )}
            {isPF && cliente.rg && (
              <Detail icon={<IdentificationCard weight="light" />} label="RG" value={cliente.rg} />
            )}
            {isPF && cliente.data_nascimento && (
              <Detail
                icon={<Calendar weight="light" />}
                label="Data de nascimento"
                value={formatDateBR(cliente.data_nascimento)}
              />
            )}
            {!isPF && cliente.data_fundacao && (
              <Detail
                icon={<Calendar weight="light" />}
                label="Data de fundação"
                value={formatDateBR(cliente.data_fundacao)}
              />
            )}
            {cliente.email && (
              <Detail
                icon={<EnvelopeSimple weight="light" />}
                label="Email"
                value={
                  <a
                    href={`mailto:${cliente.email}`}
                    className="text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    {cliente.email}
                  </a>
                }
              />
            )}
            {cliente.telefone && (
              <Detail icon={<Phone weight="light" />} label="Telefone" value={formatPhone(cliente.telefone)} />
            )}
          </dl>
        </Card>

        {/* Address */}
        {enderecoFull && (
          <Card className="col-span-12">
            <div className="eyebrow mb-5">Endereço</div>
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                <MapPin weight="light" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] leading-relaxed text-[var(--color-ink)]">{enderecoFull.line1}</p>
                <p className="text-[13px] text-[var(--color-ink-muted)] mt-0.5">{enderecoFull.line2}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Inscrições Estaduais — PJ only */}
        {!isPF && (
          <Card className="col-span-12">
            <div className="eyebrow mb-5">Inscrições Estaduais</div>
            {inscricoes.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                Nenhuma inscrição estadual cadastrada.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {inscricoes.map((i) => (
                  <li key={i.id} className="flex items-center gap-3">
                    <Badge tone="neutral" icon={<IdentificationCard weight="light" />}>
                      {i.estado}
                    </Badge>
                    <span className="font-mono tabular-nums text-[13.5px] text-[var(--color-ink)]">
                      {i.inscricao}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Contatos PJ */}
        {!isPF && (
          <Card className="col-span-12">
            <ContatosPJSection clienteId={cliente.id} />
          </Card>
        )}

        {/* Filiais — PJ matriz only */}
        {!isPF && cliente.tipo_unidade !== "filial" && (
          <Card className="col-span-12">
            <div className="eyebrow mb-5">Filiais</div>
            {filiais.length === 0 ? (
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                Esta matriz ainda não possui filiais. Cadastre uma empresa como filial e
                selecione esta matriz para vinculá-la aqui.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-hairline)] -mx-1">
                {filiais.map((f) => (
                  <li key={f.id}>
                    <Link
                      to={`/clientes/${f.id}`}
                      className="group flex items-center gap-4 px-1 py-3 transition-colors hover:bg-[var(--color-surface-muted)] rounded"
                    >
                      <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                        <Buildings weight="light" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-[var(--color-ink)] truncate">
                          {f.nome}
                        </div>
                        <div className="text-[12.5px] text-[var(--color-ink-muted)] font-mono tabular-nums">
                          {formatCNPJ(f.cnpj) || "—"}
                        </div>
                      </div>
                      {f.status_relacionamento === "inativo" && (
                        <Badge tone="neutral" className="!py-[1px] !text-[10px]">Inativo</Badge>
                      )}
                      <ArrowUpRight
                        weight="light"
                        className="w-4 h-4 text-[var(--color-ink-subtle)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-[2px] group-hover:-translate-y-[1px] group-hover:text-[var(--color-ink-soft)]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Processos */}
        <Card className="col-span-12">
          <ProcessosSection clienteId={cliente.id} />
        </Card>

        {/* Contratos */}
        <Card className="col-span-12">
          <ContratosSection context={{ kind: "cliente", clienteId: cliente.id }} />
        </Card>

        {/* Lançamentos */}
        <Card className="col-span-12">
          <LancamentosSection context={{ kind: "cliente", clienteId: cliente.id }} />
        </Card>

        {/* Agenda */}
        <Card className="col-span-12">
          <AgendaSection context={{ kind: "cliente", clienteId: cliente.id }} />
        </Card>

        {/* Observações */}
        {cliente.observacoes && (
          <Card className="col-span-12">
            <div className="flex items-start gap-4">
              <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                <FileText weight="light" />
              </div>
              <div className="flex-1">
                <div className="eyebrow mb-2">Observações</div>
                <p className="text-[14px] leading-relaxed text-[var(--color-ink-soft)] whitespace-pre-wrap">
                  {cliente.observacoes}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Timestamps footer */}
        <div className="col-span-12 flex items-center gap-5 text-[11.5px] text-[var(--color-ink-subtle)] pt-2 pb-6">
          <span>Criado em {formatDateBR(cliente.criado_em)}</span>
          <span className="text-[var(--color-ink-subtle)]">·</span>
          <span>Última atualização em {formatDateBR(cliente.atualizado_em)}</span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir cliente?"
        description={
          <>
            Esta ação remove permanentemente o cliente <strong>{cliente.nome}</strong>, seus
            contatos, todos os processos vinculados e todos os contratos vinculados.
            A exclusão é bloqueada quando há contratos ativos ou processos em andamento —
            nesses casos, inative ou encerre cada um antes.
          </>
        }
        confirmLabel="Excluir cliente"
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

function formatEndereco(c: Cliente): { line1: string; line2: string } | null {
  const hasAny = c.logradouro || c.cidade || c.bairro || c.cep;
  if (!hasAny) return null;
  const line1Parts = [c.logradouro, c.numero, c.complemento].filter(Boolean);
  const line1 = line1Parts.join(", ") || "—";
  const line2Parts = [c.bairro, [c.cidade, c.estado].filter(Boolean).join(" / "), c.cep ? `CEP ${formatCEP(c.cep)}` : null]
    .filter(Boolean);
  return { line1, line2: line2Parts.join(" · ") };
}
