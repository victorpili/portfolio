## 1. Database

- [x] 1.1 Create migration `0005_create_processos.sql` with all columns, CHECK constraints on `fase`, `status`, `chance_exito` (0–100), `numero_cnj` length (20 when not null), and the fase/fase_custom invariant.
- [x] 1.2 Add `UNIQUE(numero_cnj) WHERE numero_cnj IS NOT NULL` partial index.
- [x] 1.3 Add index on `cliente_id` for fast client → processos lookup, plus an index on `status`.
- [x] 1.4 Wire migration into plugin-sql migrations array.
- [x] 1.5 Create migration `0006_processos_add_natureza.sql` that recreates the table to: add a `natureza` column (`judicial` / `administrativo`, default `judicial`), rename `numero_cnj` → `numero_processo`, relax the length CHECK to apply only to judicial, and rebuild the partial unique index.
- [x] 1.6 Create migration `0007_processos_unique_numero.sql` broadening the partial unique index so `numero_processo` uniqueness applies across both naturezas (administrativo numbers cannot duplicate either).

## 2. Backend (data layer)

> Same pattern as clientes — plugin-sql is JS-driven; logic lives in `src/features/processos/api.ts` paired with SQL CHECK + partial unique indexes.

- [x] 2.1 Implement `processosCreate(input)` — strips CNJ punctuation, validates length 20, validates chance_exito 0–100, enforces fase/fase_custom invariant.
- [x] 2.2 Implement `processosUpdate(id, input)` — same validations, refresh `atualizado_em`.
- [x] 2.3 Implement `processosDelete(id)` — straightforward; lancamentos FK guard deferred to the lancamentos module.
- [x] 2.4 Implement `processosList(filters)` joining clientes for display + free-text search across CNJ digits / cliente name / parte adversa / vara / tribunal.
- [x] 2.5 Implement `processosGet(id)` and `processosListByCliente(cliente_id)` (used by the clientes detail page).

## 3. Frontend (React + Tailwind)

- [x] 3.1 Add CNJ formatting utility (`formatCNJ`, `maskCNJ`) in `src/lib/format/documents.ts`.
- [x] 3.2 Build `ProcessosListPage` with status filter chips, free-text search, empty/loading states, per-row CNJ + cliente name + fase + valor da causa + status.
- [x] 3.3 Build `ProcessoFormPage`: natureza pill toggle (judicial/administrativo), client / fase / status as autocomplete Comboboxes, numero_processo input that switches between CNJ mask and free text based on natureza, chance_exito numeric input with paired slider, valor_causa as a BRL `CurrencyInput`. Supports `?cliente_id=` deep link for inline creation from the cliente detail. Field labels adapt to natureza (e.g. "Vara"/"Setor", "Tribunal"/"Esfera", "Comarca"/"Unidade").
- [x] 3.4 Build `ProcessoDetailPage`: header with key fields, chance_exito bar, valor_causa, external `link_documentos` button using `@tauri-apps/plugin-opener`, lancamentos placeholder.
- [x] 3.5 Add a Processos section to `ClienteDetailPage` listing the client's processos with a "Novo processo" CTA that pre-fills the cliente. Administrativo entries get an "Admin" badge.
- [x] 3.6 Introduce a reusable `Combobox` component (typeahead, accent-insensitive substring filter, keyboard nav, click-outside, allowClear, invalid state) and adopt it across cliente form (origem, status_relacionamento, estado UF) and processo form (cliente, fase, status).

## 4. Verification

- [x] 4.1 `npx tsc --noEmit` passes; `npm run build` succeeds.
- [x] 4.2 Run `npx openspec validate add-processos-module`.
- [ ] 4.3 Manual smoke test (requires Rust toolchain): create processo with formatted CNJ, attempt duplicate, switch fase to "outro" and confirm fase_custom is required, type invalid chance_exito, open external link, confirm Processos section appears inside cliente detail with quick CTA.
