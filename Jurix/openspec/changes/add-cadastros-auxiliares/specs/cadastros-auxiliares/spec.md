## ADDED Requirements

### Requirement: Five lookup tables share an identical schema
The system SHALL persist five lookup tables — `areas_direito`, `tipos_contrato`, `centros_custo`, `origens`, `tipos_evento` — each with columns `id` (TEXT UUID PK), `nome` (TEXT NOT NULL), `ativo` (INTEGER 0/1 DEFAULT 1), `criado_em` (TEXT ISO-8601). Each table SHALL enforce `UNIQUE(nome COLLATE NOCASE)`.

#### Scenario: Create an entry in any lookup
- **WHEN** the user creates a new entry in `areas_direito` with `nome = "Direito Digital"`
- **THEN** a row is inserted with `ativo = 1`, the current timestamp, and a new UUID

#### Scenario: Reject duplicate name case-insensitively
- **WHEN** the user attempts to create `nome = "direito digital"` in `areas_direito` while `"Direito Digital"` already exists
- **THEN** the system rejects with a uniqueness error

### Requirement: ativo toggle hides entries from selection lists but preserves history
The system SHALL filter `ativo = 0` rows out of all "create new entity" dropdowns. When rendering an existing entity whose lookup row is `ativo = 0`, the lookup name SHALL still be displayed with a `"(inativo)"` suffix so the historical record remains legible.

#### Scenario: Deactivated origem hides from new client form
- **WHEN** the user deactivates `origens.nome = "Anúncio Google"` and then opens the new client form
- **THEN** that origem is not visible in the origem dropdown

#### Scenario: Existing client keeps showing the deactivated origem
- **WHEN** the user opens an existing client whose `origem_id` points at a deactivated row with `nome = "Anúncio Google"`
- **THEN** the form shows the value as `"Anúncio Google (inativo)"` and the value is preserved on save

### Requirement: Deletion blocked when the entry is referenced
The system SHALL block deletion of a lookup entry whose `id` is referenced by at least one row in the related domain table. The error message SHALL identify the count and the referencing table. The user SHALL be advised to deactivate instead. When zero referencing rows exist, deletion SHALL proceed.

| Lookup | Referencing table.column |
|---|---|
| `areas_direito` | `contratos.area_direito_id` |
| `tipos_contrato` | `contratos.tipo_contrato_id` |
| `centros_custo` | `lancamentos.centro_custo_id` |
| `origens` | `clientes.origem_id` |
| `tipos_evento` | `agenda_eventos.tipo_evento_id` |

#### Scenario: Block deletion when referenced
- **WHEN** the user attempts to delete an `areas_direito` row that is referenced by at least one row in `contratos`
- **THEN** the system rejects with a message naming the referencing table and the count of rows

#### Scenario: Allow deletion when not referenced
- **WHEN** the user attempts to delete a `tipos_evento` row that no `agenda_eventos` row points at
- **THEN** the system deletes the row

### Requirement: A generic command surface serves all five lookups
The system SHALL expose Tauri commands `lookup_list(table)`, `lookup_create(table, nome)`, `lookup_update(table, id, nome)`, `lookup_toggle_ativo(table, id)`, `lookup_delete(table, id)` where `table` is one of the five whitelisted names. Any other `table` value SHALL be rejected at the Rust layer so the command cannot be coerced into running arbitrary SQL.

#### Scenario: Reject unknown table name
- **WHEN** an invocation supplies `table = "usuarios"`
- **THEN** the command returns an error without executing any SQL

#### Scenario: List returns alphabetical order
- **WHEN** the user opens the configurações tab for `tipos_contrato`
- **THEN** the rows are returned ordered by `nome` ascending (COLLATE NOCASE)

### Requirement: Seed defaults populate a fresh database
On a fresh installation, the system SHALL seed each lookup with the documented default rows using `INSERT OR IGNORE` so re-running the seed on an existing DB is a no-op.

#### Scenario: Defaults present on first launch
- **WHEN** the user opens the app for the first time and navigates to "Configurações"
- **THEN** each lookup tab contains its full default list (e.g. `areas_direito` includes "Cível", "Trabalhista", etc.)

#### Scenario: Edits survive across launches
- **WHEN** the user renames "Cível" to "Direito Cível" and restarts the app
- **THEN** the renamed value persists and the seed migration does NOT re-insert "Cível"

### Requirement: Configurações screen exposes a unified UI for the five tables
The system SHALL provide a single `/configuracoes` route with a tab per lookup table. Each tab SHALL list its rows, allow inline edit, allow toggle ativo/inativo, and allow delete (subject to the referencing guard). Adding a row SHALL be available via a single text input plus "Adicionar" button at the top of each tab.

#### Scenario: Switch tabs to manage different lookups
- **WHEN** the user clicks the "Tipos de Evento" tab
- **THEN** the table contents update to show rows from `tipos_evento` only

#### Scenario: Inline edit of a name
- **WHEN** the user edits the `nome` of a `centros_custo` row inline and confirms
- **THEN** the row is updated; if the new name collides case-insensitively with another row, the system rejects and the inline input shows the error
