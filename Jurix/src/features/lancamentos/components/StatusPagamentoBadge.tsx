import { CircleDashed, CheckCircle, CircleHalf, WarningCircle, Prohibit } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import type { StatusPagamento, StatusParcela } from "../types";
import { STATUS_PAGAMENTO_LABELS } from "./labels";

type AnyStatus = StatusPagamento | StatusParcela;

const TONE: Record<AnyStatus, "neutral" | "positive" | "warning" | "critical" | "info"> = {
  pendente: "neutral",
  pago: "positive",
  parcialmente_pago: "info",
  inadimplente: "critical",
  cancelado: "neutral",
};

export function StatusPagamentoBadge({ status }: { status: AnyStatus }) {
  const label = STATUS_PAGAMENTO_LABELS[status as StatusPagamento] ?? status;
  const icon =
    status === "pago" ? (
      <CheckCircle weight="light" />
    ) : status === "parcialmente_pago" ? (
      <CircleHalf weight="light" />
    ) : status === "inadimplente" ? (
      <WarningCircle weight="light" />
    ) : status === "cancelado" ? (
      <Prohibit weight="light" />
    ) : (
      <CircleDashed weight="light" />
    );
  return (
    <Badge tone={TONE[status]} icon={icon}>
      {label}
    </Badge>
  );
}
