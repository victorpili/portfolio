## ADDED Requirements

### Requirement: Processo registry persists case metadata linked to a client
The system SHALL persist legal processes in a `processos` table with columns `id` (UUID PK), `cliente_id` (FK to `clientes`, NOT NULL), `natureza` (TEXT CHECK IN ('judicial', 'administrativo')), `numero_processo`, `vara`, `tribunal`, `comarca`, `fase`, `fase_custom`, `parte_adversa`, `advogado_adversario`, `oab_adversario`, `valor_causa` (INTEGER cents), `chance_exito` (INTEGER 0–100, nullable), `link_documentos` (TEXT URL), `status`, `observacoes`, `criado_em`, `atualizado_em`. Deletion of a `clientes` row whose deletion would otherwise succeed SHALL cascade into `processos` only if no `contratos` reference those processes — otherwise the client deletion is already blocked by the clientes module.

#### Scenario: Create a processo linked to an existing client
- **WHEN** the user submits a processo with a valid `cliente_id`, `natureza = 'judicial'`, `numero_processo` (a 20-digit CNJ), and `status = 'em_andamento'`
- **THEN** the row is inserted with `criado_em` and `atualizado_em` set to the current timestamp and a new UUID assigned to `id`

#### Scenario: Reject a processo without a valid client
- **WHEN** the user submits a processo whose `cliente_id` does not exist in `clientes`
- **THEN** the system rejects with a foreign-key error and no row is written

### Requirement: natureza distinguishes judicial from administrativo processos
The `natureza` column SHALL accept exactly one of `'judicial'` or `'administrativo'`. New processos SHALL default to `'judicial'` when not explicitly provided. The natureza affects how `numero_processo` is validated and rendered: judicial processos use the 20-digit CNJ format; administrativos are free-form text (NUP, SEI, internal protocols, etc.).

#### Scenario: Default natureza is judicial
- **WHEN** the user creates a processo without specifying natureza
- **THEN** the row is inserted with `natureza = 'judicial'`

#### Scenario: Reject unknown natureza
- **WHEN** the user submits a `natureza` value other than `'judicial'` or `'administrativo'`
- **THEN** the system rejects with a validation error

### Requirement: numero_processo storage depends on natureza
For `natureza = 'judicial'`, the system SHALL strip every non-digit character from `numero_processo` before persistence, and the stored value SHALL be exactly 20 digits when present. The display layer SHALL format judicial numbers as `NNNNNNN-DD.AAAA.J.TR.OOOO`. For `natureza = 'administrativo'`, the system SHALL persist `numero_processo` verbatim (trimmed of surrounding whitespace) with no length constraint, and display SHALL render it as stored.

#### Scenario: Judicial — submit a formatted CNJ
- **WHEN** the user submits `natureza = 'judicial'` with `numero_processo = "0001234-56.2024.8.26.0100"`
- **THEN** the value persisted is `"00012345620248260100"` (20 digits, no punctuation)

#### Scenario: Judicial — reject CNJ with wrong digit count
- **WHEN** the user submits `natureza = 'judicial'` with a `numero_processo` whose digit count, after stripping punctuation, is not 20
- **THEN** the system rejects with a validation error and no row is written

#### Scenario: Judicial — display stored CNJ in canonical format
- **WHEN** the UI renders a judicial processo whose stored `numero_processo` is `"00012345620248260100"`
- **THEN** it is shown as `"0001234-56.2024.8.26.0100"` using the canonical mask

#### Scenario: Administrativo — accept a free-form number verbatim
- **WHEN** the user submits `natureza = 'administrativo'` with `numero_processo = "13864.722222/2024-99"`
- **THEN** the value is persisted verbatim and displayed without applying the CNJ mask

#### Scenario: Administrativo — accept any non-empty string
- **WHEN** the user submits `natureza = 'administrativo'` with `numero_processo = "SEI-1234/2026"`
- **THEN** the row is inserted with that exact value (trimmed of surrounding whitespace)

### Requirement: numero_processo is unique across all processos when present
The system SHALL enforce uniqueness of `numero_processo` across every row in `processos` where `numero_processo IS NOT NULL`, regardless of `natureza`. NULL `numero_processo` SHALL NOT participate in the uniqueness constraint, so multiple rows without a number remain valid.

#### Scenario: Duplicate judicial CNJ rejected
- **WHEN** the user creates a judicial processo whose `numero_processo` matches the `numero_processo` of an existing processo
- **THEN** the system rejects the operation with a uniqueness error

#### Scenario: Duplicate administrativo number rejected
- **WHEN** the user creates an administrativo processo whose `numero_processo` matches the `numero_processo` of an existing processo
- **THEN** the system rejects the operation with a uniqueness error

#### Scenario: Multiple processos without number are allowed
- **WHEN** the user creates two processos, both with `numero_processo = NULL`
- **THEN** both inserts succeed

#### Scenario: Same digits across naturezas also rejected
- **WHEN** a judicial processo already exists with `numero_processo = "00012345620248260100"` and the user creates an administrativo processo whose `numero_processo` is the same string
- **THEN** the system rejects with a uniqueness error (uniqueness is global, not scoped by natureza)

### Requirement: fase uses a controlled list with an Outro escape hatch
The `fase` column SHALL accept one of `'conhecimento'`, `'recurso'`, `'execucao'`, `'arquivado'`, `'outro'`. When `fase = 'outro'`, the system SHALL require a non-empty `fase_custom`. For the four canonical values `fase_custom` SHALL be NULL.

#### Scenario: Select a canonical fase
- **WHEN** the user submits `fase = 'recurso'` without `fase_custom`
- **THEN** the row is inserted with `fase = 'recurso'` and `fase_custom = NULL`

#### Scenario: Select Outro requires a custom value
- **WHEN** the user submits `fase = 'outro'` with empty `fase_custom`
- **THEN** the system rejects with a validation error

#### Scenario: Custom fase persists alongside Outro
- **WHEN** the user submits `fase = 'outro'` and `fase_custom = 'Cumprimento de sentença'`
- **THEN** the row is inserted with both values stored verbatim

### Requirement: status follows a controlled list
The `status` column SHALL accept exactly one of `'em_andamento'`, `'encerrado'`, `'suspenso'`. New processos SHALL default to `'em_andamento'`.

#### Scenario: Default status on create
- **WHEN** the user creates a processo and does not specify `status`
- **THEN** the row is inserted with `status = 'em_andamento'`

#### Scenario: Reject unknown status
- **WHEN** the user submits an unrecognized status value
- **THEN** the system rejects with a validation error

### Requirement: Status is colour-coded across the module
The UI SHALL render the processo status with a consistent colour so the three states are visually distinguishable at a glance: `em_andamento` in green, `suspenso` in orange, `encerrado` in red. The colour SHALL be applied to the status badge wherever it appears (list, detail, embedded sections) and to the options of the status selector in the processo form.

#### Scenario: Status badge colours
- **WHEN** a processo with `status = 'em_andamento'` is displayed
- **THEN** its status badge uses the green (positive) tone; a `'suspenso'` processo uses orange (warning); an `'encerrado'` processo uses red (critical)

#### Scenario: Status selector shows colour dots
- **WHEN** the user opens the status selector in the processo form
- **THEN** each option shows a leading colour dot matching its status colour

### Requirement: valor_causa stored in integer cents
The system SHALL persist `valor_causa` as INTEGER cents (e.g. R$ 1.234,56 is stored as 123456). The UI SHALL accept and display BRL currency formatting. The column SHALL be nullable.

#### Scenario: Convert input to cents
- **WHEN** the user types `R$ 12.345,67` into the valor_causa input and saves
- **THEN** the stored value is the integer `1234567`

#### Scenario: Render cents as BRL
- **WHEN** the UI loads a processo whose stored `valor_causa` is `1234567`
- **THEN** the field is displayed as `R$ 12.345,67`

### Requirement: chance_exito is an integer 0–100
The `chance_exito` column SHALL accept an integer between 0 and 100 inclusive, or NULL when the user has not assessed the case. The system SHALL reject values outside that range. This value SHALL be consumed by the dashboard's non-guaranteed receivables projection.

#### Scenario: Accept a chance_exito in range
- **WHEN** the user submits `chance_exito = 65`
- **THEN** the row is inserted with `chance_exito = 65`

#### Scenario: Reject an out-of-range chance_exito
- **WHEN** the user submits `chance_exito = 150` or a negative value
- **THEN** the system rejects with a validation error

### Requirement: List view filters processos by client and status
The processos list SHALL support filtering by `cliente_id`, by `status`, and by free-text search across `numero_cnj`, `parte_adversa`, `vara`, `tribunal`. The client detail screen SHALL show a "Processos" section listing only that client's processos.

#### Scenario: Filter by status
- **WHEN** the user opens the list and selects "Apenas em andamento"
- **THEN** only processos with `status = 'em_andamento'` are returned

#### Scenario: Search by partial CNJ
- **WHEN** the user searches for "1234" in the list
- **THEN** processos whose stored `numero_cnj` contains the substring `"1234"` are returned

### Requirement: link_documentos is an optional external URL
The `link_documentos` column SHALL hold a single TEXT URL or NULL. When present, the UI SHALL render it as an external link that opens in the user's default browser.

#### Scenario: Save a Drive link on a processo
- **WHEN** the user saves a processo with `link_documentos = "https://drive.google.com/drive/folders/abc123"`
- **THEN** the row is persisted with that value verbatim

#### Scenario: Detail view opens the link externally
- **WHEN** the user clicks the link on the processo detail screen
- **THEN** the URL is opened in the OS default browser via the Tauri opener plugin
