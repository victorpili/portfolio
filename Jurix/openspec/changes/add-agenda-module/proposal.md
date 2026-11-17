## Why

A lawyer's calendar is dominated by hard deadlines — audiências, prazos processuais, reuniões com clientes. Missing one has serious consequences. Jurix needs an agenda that captures events, links them to the relevant case/client/contract, and surfaces upcoming items prominently.

## What Changes

- Introduce an `agenda_eventos` table with optional FKs to `clientes`, `processos`, and `contratos`.
- Introduce a `tipo_evento_id` FK to the `tipos_evento` lookup table (configurable: audiência, reunião, prazo, etc.).
- Provide an `alerta_dias` integer for an internal anticipation alert (e.g. "remind me 3 days before").
- Provide a `status` field (`pendente` / `concluido` / `cancelado`).
- Provide three list views: monthly calendar, weekly list, and "prazos vencendo" lists for the next 7 and 30 days.

## Capabilities

### New Capabilities
- `agenda`: event scheduler with FK to client/processo/contrato, configurable event types via the lookup table, alert anticipation, and the four standard views (monthly calendar, weekly, próximos 7 dias, próximos 30 dias).

### Modified Capabilities
<!-- none -->

## Impact

- New SQLite table: `agenda_eventos`.
- Migration `0007_create_agenda_eventos.sql`.
- New Tauri commands for CRUD and the three list views.
- New React route/screen with three view modes.
- The dashboard MAY surface a compact "próximos eventos" widget reading from this module's queries.
