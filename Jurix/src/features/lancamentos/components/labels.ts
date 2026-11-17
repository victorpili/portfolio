import { todayIso } from "../../../lib/format/dates";
import type {
  Natureza,
  Parcela,
  StatusPagamento,
  StatusParcela,
  TipoLancamento,
} from "../types";

export const NATUREZA_LABELS: Record<Natureza, string> = {
  entrada: "Entrada",
  saida: "Saída",
};

export const TIPO_LABELS: Record<TipoLancamento, string> = {
  mensalidade: "Mensalidade",
  pagamento_unico: "Pagamento único",
  sucumbencia: "Sucumbência",
  acordo: "Acordo",
  reembolso_custas: "Reembolso de custas",
  despesa_escritorio: "Despesa do escritório",
  custas_processuais: "Custas processuais",
  reembolso_cliente: "Reembolso ao cliente",
};

export const TIPO_OPTIONS_ENTRADA: { value: TipoLancamento; label: string }[] = [
  { value: "mensalidade", label: "Mensalidade" },
  { value: "pagamento_unico", label: "Pagamento único" },
  { value: "sucumbencia", label: "Sucumbência" },
  { value: "acordo", label: "Acordo" },
  { value: "reembolso_custas", label: "Reembolso de custas" },
];

export const TIPO_OPTIONS_SAIDA: { value: TipoLancamento; label: string }[] = [
  { value: "despesa_escritorio", label: "Despesa do escritório" },
  { value: "custas_processuais", label: "Custas processuais" },
  { value: "reembolso_cliente", label: "Reembolso ao cliente" },
];

export const STATUS_PAGAMENTO_LABELS: Record<StatusPagamento, string> = {
  pendente: "Pendente",
  pago: "Pago",
  parcialmente_pago: "Parcialmente pago",
  cancelado: "Cancelado",
  inadimplente: "Inadimplente",
};

export const STATUS_PARCELA_LABELS: Record<StatusParcela, string> = {
  pendente: "Pendente",
  pago: "Pago",
  inadimplente: "Inadimplente",
};

/** Effective parcela status — a pending parcela past its due date reads as inadimplente. */
export function parcelaStatusEfetivo(p: Parcela): StatusParcela {
  if (p.status === "pendente" && p.data_prevista < todayIso()) return "inadimplente";
  return p.status;
}
