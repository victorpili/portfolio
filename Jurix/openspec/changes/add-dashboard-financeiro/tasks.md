## 1. Dependencies

- [x] 1.1 Add `recharts` to dependencies.
- [x] 1.2 Add a date library (date-fns) for period math. _(Already installed; now used by `period.ts`.)_

## 2. Backend (data layer — JS-driven via plugin-sql, read-only aggregations)

> All aggregations live in `src/features/dashboard/api.ts`, returning integer cents.
> Shared SQL building blocks treat avista lancamentos and parcelas uniformly.

- [x] 2.1 Implement `dashboardKpis(from, to)` — total_recebido, total_pago_saidas, resultado_liquido, ticket_medio (null when no payers), inadimplencia_total, num_clientes_pagantes.
- [x] 2.2 Implement `dashboardRecebimentosMensais()` — last 12 months, zero-filled.
- [x] 2.3 Implement `dashboardReceitaPorArea(from, to)` joined to `areas_direito` ("(inativo)" suffix; "Sem contrato" bucket).
- [x] 2.4 Implement `dashboardReceitaPorTipoContrato(from, to)` joined to `tipos_contrato`.
- [x] 2.5 Implement `dashboardConcentracao(from, to)` — per-cliente pct + `alert_eligible` (≥3 payers AND top > 40%).
- [x] 2.6 Implement `dashboardRecebiveisProximos(dias)` — sum + detailed list.
- [x] 2.7 Implement `dashboardInadimplenciaDetalhada()` — overdue list with `dias_atrasado`, ordered desc.
- [x] 2.8 Implement `dashboardProjecao()` — garantidas, nao_garantidas_ponderadas, saidas, resultado for 3/6/12 months, plus the "sem chance_exito" list and per-cliente contribution.
- [x] 2.9 Implement `simular(projecao, modo, params)` — pure TS function applying the modo delta over the projection baseline; returns baseline/delta/novo per horizon + indicador.

## 3. Frontend (React + Tailwind + recharts)

- [x] 3.1 Build `DashboardPage` with two top-level tabs: Visão Geral / Projeção.
- [x] 3.2 Build the `PeriodSelector` (4 buttons + a custom range modal) that drives the Visão Geral fetch.
- [x] 3.3 Build KPI cards bound to `dashboardKpis` — 4 cards (entradas recebidas, saídas pagas, ticket médio, inadimplência) plus a "Cenários do período" trio: pior cenário / lucro garantido / melhor cenário.
- [x] 3.4 Build the `EntradasSaidasChart` (area chart — translucent fills, smaller series on top) from `dashboardRecebimentosMensais`. Chart follows the selected period, not a fixed 12-month window.
- [x] 3.5 Build two donut charts: receita por área, receita por tipo de contrato.
- [x] 3.6 Build the próximos 7 / próximos 30 widgets with expandable detail lists.
- [x] 3.7 Build the inadimplência detail table sorted by dias_atrasado, paginated past 50 rows.
- [x] 3.8 Build the concentration alert banner (visible only when `alert_eligible = true`).
- [x] 3.9 Build the Projeção tab: three horizon cards (3/6/12) and a "Sem chance_exito atribuída" panel linking to processo edit.
- [x] 3.10 Build the Simulador with the three modes and the indicador visual (color-coded badge).

## 4. Verification

- [ ] 4.1 Manual smoke test on a seeded DB. **Requires Rust toolchain installed.** _(Pending — `tsc` + `npm run build` pass clean; DashboardPage lazy-loaded so recharts stays off the initial bundle.)_
- [x] 4.2 Run `npx openspec validate add-dashboard-financeiro`.
