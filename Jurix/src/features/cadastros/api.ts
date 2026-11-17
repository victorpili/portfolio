import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../lib/db";
import { nowIsoTimestamp } from "../../lib/format/dates";
import { ConflictError, DeleteBlockedError, ValidationError } from "../../lib/errors";

export interface LookupRow {
  id: string;
  nome: string;
  ativo: number;
  criado_em: string;
}

export const LOOKUP_TABLES = [
  "areas_direito",
  "tipos_contrato",
  "centros_custo",
  "origens",
  "tipos_evento",
] as const;

export type LookupTable = (typeof LOOKUP_TABLES)[number];

function assertTable(table: string): asserts table is LookupTable {
  if (!LOOKUP_TABLES.includes(table as LookupTable)) {
    throw new Error(`Unknown lookup table: ${table}`);
  }
}

export async function lookupList(table: LookupTable, opts?: { onlyActive?: boolean }): Promise<LookupRow[]> {
  assertTable(table);
  const db = await getDb();
  const where = opts?.onlyActive ? "WHERE ativo = 1" : "";
  const sql = `SELECT id, nome, ativo, criado_em FROM ${table} ${where} ORDER BY nome COLLATE NOCASE ASC`;
  return db.select<LookupRow[]>(sql);
}

// Domain table each lookup is referenced by — drives the deletion guard.
// Singular/plural are pt-BR nouns used in the blocked message.
const LOOKUP_REFERENCES: Record<
  LookupTable,
  { table: string; column: string; singular: string; plural: string }
> = {
  areas_direito: { table: "contratos", column: "area_direito_id", singular: "contrato", plural: "contratos" },
  tipos_contrato: { table: "contratos", column: "tipo_contrato_id", singular: "contrato", plural: "contratos" },
  centros_custo: { table: "lancamentos", column: "centro_custo_id", singular: "lançamento", plural: "lançamentos" },
  origens: { table: "clientes", column: "origem_id", singular: "cliente", plural: "clientes" },
  tipos_evento: {
    table: "agenda_eventos",
    column: "tipo_evento_id",
    singular: "evento da agenda",
    plural: "eventos da agenda",
  },
};

function isUniqueViolation(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? error ?? "");
  return /UNIQUE constraint failed/i.test(msg);
}

async function lookupGet(table: LookupTable, id: string): Promise<LookupRow> {
  const db = await getDb();
  const rows = await db.select<LookupRow[]>(
    `SELECT id, nome, ativo, criado_em FROM ${table} WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) throw new ValidationError("Item não encontrado.");
  return rows[0];
}

export async function lookupCreate(table: LookupTable, nome: string): Promise<LookupRow> {
  assertTable(table);
  const trimmed = (nome ?? "").trim();
  if (!trimmed) throw new ValidationError("O nome é obrigatório.", "nome");

  const db = await getDb();
  const id = uuidv4();
  const now = nowIsoTimestamp();
  try {
    await db.execute(`INSERT INTO ${table} (id, nome, ativo, criado_em) VALUES ($1, $2, 1, $3)`, [
      id,
      trimmed,
      now,
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError(`Já existe um item chamado "${trimmed}".`);
    throw e;
  }
  return { id, nome: trimmed, ativo: 1, criado_em: now };
}

export async function lookupUpdate(table: LookupTable, id: string, nome: string): Promise<LookupRow> {
  assertTable(table);
  const trimmed = (nome ?? "").trim();
  if (!trimmed) throw new ValidationError("O nome é obrigatório.", "nome");

  const db = await getDb();
  try {
    const result = await db.execute(`UPDATE ${table} SET nome = $1 WHERE id = $2`, [trimmed, id]);
    if (result.rowsAffected === 0) throw new ValidationError("Item não encontrado.");
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError(`Já existe um item chamado "${trimmed}".`);
    throw e;
  }
  return lookupGet(table, id);
}

export async function lookupToggleAtivo(table: LookupTable, id: string): Promise<LookupRow> {
  assertTable(table);
  const db = await getDb();
  const result = await db.execute(
    `UPDATE ${table} SET ativo = CASE ativo WHEN 1 THEN 0 ELSE 1 END WHERE id = $1`,
    [id],
  );
  if (result.rowsAffected === 0) throw new ValidationError("Item não encontrado.");
  return lookupGet(table, id);
}

export async function lookupDelete(table: LookupTable, id: string): Promise<void> {
  assertTable(table);
  const db = await getDb();
  const ref = LOOKUP_REFERENCES[table];

  // The referencing table may not exist yet (e.g. agenda_eventos before the Agenda module).
  const tableExists = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = $1`,
    [ref.table],
  );
  if (tableExists.length > 0) {
    const counted = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) AS count FROM ${ref.table} WHERE ${ref.column} = $1`,
      [id],
    );
    const count = counted[0]?.count ?? 0;
    if (count > 0) {
      const noun = count === 1 ? ref.singular : ref.plural;
      throw new DeleteBlockedError(
        `Este item é usado por ${count} ${noun}. Desative-o em vez de excluir para preservar o histórico.`,
        [{ table: ref.table, count }],
      );
    }
  }

  const result = await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
  if (result.rowsAffected === 0) throw new ValidationError("Item não encontrado.");
}
