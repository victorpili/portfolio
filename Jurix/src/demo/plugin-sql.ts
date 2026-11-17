/**
 * Substituto de `@tauri-apps/plugin-sql` usado só na demo web (`vite --mode demo`).
 *
 * O app desktop fala com o SQLite através do plugin do Tauri. No navegador não há
 * Tauri, então este módulo expõe a mesma API (`Database.load`, `execute`, `select`)
 * sobre o sql.js — o próprio SQLite compilado para WebAssembly — rodando em memória.
 * As migrações são exatamente os arquivos de `src-tauri/migrations/`, as mesmas
 * que o app desktop aplica. Nenhuma linha do código das telas ou das APIs muda.
 */
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export interface QueryResult {
  rowsAffected: number;
  lastInsertId?: number;
}

const migrations = import.meta.glob("../../src-tauri/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

let instance: Promise<SqlJsDatabase> | null = null;

async function open(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  // O sqlx (por baixo do plugin do Tauri) liga as chaves estrangeiras por padrão.
  db.exec("PRAGMA foreign_keys = ON;");
  for (const path of Object.keys(migrations).sort()) {
    db.exec(migrations[path]);
  }
  return db;
}

/** O plugin usa `$1, $2…`; no SQLite, `?1, ?2…` amarra pelo índice, como o sqlx faz. */
function toNumbered(sql: string): string {
  return sql.replace(/\$(\d+)/g, "?$1");
}

function toBindings(values: unknown[] = []): SqlValue[] {
  return values.map((v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "number" || typeof v === "string") return v;
    return JSON.stringify(v);
  });
}

export default class Database {
  path: string;

  private constructor(path: string) {
    this.path = path;
  }

  static async load(path: string): Promise<Database> {
    if (!instance) instance = open();
    await instance;
    return new Database(path);
  }

  static get(path: string): Database {
    return new Database(path);
  }

  async execute(query: string, bindValues?: unknown[]): Promise<QueryResult> {
    const db = await instance!;
    db.run(toNumbered(query), toBindings(bindValues));
    const rowsAffected = db.getRowsModified();
    const last = db.exec("SELECT last_insert_rowid() AS id");
    const lastInsertId = Number(last[0]?.values[0]?.[0] ?? 0);
    return { rowsAffected, lastInsertId };
  }

  async select<T>(query: string, bindValues?: unknown[]): Promise<T> {
    const db = await instance!;
    const stmt = db.prepare(toNumbered(query));
    try {
      stmt.bind(toBindings(bindValues));
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows as T;
    } finally {
      stmt.free();
    }
  }

  async close(): Promise<boolean> {
    return true;
  }
}
