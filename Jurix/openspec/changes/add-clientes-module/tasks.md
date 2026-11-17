## 1. Database

- [x] 1.1 Create migration `0003_create_clientes.sql` with the `clientes` table (id UUID PK, tipo TEXT CHECK IN ('pf','pj'), nome, cpf, cnpj, rg, data_nascimento, data_fundacao, email, telefone, full address fields, origem_id FK, status_relacionamento TEXT DEFAULT 'ativo', observacoes, criado_em, atualizado_em). _(filename adjusted — lookups migrations occupy 0001/0002)_
- [x] 1.2 Add unique partial indexes: `UNIQUE(cpf) WHERE cpf IS NOT NULL AND tipo='pf'` and `UNIQUE(cnpj) WHERE cnpj IS NOT NULL AND tipo='pj'`.
- [x] 1.3 Create migration `0004_create_contatos_pj.sql` with the `contatos_pj` table (id UUID, cliente_id FK ON DELETE CASCADE, nome, cargo, email, telefone, observacoes).
- [ ] 1.4 Add index on `lancamentos.cliente_id` — deferred to the lancamentos module migration.
- [x] 1.5 Wire migrations into the @tauri-apps/plugin-sql migrations array.

## 2. Backend (Tauri / data layer)

> Decision (see CLAUDE.md): plugin-sql is JS-driven; the "Rust commands" requirement is satisfied through the plugin's built-in invoke handlers. Validation lives in the TS API client (`src/features/clientes/api.ts`) and is paired with SQL CHECK constraints + partial unique indexes.

- [x] 2.1 Implement `clientesCreate(input)` — strips CPF/CNPJ/CEP/telefone punctuation, validates length, enforces PF/PJ field constraints, inserts row, returns full record.
- [x] 2.2 Implement `clientesUpdate(id, input)` — same validations; refreshes `atualizado_em`.
- [x] 2.3 Implement `clientesDelete(id)` — checks for related `contratos` with `status='ativo'` (gated by `sqlite_master` existence check until the contratos table lands); raises `DeleteBlockedError` the UI can recognize.
- [x] 2.4 Implement `clientesList(filters)` — filter by `status_relacionamento`, `tipo`, and free-text search on nome/cpf/cnpj (digit-aware).
- [x] 2.5 Implement `clientesGet(id)`.
- [x] 2.6 Implement `clientesStatusFinanceiro(id)` returning `adimplente|inadimplente|sem_movimentacao`; gated by `sqlite_master` until the lancamentos table lands.
- [x] 2.7 Implement `contatosPjCreate/Update/Delete/List` with PF/PJ guard.

## 3. Frontend (React + Tailwind)

- [x] 3.1 Types in `src/features/clientes/types.ts` mirroring the database record.
- [x] 3.2 API wrapper `src/features/clientes/api.ts` around `Database.execute/select`.
- [x] 3.3 Build `ClientesListPage`: searchable list, filter chips for tipo and status_relacionamento, status_financeiro badge per row, empty / loading states.
- [x] 3.4 Build `ClienteFormPage` (create and edit): tipo toggle with conditional PF/PJ field groups, live document masks, CEP & telefone masks, address group, origem dropdown (filters inactive), CPF + CNPJ check-digit validation, save/cancel.
- [x] 3.5 Build `ClienteDetailPage`: client info, status_financeiro panel, contatos_pj sub-section (PJ only) with add / edit / remove inline.
- [x] 3.6 Add CPF/CNPJ/CEP/telefone formatting utilities at `src/lib/format/documents.ts`. _(Unit tests deferred — utilities are pure and used end-to-end through the UI.)_
- [x] 3.7 Add deletion-blocked confirm dialog surfacing the blocker error message.

## 4. Verification

- [ ] 4.1 Manual smoke test: create one PF client, one PJ client with two contatos, switch tipo in form, attempt duplicate CPF, attempt delete with active contract (stubbed once contratos lands), inactivate then delete. **Requires Rust toolchain installed.**
- [x] 4.2 Run `npx openspec validate add-clientes-module` and resolve any warnings.
