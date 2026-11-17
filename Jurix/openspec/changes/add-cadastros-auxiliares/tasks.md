## 1. Database

- [x] 1.1 Create migration `0001_create_lookups.sql` with the five tables (areas_direito, tipos_contrato, centros_custo, origens, tipos_evento), each `(id TEXT PK, nome TEXT NOT NULL UNIQUE COLLATE NOCASE, ativo INTEGER DEFAULT 1, criado_em TEXT)`.
- [x] 1.2 Create migration `0002_seed_lookups.sql` inserting default Brazilian rows for each table using `INSERT OR IGNORE`.
- [x] 1.3 Register migrations into the plugin-sql migrations array as the very first migrations so other modules can FK these tables.

## 2. Backend (data layer)

> See CLAUDE.md — plugin-sql is JS-driven, table whitelisting lives in `src/features/cadastros/api.ts`.

- [x] 2.1 Define the `LookupTable` whitelist in `src/features/cadastros/api.ts` (`const LOOKUP_TABLES = [...] as const`).
- [x] 2.2 Implement `lookupList(table)` returning rows ordered by `nome` COLLATE NOCASE ASC. _(Used by ClienteFormPage's origem dropdown.)_
- [x] 2.3 Implement `lookupCreate(table, nome)` — generates UUID, inserts with `ativo = 1`, returns the row.
- [x] 2.4 Implement `lookupUpdate(table, id, nome)` — enforces unique nome case-insensitively.
- [x] 2.5 Implement `lookupToggleAtivo(table, id)` — flips the bit.
- [x] 2.6 Implement `lookupDelete(table, id)` — runs the per-table referencing check and rejects with a count when blocked. Referencing table guarded by a `sqlite_master` existence check so `agenda_eventos` (not yet created) does not break the call.
- [x] 2.7 Whitelist runtime check — `assertTable()` rejects any non-whitelisted name before composing SQL.

## 3. Frontend (React + Tailwind)

- [x] 3.1 Build `ConfiguracoesPage` with five tabs and a shared table component.
- [x] 3.2 Build `LookupManager` component that renders rows with inline edit, an "Ativo" switch, and a trash icon.
- [x] 3.3 Build the "Adicionar" form at the top of each tab.
- [x] 3.4 Surface the deletion-blocked error in a modal that names the referencing count.
- [x] 3.5 Reuse lookup rows in dropdowns — clientes form already filters `ativo = 1` and labels stale selections with "(inativo)".

## 4. Verification

- [ ] 4.1 Manual smoke test on a fresh DB. **Requires Rust toolchain installed.** _(Pending — `tsc` + `npm run build` pass clean.)_
- [x] 4.2 Run `npx openspec validate add-cadastros-auxiliares`.
