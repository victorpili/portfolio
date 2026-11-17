## Why

An autonomous lawyer's practice revolves around their client portfolio. Jurix needs a robust client registry as the foundation for processes, contracts, and financial entries — without it no other module can be built.

## What Changes

- Introduce a `clientes` table supporting both individuals (PF) and legal entities (PJ), with type-conditional fields (CPF/RG/birth date for PF; CNPJ/founding date for PJ).
- Store CPF, CNPJ and other document numbers as digits only; format only at the presentation layer.
- Compute `status_financeiro` (adimplente / inadimplente / sem movimentação) on demand from `lancamentos`; it is never persisted.
- Allow `status_relacionamento` (ativo / inativo) to be toggled manually by the user.
- Block deletion when active contracts reference the client; require the user to inactivate first.
- Provide a `contatos_pj` sub-registry to capture multiple named contacts per legal entity.
- Provide a generic `origens` lookup table reference (FK `origem_id`); the lookup itself is delivered by the cadastros-auxiliares change.

## Capabilities

### New Capabilities
- `clientes`: client master registry — CRUD, PF/PJ conditional fields, document storage rules, deletion guard, contatos PJ sub-registry, and on-demand financial status computation.

### Modified Capabilities
<!-- none — greenfield -->

## Impact

- New SQLite tables: `clientes`, `contatos_pj`.
- New migration file (version 0001 for this module).
- New Tauri commands (Rust) for CRUD plus `clientes_status_financeiro` lookup.
- New React routes/screens: list, create, edit, detail.
- Depends on the `origens` lookup table from `add-cadastros-auxiliares`; coordinated by migration order during implementation.
