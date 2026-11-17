import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../lib/db";
import { nowIsoTimestamp } from "../../lib/format/dates";
import { ConflictError, ValidationError } from "../../lib/errors";
import type {
  Contrato,
  ContratoInput,
  ContratoListFilters,
  ContratoListRow,
  ContratoResumoFinanceiro,
} from "./types";

const CONTRATO_COLUMNS = `
  id, codigo, nome, cliente_id, processo_id, area_direito_id, tipo_contrato_id,
  valor_base, data_inicio, data_encerramento, status,
  link_documentos, observacoes, criado_em, atualizado_em
`;

function yearOf(iso: string | null | undefined): number {
  if (!iso) return new Date().getFullYear();
  const m = /^(\d{4})-/.exec(iso);
  return m ? Number(m[1]) : new Date().getFullYear();
}

/**
 * Compute the next available CTR-{YYYY}-{NNNN} sequence for a given year.
 * Inspects every existing codigo matching the canonical pattern and returns
 * MAX(sequence) + 1, zero-padded to 4 digits.
 */
export async function previewNextCodigo(year: number = new Date().getFullYear()): Promise<string> {
  const db = await getDb();
  const pattern = `CTR-${year}-[0-9][0-9][0-9][0-9]`;
  const rows = await db.select<{ max_seq: number | null }[]>(
    `SELECT MAX(CAST(substr(codigo, 10) AS INTEGER)) AS max_seq
       FROM contratos WHERE codigo GLOB $1`,
    [pattern],
  );
  const next = (rows[0]?.max_seq ?? 0) + 1;
  return `CTR-${year}-${String(next).padStart(4, "0")}`;
}

async function assertProcessoBelongsToCliente(processo_id: string, cliente_id: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ cliente_id: string }[]>(
    `SELECT cliente_id FROM processos WHERE id = $1`,
    [processo_id],
  );
  if (rows.length === 0) {
    throw new ValidationError("Processo selecionado não existe.", "processo_id");
  }
  if (rows[0].cliente_id !== cliente_id) {
    throw new ValidationError("O processo escolhido pertence a outro cliente.", "processo_id");
  }
}

function validate(input: ContratoInput): void {
  if (!input.cliente_id) throw new ValidationError("Cliente é obrigatório.", "cliente_id");
  if (!input.area_direito_id) throw new ValidationError("Área do direito é obrigatória.", "area_direito_id");
  if (!input.tipo_contrato_id) throw new ValidationError("Tipo de contrato é obrigatório.", "tipo_contrato_id");
  if (!input.nome || !input.nome.trim()) throw new ValidationError("Nome é obrigatório.", "nome");
  if (input.valor_base == null || !Number.isInteger(input.valor_base) || input.valor_base < 0) {
    throw new ValidationError("Valor base deve ser um inteiro em centavos (não negativo).", "valor_base");
  }
  if (!input.data_inicio) throw new ValidationError("Data de início é obrigatória.", "data_inicio");
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

export async function contratosCreate(rawInput: ContratoInput): Promise<Contrato> {
  validate(rawInput);
  if (rawInput.processo_id) {
    await assertProcessoBelongsToCliente(rawInput.processo_id, rawInput.cliente_id);
  }

  const codigo = rawInput.codigo?.trim() || (await previewNextCodigo(yearOf(rawInput.data_inicio)));
  const id = uuidv4();
  const now = nowIsoTimestamp();
  const db = await getDb();

  try {
    await db.execute(
      `INSERT INTO contratos (${CONTRATO_COLUMNS})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        id,
        codigo,
        rawInput.nome.trim(),
        rawInput.cliente_id,
        rawInput.processo_id,
        rawInput.area_direito_id,
        rawInput.tipo_contrato_id,
        rawInput.valor_base,
        rawInput.data_inicio,
        rawInput.data_encerramento,
        rawInput.status ?? "ativo",
        rawInput.link_documentos,
        rawInput.observacoes,
        now,
        now,
      ],
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ConflictError(`Já existe um contrato com o código "${codigo}".`);
    }
    if (isCheckViolation(e)) {
      throw new ValidationError("Os campos do contrato não respeitam as restrições do banco.");
    }
    throw e;
  }

  const created = await contratosGet(id);
  if (!created) throw new Error("Falha ao recuperar contrato recém-criado.");
  return created;
}

export async function contratosUpdate(id: string, rawInput: ContratoInput): Promise<Contrato> {
  validate(rawInput);
  if (!rawInput.codigo || !rawInput.codigo.trim()) {
    throw new ValidationError("Código é obrigatório ao editar.", "codigo");
  }
  if (rawInput.processo_id) {
    await assertProcessoBelongsToCliente(rawInput.processo_id, rawInput.cliente_id);
  }

  const codigo = rawInput.codigo.trim();
  const now = nowIsoTimestamp();
  const db = await getDb();

  try {
    const result = await db.execute(
      `UPDATE contratos SET
         codigo = $1, nome = $2, cliente_id = $3, processo_id = $4,
         area_direito_id = $5, tipo_contrato_id = $6, valor_base = $7,
         data_inicio = $8, data_encerramento = $9, status = $10,
         link_documentos = $11, observacoes = $12, atualizado_em = $13
       WHERE id = $14`,
      [
        codigo,
        rawInput.nome.trim(),
        rawInput.cliente_id,
        rawInput.processo_id,
        rawInput.area_direito_id,
        rawInput.tipo_contrato_id,
        rawInput.valor_base,
        rawInput.data_inicio,
        rawInput.data_encerramento,
        rawInput.status,
        rawInput.link_documentos,
        rawInput.observacoes,
        now,
        id,
      ],
    );
    if (result.rowsAffected === 0) {
      throw new ValidationError("Contrato não encontrado.");
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ConflictError(`Já existe outro contrato com o código "${codigo}".`);
    }
    if (isCheckViolation(e)) {
      throw new ValidationError("Os campos do contrato não respeitam as restrições do banco.");
    }
    throw e;
  }

  const updated = await contratosGet(id);
  if (!updated) throw new Error("Contrato não encontrado após atualização.");
  return updated;
}

export async function contratosDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM contratos WHERE id = $1`, [id]);
}

export async function contratosGet(id: string): Promise<Contrato | null> {
  const db = await getDb();
  const rows = await db.select<Contrato[]>(
    `SELECT ${CONTRATO_COLUMNS} FROM contratos WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function contratosList(filters: ContratoListFilters = {}): Promise<ContratoListRow[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.cliente_id) {
    params.push(filters.cliente_id);
    where.push(`c.cliente_id = $${params.length}`);
  }
  if (filters.status && filters.status !== "all") {
    params.push(filters.status);
    where.push(`c.status = $${params.length}`);
  }
  if (filters.area_direito_id) {
    params.push(filters.area_direito_id);
    where.push(`c.area_direito_id = $${params.length}`);
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    params.push(term);
    const p = `$${params.length}`;
    where.push(
      `(c.codigo LIKE ${p} COLLATE NOCASE OR c.nome LIKE ${p} COLLATE NOCASE OR cli.nome LIKE ${p} COLLATE NOCASE)`,
    );
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return db.select<ContratoListRow[]>(
    `SELECT
       c.id, c.codigo, c.nome, c.cliente_id, c.processo_id,
       c.area_direito_id, c.tipo_contrato_id, c.valor_base,
       c.data_inicio, c.data_encerramento, c.status,
       c.link_documentos, c.observacoes, c.criado_em, c.atualizado_em,
       cli.nome AS cliente_nome,
       ad.nome  AS area_nome,
       tc.nome  AS tipo_nome
     FROM contratos c
     JOIN clientes        cli ON cli.id = c.cliente_id
     JOIN areas_direito   ad  ON ad.id  = c.area_direito_id
     JOIN tipos_contrato  tc  ON tc.id  = c.tipo_contrato_id
     ${whereSql}
     ORDER BY c.atualizado_em DESC`,
    params,
  );
}

export async function contratosListByCliente(cliente_id: string): Promise<Contrato[]> {
  const db = await getDb();
  return db.select<Contrato[]>(
    `SELECT ${CONTRATO_COLUMNS} FROM contratos WHERE cliente_id = $1
     ORDER BY atualizado_em DESC`,
    [cliente_id],
  );
}

export async function contratosListByProcesso(processo_id: string): Promise<Contrato[]> {
  const db = await getDb();
  return db.select<Contrato[]>(
    `SELECT ${CONTRATO_COLUMNS} FROM contratos WHERE processo_id = $1
     ORDER BY atualizado_em DESC`,
    [processo_id],
  );
}

/**
 * Aggregates faturado / recebido / em aberto from `lancamentos` + `parcelas`
 * for a contrato. Only `natureza = 'entrada'` lancamentos count; `cancelado`
 * ones are excluded. Avista entries contribute their `valor`; parcelado entries
 * contribute per-parcela. Overdue pendente amounts count as "em aberto".
 */
export async function contratosResumoFinanceiro(
  contrato_id: string,
): Promise<ContratoResumoFinanceiro> {
  const db = await getDb();
  const exists = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='lancamentos'`,
  );
  if (exists.length === 0) {
    return { total_faturado_cents: 0, total_recebido_cents: 0, total_em_aberto_cents: 0 };
  }

  // Avista entradas (not cancelled).
  const avista = await db.select<
    { faturado: number; recebido: number; em_aberto: number }[]
  >(
    `SELECT
       COALESCE(SUM(valor), 0) AS faturado,
       COALESCE(SUM(CASE WHEN status_pagamento = 'pago' THEN valor ELSE 0 END), 0) AS recebido,
       COALESCE(SUM(CASE WHEN status_pagamento IN ('pendente', 'inadimplente') THEN valor ELSE 0 END), 0) AS em_aberto
     FROM lancamentos
     WHERE contrato_id = $1 AND natureza = 'entrada'
       AND forma_pagamento = 'avista' AND status_pagamento != 'cancelado'`,
    [contrato_id],
  );

  // Parcelado entradas (not cancelled) — aggregate at the parcela level.
  const parcelado = await db.select<
    { faturado: number; recebido: number; em_aberto: number }[]
  >(
    `SELECT
       COALESCE(SUM(p.valor), 0) AS faturado,
       COALESCE(SUM(CASE WHEN p.status = 'pago' THEN p.valor ELSE 0 END), 0) AS recebido,
       COALESCE(SUM(CASE WHEN p.status IN ('pendente', 'inadimplente') THEN p.valor ELSE 0 END), 0) AS em_aberto
     FROM parcelas p
     JOIN lancamentos l ON l.id = p.lancamento_id
     WHERE l.contrato_id = $1 AND l.natureza = 'entrada'
       AND l.forma_pagamento = 'parcelado' AND l.status_pagamento != 'cancelado'`,
    [contrato_id],
  );

  const a = avista[0] ?? { faturado: 0, recebido: 0, em_aberto: 0 };
  const p = parcelado[0] ?? { faturado: 0, recebido: 0, em_aberto: 0 };
  return {
    total_faturado_cents: a.faturado + p.faturado,
    total_recebido_cents: a.recebido + p.recebido,
    total_em_aberto_cents: a.em_aberto + p.em_aberto,
  };
}
