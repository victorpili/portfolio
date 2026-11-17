## Context

The dashboard reads from every other module. It needs to be fast (the user opens it many times a day) and correct (financial numbers must reconcile with the lancamentos screen). It also needs a thoughtful projection model: future revenue is uncertain, and the two-bucket split (garantida vs. não garantida ponderada por chance_exito) is the user's mental model.

## Goals / Non-Goals

**Goals:**
- Read-only over the existing schema — no new tables.
- Aggregations are pure SQL where possible; complex composition happens in the Rust command, not in JS.
- Period selector covers the four user-visible ranges with consistent semantics.
- Projection numbers reconcile exactly with what the user sees in lancamentos.
- Simulador deltas are computed against the current projection baseline — never against ad-hoc inputs.

**Non-Goals:**
- Drill-down on every chart cell (clicking a chart bar to see contributing rows is a nice-to-have, not MVP-blocking).
- Forecasting based on historical growth — projection in MVP is the deterministic sum of scheduled future entries.
- Exporting reports to PDF — out of scope for MVP.

## Decisions

### Period semantics
- "Mês atual": from the 1st of the current month through the last day of the current month, inclusive.
- "Trimestre": the calendar quarter containing today.
- "Ano": from January 1st through December 31st of the current year.
- "Personalizado": user-picked `from_date`, `to_date`, inclusive on both ends.

All period queries match against `lancamentos.data_pagamento` for "Total recebido" type metrics and against `parcelas.data_prevista` / `lancamentos.data_prevista` for "recebíveis previstos" / "inadimplência" metrics.

### Charts library: recharts
- Why: React-native, declarative, small bundle, supports the chart types we need (line, bar, donut).
- Alternative considered: visx — more flexible but more code per chart for our simple use cases.
- Alternative considered: Chart.js — imperative API; less idiomatic in React.

### Aggregation queries
- `dashboard_kpis(from_date, to_date)` returns total_recebido, total_pago_saidas, resultado_liquido, num_clientes_ativos_periodo, ticket_medio, total_inadimplencia.
- `dashboard_recebimentos_mensais(from_date, to_date)` returns rows `{ano_mes, entradas, saidas}` for the 12-month line chart.
- `dashboard_receita_por_area(from_date, to_date)` returns rows `{area_direito_id, area_nome, total}` for the donut chart.
- `dashboard_receita_por_tipo_contrato(from_date, to_date)` returns the same shape over `tipo_contrato`.
- `dashboard_concentracao(from_date, to_date)` returns `[{cliente_id, cliente_nome, total, pct_periodo}]` sorted desc; the UI surfaces an alert when the top row's `pct_periodo > 0.40`.
- `dashboard_recebiveis_proximos(dias)` returns the sum and list of receivables with `data_prevista` within `[today, today + dias]`.
- `dashboard_inadimplencia_detalhada()` returns the list of overdue entries (joined with cliente + contrato + processo names).

### Projection model
- Time horizon: 3 / 6 / 12 months from today.
- **Entradas garantidas**: future `parcelas` (parcelado) plus future `lancamentos.data_prevista` (avista) with `status_pagamento = 'pendente'` AND `garantido = true`.
- **Entradas não garantidas**: same set but with `garantido = false`. Each entry's contribution is weighted by the linked processo's `chance_exito / 100`. If the entry has no linked processo, its weight is 0 (it cannot be assessed) — the UI shows these in a separate "Sem chance_exito atribuída" bucket so the user can fix them.
- **Saídas fixas previstas**: future `lancamentos` with `natureza = 'saida'` AND `status_pagamento = 'pendente'`. (No recurrence engine in MVP — the user must enter future expense lancamentos to project them.)
- **Resultado líquido projetado**: garantidas + ponderadas_não_garantidas − saídas.

### Simulador
Three simulation modes, each takes a parameter and returns the delta versus the current projection baseline for 3/6/12 months:
- **Novo contrato mensalista (+R$ X / mês)**: adds `X × N` to the entradas garantidas of the next N months (N ∈ {3, 6, 12}).
- **Aumento de despesa fixa (+R$ X / mês)**: subtracts `X × N` from the saídas.
- **Perda de cliente (remover receita do cliente Y)**: re-runs the projection excluding lancamentos linked to cliente Y. Delta = baseline − simulado.

Each simulação renders three values:
- Delta isolado por horizonte (3/6/12 meses).
- Novo resultado projetado (baseline + delta) por horizonte.
- Indicador visual:
  - `saudavel` when projected resultado_liquido_12 ≥ 0 AND ≥ 80% of baseline.
  - `atencao` when ≥ 0 but < 80%.
  - `critico` when < 0.

### Frontend composition
The dashboard page hits the seven query commands in parallel and composes them. Each widget is independently lazily rendered with a skeleton while loading. Period changes refetch in parallel.

## Risks / Trade-offs

- **[Não garantidas without chance_exito]** → They cannot be weighted. Mitigation: surface them in a separate bucket with a CTA "atribuir chance_exito ao processo X". They do not silently default to 0%.
- **[Mes-a-mes chart on a sparse history]** → For users with little data the chart looks empty. Mitigation: zero-fill the 12 months grid so the chart always shows a clean axis.
- **[Concentration alert false alarms]** → For users with few clients the 40% threshold is easily tripped. Mitigation: only surface the alert when there are at least 3 distinct payer clientes in the period.
- **[Simulador double-counting]** → "Perda de cliente" + "Novo contrato" stacked could be confusing. Mitigation: the UI permits only one active simulação at a time in MVP.
- **[recharts bundle size]** → Adds ~80 KB gzipped to the renderer. Acceptable for a desktop app.

## Migration Plan

- Read-only — no schema changes. Adds the `recharts` dependency.
