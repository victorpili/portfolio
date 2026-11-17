import { useState } from "react";
import { PageHeader } from "../../../components/ui/PageHeader";
import { cn } from "../../../lib/cn";
import { VisaoGeralTab } from "../components/VisaoGeralTab";
import { ProjecaoTab } from "../components/ProjecaoTab";

type Tab = "geral" | "projecao";

const TABS: { value: Tab; label: string }[] = [
  { value: "geral", label: "Visão Geral" },
  { value: "projecao", label: "Projeção" },
];

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>("geral");

  return (
    <>
      <PageHeader
        eyebrow="Financeiro"
        title="Dashboard"
        description="O painel financeiro do escritório: o que entrou, o que saiu, o que está por vir e cenários hipotéticos."
      />

      <div className="flex items-center gap-1 border-b border-[var(--color-hairline)] mb-7">
        {TABS.map((t) => {
          const active = t.value === tab;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "relative px-4 py-2.5 text-[13.5px] font-medium transition-colors duration-200",
                active
                  ? "text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {t.label}
              {active && (
                <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-[var(--color-accent)]" />
              )}
            </button>
          );
        })}
      </div>

      {tab === "geral" ? <VisaoGeralTab /> : <ProjecaoTab />}
    </>
  );
}
