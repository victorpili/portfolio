import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../lib/db";
import { onlyDigits } from "../../lib/format/documents";
import { nowIsoTimestamp } from "../../lib/format/dates";
import { ConflictError, ValidationError } from "../../lib/errors";
import type {
  Processo,
  ProcessoInput,
  ProcessoListFilters,
  ProcessoListRow,
} from "./types";

const PROCESSO_COLUMNS = `
  id, cliente_id, natureza, numero_processo, vara, tribunal, comarca,
  fase, fase_custom, parte_adversa, advogado_adversario, oab_adversario,
  valor_causa, chance_exito, link_documentos, status, observacoes,
  criado_em, atualizado_em
`;

function normalizeInput(raw: ProcessoInput): ProcessoInput {
  // For judicial processos the number must be 20 digits — strip punctuation.
  // For administrativo it's free text — trim only.
  let numero_processo: string | null = null;
  if (raw.numero_processo && raw.numero_processo.trim()) {
    numero_processo =
      raw.natureza === "judicial"
        ? onlyDigits(raw.numero_processo)
        : raw.numero_processo.trim();
    if (!numero_processo) numero_processo = null;
  }
  const fase_custom = raw.fase === "outro" ? (raw.fase_custom?.trim() || null) : null;
  return { ...raw, numero_processo, fase_custom };
}

function validate(input: ProcessoInput): void {
  if (!input.cliente_id) {
    throw new ValidationError("Cliente é obrigatório.", "cliente_id");
  }
  if (input.natureza !== "judicial" && input.natureza !== "administrativo") {
    throw new ValidationError("Natureza do processo inválida.", "natureza");
  }
  if (input.natureza === "judicial" && input.numero_processo && input.numero_processo.length !== 20) {
    throw new ValidationError("Número CNJ deve conter 20 dígitos.", "numero_processo");
  }
  if (input.fase === "outro" && !input.fase_custom) {
    throw new ValidationError('Informe o nome da fase customizada quando "Outro" estiver selecionado.', "fase_custom");
  }
  if (input.chance_exito != null) {
    if (
      !Number.isInteger(input.chance_exito) ||
      input.chance_exito < 0 ||
      input.chance_exito > 100
    ) {
      throw new ValidationError("Chance de êxito deve ser um inteiro entre 0 e 100.", "chance_exito");
    }
  }
  if (input.valor_causa != null && !Number.isInteger(input.valor_causa)) {
    throw new ValidationError("Valor da causa deve ser um inteiro em centavos.", "valor_causa");
  }
}

function isUniqueViolation(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? error ?? "");
  return /UNIQUE constraint failed/i.test(msg);
}

function isCheckViolation(error: unknown): boolean {
  const msg = String((error as { message?: string } | null)?.message ?? error ?? "");
  return /CHECK constraint failed/i.test(msg);
}

// ──────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────

export async function processosCreate(raw: ProcessoInput): Promise<Processo> {
  const input = normalizeInput(raw);
  validate(input);

  const id = uuidv4();
  const now = nowIsoTimestamp();
  const db = await getDb();

  try {
    await db.execute(
      `INSERT INTO processos (${PROCESSO_COLUMNS})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        id,
        input.cliente_id,
        input.natureza,
        input.numero_processo,
        input.vara,
        input.tribunal,
        input.comarca,
        input.fase,
        input.fase_custom,
        input.parte_adversa,
        input.advogado_adversario,
        input.oab_adversario,
        input.valor_causa,
        input.chance_exito,
        input.link_documentos,
        input.status ?? "em_andamento",
        input.observacoes,
        now,
        now,
      ],
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ConflictError(
        input.natureza === "judicial"
          ? "Já existe um processo com este número CNJ."
          : "Já existe um processo administrativo com esse número.",
      );
    }
    if (isCheckViolation(e)) {
      throw new ValidationError("Os campos do processo não respeitam as restrições do banco.");
    }
    throw e;
  }

  const created = await processosGet(id);
  if (!created) throw new Error("Falha ao recuperar processo recém-criado.");
  return created;
}

export async function processosUpdate(id: string, raw: ProcessoInput): Promise<Processo> {
  const input = normalizeInput(raw);
  validate(input);

  const now = nowIsoTimestamp();
  const db = await getDb();

  try {
    const result = await db.execute(
      `UPDATE processos SET
         cliente_id = $1, natureza = $2, numero_processo = $3, vara = $4, tribunal = $5, comarca = $6,
         fase = $7, fase_custom = $8, parte_adversa = $9, advogado_adversario = $10,
         oab_adversario = $11, valor_causa = $12, chance_exito = $13,
         link_documentos = $14, status = $15, observacoes = $16, atualizado_em = $17
       WHERE id = $18`,
      [
        input.cliente_id,
        input.natureza,
        input.numero_processo,
        input.vara,
        input.tribunal,
        input.comarca,
        input.fase,
        input.fase_custom,
        input.parte_adversa,
        input.advogado_adversario,
        input.oab_adversario,
        input.valor_causa,
        input.chance_exito,
        input.link_documentos,
        input.status,
        input.observacoes,
        now,
        id,
      ],
    );
    if (result.rowsAffected === 0) {
      throw new ValidationError("Processo não encontrado.");
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ConflictError(
        input.natureza === "judicial"
          ? "Já existe outro processo com este número CNJ."
          : "Já existe outro processo administrativo com esse número.",
      );
    }
    if (isCheckViolation(e)) {
      throw new ValidationError("Os campos do processo não respeitam as restrições do banco.");
    }
    throw e;
  }

  const updated = await processosGet(id);
  if (!updated) throw new Error("Processo não encontrado após atualização.");
  return updated;
}

export async function processosDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM processos WHERE id = $1`, [id]);
}

export async function processosGet(id: string): Promise<Processo | null> {
  const db = await getDb();
  const rows = await db.select<Processo[]>(
    `SELECT ${PROCESSO_COLUMNS} FROM processos WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function processosList(filters: ProcessoListFilters = {}): Promise<ProcessoListRow[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.cliente_id) {
    params.push(filters.cliente_id);
    where.push(`p.cliente_id = $${params.length}`);
  }
  if (filters.status && filters.status !== "all") {
    params.push(filters.status);
    where.push(`p.status = $${params.length}`);
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    const termDigits = onlyDigits(filters.search);
    params.push(term);
    const nameParam = `$${params.length}`;
    // Search the raw number as-is (matches both administrative and digit-only CNJs).
    let clause =
      `p.parte_adversa LIKE ${nameParam} COLLATE NOCASE` +
      ` OR p.vara LIKE ${nameParam} COLLATE NOCASE` +
      ` OR p.tribunal LIKE ${nameParam} COLLATE NOCASE` +
      ` OR c.nome LIKE ${nameParam} COLLATE NOCASE` +
      ` OR p.numero_processo LIKE ${nameParam} COLLATE NOCASE`;
    if (termDigits) {
      params.push(`%${termDigits}%`);
      const digitParam = `$${params.length}`;
      clause += ` OR p.numero_processo LIKE ${digitParam}`;
    }
    where.push(`(${clause})`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return db.select<ProcessoListRow[]>(
    `SELECT
       p.id, p.cliente_id, p.natureza, p.numero_processo, p.vara, p.tribunal, p.comarca,
       p.fase, p.fase_custom, p.parte_adversa, p.advogado_adversario, p.oab_adversario,
       p.valor_causa, p.chance_exito, p.link_documentos, p.status, p.observacoes,
       p.criado_em, p.atualizado_em,
       c.nome AS cliente_nome, c.tipo AS cliente_tipo
     FROM processos p
     JOIN clientes c ON c.id = p.cliente_id
     ${whereSql}
     ORDER BY p.atualizado_em DESC`,
    params,
  );
}

export async function processosListByCliente(cliente_id: string): Promise<Processo[]> {
  const db = await getDb();
  return db.select<Processo[]>(
    `SELECT ${PROCESSO_COLUMNS} FROM processos WHERE cliente_id = $1
     ORDER BY atualizado_em DESC`,
    [cliente_id],
  );
}
