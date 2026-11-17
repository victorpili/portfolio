## Context

Five lookup tables share an identical schema and almost identical UX. The temptation is to fuse them into one polymorphic table; experience says that polymorphism is fragile and the duplication cost is tiny (five trivial migrations). The interesting decisions are deletion safety, ordering, and seeding.

## Goals / Non-Goals

**Goals:**
- Uniform shape and uniform UI for all five lookups.
- Safe deletion that does not orphan referencing rows.
- A reasonable starter dataset so the user is not staring at empty dropdowns on day one.

**Non-Goals:**
- A single polymorphic `lookups` table — readability and referential integrity beat the small DRY win.
- User-defined custom lookup tables — fixed set of five.
- Ordering by drag-and-drop — alphabetical for MVP.

## Decisions

### Five distinct tables, identical schema
Each table is its own SQLite table so other modules can FK it directly. This keeps PRAGMA foreign_keys analysis simple and avoids the "which lookup?" join.

### Generic backend command surface
A single Tauri command `lookup_list(table)`, `lookup_create(table, nome)`, `lookup_update(table, id, nome)`, `lookup_toggle_ativo(table, id)`, `lookup_delete(table, id)` parameterized by a `table` enum on the Rust side. Whitelisted table names prevent SQL injection.

### Deletion blocked when referenced
For each lookup, deletion runs a `SELECT 1 FROM <referencing_table> WHERE <fk> = ? LIMIT 1` check; if a row exists, deletion is rejected and the user is instructed to deactivate. The user-facing message names the count of referencing rows.

| Lookup | Referenced by |
|---|---|
| `areas_direito` | `contratos.area_direito_id` |
| `tipos_contrato` | `contratos.tipo_contrato_id` |
| `centros_custo` | `lancamentos.centro_custo_id` |
| `origens` | `clientes.origem_id` |
| `tipos_evento` | `agenda_eventos.tipo_evento_id` |

### Deactivation hides from dropdowns but preserves history
`ativo = 0` rows are filtered out of all new-entity dropdowns. When rendering an existing entity whose lookup row is deactivated, the value is still shown (so historical data does not disappear) but it is rendered with a "(inativo)" suffix.

### Uniqueness on `nome` within each table
A `UNIQUE(nome COLLATE NOCASE)` constraint prevents accidental duplicates like "Direito Civil" vs "direito civil".

### Seed defaults
Initial seeds chosen to cover the most common Brazilian use cases:
- `areas_direito`: Cível, Trabalhista, Tributário, Família, Empresarial, Penal, Previdenciário, Consumidor.
- `tipos_contrato`: Mensalidade (Honorário Fixo), Honorário de Êxito, Pro Bono, Pontual (Avulso), Consultoria.
- `centros_custo`: Escritório, Custas Processuais, Honorários a Reembolsar.
- `origens`: Indicação, Site, Rede Social, Cliente Recorrente, Outros.
- `tipos_evento`: Audiência, Reunião com Cliente, Prazo Processual, Compromisso Interno.

## Risks / Trade-offs

- **[Five tables vs one]** → Acknowledged duplication; the cost is five 4-line CREATE statements.
- **[Deletion guard query cost]** → O(1) thanks to FK indexes that the referencing modules already create.
- **[Seeds becoming stale opinions]** → They are user-editable; we are not committing to these strings.

## Migration Plan

- Migration `0000_create_lookups.sql` runs FIRST so module 1+ can FK these tables.
- Migration `0001_seed_lookups.sql` inserts default rows; runs on a fresh DB only (idempotent INSERT OR IGNORE).
