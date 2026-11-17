## Why

Contracts are the bridge between Jurix's case work and its finances. A contrato attaches a billable agreement to a client (and optionally a processo) and is the parent of every recurring or one-off `lancamento`. Without it, the user cannot reason about how much each engagement is producing.

## What Changes

- Introduce a `contratos` table FK to `clientes` (required) and `processos` (optional), plus FKs to `areas_direito` and `tipos_contrato`.
- Auto-generate a human-friendly `codigo` of the form `CTR-{ANO}-{SEQUENCIAL}` (per-year sequence), editable by the user.
- Provide a `status` field (`ativo` / `inativo` / `suspenso`) — only `ativo` blocks client deletion.
- Provide `valor_base` as integer cents.
- On the contrato detail screen, expose a financial summary computed from related lancamentos: `total_faturado`, `total_recebido`, `total_em_aberto`, and the full list of `lancamentos`.
- Allow the user to create lancamentos directly inside the contrato detail with `cliente_id` and `contrato_id` pre-filled.

## Capabilities

### New Capabilities
- `contratos`: contract registry — auto-generated code, FK to cliente / processo / area_direito / tipo_contrato, valor_base in cents, status lifecycle, financial summary view, inline lancamento creation.

### Modified Capabilities
<!-- none -->

## Impact

- New SQLite table: `contratos`.
- Migration file `0004_create_contratos.sql`.
- New Tauri commands for CRUD plus `contratos_resumo_financeiro(id)` returning aggregated totals.
- New React routes/screens: list, create, edit, detail.
- Cross-module: triggers the clientes deletion guard; consumed later by the lancamentos and dashboard modules.
