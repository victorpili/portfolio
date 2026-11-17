import { NavLink } from "react-router-dom";
import {
  ChartLineUp,
  Users,
  Briefcase,
  Receipt,
  CurrencyCircleDollar,
  CalendarBlank,
  GearSix,
} from "@phosphor-icons/react";
import { cn } from "../../lib/cn";

interface NavEntry {
  to: string;
  label: string;
  icon: React.ComponentType<{ weight?: "thin" | "light" | "regular"; className?: string }>;
  comingSoon?: boolean;
}

const PRIMARY_NAV: NavEntry[] = [
  { to: "/dashboard", label: "Dashboard", icon: ChartLineUp },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/processos", label: "Processos", icon: Briefcase },
  { to: "/contratos", label: "Contratos", icon: Receipt },
  { to: "/lancamentos", label: "Lançamentos", icon: CurrencyCircleDollar },
  { to: "/agenda", label: "Agenda", icon: CalendarBlank },
];

const SECONDARY_NAV: NavEntry[] = [
  { to: "/configuracoes", label: "Configurações", icon: GearSix },
];

export function Sidebar() {
  return (
    <aside className="w-[244px] shrink-0 h-screen sticky top-0 flex flex-col bg-[var(--color-canvas)] border-r border-[var(--color-hairline)]">
      <div className="px-6 pt-8 pb-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[10px] bg-[var(--color-accent)] text-[var(--color-canvas)] flex items-center justify-center font-display text-[15px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            J
          </div>
          <div>
            <div className="text-[15px] font-medium tracking-tight">Jurix</div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-[var(--color-ink-muted)] mt-px">
              Gestão jurídica
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        <SectionLabel>Trabalho</SectionLabel>
        {PRIMARY_NAV.map((entry) => (
          <SidebarItem key={entry.to} entry={entry} />
        ))}

        <div className="mt-6" />
        <SectionLabel>Sistema</SectionLabel>
        {SECONDARY_NAV.map((entry) => (
          <SidebarItem key={entry.to} entry={entry} />
        ))}
      </nav>

      <div className="px-6 py-6 border-t border-[var(--color-hairline)]">
        <div className="text-[11px] text-[var(--color-ink-muted)] leading-relaxed">
          Versão 0.1.0
          <br />
          <span className="text-[var(--color-ink-subtle)]">Dados locais (SQLite)</span>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-subtle)]">
      {children}
    </div>
  );
}

function SidebarItem({ entry }: { entry: NavEntry }) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      end
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 px-3 py-2 rounded-[10px] text-[13.5px] font-medium",
          "transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isActive
            ? "bg-[var(--color-surface)] text-[var(--color-ink)] ring-1 ring-inset ring-[var(--color-hairline)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
            : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
        )
      }
    >
      <Icon weight="light" className="w-[18px] h-[18px] shrink-0" />
      <span className="flex-1">{entry.label}</span>
      {entry.comingSoon && (
        <span className="text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-subtle)]">
          em breve
        </span>
      )}
    </NavLink>
  );
}
