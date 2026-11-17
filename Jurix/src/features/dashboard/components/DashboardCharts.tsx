import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "../../../lib/format/currency";
import { monthShortLabel } from "../period";
import type { ChartScenario, GrupoReceita, MesFluxo } from "../types";

const SLICE_COLORS = [
  "#1c2a3a", "#3f6f5f", "#8a5a2b", "#6b4a6f", "#2f5d7a", "#7a3b32", "#9aa0a6",
];

const tooltipStyle = {
  borderRadius: "0.75rem",
  border: "1px solid var(--color-hairline-strong)",
  background: "var(--color-surface)",
  fontSize: "12.5px",
  boxShadow: "0 8px 24px rgba(20,22,26,0.1)",
};

/** Compact axis label: 1234567 cents → "R$ 12k". */
function compactBRL(cents: number): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) return `R$ ${Math.round(reais / 1000)}k`;
  return `R$ ${Math.round(reais)}`;
}

export function EntradasSaidasChart({
  data,
  scenario,
}: {
  data: MesFluxo[];
  scenario: ChartScenario;
}) {
  // Past months show only realised cash; from today on, the pending lançamentos
  // are added per the selected scenario (garantido / pior / melhor).
  const rows = data.map((d) => {
    const entradas =
      d.entradas_pagas_cents +
      d.entradas_prev_garantidas_cents +
      (scenario === "melhor" ? d.entradas_prev_incertas_cents : 0);
    const saidas =
      d.saidas_pagas_cents +
      d.saidas_prev_garantidas_cents +
      (scenario === "pior" ? d.saidas_prev_incertas_cents : 0);
    return { mes: monthShortLabel(d.ano_mes), Entradas: entradas, Saídas: saidas };
  });

  // Render the larger-total series first (underneath) so the smaller one sits
  // on top — combined with translucent fills, both series stay legible.
  const totalEntradas = rows.reduce((acc, r) => acc + r.Entradas, 0);
  const totalSaidas = rows.reduce((acc, r) => acc + r.Saídas, 0);

  const entradasArea = (
    <Area
      key="entradas"
      type="monotone"
      dataKey="Entradas"
      stroke="var(--color-positive)"
      strokeWidth={2}
      fill="url(#fillEntradas)"
      activeDot={{ r: 4 }}
    />
  );
  const saidasArea = (
    <Area
      key="saidas"
      type="monotone"
      dataKey="Saídas"
      stroke="var(--color-critical)"
      strokeWidth={2}
      fill="url(#fillSaidas)"
      activeDot={{ r: 4 }}
    />
  );
  const ordered =
    totalEntradas >= totalSaidas ? [entradasArea, saidasArea] : [saidasArea, entradasArea];

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <defs>
            <linearGradient id="fillEntradas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-positive)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--color-positive)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillSaidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-critical)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--color-critical)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-hairline)" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-hairline-strong)" }}
          />
          <YAxis
            tickFormatter={(v) => compactBRL(Number(v))}
            tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatBRL(Number(value))}
            cursor={{ stroke: "var(--color-hairline-strong)" }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {ordered}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data }: { data: GrupoReceita[] }) {
  const positivos = data.filter((d) => d.total_cents > 0);

  if (positivos.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-[13px] text-[var(--color-ink-muted)]">
        Sem receita recebida no período.
      </div>
    );
  }

  const total = positivos.reduce((acc, d) => acc + d.total_cents, 0);

  return (
    <div className="flex items-center gap-5">
      <div style={{ width: 168, height: 168 }} className="shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={positivos}
              dataKey="total_cents"
              nameKey="grupo_nome"
              innerRadius={48}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--color-surface)"
              strokeWidth={2}
            >
              {positivos.map((d, i) => (
                <Cell key={d.grupo_id} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatBRL(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 min-w-0 flex flex-col gap-2">
        {positivos.map((d, i) => (
          <li key={d.grupo_id} className="flex items-center gap-2.5 text-[12.5px]">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }}
            />
            <span className="flex-1 min-w-0 truncate text-[var(--color-ink-soft)]">
              {d.grupo_nome}
            </span>
            <span className="tabular-nums text-[var(--color-ink-muted)]">
              {Math.round((d.total_cents / total) * 100)}%
            </span>
            <span className="tabular-nums font-medium text-[var(--color-ink)] w-[92px] text-right">
              {formatBRL(d.total_cents)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
