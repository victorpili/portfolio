## Why

A lawyer's day-to-day work is organized around legal processes. Jurix needs a `processos` registry to track each case, link it to its client, capture procedural metadata, and feed downstream features (financial projection uses each process's chance_exito).

## What Changes

- Introduce a `processos` table linked to `clientes` via `cliente_id`.
- Provide a `natureza` field (`judicial` / `administrativo`) that changes how the process number is validated, stored and displayed: judicial processos use the 20-digit CNJ format; administrativos accept free-form text (NUP, SEI, protocolos internos, etc.).
- Store `numero_processo` (the case identifier) as digits only when judicial; verbatim when administrativo. Display formatting only applies to judicial.
- Provide a controlled `fase` field with four standard values plus an "Outro" option for custom phases.
- Introduce a `chance_exito` integer (0–100) consumed later by the dashboard's non-guaranteed projection.
- Provide `valor_causa` stored as integer cents.
- Provide `status` (em_andamento / encerrado / suspenso) for filtering.
- Allow free-text `parte_adversa`, `advogado_adversario`, `oab_adversario`, `vara`, `tribunal`, `comarca`, plus an external `link_documentos` URL.

## Capabilities

### New Capabilities
- `processos`: process registry — CRUD, natureza (judicial/administrativo) gating number format & uniqueness, CNJ normalization for judicial, valor_causa as cents, chance_exito for financial projection, controlled fase + status, link to client.

### Modified Capabilities
<!-- none -->

## Impact

- New SQLite table: `processos`.
- Migration file `0003_create_processos.sql`.
- New Tauri commands for CRUD plus list filtered by client.
- New React routes/screens: list, create, edit, detail.
- Downstream: the lancamentos module will FK `processo_id`; the dashboard's projection module reads `chance_exito` from this table.
