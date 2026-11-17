## ADDED Requirements

### Requirement: Contrato registry persists contract metadata linked to a client
The system SHALL persist contracts in a `contratos` table with columns `id` (UUID PK), `codigo` (TEXT UNIQUE NOT NULL), `nome` (TEXT NOT NULL), `cliente_id` (FK to `clientes`, NOT NULL), `processo_id` (FK to `processos`, nullable), `area_direito_id` (FK), `tipo_contrato_id` (FK), `valor_base` (INTEGER cents), `data_inicio` (DATE), `data_encerramento` (DATE, nullable), `status` (TEXT CHECK IN ('ativo','inativo','suspenso') DEFAULT 'ativo'), `link_documentos` (TEXT URL nullable), `observacoes`, `criado_em`, `atualizado_em`.

#### Scenario: Create a contrato linked to client and processo
- **WHEN** the user submits a contrato with a valid `cliente_id`, an optional `processo_id`, a valid `area_direito_id`, and a `valor_base`
- **THEN** the row is inserted with a generated `codigo`, status `'ativo'`, and timestamps populated

#### Scenario: Reject a contrato whose processo does not belong to the same client
- **WHEN** the user submits `processo_id` that belongs to a different client than the chosen `cliente_id`
- **THEN** the system rejects with a validation error and no row is written

### Requirement: codigo is auto-generated as CTR-{YYYY}-{NNNN} and editable
On insert, the system SHALL generate `codigo` of the form `CTR-{YYYY}-{NNNN}` where `YYYY` is the year of `data_inicio` (falling back to the current year if `data_inicio` is empty) and `NNNN` is a zero-padded four-digit sequence equal to `MAX(sequence) + 1` for contratos whose codigo starts with `CTR-{YYYY}-`. The system SHALL persist the generated codigo. The user SHALL be allowed to overwrite `codigo` on the form. The system SHALL enforce uniqueness of `codigo`.

#### Scenario: First contrato of the year
- **WHEN** the user creates the first contrato of 2026 with `data_inicio = "2026-03-10"` and does not type a `codigo`
- **THEN** the contrato is saved with `codigo = "CTR-2026-0001"`

#### Scenario: Sequence increments within the same year
- **WHEN** the user creates a second contrato in 2026 after the first was already saved with `codigo = "CTR-2026-0001"`
- **THEN** the second contrato is saved with `codigo = "CTR-2026-0002"`

#### Scenario: Sequence resets in a new year
- **WHEN** the user creates a contrato whose `data_inicio` is in 2027 and the highest existing 2027 codigo is none
- **THEN** the contrato is saved with `codigo = "CTR-2027-0001"`

#### Scenario: User overrides the generated codigo
- **WHEN** the user types `codigo = "CTR-ESCRITORIO-001"` and submits
- **THEN** the row is saved with that exact codigo, provided no other contrato already uses it

#### Scenario: Duplicate codigo rejected
- **WHEN** the user attempts to save a contrato with a codigo already in use
- **THEN** the system rejects with a uniqueness error and surfaces the conflicting contrato

### Requirement: valor_base is stored in integer cents
The system SHALL persist `valor_base` as INTEGER cents and display BRL formatting at the UI layer.

#### Scenario: Convert valor_base input to cents
- **WHEN** the user types `R$ 2.500,00` into the valor_base input
- **THEN** the persisted value is `250000`

### Requirement: status follows the lifecycle ativo / inativo / suspenso
The `status` column SHALL accept exactly one of `'ativo'`, `'inativo'`, `'suspenso'`. New contratos SHALL default to `'ativo'`. Only contratos with `status = 'ativo'` SHALL block client deletion in the clientes module.

#### Scenario: Default status on create
- **WHEN** the user creates a contrato without specifying status
- **THEN** it is saved with `status = 'ativo'`

#### Scenario: Suspenso does not block client deletion
- **WHEN** a client has only contratos with `status = 'suspenso'` and the user attempts to delete the client
- **THEN** the deletion proceeds (the clientes deletion guard only counts `'ativo'` contratos)

### Requirement: Financial summary aggregates lancamentos in real time
The system SHALL expose a `contratos_resumo_financeiro(contrato_id)` operation that returns `total_faturado`, `total_recebido`, `total_em_aberto`, each in integer cents. `total_faturado` SHALL be the sum of all parcelas (for parcelado lancamentos) and full values (for à vista lancamentos) of `natureza = 'entrada'` linked to the contrato. `total_recebido` SHALL be the subset whose effective status is `'pago'`. `total_em_aberto` SHALL be the subset whose status is `'pendente'`, `'parcialmente_pago'`, or `'inadimplente'`. `'cancelado'` lancamentos SHALL be excluded from all three totals.

#### Scenario: Contrato with one paid avista lancamento
- **WHEN** a contrato has a single `entrada` lancamento à vista with `valor = 100000` (R$ 1.000,00) and `status_pagamento = 'pago'`
- **THEN** the summary returns `total_faturado = 100000`, `total_recebido = 100000`, `total_em_aberto = 0`

#### Scenario: Contrato with parcelado lancamento partially paid
- **WHEN** a contrato has a `parcelado` lancamento with 6 parcelas of `50000` each, 2 already `'pago'` and 4 `'pendente'`
- **THEN** the summary returns `total_faturado = 300000`, `total_recebido = 100000`, `total_em_aberto = 200000`

#### Scenario: Cancelled lancamentos excluded
- **WHEN** a contrato has lancamentos of which one with `valor = 50000` is `status_pagamento = 'cancelado'`
- **THEN** that lancamento does not contribute to any of the totals

### Requirement: Contrato detail allows inline lancamento creation with pre-filled keys
The contrato detail screen SHALL expose a "Novo lançamento" CTA that opens the lancamentos creation form with `cliente_id` and `contrato_id` pre-filled and locked. On save, the new lancamento SHALL appear immediately in the contrato's lancamento list and the financial summary SHALL recompute.

#### Scenario: Pre-filled keys on inline creation
- **WHEN** the user clicks "Novo lançamento" from within a contrato detail
- **THEN** the lancamentos form opens with `cliente_id` and `contrato_id` already populated and disabled for editing

#### Scenario: Summary refreshes after inline save
- **WHEN** the user saves a new lancamento from the contrato detail
- **THEN** the contrato's financial summary on the same screen updates to include that lancamento without a page reload

### Requirement: link_documentos is an optional external URL
The `link_documentos` column SHALL hold a single TEXT URL or NULL. The UI SHALL render it as an external link opened via the Tauri opener plugin.

#### Scenario: Save and open a documents link
- **WHEN** the user saves a contrato with `link_documentos = "https://drive.google.com/..."` and later clicks the link in detail view
- **THEN** the URL opens in the OS default browser
