## Context

A contrato is owned by exactly one client, may optionally point at one processo, and is classified by `area_direito` and `tipo_contrato` (both from the cadastros-auxiliares module). It is the financial parent of N lancamentos. The user wants a glance-able summary on the contrato page so they don't need to open the lancamentos screen to know "how much have I billed under this contract."

## Goals / Non-Goals

**Goals:**
- Predictable, human-readable contract codes that survive year rollovers.
- Always-fresh financial totals, computed from lancamentos.
- Frictionless lancamento creation from inside a contrato.
- Status lifecycle that integrates with the clientes deletion guard.

**Non-Goals:**
- Contract templates / digital signature workflow — out of scope.
- Time-tracking / billable hours — financial entries are captured via lancamentos directly.
- Multi-currency — BRL only.

## Decisions

### Auto-generated codigo with per-year sequence
Format: `CTR-{YYYY}-{NNNN}` where `YYYY` is the year of `data_inicio` (or creation date if data_inicio is empty) and `NNNN` is a 1-based sequence within that year. The user CAN edit the code after creation; the system MUST keep it unique.
- Alternative considered: monotonic global sequence (`CTR-{NNNN}`). Rejected because lawyers expect codes to encode the year.
- Alternative considered: UUID short hash. Rejected for readability.

### Sequence computed at insert time
A SQL transaction reads `MAX(sequence)` for the contrato's year and inserts `sequence + 1`. On collision (user edits a code and conflicts) the unique index rejects it and the UI surfaces the conflict.

### Status as enum with three values
`ativo` (default), `inativo`, `suspenso`. The clientes deletion guard considers only `ativo`. `suspenso` is a soft pause that does not block deletion but does change the contract's visual indicator in the list.

### Financial summary computed on demand
A single Tauri command `contratos_resumo_financeiro(contrato_id)` returns:
- `total_faturado` — SUM of valor of all `lancamentos` for this contrato where `natureza = 'entrada'`.
- `total_recebido` — SUM of valor where `natureza = 'entrada'` AND `status_pagamento = 'pago'`.
- `total_em_aberto` — SUM of valor where `natureza = 'entrada'` AND `status_pagamento IN ('pendente', 'parcialmente_pago', 'inadimplente')`.
- For parcelado lancamentos these aggregations operate at the parcela level.
- Alternative considered: persisted aggregates updated via triggers. Rejected — too risky for a small dataset; recompute is fast enough and never drifts.

### `link_documentos` as a single URL
Same pattern as processos — external storage; one TEXT URL.

### Inline lancamento creation in contrato detail
The contrato detail screen exposes a "Novo lançamento" CTA that opens the lancamentos form with `cliente_id` and `contrato_id` pre-filled and locked.

## Risks / Trade-offs

- **[codigo collision on user edit]** → A UNIQUE index on `codigo` enforces it; the UI surfaces the conflict and prompts a new value.
- **[Year boundary edge cases]** → If a user changes `data_inicio` to another year after creation, the codigo does not auto-update; the field becomes informational. Mitigation: tooltip on the codigo field explains this.
- **[Aggregation cost as lancamentos grow]** → Negligible for the target user. Indexes on `lancamentos.contrato_id` keep this O(n) where n is small.

## Migration Plan

- Migration `0004_create_contratos.sql` runs after clientes (0001), contatos_pj (0002), and processos (0003), plus the cadastros-auxiliares migration that creates `areas_direito` and `tipos_contrato`.
