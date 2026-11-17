import { useState } from "react";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { cn } from "../../../lib/cn";
import { LookupManager } from "../components/LookupManager";
import type { LookupTable } from "../api";

interface TabDef {
  table: LookupTable;
  label: string;
  itemNoun: string;
  description: string;
}

const TABS: TabDef[] = [
  {
    table: "areas_direito",
    label: "Áreas do Direito",
    itemNoun: "área do direito",
    description: "Áreas de atuação usadas para classificar contratos.",
  },
  {
    table: "tipos_contrato",
    label: "Tipos de Contrato",
    itemNoun: "tipo de contrato",
    description: "Modalidades de honorário disponíveis ao cadastrar um contrato.",
  },
  {
    table: "centros_custo",
    label: "Centros de Custo",
    itemNoun: "centro de custo",
    description: "Categorias de destino para as saídas financeiras.",
  },
  {
    table: "origens",
    label: "Origens",
    itemNoun: "origem",
    description: "Canais de captação registrados no cadastro de clientes.",
  },
  {
    table: "tipos_evento",
    label: "Tipos de Evento",
    itemNoun: "tipo de evento",
    description: "Categorias de compromisso usadas na agenda.",
  },
];

export function ConfiguracoesPage() {
  const [activeTable, setActiveTable] = useState<LookupTable>("areas_direito");
  const active = TABS.find((t) => t.table === activeTable)!;

  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Gerencie as listas auxiliares usadas nos cadastros. Itens em uso não podem ser excluídos — desative-os para ocultá-los de novos formulários sem perder o histórico."
      />

      <div className="flex items-center gap-1 border-b border-[var(--color-hairline)] mb-7 flex-wrap">
        {TABS.map((tab) => {
          const isActive = tab.table === activeTable;
          return (
            <button
              key={tab.table}
              type="button"
              onClick={() => setActiveTable(tab.table)}
              className={cn(
                "relative px-4 py-2.5 text-[13.5px] font-medium",
                "transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                isActive
                  ? "text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {tab.label}
              {isActive && (
                <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-[var(--color-accent)]" />
              )}
            </button>
          );
        })}
      </div>

      <Card>
        <div className="eyebrow mb-1">{active.label}</div>
        <p className="text-[13.5px] text-[var(--color-ink-muted)] leading-relaxed mb-6">
          {active.description}
        </p>
        <LookupManager key={active.table} table={active.table} itemNoun={active.itemNoun} />
      </Card>
    </>
  );
}
