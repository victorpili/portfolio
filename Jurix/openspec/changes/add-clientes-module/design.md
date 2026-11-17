## Context

Jurix is a single-user desktop application. The clients table is the root of nearly every other entity (processos, contratos, lancamentos, agenda). Two structural choices drive the rest of the system:

1. **One table for PF + PJ vs. two tables** — the dataset is small (hundreds, not millions) and the overlap is large, so a single table with a discriminator column wins.
2. **Document storage format** — Brazilian documents are routinely typed, pasted, and exported in mixed formats; uniqueness checks break unless we normalize.

## Goals / Non-Goals

**Goals:**
- Single source of truth for client data across all modules.
- Uniqueness of CPF (per PF) and CNPJ (per PJ).
- Type-conditional UI without conditional SQL columns.
- Safe deletion semantics — no orphan contracts.

**Non-Goals:**
- Importing clients from external systems (CSV import is a future enhancement).
- Validating CPF / CNPJ check digits at the SQL layer — handled in the application.
- Multi-user / multi-tenant — Jurix is single-user local.

## Decisions

### Single `clientes` table with `tipo` discriminator
Use one table with a `tipo` column (`pf` | `pj`). PF-only and PJ-only fields coexist as nullable columns; the UI hides irrelevant fields.
- Alternative considered: separate `pessoas_fisicas` / `pessoas_juridicas` tables. Rejected because every FK from processos/contratos/lancamentos would need a polymorphic join — a bad trade for a tiny benefit.

### Documents stored as digit-only strings
`cpf` and `cnpj` are stored as 11- and 14-character digit-only strings. Formatting (e.g. `123.456.789-09`) is purely a display-layer concern.
- Why: uniqueness comparison and search work without normalization at query time.
- Alternative considered: storing already-formatted strings. Rejected — duplicates would slip through whenever input formatting varied.

### `status_financeiro` computed, not persisted
Derived in real time from the `lancamentos` table:
- `inadimplente` → any lancamento with `status_pagamento = 'inadimplente'` or `status_pagamento = 'pendente'` AND `data_prevista < hoje`.
- `sem_movimentacao` → no lancamentos exist for this client.
- `adimplente` → otherwise.
- Why: it must always reflect the latest lancamentos state; persisting invites drift.

### `status_relacionamento` is manual
Only the user toggles it. Inactivating a client does NOT cascade — historical contracts/processes remain. The list view defaults to filtering active clients.

### Deletion blocked by active contracts and in-progress processos; otherwise cascades
Hard-delete is allowed only when no contract has `status = 'ativo'` AND no processo has `status = 'em_andamento'`. The user must first inactivate contracts and encerrar/suspender processos. Once allowed, deletion cascades: the system deletes the client's `contratos`, then `processos`, then the `clientes` row (which cascades `contatos_pj` via the FK). Order is `contratos → processos → clientes` because `contratos.processo_id` references `processos` — deleting contratos first avoids an FK violation.
- Why cascade instead of leaving orphans: `processos.cliente_id` and `contratos.cliente_id` are `NOT NULL` FKs with no `ON DELETE` action, so a bare `DELETE FROM clientes` fails with a foreign-key error whenever any processo/contrato exists. The user explicitly wants related processos removed together with the client.
- **No manual transaction**: `tauri-plugin-sql` draws a connection from a pool for every `execute()` call, so a `BEGIN`/`COMMIT` spread across separate `execute()` calls would leave a transaction dangling on a different pooled connection and lock the database. The cascade is therefore three independent auto-committed statements. The validation gates guarantee, in the current schema, that none of them can fail on an FK constraint, so atomicity is not needed; if a delete somehow failed mid-cascade, re-running the delete is idempotent and self-heals.
- Alternative considered: cascading soft-delete. Rejected for a single-user app — explicit blocking + hard cascade is simpler to reason about.
- Alternative considered: `ON DELETE CASCADE` at the schema level (which WOULD be atomic via SQLite's per-statement implicit transaction). Viable future hardening, but deferred to avoid recreating three tables in a migration; the ordered deletes give the same observable result.

### `contatos_pj` as a separate child table
PJ clients can hold N named contacts. Modeled as `contatos_pj` with FK `cliente_id` and `ON DELETE CASCADE` (cascade fires only because deletion already required zero active contracts).

### `origem_id` is an FK, not free text
Forces consistency across the database and powers analytics. Delivered by the cadastros-auxiliares capability.

## Risks / Trade-offs

- **[Schema drift between PF and PJ fields]** → Mitigation: scenarios in the spec enforce that PF-only / PJ-only fields stay NULL for the wrong tipo; backend rejects mismatches.
- **[Status computation cost at scale]** → Not a concern for the target user (hundreds of clients), but the query joins `lancamentos`; an index on `lancamentos.cliente_id` is mandatory.
- **[Origin lookup dependency]** → The clientes module depends on `origens` existing. Mitigation: run the cadastros-auxiliares migration first, or seed an "Não informado" default origem at clientes-module setup.

## Migration Plan

- This is greenfield — no data to migrate.
- Migration file: `0001_create_clientes.sql` (after the lookup tables migration).
