## ADDED Requirements

### Requirement: Lancamento registry stores entradas and saídas linked to a client
The system SHALL persist financial entries in a `lancamentos` table with columns `id` (UUID PK), `descricao` (TEXT), `natureza` (TEXT CHECK IN ('entrada','saida')), `cliente_id` (FK to `clientes`, NOT NULL), `contrato_id` (FK to `contratos`, nullable), `processo_id` (FK to `processos`, nullable), `tipo` (TEXT), `centro_custo_id` (FK to `centros_custo`, nullable), `garantido` (INTEGER 0/1), `forma_pagamento` (TEXT CHECK IN ('avista','parcelado')), `num_parcelas` (INTEGER nullable), `valor` (INTEGER cents), `data_prevista` (DATE nullable), `data_pagamento` (DATE nullable), `status_pagamento` (TEXT), `numero_documento` (TEXT nullable), `observacoes`, `criado_em`, `atualizado_em`.

#### Scenario: Create an avista entrada
- **WHEN** the user submits a lancamento with `natureza='entrada'`, `tipo='pagamento_unico'`, `forma_pagamento='avista'`, `valor=150000`, `data_prevista="2026-06-10"`, `cliente_id` set, `contrato_id` set
- **THEN** one row is inserted in `lancamentos` with those values and no rows are written in `parcelas`

#### Scenario: Reject a lancamento without a client
- **WHEN** the user submits a lancamento with `cliente_id = NULL`
- **THEN** the system rejects with a validation error

### Requirement: tipo values are constrained by natureza
The system SHALL accept `tipo` only from the set whose `natureza` matches. For `natureza = 'entrada'` the allowed values SHALL be `mensalidade`, `pagamento_unico`, `sucumbencia`, `acordo`, `reembolso_custas`. For `natureza = 'saida'` the allowed values SHALL be `despesa_escritorio`, `custas_processuais`, `reembolso_cliente`. Mismatches SHALL be rejected.

#### Scenario: Reject saida tipo on an entrada
- **WHEN** the user submits `natureza = 'entrada'` together with `tipo = 'despesa_escritorio'`
- **THEN** the system rejects with a validation error

#### Scenario: Reject unknown tipo
- **WHEN** the user submits a `tipo` not in either allowed set
- **THEN** the system rejects with a validation error

### Requirement: centro_custo_id is required for saídas and forbidden for entradas
The system SHALL require a non-null `centro_custo_id` whenever `natureza = 'saida'`. The system SHALL require `centro_custo_id` to be NULL whenever `natureza = 'entrada'`.

#### Scenario: Saida without centro_custo rejected
- **WHEN** the user submits `natureza = 'saida'` and `centro_custo_id = NULL`
- **THEN** the system rejects with a validation error

#### Scenario: Entrada with centro_custo rejected
- **WHEN** the user submits `natureza = 'entrada'` with a non-null `centro_custo_id`
- **THEN** the system rejects with a validation error

### Requirement: garantido is auto-false for sucumbencia and acordo
On insert or update, when `tipo ∈ {'sucumbencia', 'acordo'}` the system SHALL force `garantido = false` regardless of the value supplied by the caller. For any other `tipo` the system SHALL persist the value the user provided.

#### Scenario: Save a sucumbencia with garantido=true input
- **WHEN** the user submits `tipo = 'sucumbencia'` and `garantido = true`
- **THEN** the row is saved with `garantido = false`

#### Scenario: User retains control of garantido for mensalidade
- **WHEN** the user submits `tipo = 'mensalidade'` with `garantido = true`
- **THEN** the row is saved with `garantido = true`

### Requirement: forma_pagamento drives num_parcelas validation
When `forma_pagamento = 'parcelado'` the system SHALL require `num_parcelas >= 2`. When `forma_pagamento = 'avista'` the system SHALL require `num_parcelas IS NULL`. Mismatches SHALL be rejected.

#### Scenario: Avista with num_parcelas rejected
- **WHEN** the user submits `forma_pagamento = 'avista'` and `num_parcelas = 3`
- **THEN** the system rejects with a validation error

#### Scenario: Parcelado with num_parcelas = 1 rejected
- **WHEN** the user submits `forma_pagamento = 'parcelado'` and `num_parcelas = 1`
- **THEN** the system rejects with a validation error (use avista instead)

### Requirement: valor semantics depend on forma_pagamento
For `forma_pagamento = 'avista'` the `valor` column SHALL hold the total amount in cents. For `forma_pagamento = 'parcelado'` the `valor` column SHALL hold the amount of each individual parcela in cents; the implied total is `valor × num_parcelas`. The UI SHALL label the input accordingly.

#### Scenario: Save an avista total
- **WHEN** the user submits `forma_pagamento = 'avista'` and types `R$ 1.000,00` into the valor input
- **THEN** the stored `valor` is `100000`

#### Scenario: Save a parcelado per-parcela value
- **WHEN** the user submits `forma_pagamento = 'parcelado'`, `num_parcelas = 6`, and types `R$ 500,00` into the valor input
- **THEN** the stored `lancamentos.valor` is `50000` and the implied total is `300000`

### Requirement: Parcelado lancamentos auto-generate N parcelas on the same day of each month
When `forma_pagamento = 'parcelado'`, on insert the system SHALL atomically generate `num_parcelas` rows in `parcelas`. The `parcelas` table SHALL contain columns `id` (UUID), `lancamento_id` (FK NOT NULL ON DELETE CASCADE), `numero` (INTEGER 1..num_parcelas), `valor` (INTEGER cents), `data_prevista` (DATE), `data_pagamento` (DATE nullable), `status` (TEXT CHECK IN ('pendente','pago','inadimplente') DEFAULT 'pendente'), `observacoes`. For parcela `numero = N` (1-indexed), `data_prevista` SHALL be computed by taking the original `data_primeira_parcela`'s day-of-month and applying it to the `(N - 1)`-th month after `data_primeira_parcela`. When the target month has fewer days than the original day-of-month, `data_prevista` SHALL be the last day of that target month. The day-of-month anchor SHALL be the original chosen day for every parcela — it SHALL NOT drift to the clamped day in subsequent months. Each parcela's `valor` SHALL equal the lancamento's `valor`. All parcelas SHALL start with `status = 'pendente'`.

#### Scenario: Generate six parcelas on the 10th of each month
- **WHEN** the user creates a parcelado lancamento with `data_primeira_parcela = "2026-06-10"` and `num_parcelas = 6`
- **THEN** six rows are inserted into `parcelas` with `numero` 1 through 6 and `data_prevista` of `2026-06-10`, `2026-07-10`, `2026-08-10`, `2026-09-10`, `2026-10-10`, `2026-11-10`

#### Scenario: Day 31 clamps to last day of shorter months
- **WHEN** the user creates a parcelado lancamento with `data_primeira_parcela = "2026-01-31"` and `num_parcelas = 4`
- **THEN** the parcelas have `data_prevista` of `2026-01-31`, `2026-02-28`, `2026-03-31`, `2026-04-30` — the day-of-month anchor remains 31 throughout, clamping per-month

#### Scenario: Day 31 in a leap year reaches Feb 29
- **WHEN** the user creates a parcelado lancamento with `data_primeira_parcela = "2028-01-31"` and `num_parcelas = 3`
- **THEN** the parcelas have `data_prevista` of `2028-01-31`, `2028-02-29` (leap year), `2028-03-31`

#### Scenario: Day 30 falls on Feb 28 in non-leap year
- **WHEN** the user creates a parcelado lancamento with `data_primeira_parcela = "2026-01-30"` and `num_parcelas = 3`
- **THEN** the parcelas have `data_prevista` of `2026-01-30`, `2026-02-28` (clamped), `2026-03-30`

#### Scenario: All parcelas inherit the lancamento valor
- **WHEN** the user creates a parcelado lancamento with `valor = 50000` and `num_parcelas = 4`
- **THEN** every generated parcela has `valor = 50000`

#### Scenario: Reject parcelado without data_primeira_parcela
- **WHEN** the user submits `forma_pagamento = 'parcelado'` without supplying `data_primeira_parcela`
- **THEN** the system rejects with a validation error

#### Scenario: Avista lancamentos write no parcelas
- **WHEN** the user creates an avista lancamento
- **THEN** zero rows are inserted into `parcelas` for that lancamento

### Requirement: data_prevista is set only for avista lancamentos
For `forma_pagamento = 'avista'`, `lancamentos.data_prevista` SHALL be non-null. For `forma_pagamento = 'parcelado'`, `lancamentos.data_prevista` SHALL be NULL — the per-parcela due dates live on `parcelas.data_prevista`.

#### Scenario: Avista without data_prevista rejected
- **WHEN** the user submits an avista lancamento without `data_prevista`
- **THEN** the system rejects with a validation error

#### Scenario: Parcelado with data_prevista on parent ignored
- **WHEN** the user submits a parcelado lancamento with a non-null `data_prevista` on the parent
- **THEN** the system stores `data_prevista = NULL` on the lancamento; the value provided is treated as `data_primeira_parcela`

### Requirement: status_pagamento for parcelado lancamentos is derived from parcelas
The system SHALL compute `lancamentos.status_pagamento` from the parcelas every time a parcela's status changes:
- All parcelas `pago` → `'pago'`.
- Any parcela `pago` AND at least one other parcela not `pago` → `'parcialmente_pago'`.
- No parcela `pago` AND at least one parcela `inadimplente` → `'inadimplente'`.
- Otherwise → `'pendente'`.
An explicit user action setting `status_pagamento = 'cancelado'` SHALL override this derivation and freeze the status until the user un-cancels.

#### Scenario: All parcelas paid yields pago
- **WHEN** every parcela of a parcelado lancamento becomes `status = 'pago'`
- **THEN** the lancamento's `status_pagamento` is recomputed to `'pago'`

#### Scenario: Mix of paid and pending yields parcialmente_pago
- **WHEN** at least one parcela is `'pago'` and at least one other is `'pendente'`
- **THEN** the lancamento's `status_pagamento` is `'parcialmente_pago'`

#### Scenario: Cancellation is sticky
- **WHEN** the user sets a parcelado lancamento to `'cancelado'`
- **THEN** subsequent parcela status changes do not flip the lancamento status away from `'cancelado'`

### Requirement: status_pagamento for avista lancamentos is set directly
For `forma_pagamento = 'avista'` the user SHALL set `status_pagamento` directly. The allowed values SHALL be `'pendente'`, `'pago'`, `'cancelado'`, `'inadimplente'`. The value `'parcialmente_pago'` SHALL be rejected for avista lancamentos.

#### Scenario: Mark avista as pago with data_pagamento
- **WHEN** the user marks an avista lancamento as `'pago'` and supplies `data_pagamento = "2026-05-15"`
- **THEN** the row is updated with `status_pagamento = 'pago'` and `data_pagamento = "2026-05-15"`

#### Scenario: Reject parcialmente_pago on avista
- **WHEN** the user submits `status_pagamento = 'parcialmente_pago'` on an avista lancamento
- **THEN** the system rejects with a validation error

### Requirement: Inadimplência is computed from data_prevista vs today
The system SHALL surface a lancamento (avista) or parcela (parcelado) as effectively inadimplente when `status = 'pendente'` AND `data_prevista < today`. Dashboard and list queries SHALL treat the computed state as `'inadimplente'` for filtering and aggregation. The persisted column MAY still read `'pendente'` until the next refresh, but read queries SHALL convert.

#### Scenario: Pending parcela past due classified as inadimplente
- **WHEN** a parcela has `status = 'pendente'` and `data_prevista < today`
- **THEN** the dashboard's "inadimplência" totals include that parcela's `valor`

#### Scenario: Pending parcela not yet due is not inadimplente
- **WHEN** a parcela has `status = 'pendente'` and `data_prevista >= today`
- **THEN** the dashboard's "inadimplência" totals do not include that parcela

### Requirement: Parcelas can be marked paid individually
The system SHALL expose an operation `parcelas_marcar_pago(id, data_pagamento)` that sets the parcela's `status = 'pago'` and `data_pagamento`. After the update, the parent lancamento's `status_pagamento` SHALL be recomputed by the rule above.

#### Scenario: Mark a parcela paid recomputes the parent
- **WHEN** the user marks parcela 3 of 6 as paid with `data_pagamento = "2026-08-09"`
- **THEN** that parcela becomes `status = 'pago'` with the supplied date, and the lancamento's `status_pagamento` is set to `'parcialmente_pago'`

### Requirement: Editing num_parcelas after payment is rejected
The system SHALL reject any update that changes `num_parcelas` if at least one parcela of that lancamento has `status = 'pago'`. The same lock SHALL apply to changes of `valor`, `forma_pagamento` and the first-parcela date once a parcela is paid. When no parcela is paid, the system MAY re-generate parcelas: existing rows are deleted and new ones created using the same same-day-of-month rule (clamped to the last day of shorter months).

#### Scenario: Reject num_parcelas change after a payment
- **WHEN** the user attempts to change `num_parcelas` on a lancamento where at least one parcela is `'pago'`
- **THEN** the system rejects with a validation error

#### Scenario: Regenerate parcelas when none have been paid
- **WHEN** the user changes `num_parcelas` from 6 to 4 on a lancamento whose parcelas are all `'pendente'`
- **THEN** all six existing parcelas are deleted and four new ones are inserted with `numero` 1..4 and dates derived from the original `data_primeira_parcela`

### Requirement: numero_documento is a free-text reference
The system SHALL persist `numero_documento` as a free TEXT column (NF number, RPA, recibo, etc.) without format validation. The column SHALL be nullable.

#### Scenario: Save and search by numero_documento
- **WHEN** the user saves `numero_documento = "NF 1234-A"` on a lancamento
- **THEN** the value is persisted verbatim and the lancamentos list search matches the substring `"1234"`

### Requirement: Lancamentos list supports rich filtering
The system SHALL provide a list query that filters by any combination of: `cliente_id`, `contrato_id`, `processo_id`, `natureza`, `tipo`, `status_pagamento`, `centro_custo_id`, `garantido`, date range on `data_prevista` (and on parcelas' `data_prevista`), and free-text search on `descricao` / `numero_documento`. Results SHALL be paginated and sortable by `data_prevista`, `data_pagamento`, `valor`, `criado_em`.

#### Scenario: Filter by entrada and pago in a date range
- **WHEN** the user filters by `natureza='entrada'`, `status_pagamento='pago'`, and `data_pagamento` between two dates
- **THEN** the returned rows include only entradas paid within that range

#### Scenario: Filter by inadimplente surfaces overdue pendings
- **WHEN** the user filters by `status_pagamento='inadimplente'`
- **THEN** the result includes both rows persisted as `'inadimplente'` and rows persisted as `'pendente'` whose `data_prevista < today`
