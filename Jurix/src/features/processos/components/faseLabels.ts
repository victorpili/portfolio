import type { FaseProcesso, Processo } from "../types";

export const FASE_LABELS: Record<FaseProcesso, string> = {
  conhecimento: "Conhecimento",
  recurso: "Recurso",
  execucao: "Execução",
  arquivado: "Arquivado",
  outro: "Outro",
};

export const FASE_OPTIONS: { value: FaseProcesso; label: string }[] = [
  { value: "conhecimento", label: "Conhecimento" },
  { value: "recurso", label: "Recurso" },
  { value: "execucao", label: "Execução" },
  { value: "arquivado", label: "Arquivado" },
  { value: "outro", label: "Outro…" },
];

export function faseDisplay(p: Pick<Processo, "fase" | "fase_custom">): string {
  if (p.fase === "outro" && p.fase_custom) return p.fase_custom;
  return FASE_LABELS[p.fase];
}
