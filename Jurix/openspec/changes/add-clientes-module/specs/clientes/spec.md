## ADDED Requirements

### Requirement: Client registry stores both PF and PJ entities in one table
The system SHALL persist clients in a single `clientes` table with a `tipo` column whose value is `'pf'` or `'pj'`. Records SHALL include shared fields (id, tipo, nome, email, telefone, full address fields, origem_id, status_relacionamento, observacoes, criado_em, atualizado_em) and type-conditional fields (PF: cpf, rg, data_nascimento; PJ: cnpj, data_fundacao). The `id` column SHALL be a UUID v4. `criado_em` and `atualizado_em` SHALL be ISO-8601 timestamps; `atualizado_em` SHALL be refreshed on every update.

#### Scenario: Create a PF client with the required PF fields
- **WHEN** the user submits a new client with `tipo = 'pf'`, a valid `nome`, and a valid `cpf`
- **THEN** the row is inserted with `cnpj` and `data_fundacao` set to NULL, `criado_em` and `atualizado_em` set to the current timestamp, and a new UUID assigned to `id`

#### Scenario: Create a PJ client with the required PJ fields
- **WHEN** the user submits a new client with `tipo = 'pj'`, a valid `nome` (razão social), and a valid `cnpj`
- **THEN** the row is inserted with `cpf`, `rg` and `data_nascimento` set to NULL

#### Scenario: Reject a client with mismatched type fields
- **WHEN** the user submits `tipo = 'pf'` together with a non-null `cnpj`, OR `tipo = 'pj'` together with a non-null `cpf`
- **THEN** the system rejects the operation with a validation error and no row is written

### Requirement: CPF and CNPJ are stored as digits only
The system SHALL strip every non-digit character from `cpf` and `cnpj` before persistence. Stored CPF SHALL be exactly 11 digits and stored CNPJ SHALL be exactly 14 digits. The system SHALL reject documents whose digit count is wrong. Display SHALL format the values (`000.000.000-00` for CPF, `00.000.000/0000-00` for CNPJ); storage SHALL never contain punctuation.

#### Scenario: Submit a formatted CPF
- **WHEN** the user submits `cpf = "123.456.789-09"`
- **THEN** the value persisted is `"12345678909"`

#### Scenario: Submit a formatted CNPJ
- **WHEN** the user submits `cnpj = "12.345.678/0001-95"`
- **THEN** the value persisted is `"12345678000195"`

#### Scenario: Reject a CPF with wrong length
- **WHEN** the user submits a CPF whose digit count, after stripping punctuation, is not 11
- **THEN** the system rejects with a validation error

### Requirement: CPF and CNPJ are unique per client type
The system SHALL enforce uniqueness of `cpf` across all PF clients and uniqueness of `cnpj` across all PJ clients. Empty / NULL document values SHALL NOT participate in the uniqueness constraint.

#### Scenario: Duplicate CPF rejected
- **WHEN** the user tries to create a PF client with a `cpf` that already exists on another PF client
- **THEN** the system rejects the operation with a uniqueness error and no row is written

#### Scenario: Duplicate CNPJ rejected
- **WHEN** the user tries to create a PJ client with a `cnpj` that already exists on another PJ client
- **THEN** the system rejects the operation with a uniqueness error

### Requirement: Client form exposes only the fields relevant to the chosen type
The client form SHALL render `cpf`, `rg`, and `data_nascimento` only when `tipo = 'pf'`. It SHALL render `cnpj`, `data_fundacao`, and the `contatos_pj` sub-section only when `tipo = 'pj'`. Switching the type in the form SHALL clear the inputs of the previously visible type-specific fields.

#### Scenario: PF fields hidden when type is PJ
- **WHEN** the user selects `tipo = 'pj'` in the form
- **THEN** `cpf`, `rg`, and `data_nascimento` inputs disappear from the screen

#### Scenario: Switching type clears stale inputs
- **WHEN** the user types a value into a PF-only field and then switches `tipo` to `'pj'`
- **THEN** the PF-only inputs are cleared, so an accidental switch back does not preserve stale data

### Requirement: `status_financeiro` is computed in real time
The system SHALL compute `status_financeiro` for any client on demand by inspecting that client's `lancamentos`. The result SHALL be one of `'adimplente'`, `'inadimplente'`, `'sem_movimentacao'`. The system SHALL NOT persist this value.

#### Scenario: Client with no lancamentos
- **WHEN** the dashboard or list view requests the status of a client that has zero rows in `lancamentos`
- **THEN** the response is `'sem_movimentacao'`

#### Scenario: Client with overdue or inadimplente lancamento
- **WHEN** the client has at least one lancamento with `status_pagamento = 'inadimplente'`, OR with `status_pagamento = 'pendente'` AND `data_prevista < today`
- **THEN** the response is `'inadimplente'`

#### Scenario: Client paying on time
- **WHEN** the client has lancamentos but none qualify as inadimplente by the previous rule
- **THEN** the response is `'adimplente'`

### Requirement: `status_relacionamento` is set manually by the user
The system SHALL allow the user to toggle `status_relacionamento` between `'ativo'` and `'inativo'`. Toggling SHALL NOT cascade — historical contracts, processes, and lancamentos for the client SHALL remain unchanged. New clients SHALL default to `'ativo'`.

#### Scenario: Inactivate a client
- **WHEN** the user opens an active client's detail and chooses "Inativar"
- **THEN** the client's `status_relacionamento` becomes `'inativo'` and all linked contracts, processes, and lancamentos remain untouched

#### Scenario: List view filters inactive clients by default
- **WHEN** the user opens the clients list with the default filter
- **THEN** only clients with `status_relacionamento = 'ativo'` are shown, and a toggle is provided to include inactive ones

### Requirement: Deletion is blocked by active contracts and in-progress processos
The system SHALL block hard-deletion of any client that has at least one related row in `contratos` with `status = 'ativo'`, OR at least one related row in `processos` with `status = 'em_andamento'`. The error message SHALL instruct the user to inactivate the affected contracts and/or encerrar/suspender the affected processos first.

#### Scenario: Block deletion when an active contract exists
- **WHEN** the user attempts to delete a client that has at least one contract with `status = 'ativo'`
- **THEN** the system rejects the deletion and surfaces a message identifying the number of blocking contracts

#### Scenario: Block deletion when an in-progress processo exists
- **WHEN** the user attempts to delete a client that has at least one processo with `status = 'em_andamento'`
- **THEN** the system rejects the deletion and surfaces a message instructing the user to encerrar or suspender those processos

### Requirement: Allowed deletion cascades to processos, contratos and contatos
When deletion is permitted (no active contracts and no in-progress processos), the system SHALL delete every related row in `contratos` and `processos`, then the client itself — which cascades into `contatos_pj` via the `ON DELETE CASCADE` foreign key. The deletion order SHALL be `contratos` → `processos` → `clientes` so that no foreign-key constraint is violated. The deletes SHALL be issued as independent statements (the database access layer pools connections, so a manual multi-statement transaction is not used).

#### Scenario: Cascade delete with inactive contracts and closed processos
- **WHEN** the user deletes a client whose contracts are all `'inativo'`/`'suspenso'` and whose processos are all `'encerrado'`/`'suspenso'`
- **THEN** the system deletes those contratos and processos, deletes the client, and cascades into `contatos_pj`

#### Scenario: Delete a client with no related records
- **WHEN** the user deletes a client that has no contratos, processos or contatos
- **THEN** the client row is removed without error

#### Scenario: Deletion order avoids foreign-key violations
- **WHEN** the cascade runs for a client with both contratos and processos
- **THEN** contratos are deleted before processos (since `contratos.processo_id` references `processos`), and processos before the client row, so no statement fails on a foreign-key constraint

### Requirement: PJ clients support a `contatos_pj` sub-registry
For PJ clients only, the system SHALL persist a child table `contatos_pj` with columns `id` (UUID), `cliente_id` (FK with ON DELETE CASCADE), `nome`, `cargo`, `email`, `telefone`, `observacoes`. PF clients SHALL NOT be able to attach `contatos_pj` rows.

#### Scenario: Add a contato to a PJ client
- **WHEN** the user opens a PJ client and adds a contato with `nome = "João"` and `cargo = "Diretor"`
- **THEN** a row is inserted into `contatos_pj` linked to that client

#### Scenario: Reject contato on PF client
- **WHEN** the API receives a contato insert whose `cliente_id` points at a PF client
- **THEN** the system rejects the operation with a validation error

#### Scenario: Cascade delete contatos when the PJ client is deleted
- **WHEN** a PJ client is deleted successfully
- **THEN** every row in `contatos_pj` referencing that client is also deleted

### Requirement: PJ clients support multiple inscrições estaduais — one per UF
For PJ clients only, the system SHALL persist an `inscricoes_estaduais` child table with columns `id` (UUID), `cliente_id` (FK with ON DELETE CASCADE), `estado` (UF), `inscricao` (free text), `criado_em`. The system SHALL enforce uniqueness of `(cliente_id, estado)` so a client cannot have two inscrições for the same state. The cliente form SHALL expose a repeatable field group (free-text inscrição + UF selector) where the user adds, edits and removes inscrições. PF clients SHALL NOT have inscrições estaduais.

#### Scenario: Add two inscrições for different states
- **WHEN** the user, on a PJ client, adds an inscrição for `SP` and another for `MG`
- **THEN** both rows are persisted in `inscricoes_estaduais` for that client

#### Scenario: Reject two inscrições for the same state
- **WHEN** the user adds a second inscrição whose `estado` matches an existing inscrição of the same client
- **THEN** the system rejects the save with a validation error and instructs the user that only one inscrição per state is allowed

#### Scenario: Inscrição requires both estado and number
- **WHEN** the user adds an inscrição row with an empty `estado` or an empty `inscricao`
- **THEN** the system rejects the save with a validation error

#### Scenario: Cascade delete inscrições when the PJ client is deleted
- **WHEN** a PJ client is deleted successfully
- **THEN** every row in `inscricoes_estaduais` referencing that client is also deleted

### Requirement: PJ clients are classified as matriz or filial
For PJ clients only, the system SHALL persist `tipo_unidade` (`'matriz'` | `'filial'`) and a nullable `matriz_id` foreign key to another `clientes` row. New PJ clients SHALL default to `'matriz'`. When `tipo_unidade = 'filial'` the system SHALL require a `matriz_id`. When `tipo_unidade = 'matriz'` the `matriz_id` SHALL be NULL. PF clients SHALL have `tipo_unidade` and `matriz_id` NULL.

#### Scenario: A filial must reference a matriz
- **WHEN** the user marks a PJ client as `'filial'` without choosing a matriz
- **THEN** the system rejects the save with a validation error on the matriz field

#### Scenario: The matriz must be a PJ matriz, not a filial
- **WHEN** the user picks, as the matriz of a filial, a client that is PF or whose `tipo_unidade` is `'filial'`
- **THEN** the system rejects the save with a validation error

#### Scenario: A client cannot be its own matriz
- **WHEN** the user tries to set a client's `matriz_id` to its own id
- **THEN** the system rejects the save with a validation error

#### Scenario: The filial selector lists only eligible matrizes
- **WHEN** the cliente form renders the matriz selector for a filial
- **THEN** it lists only PJ clients whose `tipo_unidade` is not `'filial'`, excluding the client being edited

#### Scenario: Block converting a matriz with filiais into a filial
- **WHEN** the user edits a PJ client that is the matriz of at least one filial and changes its `tipo_unidade` to `'filial'`
- **THEN** the system rejects the save and instructs the user to reassign or convert the filiais first

#### Scenario: Matriz detail lists its filiais
- **WHEN** the user opens the detail of a PJ matriz that has filiais
- **THEN** a "Filiais" section lists every client whose `matriz_id` points at it, each linking to its detail

#### Scenario: Block deleting a matriz that still has filiais
- **WHEN** the user attempts to delete a PJ client that is the matriz of at least one filial
- **THEN** the system blocks the deletion and instructs the user to reassign or delete the filiais first

### Requirement: `origem_id` references the `origens` lookup table
The `origem_id` column SHALL be a foreign key into the `origens` lookup table. The field SHALL be nullable so that imported or legacy records without an assigned origin remain valid.

#### Scenario: Origens dropdown lists only active origens
- **WHEN** the client form renders the origem dropdown
- **THEN** the dropdown lists only rows from `origens` where `ativo = true`, plus the currently selected origem if it has been since deactivated

#### Scenario: Reject an unknown origem_id
- **WHEN** the user submits an `origem_id` that does not exist in `origens`
- **THEN** the system rejects with a foreign-key error
