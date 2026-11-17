import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../lib/db";
import { nowIsoTimestamp } from "../../lib/format/dates";
import { ValidationError } from "../../lib/errors";
import type {
  AgendaEntityType,
  AgendaEvento,
  AgendaEventoInput,
  AgendaEventoRow,
  StatusEvento,
} from "./types";

const STATUSES: StatusEvento[] = ["pendente", "concluido", "cancelado"];

const EVENTO_COLUMNS = `
  e.id, e.titulo, e.tipo_evento_id, e.data_hora, e.cliente_id, e.processo_id,
  e.contrato_id, e.alerta_dias, e.status, e.descricao, e.criado_em
`;

/** Enriched SELECT used by every list query — joins the linked entity names. */
const ENRICHED_SELECT = `
  SELECT ${EVENTO_COLUMNS},
    te.nome AS tipo_evento_nome,
    c.nome AS cliente_nome,
    p.numero_processo AS processo_numero,
    p.natureza AS processo_natureza,
    ct.codigo AS contrato_codigo
  FROM agenda_eventos e
  JOIN tipos_evento te ON te.id = e.tipo_evento_id
  LEFT JOIN clientes c ON c.id = e.cliente_id
  LEFT JOIN processos p ON p.id = e.processo_id
  LEFT JOIN contratos ct ON ct.id = e.contrato_id
`;

// ──────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────

const DATA_HORA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

async function validate(input: AgendaEventoInput): Promise<void> {
  if (!input.titulo || !input.titulo.trim()) {
    throw new ValidationError("O título é obrigatório.", "titulo");
  }
  if (!input.tipo_evento_id) {
    throw new ValidationError("Selecione o tipo do evento.", "tipo_evento_id");
  }
  if (!input.data_hora || !DATA_HORA_RE.test(input.data_hora)) {
    throw new ValidationError("Informe data e hora do evento.", "data_hora");
  }
  if (
    !Number.isInteger(input.alerta_dias) ||
    input.alerta_dias < 0 ||
    input.alerta_dias > 365
  ) {
    throw new ValidationError("O alerta deve ser um número de dias entre 0 e 365.", "alerta_dias");
  }
  if (!STATUSES.includes(input.status)) {
    throw new ValidationError("Status do evento inválido.", "status");
  }

  const db = await getDb();

  const tipo = await db.select<{ id: string }[]>(
    `SELECT id FROM tipos_evento WHERE id = $1`,
    [input.tipo_evento_id],
  );
  if (tipo.length === 0) {
    throw new ValidationError("O tipo de evento selecionado não existe.", "tipo_evento_id");
  }

  // When both processo and cliente are set, the processo's cliente must match.
  if (input.processo_id) {
    const processo = await db.select<{ cliente_id: string }[]>(
      `SELECT cliente_id FROM processos WHERE id = $1`,
      [input.processo_id],
    );
    if (processo.length === 0) {
      throw new ValidationError("O processo vinculado não existe.", "processo_id");
    }
    if (input.cliente_id && input.cliente_id !== processo[0].cliente_id) {
      throw new ValidationError(
        "O cliente informado não corresponde ao cliente do processo selecionado.",
        "cliente_id",
      );
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────

export async function agendaCreate(input: AgendaEventoInput): Promise<AgendaEvento> {
  await validate(input);
  const db = await getDb();
  const id = uuidv4();
  const criado_em = nowIsoTimestamp();

  await db.execute(
    `INSERT INTO agenda_eventos
       (id, titulo, tipo_evento_id, data_hora, cliente_id, processo_id,
        contrato_id, alerta_dias, status, descricao, criado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id,
      input.titulo.trim(),
      input.tipo_evento_id,
      input.data_hora,
      input.cliente_id,
      input.processo_id,
      input.contrato_id,
      input.alerta_dias,
      input.status,
      input.descricao?.trim() || null,
      criado_em,
    ],
  );

  const created = await agendaGet(id);
  if (!created) throw new Error("Falha ao recuperar o evento recém-criado.");
  return created;
}

export async function agendaUpdate(id: string, input: AgendaEventoInput): Promise<AgendaEvento> {
  await validate(input);
  const db = await getDb();
  const result = await db.execute(
    `UPDATE agenda_eventos SET
       titulo = $1, tipo_evento_id = $2, data_hora = $3, cliente_id = $4,
       processo_id = $5, contrato_id = $6, alerta_dias = $7, status = $8, descricao = $9
     WHERE id = $10`,
    [
      input.titulo.trim(),
      input.tipo_evento_id,
      input.data_hora,
      input.cliente_id,
      input.processo_id,
      input.contrato_id,
      input.alerta_dias,
      input.status,
      input.descricao?.trim() || null,
      id,
    ],
  );
  if (result.rowsAffected === 0) throw new ValidationError("Evento não encontrado.");

  const updated = await agendaGet(id);
  if (!updated) throw new Error("Evento não encontrado após atualização.");
  return updated;
}

export async function agendaDelete(id: string): Promise<void> {
  const db = await getDb();
  const result = await db.execute(`DELETE FROM agenda_eventos WHERE id = $1`, [id]);
  if (result.rowsAffected === 0) throw new ValidationError("Evento não encontrado.");
}

/** Set the lifecycle status of an event (concluído, cancelado, or back to pendente). */
export async function agendaSetStatus(id: string, status: StatusEvento): Promise<void> {
  if (!STATUSES.includes(status)) {
    throw new ValidationError("Status do evento inválido.", "status");
  }
  const db = await getDb();
  const result = await db.execute(`UPDATE agenda_eventos SET status = $1 WHERE id = $2`, [
    status,
    id,
  ]);
  if (result.rowsAffected === 0) throw new ValidationError("Evento não encontrado.");
}

export async function agendaGet(id: string): Promise<AgendaEvento | null> {
  const db = await getDb();
  const rows = await db.select<AgendaEvento[]>(
    `SELECT id, titulo, tipo_evento_id, data_hora, cliente_id, processo_id,
            contrato_id, alerta_dias, status, descricao, criado_em
     FROM agenda_eventos WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ──────────────────────────────────────────────────────────────────────
// List views
// ──────────────────────────────────────────────────────────────────────

/** All events whose data_hora falls inside the given month, ordered by data_hora. */
export async function agendaListCalendar(
  year: number,
  month: number, // 1-based
): Promise<AgendaEventoRow[]> {
  const db = await getDb();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return db.select<AgendaEventoRow[]>(
    `${ENRICHED_SELECT}
     WHERE e.data_hora >= $1 AND e.data_hora < $2
     ORDER BY e.data_hora ASC`,
    [from, to],
  );
}

/**
 * Events whose date falls within the inclusive [from_date, to_date] window.
 * `statuses` filters the lifecycle status; omit/empty to include all three.
 */
export async function agendaListWindow(
  fromDate: string,
  toDate: string,
  statuses?: StatusEvento[],
): Promise<AgendaEventoRow[]> {
  const db = await getDb();
  const params: unknown[] = [fromDate, toDate];
  let statusClause = "";
  if (statuses && statuses.length > 0) {
    const valid = statuses.filter((s) => STATUSES.includes(s));
    if (valid.length > 0) {
      statusClause = ` AND e.status IN (${valid.map((_, i) => `$${i + 3}`).join(", ")})`;
      params.push(...valid);
    }
  }
  return db.select<AgendaEventoRow[]>(
    `${ENRICHED_SELECT}
     WHERE date(e.data_hora) >= $1 AND date(e.data_hora) <= $2${statusClause}
     ORDER BY e.data_hora ASC`,
    params,
  );
}

/** Events linked to a single cliente / processo / contrato, ordered by data_hora. */
export async function agendaListByEntity(
  entityType: AgendaEntityType,
  entityId: string,
): Promise<AgendaEventoRow[]> {
  const column =
    entityType === "cliente"
      ? "e.cliente_id"
      : entityType === "processo"
        ? "e.processo_id"
        : "e.contrato_id";
  const db = await getDb();
  return db.select<AgendaEventoRow[]>(
    `${ENRICHED_SELECT} WHERE ${column} = $1 ORDER BY e.data_hora ASC`,
    [entityId],
  );
}
