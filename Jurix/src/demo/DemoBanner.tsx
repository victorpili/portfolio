import { useState } from "react";
import { Info, X } from "@phosphor-icons/react";

/** Aviso fixo da demo web: dados fictícios, nada sai do navegador. */
export function DemoBanner() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div
      role="note"
      className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-[var(--color-hairline-strong)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink-soft)] shadow-lg"
    >
      <Info size={20} weight="light" className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
      <p>
        <strong className="text-[var(--color-ink)]">Demo do Jurix.</strong> Os dados são fictícios e o
        banco roda só no seu navegador: pode criar, editar e excluir à vontade. Recarregar a página
        restaura o estado inicial.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Fechar aviso"
        className="shrink-0 rounded-md p-0.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      >
        <X size={16} weight="light" />
      </button>
    </div>
  );
}
