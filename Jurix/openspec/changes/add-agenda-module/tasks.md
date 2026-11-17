## 1. Database

- [x] 1.1 Create migration `0012_create_agenda_eventos.sql` with all columns, CHECK on `status`, FKs to tipos_evento/clientes/processos/contratos. _(Numbered 0012 — next in sequence after `0011_create_parcelas.sql`; the spec's draft `0007` predates modules 1–4.)_
- [x] 1.2 Add indexes: `agenda_eventos(data_hora)`, `agenda_eventos(status, data_hora)`, `agenda_eventos(cliente_id)`, `agenda_eventos(processo_id)`, `agenda_eventos(contrato_id)`.
- [x] 1.3 Wire migration into plugin-sql migrations array.

## 2. Backend (data layer — JS-driven via plugin-sql)

- [x] 2.1 Implement `agendaCreate(input)` — validates tipo_evento exists, validates processo/cliente consistency, validates `alerta_dias` range.
- [x] 2.2 Implement `agendaUpdate(id, input)` — same validations.
- [x] 2.3 Implement `agendaDelete(id)`.
- [x] 2.4 Implement `agendaSetStatus(id, status)` — sets concluído/cancelado/pendente (covers `agenda_marcar_concluido` plus reabertura and cancelamento).
- [x] 2.5 Implement `agendaListCalendar(year, month)` returning enriched payload (joined names).
- [x] 2.6 Implement `agendaListWindow(from_date, to_date, statuses?)`.
- [x] 2.7 Implement `agendaListByEntity(entity_type, entity_id)`.

## 3. Frontend (React + Tailwind)

- [x] 3.1 Build `AgendaPage` with view-mode toggle: Calendário / Semana / Próximos 7 dias / Próximos 30 dias.
- [x] 3.2 Build the calendar grid component (pure CSS grid, 7 columns × 5–6 rows, day cells show up to 3 event chips with a "+N" overflow indicator).
- [x] 3.3 Build the weekly list component (vertical timeline, grouped by day).
- [x] 3.4 Build the próximos N dias list component (flat list ordered by data_hora, with the relative "em 2 dias" label).
- [x] 3.5 Build `EventoFormDialog` (modal): titulo, tipo dropdown, datetime picker, alerta_dias number input, optional cliente/processo/contrato selects with auto-fill of cliente from processo, descricao textarea.
- [x] 3.6 Embed `agendaListByEntity` results on cliente, processo, contrato detail screens via `AgendaSection`.
- [ ] 3.7 Wire the dashboard's "Próximos eventos" widget to `agendaListWindow`. _(Deferred — Dashboard module not yet built; `agendaListWindow` is ready to consume.)_

## 4. Verification

- [ ] 4.1 Manual smoke test: create three events (audiência on a processo, reunião on a cliente, milestone on a contrato), open the calendar view, mark one concluído and confirm it disappears from default lists, set alerta_dias=3 and verify it surfaces only within the window. **Requires Rust toolchain installed.** _(Pending — `tsc` + `npm run build` pass clean.)_
- [x] 4.2 Run `npx openspec validate add-agenda-module`.
