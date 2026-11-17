# Jurix — repo guide for future Claude sessions

Desktop management system for autonomous lawyers (Brazilian market). Built with Tauri 2 + React 19 + TypeScript + Tailwind v4 + SQLite (`@tauri-apps/plugin-sql`).

## Architecture decisions

### Database access: JS-driven via `tauri-plugin-sql`

We use `tauri-plugin-sql` for both migrations and runtime queries. Migrations are registered in [src-tauri/src/lib.rs](src-tauri/src/lib.rs) and live as SQL files under [src-tauri/migrations/](src-tauri/migrations/). They run automatically on app start.

Runtime queries go through `Database.load("sqlite:jurix.db")` from React. The plugin already exposes Tauri commands (`plugin:sql|execute`, `plugin:sql|select`) under the hood — so the OpenSpec note "Rust commands for CRUD" is satisfied through this plugin rather than hand-rolled commands.

Why this and not custom Rust commands:
- This is a single-user local app. The plugin's connection pool and migration system are exactly what we need.
- Validation logic (CPF/CNPJ format, document uniqueness rules, type-conditional fields) is enforced both at the **SQL layer** (CHECK constraints + partial unique indexes) and at the **TS API client** layer just before each `db.execute()`. The TS layer is unit-testable.
- Avoids running two SQLite handles to the same file.

The downside is that complex multi-step transactions live in TS instead of Rust. For now that's acceptable; if it becomes painful (e.g. the parcelas generation in Módulo 4), we can promote those flows into Rust commands that use the same plugin connection.

> **GOTCHA — never use manual `BEGIN`/`COMMIT` across separate `db.execute()` calls.**
> `tauri-plugin-sql` draws a connection from a *pool* for every `execute()`/`select()`.
> A `BEGIN` on one call and `COMMIT` on another run on **different connections**, leaving
> a transaction dangling → the database locks (`database is locked`).
> For multi-statement atomicity, either (a) rely on SQLite's per-statement implicit
> transaction with `ON DELETE CASCADE` FKs, or (b) accept ordered independent statements
> when validation guarantees they cannot fail. Do **not** hand-roll transactions in TS.

### Currency, documents, dates

- Currency stored as **INTEGER cents** everywhere. Formatting (`R$ 1.234,56`) is presentation-only.
- CPF/CNPJ stored as **digits only**. Format (`000.000.000-00`) is presentation-only. Partial unique indexes guarantee uniqueness only when the value is present and only within the matching `tipo`.
- Dates stored as ISO strings (`YYYY-MM-DD` for dates, full ISO timestamps for `criado_em` / `atualizado_em`). Displayed in pt-BR locale.

### Visual language

Soft Structuralism with editorial accents (see [src/index.css](src/index.css) `@theme`):
- Off-white canvas (`--color-canvas: #faf9f6`)
- Charcoal text (`--color-ink: #14161a`)
- Single deep-navy accent (`--color-accent: #1c2a3a`) used sparingly
- Display serif: `Fraunces` for h1/h2/page titles
- UI sans: `Plus Jakarta Sans`
- Cards use the **Double-Bezel** pattern (outer shell with hairline ring + inner core with inset highlight) via the `.bezel-shell` / `.bezel-inner` utilities.
- Transitions use the `--ease-out-soft` cubic-bezier for all interactive state changes.

Resist adding more colors. The semantic ones (`positive`, `warning`, `critical`) are reserved for status badges.

### File layout

```
jurix/
├── openspec/                       # OpenSpec proposals and specs (1 per module)
├── src-tauri/
│   ├── migrations/                 # Versioned SQL migrations, run by plugin-sql
│   └── src/lib.rs                  # Plugin registration
└── src/
    ├── index.css                   # Tailwind v4 + @theme tokens
    ├── App.tsx                     # Router shell
    ├── lib/
    │   ├── db.ts                   # Lazy Database.load() singleton
    │   └── format/                 # Documents, currency, dates utilities
    ├── components/
    │   ├── ui/                     # Button, Card, Input, Select, Badge, etc.
    │   └── layout/                 # AppShell, Sidebar, PageHeader
    └── features/
        └── clientes/               # Pages, API client, types for one module
            ├── api.ts
            ├── types.ts
            └── pages/
```

## OpenSpec workflow

- Proposals live under `openspec/changes/<change-name>/`.
- Each change has `proposal.md`, `design.md`, `specs/<capability>/spec.md`, `tasks.md`.
- Run `npx openspec validate <change>` after editing a spec.
- Run `npx openspec list` to see all proposed changes and their task completion.

## Build & run

```bash
npm install                # install JS deps
npm run tauri dev          # dev mode (requires Rust toolchain installed)
npm run tauri build        # production build
npx openspec list          # see specs / changes
```

Rust toolchain is required for `tauri dev` and `tauri build`. Install from https://rustup.rs/. Pure-JS work (the React side, type-checking, OpenSpec) does not require Rust.
