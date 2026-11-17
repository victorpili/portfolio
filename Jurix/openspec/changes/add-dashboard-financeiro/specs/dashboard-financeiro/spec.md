## ADDED Requirements

### Requirement: Dashboard exposes a period selector with four ranges
The dashboard SHALL provide a period selector with four options: `mes_atual`, `trimestre`, `ano`, `personalizado`. The chosen period SHALL drive every widget in the Visão Geral area. Default selection SHALL be `mes_atual`.

#### Scenario: Default period on first load
- **WHEN** the user opens the dashboard
- **THEN** the period selector reads `mes_atual` and every widget is computed for that range

#### Scenario: Personalizado requires a valid date range
- **WHEN** the user selects `personalizado` and provides `from_date > to_date`
- **THEN** the system rejects with a validation error and the previous period stays in effect

### Requirement: KPI widgets render total recebido, total pago, resultado, ticket médio, inadimplência
The system SHALL compute and display, for the selected period:
- **Total de entradas recebidas** = SUM of cents of entries with `natureza = 'entrada'` and `status_pagamento = 'pago'` whose `data_pagamento` falls in the period (treating parcelas and avista lancamentos uniformly).
- **Total de saídas** = SUM with `natureza = 'saida'` and `status_pagamento = 'pago'` in the same period.
- **Resultado líquido** = total_recebido − total_pago_saidas.
- **Ticket médio por cliente** = total_recebido / (distinct cliente_id paying in the period). When no clientes paid, the value SHALL be `0` and the widget SHALL render "—".
- **Inadimplência total** = SUM of cents of pendentes (parcelas + avista) whose `data_prevista < today`.

#### Scenario: Resultado liquid computed correctly
- **WHEN** the period totals are `total_recebido = 1500000` (R$ 15.000) and `total_pago_saidas = 600000` (R$ 6.000)
- **THEN** the resultado_liquido widget shows `R$ 9.000,00`

#### Scenario: Ticket médio with zero paying clients
- **WHEN** the period has zero rows where any cliente paid
- **THEN** the widget displays `—` and not `R$ 0,00` (to avoid implying a real zero ticket)

### Requirement: Recebíveis previstos widgets show next 7 and 30 days
The system SHALL provide two widgets summing receivables (parcelas + avista) whose `status_pagamento = 'pendente'` AND `data_prevista` falls in `[today, today + 7]` and `[today, today + 30]` respectively. Each widget SHALL also expose a clickable list of the contributing entries with cliente.nome and data_prevista.

#### Scenario: Próximos 7 dias only counts pending receivables
- **WHEN** a parcela has `status = 'pago'` with `data_prevista` within the next 7 days
- **THEN** that parcela is excluded from the próximos-7 widget

#### Scenario: Inadimplente entries are not future receivables
- **WHEN** a parcela has `status = 'pendente'` and `data_prevista < today`
- **THEN** it is included in the inadimplência KPI but NOT in the próximos-7 or próximos-30 widget

### Requirement: Inadimplência widget lists detailed overdue entries
The system SHALL expose the detailed list of overdue entries — joining cliente.nome, contrato.codigo (if any), processo.numero_cnj (if any), valor, data_prevista, dias_atrasado — ordered by dias_atrasado descending. The list SHALL paginate when more than 50 entries exist.

#### Scenario: Dias atrasado computed correctly
- **WHEN** today is 2026-05-15 and an entry's `data_prevista` is `"2026-05-10"`
- **THEN** the row shows `dias_atrasado = 5`

### Requirement: Entradas x Saídas chart covers the last 12 months
The system SHALL render a chart of `entradas` vs. `saidas` (paid, by `data_pagamento`) grouped by `YYYY-MM` for the last 12 months including the current month. Months with no activity SHALL be present in the dataset with value `0` so the axis is continuous.

#### Scenario: Sparse history shows zero-filled months
- **WHEN** the user has lancamentos only in the current and previous month
- **THEN** the chart still shows 12 monthly buckets, ten of which have value 0

#### Scenario: Bar ordering is chronological
- **WHEN** the chart renders
- **THEN** months appear left-to-right from oldest to current

### Requirement: Receita por área do direito and por tipo de contrato render as donut charts
The system SHALL render two donut charts of total recebido in the selected period, grouped by `contratos.area_direito_id` and by `contratos.tipo_contrato_id`. Entries without a linked contrato SHALL be grouped under "Sem contrato". Inactive lookup rows SHALL be labeled with `"(inativo)"` suffix.

#### Scenario: Entries without contrato fall into 'Sem contrato'
- **WHEN** the period includes a paid entrada whose `contrato_id` is NULL
- **THEN** its valor contributes to a slice labeled "Sem contrato"

### Requirement: Concentration alert triggers when one cliente exceeds 40% of period revenue
The system SHALL compute `pct_periodo = cliente_total / total_recebido` for each paying cliente. When at least 3 distinct paying clientes exist in the period AND the top cliente's `pct_periodo > 0.40`, the dashboard SHALL render a visible alert naming the cliente and the percentage. When fewer than 3 paying clientes exist, no alert SHALL be shown regardless of concentration.

#### Scenario: Alert shown with 4 clients and one above 40%
- **WHEN** the period has 4 paying clients and one accounts for 55% of total_recebido
- **THEN** the alert renders with the cliente's name and "55% do faturamento"

#### Scenario: Suppressed alert when only 2 clients
- **WHEN** the period has only 2 paying clients even if one accounts for 70%
- **THEN** no concentration alert is rendered

### Requirement: Projeção area covers 3, 6, and 12 months with garantidas + não garantidas + saídas
The system SHALL provide a separate "Projeção" view (tab) that computes, for horizons of 3 / 6 / 12 months ahead of today, three lines:
- **Entradas garantidas** = SUM of cents of pending entradas (parcelas + avista) with `garantido = true` whose `data_prevista` falls in `[today, today + N months]`.
- **Entradas não garantidas (ponderadas)** = SUM over the same date window where `garantido = false` AND the linked `processo.chance_exito IS NOT NULL`, of `valor × (chance_exito / 100)`.
- **Saídas previstas** = SUM of pending saídas in the window.
- **Resultado líquido projetado** = garantidas + nao_garantidas_ponderadas − saidas.

#### Scenario: Não garantida sem chance_exito is excluded
- **WHEN** a future entrada has `garantido = false` and its linked processo has `chance_exito = NULL`, OR has no linked processo
- **THEN** the entry is excluded from `entradas_nao_garantidas_ponderadas` and surfaced separately in a "Sem chance_exito atribuída" warning panel

#### Scenario: Garantida includes mensalidades pending future parcelas
- **WHEN** a parcelado mensalidade has parcelas due in months 1, 2, 3 ahead and the lancamento has `garantido = true`
- **THEN** all three parcelas contribute to entradas_garantidas at their respective monthly buckets

#### Scenario: Ponderação uses chance_exito / 100
- **WHEN** a non-guaranteed entrada with `valor = 500000` is linked to a processo with `chance_exito = 60`
- **THEN** it contributes `300000` (cents) to entradas_nao_garantidas_ponderadas in its month bucket

### Requirement: Sem chance_exito atribuída panel surfaces unrated processos
The projeção area SHALL display, next to "Entradas não garantidas", a panel listing the lancamentos that were skipped because their linked processo lacks a `chance_exito`. Each row SHALL be clickable, opening the processo for editing.

#### Scenario: Panel updates when chance_exito is attributed
- **WHEN** the user opens the processo from the panel and saves `chance_exito = 70`
- **THEN** on returning to the projeção, that lancamento moves out of the panel and into `entradas_nao_garantidas_ponderadas` with weight 0.7

### Requirement: Simulador supports three modes against the projection baseline
The system SHALL provide a "Simulador" panel inside the Projeção view with three modes selectable by radio button:
- **Novo contrato mensalista (+R$ X / mês)** — user enters `X` in BRL; simulator adds `X × N` to entradas garantidas for each horizon N (3, 6, 12 months).
- **Aumento de despesa fixa (+R$ X / mês)** — user enters `X`; simulator subtracts `X × N` from saídas for each horizon.
- **Perda de cliente Y** — user selects a cliente; simulator excludes that cliente's lancamentos from the entradas (both garantidas and ponderadas) and recomputes.

Only one simulation SHALL be active at a time. The result panel SHALL show:
- **Delta isolado por horizonte** for 3 / 6 / 12 meses.
- **Novo resultado projetado** = baseline + delta, por horizonte.
- **Indicador visual** computed from the 12-month projected resultado_liquido:
  - `saudavel` ⇨ projected ≥ 0 AND projected ≥ 80% × baseline_12.
  - `atencao` ⇨ projected ≥ 0 AND projected < 80% × baseline_12.
  - `critico` ⇨ projected < 0.

#### Scenario: Simulate +R$ 5.000/mês new contract
- **WHEN** the user selects "Novo contrato mensalista" and types R$ 5.000
- **THEN** the result shows deltas of `+R$ 15.000`, `+R$ 30.000`, `+R$ 60.000` for the 3, 6, 12-month horizons

#### Scenario: Simulate perda de cliente Y
- **WHEN** the user selects "Perda de cliente" and picks cliente Y, who contributes R$ 8.000 in baseline entradas over 12 months
- **THEN** the result shows a 12-month delta of −R$ 8.000 against the baseline

#### Scenario: Indicator turns critico when projection goes negative
- **WHEN** the simulator produces a 12-month projected resultado_liquido of −R$ 1.500
- **THEN** the visual indicator renders `critico`

#### Scenario: Only one simulation active at a time
- **WHEN** the user switches the simulator radio from "Perda de cliente" to "Aumento de despesa fixa"
- **THEN** the perda-de-cliente parameters are cleared and the despesa-fixa parameters take effect

### Requirement: All financial values are presented in BRL and stored in cents
The dashboard SHALL display every monetary value formatted as BRL (`R$ 1.234,56`). Every backend command for the dashboard SHALL return integer cents. The frontend SHALL do the formatting; no formatting SHALL happen server-side.

#### Scenario: Backend returns cents
- **WHEN** the dashboard calls `dashboard_kpis(...)`
- **THEN** the response has integer fields like `total_recebido_cents: 1500000` — never strings, never decimals
