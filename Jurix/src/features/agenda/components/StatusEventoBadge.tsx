import { CheckCircle, Clock, Prohibit } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import type { StatusEvento } from "../types";
import { STATUS_EVENTO_LABEL } from "./calendar";

const TONE: Record<StatusEvento, "info" | "positive" | "neutral"> = {
  pendente: "info",
  concluido: "positive",
  cancelado: "neutral",
};

export function StatusEventoBadge({ status }: { status: StatusEvento }) {
  const icon =
    status === "concluido" ? (
      <CheckCircle weight="light" />
    ) : status === "cancelado" ? (
      <Prohibit weight="light" />
    ) : (
      <Clock weight="light" />
    );
  return (
    <Badge tone={TONE[status]} icon={icon}>
      {STATUS_EVENTO_LABEL[status]}
    </Badge>
  );
}
