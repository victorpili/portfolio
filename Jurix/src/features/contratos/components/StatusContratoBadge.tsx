import { CheckCircle, Pause, Archive } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import type { StatusContrato } from "../types";

export function StatusContratoBadge({ status }: { status: StatusContrato }) {
  if (status === "ativo") {
    return (
      <Badge tone="positive" icon={<CheckCircle weight="light" />}>
        Ativo
      </Badge>
    );
  }
  if (status === "suspenso") {
    return (
      <Badge tone="warning" icon={<Pause weight="light" />}>
        Suspenso
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" icon={<Archive weight="light" />}>
      Inativo
    </Badge>
  );
}
