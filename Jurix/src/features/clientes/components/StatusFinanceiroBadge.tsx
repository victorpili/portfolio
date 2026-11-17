import { CheckCircle, WarningCircle, Minus } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import type { StatusFinanceiro } from "../types";

export function StatusFinanceiroBadge({ status }: { status: StatusFinanceiro }) {
  if (status === "adimplente") {
    return (
      <Badge tone="positive" icon={<CheckCircle weight="light" />}>
        Adimplente
      </Badge>
    );
  }
  if (status === "inadimplente") {
    return (
      <Badge tone="critical" icon={<WarningCircle weight="light" />}>
        Inadimplente
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" icon={<Minus weight="light" />}>
      Sem movimentação
    </Badge>
  );
}
