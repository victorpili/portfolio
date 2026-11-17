## Context

A lancamento is the smallest financial unit. The user wants to enter a recurring mensalidade once and have Jurix track every monthly parcela's due date and payment state. They also need ad-hoc entries (one-off payments, court costs, office expenses). Several invariants depend on `tipo` and `natureza`:

- `tipo` legal values depend on `natureza`.
- `garantido` is auto-false for `sucumbencia` and `acordo`.
- `centro_custo_id` only applies to saídas.
- `num_parcelas` is only valid when `forma_pagamento = parcelado`.

The semantics of `valor` itself depends on `forma_pagamento`: stored as the total for avista, as the per-parcela amount for parcelado. This is the most error-prone part of the schema and the place the spec scenarios most need to be airtight.

## Goals / Non-Goals

**Goals:**
- Single insert generates N parcelas atomically.
- Status lifecycle that supports partial payments without losing audit trail.
- Type-conditional invariants enforced at the backend, not just the UI.
- Queries fast enough for the dashboard to aggregate over 12 months of history.

**Non-Goals:**
- Bank integration / automatic reconciliation — manual marking only.
- Multi-currency.
- Tax / NF-e issuance — out of scope; `numero_documento` is just a free-text field for the user's own reference.

## Decisions

### `lancamento` and `parcela` as separate tables
A parcelado lancamento writes one row to `lancamentos` and N rows to `parcelas`. An avista lancamento writes only to `lancamentos`. Aggregation queries union the two correctly via a CASE on `forma_pagamento`.
- Alternative considered: storing one row per parcela in a single `lancamentos` table. Rejected because it loses the "this is one logical contract milestone" grouping the user thinks in.
- Alternative considered: representing avista as a 1-parcela parcelado lancamento. Rejected — adds query joins for the common case.

### Parcela due dates: same day of month, clamped to month's last day
The user types `data_primeira_parcela` (the first parcela's due date) and `num_parcelas`. The system writes N parcelas all on the same day of the month (`day = day(data_primeira_parcela)`). When the target month has fewer days than that — Feb 29/30/31, Apr/Jun/Sep/Nov 31 — the parcela's `data_prevista` is the last day of that month. The day stays "anchored" to the original chosen day for all subsequent parcelas (i.e. if the first parcela falls on Jan 31, parcela 2 is Feb 28 (or 29 in leap year), parcela 3 is Mar 31 — not Mar 28).
- Alternative considered: strict +30 days per parcela. Rejected — users expect mensalidades on the same day each month, not slowly drifting backwards.
- Alternative considered: snap forward to the next valid date (e.g. Jan 31 → Mar 1). Rejected — Brazilian commercial convention is to use the last day of the month, not roll into the next.

### `valor` semantics depend on `forma_pagamento`
- `forma_pagamento = 'avista'` → `valor` is the total amount in cents; no rows in `parcelas`.
- `forma_pagamento = 'parcelado'` → `valor` is the per-parcela amount in cents; the system writes N parcelas, each with that `valor`; the lancamento total is `valor × num_parcelas`.

### Type-conditional `tipo` values
Two enums depending on `natureza`:
- `natureza = 'entrada'` → `tipo ∈ {mensalidade, pagamento_unico, sucumbencia, acordo, reembolso_custas}`.
- `natureza = 'saida'` → `tipo ∈ {despesa_escritorio, custas_processuais, reembolso_cliente}`.

Backend rejects type/natureza mismatches.

### `garantido` is auto-false for sucumbencia and acordo
On insert/update, when `tipo ∈ {sucumbencia, acordo}` the system forces `garantido = false` regardless of input. For other tipos, the user controls the field. The dashboard's "entradas não garantidas" projection includes only `garantido = false` rows.

### `centro_custo_id` only for saídas
- `natureza = 'saida'` → `centro_custo_id` required (NOT NULL at insert time).
- `natureza = 'entrada'` → `centro_custo_id` MUST be NULL.

### Status lifecycle
At lancamento level: `pendente`, `pago`, `parcialmente_pago`, `cancelado`, `inadimplente`. At parcela level: `pendente`, `pago`, `inadimplente`.

For parcelado lancamentos the parent `status_pagamento` is derived from the parcelas:
- All parcelas `pago` → lancamento `pago`.
- Any parcela `pago` AND any other not `pago` → lancamento `parcialmente_pago`.
- No parcela `pago` AND any parcela `inadimplente` → lancamento `inadimplente`.
- No parcela `pago` AND no parcela `inadimplente` → lancamento `pendente`.
- User-set `cancelado` is sticky and overrides derivation.

For avista lancamentos the user sets `status_pagamento` directly.

### `data_prevista` is non-null only for avista
For avista, `data_prevista` is the planned payment date. For parcelado, each parcela carries its own `data_prevista`; the lancamento's `data_prevista` is NULL.

### `inadimplente` is a computed flag exposed by queries
A parcela / avista lancamento is considered inadimplente when `status_pagamento = 'pendente'` AND `data_prevista < today`. The user MAY also flip the status to `inadimplente` manually; either path produces the same effective state for dashboard queries. Background recomputation runs on app start and on each list refresh.

## Risks / Trade-offs

- **[`valor` ambiguity]** → The semantics swap between avista and parcelado. Mitigation: clear UI copy ("Valor total" vs "Valor de cada parcela"); backend logs both interpretations in the response so callers can sanity-check.
- **[Parcela generation drift]** → If the user edits `num_parcelas` after creation, parcelas need rebuilding. Mitigation: spec rejects edits to `num_parcelas` once any parcela is `pago`; otherwise it cascades a re-generation.
- **[Status drift between lancamento and parcelas]** → Mitigation: a single command `lancamentos_recompute_status(id)` is the only writer to the lancamento `status_pagamento` for parcelado entries; the UI never sets it directly.
- **[Dashboard query cost]** → Indexes on `lancamentos.cliente_id`, `lancamentos.contrato_id`, `lancamentos.natureza`, and `parcelas.lancamento_id` / `parcelas.data_prevista` keep dashboard queries fast.

## Migration Plan

- Greenfield; runs after clientes, processos, contratos, and the cadastros (centros_custo) migrations.
- Migrations `0005_create_lancamentos.sql` and `0006_create_parcelas.sql`.
