## Why

Lancamentos are the financial heartbeat of Jurix. Every entrada (mensalidade, sucumbência, acordo, reembolso) and every saída (despesa, custas) is captured here, and every downstream financial computation — contrato resumo, client status_financeiro, the dashboard's totals and projections — reads from this table. Without lancamentos the system has nothing financial to show.

## What Changes

- Introduce a `lancamentos` table with `natureza` (entrada / saida) and a `tipo` enumeration whose accepted values depend on `natureza`.
- Introduce a `parcelas` child table populated automatically when a lancamento is `parcelado`.
- Auto-generate N parcelas at lancamento save time, with `data_prevista` = first_due + 30 days × (parcela_number - 1).
- Auto-set `garantido = false` whenever `tipo` is `sucumbencia` or `acordo` (these are inherently uncertain receivables).
- Provide a `centro_custo_id` FK that SHALL only be set for saídas.
- Provide `status_pagamento` with five values (pendente / pago / parcialmente_pago / cancelado / inadimplente) at the lancamento level; mirrored at the parcela level (excluding `parcialmente_pago` and `cancelado` for parcelas).
- Provide `forma_pagamento` (avista / parcelado) with `num_parcelas` required when parcelado.
- Store `valor` semantics that depend on `forma_pagamento`: total amount for avista, per-parcela amount for parcelado.

## Capabilities

### New Capabilities
- `lancamentos`: financial entries with type-conditional rules, automatic parcela generation, status lifecycle, and references that power downstream financial views.

### Modified Capabilities
<!-- none — but enables contratos_resumo_financeiro to actually return values, and clientes_status_financeiro to compute -->

## Impact

- New SQLite tables: `lancamentos`, `parcelas`.
- Migrations `0005_create_lancamentos.sql` and `0006_create_parcelas.sql`.
- New Tauri commands: CRUD for lancamentos, payment marking for both lancamentos and parcelas, query commands that the dashboard and contrato resumo will call.
- New React routes/screens: list, create, edit, detail of a lancamento; embedded views within contratos and clientes.
- Cross-module: depends on clientes, processos, contratos, centros_custo (cadastros).
