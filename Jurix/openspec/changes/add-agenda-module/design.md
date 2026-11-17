## Context

A single agenda table covers compromissos, audiências, prazos processuais, and reuniões. The choice of "event type" is left to the cadastros-auxiliares lookup so the user can grow the vocabulary without code changes. Alerts are internal to Jurix — there is no e-mail/push integration in MVP; the app shows visual badges and a "Próximos eventos" panel.

## Goals / Non-Goals

**Goals:**
- Single table that supports compromissos and prazos.
- Easy linkage to a client, processo, or contrato (any combination of zero or one of each).
- Fast queries for "what's coming up in N days?"
- A calendar view that scales well visually.

**Non-Goals:**
- Recurring events — out of MVP; the user creates each event explicitly.
- E-mail / push notifications — only in-app visual cues.
- Multi-day events — `data_hora` is a single instant.
- Time zones — the desktop user's local timezone is implicit; storage is ISO-8601 in local time.

## Decisions

### Single `agenda_eventos` table
All event kinds share columns and differ only by `tipo_evento_id`. UI styling per type (color, icon) is read from the lookup table.

### Optional FKs to three contexts
`cliente_id`, `processo_id`, `contrato_id` are all nullable. A typical audiência points at `processo_id` (and the UI auto-resolves the linked client). A reunião may point at `cliente_id`. A contractual milestone may point at `contrato_id`. Backend SHALL enforce that, when a processo_id and a cliente_id are both set, the processo's cliente matches.

### `alerta_dias` is an integer N
Meaning: "alert visible from `data_hora - N` days until `data_hora`". Implementation is purely a query filter — there is no scheduler job. The app's "Próximos eventos" widget runs `WHERE data_hora - INTERVAL alerta_dias DAY <= now() < data_hora`. Default value is 1; min 0; max 365.

### Status lifecycle is three-valued
`pendente` (default), `concluido`, `cancelado`. The list views default to `pendente` and offer toggles to include the others.

### Calendar view uses pure CSS grid
No external calendar library — a Tailwind CSS grid lays out the month. Days are clickable to filter the weekly list below the calendar.

### Queries
- `agenda_list_calendar(year, month)` — returns all events in that month with their linked entity names.
- `agenda_list_window(from_date, to_date)` — covers weekly view and the 7/30-day "próximos eventos" widgets.

## Risks / Trade-offs

- **[Single instant doesn't model all-day events]** → Mitigation: convention is to use `data_hora = T08:00` for "all-day" prazos; UI shows "dia inteiro" when minutes are 00:00 and hour is 8.
- **[No recurrence]** → Acknowledged MVP gap; the user can clone an event from the detail screen.
- **[Cross-entity FK consistency]** → Mitigation: backend validates processo↔cliente consistency on save.

## Migration Plan

- Migration `0007_create_agenda_eventos.sql` runs after the cadastros-auxiliares migration that creates `tipos_evento`.
