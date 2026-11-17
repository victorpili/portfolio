## Context

The Brazilian CNJ process number has a strict canonical format (`NNNNNNN-DD.AAAA.J.TR.OOOO`, 20 digits). It will be typed, pasted from PJe/eSAJ, and looked up by digit-equality, so normalization at the boundary is essential. `chance_exito` is a probability used later by the dashboard to weight non-guaranteed receivables.

## Goals / Non-Goals

**Goals:**
- Reliable storage and lookup of CNJ numbers.
- Easy navigation from a client to all of their processes.
- Schema that supports both standard and custom phase values without proliferating tables.
- Storage shape that the dashboard projection can consume directly.

**Non-Goals:**
- Scraping or integrating with court systems (PJe, eSAJ) — out of scope for MVP.
- Modeling andamentos (procedural events) — replaced for now by the external `link_documentos` URL and the agenda module's deadline tracking.
- Validating CNJ check digits at SQL layer — the application handles it.

## Decisions

### CNJ stored as 20 digits
`numero_cnj` is stored as the bare 20-digit string. Display formats it as `0000000-00.0000.0.00.0000`.
- Alternative considered: storing the formatted string. Rejected because identical CNJs typed with different punctuation would not match.

### `fase` as controlled enum plus free text fallback
Four canonical values — `conhecimento`, `recurso`, `execucao`, `arquivado` — plus a fifth `outro` paired with a `fase_custom` text field. UI shows a dropdown; when `outro` is chosen, the custom field becomes required.
- Alternative considered: a `fases` lookup table. Rejected — for four standard values the configurability isn't worth the join cost and extra UI.

### `chance_exito` is a percentage integer
Stored as INTEGER 0–100. Nullable for processes where the user hasn't assessed it. The dashboard weights non-guaranteed receivables linked to a process by `chance_exito / 100`.
- Alternative considered: REAL 0–1. Rejected for storage clarity — integers display unambiguously.

### `valor_causa` stored in cents
Stored as INTEGER (cents). All currency in Jurix follows this convention (see project context) — formatting and conversion happen at the boundary.

### `link_documentos` is a single URL
A single TEXT column holding an external URL (Google Drive, Dropbox, OneDrive, local file path). No file management inside Jurix — the user owns document storage.

## Risks / Trade-offs

- **[Free-form fase_custom fragmentation]** → Users may type variations of the same custom phase. Mitigation: dashboards aggregate only on the four canonical values; custom phases are treated as a generic "Outros" bucket.
- **[Stale `chance_exito` skewing projections]** → Mitigation: the dashboard surfaces an "última atualização" timestamp per projection input so the user can spot stale entries.
- **[No process events / andamentos]** → MVP gap. Mitigation: the agenda module covers deadlines; rich process timelines wait for a later release.

## Migration Plan

- Greenfield; runs after `add-clientes-module` migrations.
- Migration file `0003_create_processos.sql`.
