## Why

Several modules need controlled vocabularies that the user must be able to grow over time without code changes: áreas do direito, tipos de contrato, centros de custo, origens, tipos de evento. Hard-coding them would force a new release every time the user adopted a new naming convention.

## What Changes

- Introduce five identically-shaped lookup tables: `areas_direito`, `tipos_contrato`, `centros_custo`, `origens`, `tipos_evento`.
- Each table SHALL contain `id` (UUID), `nome` (TEXT NOT NULL), `ativo` (INTEGER 0/1 DEFAULT 1), `criado_em`.
- Provide a single configurações screen that lets the user create / edit / deactivate / reactivate entries in each table.
- Deletion is allowed only when the entry is not referenced by any other table — otherwise the user must deactivate.
- Seed each table with a sensible Brazilian default set so the user can start using the app immediately.

## Capabilities

### New Capabilities
- `cadastros-auxiliares`: configurable lookup tables shared by clientes, contratos, lancamentos, and agenda — CRUD plus deactivation, with deletion guards based on referencing rows.

### Modified Capabilities
<!-- none -->

## Impact

- New SQLite tables: `areas_direito`, `tipos_contrato`, `centros_custo`, `origens`, `tipos_evento`.
- Migration `0000_create_lookups.sql` — runs FIRST so other modules can FK these tables.
- Migration `0001_seed_lookups.sql` — seeds defaults.
- Generic Tauri commands `lookup_list / lookup_create / lookup_update / lookup_toggle_ativo / lookup_delete` parameterized by table name.
- New React route: `/configuracoes` with a tabbed UI per table.
