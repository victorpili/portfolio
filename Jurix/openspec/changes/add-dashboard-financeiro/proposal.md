## Why

Once lancamentos and contratos are flowing through Jurix, the user needs a financial cockpit: how much came in, how much went out, who owes me, and what the next 3/6/12 months look like. The dashboard turns the raw transactional data into the decision-making surface — including a simulador for "what if?" planning.

## What Changes

- Introduce a `/dashboard` route with two main areas: **Visão Geral** (historic + current period) and **Projeção** (forward-looking).
- Implement a period selector (mês atual, trimestre, ano, personalizado) that drives every visão-geral widget.
- Compute and display: total de entradas recebidas, total de saídas, resultado líquido, ticket médio por cliente, inadimplência (valor + lista detalhada), recebíveis previstos para os próximos 7 e 30 dias.
- Render charts: entradas × saídas mês a mês (últimos 12 meses), receita por área do direito, receita por tipo de contrato.
- Render an alert when more than 40% of the period's faturamento comes from a single cliente.
- Implement the **Projeção** view covering the next 3, 6, and 12 months, splitting entradas garantidas from entradas não garantidas (ponderadas pela `chance_exito` do processo vinculado), and including saídas fixas previstas plus a resultado líquido projetado per scenario.
- Implement the **Simulador** with three modes: novo contrato mensalista, aumento de despesa fixa, perda de cliente. Each simulation renders the isolated impact plus the new projeção numbers and an indicator (saudável / atenção / crítico).

## Capabilities

### New Capabilities
- `dashboard-financeiro`: aggregated financial view with period filter, key metrics, charts, concentration alert, forward projection, and a what-if simulador.

### Modified Capabilities
<!-- none — but every other module's data is read here -->

## Impact

- No new tables (read-only over lancamentos, parcelas, processos, contratos, clientes, lookups).
- New Tauri commands for each aggregated query (small, focused; the dashboard composes them client-side).
- New React route, several chart components (recharts), a period selector, and the simulador form.
- Adds a runtime dependency on a chart library (recharts proposed in design).
