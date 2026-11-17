import { CircleDashed, Pause, Flag } from "@phosphor-icons/react";
import { Badge } from "../../../components/ui/Badge";
import type { StatusProcesso } from "../types";

/**
 * Status colour language for processos (requested by the user):
 *   em_andamento → verde   (positive)
 *   suspenso     → laranja (warning)
 *   encerrado    → vermelho (critical)
 */
export function StatusProcessoBadge({ status }: { status: StatusProcesso }) {
  if (status === "em_andamento") {
    return (
      <Badge tone="positive" icon={<CircleDashed weight="light" />}>
        Em andamento
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
    <Badge tone="critical" icon={<Flag weight="light" />}>
      Encerrado
    </Badge>
  );
}

/** Shared colour tokens for the processo status — reused by the form's status dropdown. */
export const STATUS_PROCESSO_DOT: Record<StatusProcesso, string> = {
  em_andamento: "var(--color-positive)",
  suspenso: "var(--color-warning)",
  encerrado: "var(--color-critical)",
};
