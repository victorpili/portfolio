## 1. Database

- [x] 1.1 Create migration `0008_create_contratos.sql` with all columns, CHECK on `status`, FKs to clientes/processos/areas_direito/tipos_contrato.
- [x] 1.2 Add `UNIQUE(codigo)` index — enforced via `TEXT NOT NULL UNIQUE` on the column.
- [x] 1.3 Add indexes on `cliente_id`, `processo_id`, `status`, `area_direito_id` for list filters and the clientes deletion guard.
- [x] 1.4 Wire migration into plugin-sql migrations array.

## 2. Backend (data layer)

> Same pattern as previous modules — plugin-sql + TS API client at `src/features/contratos/api.ts`.

- [x] 2.1 Implement `contratosCreate(input)` — generates the next `codigo` for the year of `data_inicio` (fallback current year) via `previewNextCodigo()`, validates processo↔cliente consistency, enforces required area/tipo/valor_base/data_inicio.
- [x] 2.2 Implement `contratosUpdate(id, input)` — codigo is editable but required; uniqueness enforced via UNIQUE constraint.
- [x] 2.3 Implement `contratosDelete(id)`.
- [x] 2.4 Implement `contratosList(filters)` — by cliente_id, status, area_direito_id, free-text on codigo/nome/cliente; joins clientes, areas_direito, tipos_contrato for display.
- [x] 2.5 Implement `contratosGet(id)`, `contratosListByCliente(cliente_id)`, `contratosListByProcesso(processo_id)`.
- [x] 2.6 Implement `contratosResumoFinanceiro(id)` — gated by `sqlite_master` for the `lancamentos` table; returns zeros until the lancamentos module lands, then will perform a single SQL aggregation joining lancamentos and parcelas.
- [x] 2.7 Implement `previewNextCodigo(year)` — `MAX(sequence) + 1` for codigos matching the canonical `CTR-{YYYY}-NNNN` pattern via SQLite `GLOB`.

## 3. Frontend (React + Tailwind)

- [x] 3.1 Build `ContratosListPage` with filter chips (status), free-text search, per-row codigo + nome + cliente + area + tipo + valor_base + status badge.
- [x] 3.2 Build `ContratoFormPage`: **all dropdowns are autocomplete Comboboxes** — cliente, processo (filtered to the chosen client's processos), area_direito, tipo_contrato, status. CTR-YYYY-NNNN is pre-filled on mount with a "Sugerir" regenerate button. BRL-masked valor_base, vigência with cross-date validation. Supports `?cliente_id=` deep link for inline creation.
- [x] 3.3 Build `ContratoDetailPage`: header with codigo + nome + status badge, financial summary card (faturado / recebido / em aberto — wired to `contratosResumoFinanceiro`, shows zeros until lancamentos lands), processo vinculado card with link to the processo detail, observações, lancamentos placeholder with a disabled "Novo lançamento" CTA. External `link_documentos` button using `@tauri-apps/plugin-opener`.
- [x] 3.4 Build `ContratosSection` component embedded in both `ClienteDetailPage` and `ProcessoDetailPage` listing the contratos in context with a "Novo contrato" CTA that pre-fills the cliente.
- [x] 3.5 Confirm the clientes deletion guard now activates: the existing `clientesDelete` in `src/features/clientes/api.ts` already queries `sqlite_master` for the contratos table and blocks deletion when any contract has `status='ativo'`.

## 4. Verification

- [x] 4.1 `npx tsc --noEmit` passes; `npm run build` succeeds.
- [x] 4.2 Run `npx openspec validate add-contratos-module`.
- [ ] 4.3 Manual smoke test (requires Rust toolchain): create contrato standalone, create another from cliente detail to test deep-link, attempt duplicate codigo, attempt to delete a cliente with an active contrato (must be blocked), inactivate the contrato and delete cliente (must succeed).
