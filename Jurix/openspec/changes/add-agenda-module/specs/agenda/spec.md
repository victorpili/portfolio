## ADDED Requirements

### Requirement: Agenda registry persists events with optional links to client, processo, contrato
The system SHALL persist events in an `agenda_eventos` table with columns `id` (UUID PK), `titulo` (TEXT NOT NULL), `tipo_evento_id` (FK to `tipos_evento`, NOT NULL), `data_hora` (TEXT ISO-8601, NOT NULL), `cliente_id` (FK nullable), `processo_id` (FK nullable), `contrato_id` (FK nullable), `alerta_dias` (INTEGER DEFAULT 1), `status` (TEXT CHECK IN ('pendente','concluido','cancelado') DEFAULT 'pendente'), `descricao` (TEXT nullable), `criado_em` (TEXT ISO-8601). Updating an event SHALL be allowed at any time; the system SHALL NOT track `atualizado_em` for events.

#### Scenario: Create an audiência linked to a processo
- **WHEN** the user submits an event with a valid `tipo_evento_id` ("Audiência"), `data_hora = "2026-07-15T14:30:00"`, `processo_id` set, and `titulo = "Audiência de instrução"`
- **THEN** the row is inserted with `status = 'pendente'`, `alerta_dias = 1` (default), and a new UUID assigned

#### Scenario: Reject an event without a tipo
- **WHEN** the user submits an event without `tipo_evento_id`
- **THEN** the system rejects with a validation error

### Requirement: When both processo and cliente are provided, they must match
The system SHALL reject saves where `processo_id` and `cliente_id` are both set AND the processo's `cliente_id` does not equal the supplied `cliente_id`. When the user picks a `processo_id` in the UI, the corresponding `cliente_id` SHALL be auto-populated and disabled.

#### Scenario: Auto-fill cliente from processo
- **WHEN** the user selects a processo in the event form
- **THEN** the cliente field is set to the processo's cliente and becomes read-only

#### Scenario: Reject mismatched processo/cliente at the backend
- **WHEN** an API call supplies a `processo_id` whose cliente differs from the supplied `cliente_id`
- **THEN** the system rejects with a validation error

### Requirement: alerta_dias controls the anticipation window for visual alerts
The system SHALL accept `alerta_dias` as an integer in the range [0, 365]. The "Próximos eventos" widgets and visual alert badges SHALL surface an event when `today >= data_hora - alerta_dias` AND `today <= data_hora` AND `status = 'pendente'`.

#### Scenario: Default anticipation of 1 day
- **WHEN** the user creates an event without specifying `alerta_dias`
- **THEN** the saved row has `alerta_dias = 1`

#### Scenario: Reject out-of-range alerta_dias
- **WHEN** the user submits `alerta_dias = -1` or `alerta_dias = 400`
- **THEN** the system rejects with a validation error

#### Scenario: Event appears in alert widget within the window
- **WHEN** an event has `data_hora = "2026-07-15T14:30:00"`, `alerta_dias = 3`, and today is 2026-07-13
- **THEN** the event appears in the "alertas próximos" widget

#### Scenario: Concluido events are excluded from alerts
- **WHEN** the user marks an event as `'concluido'`
- **THEN** that event no longer appears in any alert widget, regardless of its `alerta_dias`

### Requirement: Status follows the lifecycle pendente / concluido / cancelado
The `status` column SHALL accept exactly one of `'pendente'`, `'concluido'`, `'cancelado'`. New events SHALL default to `'pendente'`. List views SHALL default to `'pendente'` only, with toggles to include `'concluido'` and `'cancelado'`.

#### Scenario: Mark an event as concluido
- **WHEN** the user clicks "Marcar como concluído" on a pending event
- **THEN** the event's `status` becomes `'concluido'`

#### Scenario: Default list excludes concluido
- **WHEN** the user opens the agenda list with default filters
- **THEN** only events with `status = 'pendente'` are returned

### Requirement: Monthly calendar view returns all events in a month
The system SHALL expose `agenda_list_calendar(year, month)` returning all events whose `data_hora` falls inside that month, regardless of status, together with the linked entity names (cliente.nome, processo.numero_cnj, contrato.codigo) and the `tipo_evento.nome` for rendering.

#### Scenario: Fetch March 2026
- **WHEN** the UI requests the calendar for year=2026, month=3
- **THEN** every event with `data_hora` between 2026-03-01T00:00 and 2026-03-31T23:59 inclusive is returned

#### Scenario: Calendar groups by day for rendering
- **WHEN** the UI receives the calendar payload
- **THEN** the response includes a stable order by `data_hora` so the UI can group events under their day cells without resorting

### Requirement: Weekly and próximos N dias lists query a date window
The system SHALL expose `agenda_list_window(from_date, to_date, status_filter)` returning events whose `data_hora` falls within the inclusive window. The 7-day and 30-day "próximos eventos" widgets SHALL call this with `from_date = today` and `to_date = today + N`. The weekly view SHALL call it with the Sunday-to-Saturday (or locale-appropriate) bounds of the user's current week.

#### Scenario: Próximos 7 dias on a quiet week
- **WHEN** the user opens the dashboard widget "Próximos 7 dias" and there are no pending events in that window
- **THEN** the widget renders an empty-state message and the response is an empty array

#### Scenario: Window is inclusive on both ends
- **WHEN** the user queries the window from 2026-07-13 to 2026-07-20 and an event has `data_hora = "2026-07-20T18:00"`
- **THEN** that event is included in the result

### Requirement: Detail of any cliente / processo / contrato surfaces its events
The system SHALL expose `agenda_list_by_entity(entity_type, entity_id)` returning the events linked to that entity, ordered by `data_hora` ascending. The detail screens for cliente, processo, and contrato SHALL embed this list with quick actions: mark concluido, edit, delete.

#### Scenario: Cliente detail lists upcoming events
- **WHEN** the user opens a cliente detail
- **THEN** an "Agenda" section shows that cliente's `pendente` events ordered by `data_hora`, with concluded/cancelled events available behind a toggle
