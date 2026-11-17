import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../lib/db";
import { addMonthsClamped, nowIsoTimestamp, todayIso } from "../../lib/format/dates";
import { ValidationError } from "../../lib/errors";
import type {
  Lancamento,
  LancamentoComParcelas,
  LancamentoInput,
  LancamentoListFilters,
  LancamentoListRow,
  Parcela,
  StatusPagamento,
  TipoLancamento,
} from "./types";

const TIPOS_ENTRADA: TipoLancamento[] = [
  "mensalidade",
  "pagamento_unico",
  "sucumbencia",
  "acordo",
  "reembolso_custas",
];
const TIPOS_SAIDA: TipoLancamento[] = [
  "despesa_escritorio",
  "custas_processuais",
  "reembolso_cliente",
];

const LANC_COLUMNS = `
  id, descricao, natureza, cliente_id, contrato_id, processo_id, tipo,
  centro_custo_id, garantido, forma_pagamento, num_parcelas, valor,
  data_prevista, data_pagamento, status_pagamento, numero_documento,
  observacoes, criado_em, atualizado_em
`;

/**
 * SQL fragment computing the effective status of a lancamento row aliased `l`.
 * Resolves parcelado parents from their parcelas and converts overdue pendentes
 * into 'inadimplente'.
 */
const STATUS_EFETIVO_SQL = `
  CASE
    WHEN l.status_pagamento IN ('pago', 'cancelado', 'parcialmente_pago') THEN l.status_pagamento
    WHEN l.forma_pagamento = 'avista' THEN
      CASE WHEN l.status_pagamento = 'pendente'
                AND date(l.data_prevista) < date('now', 'localtime')
           THEN 'inadimplente' ELSE l.status_pagamento END
    ELSE (
      SELECT CASE
        WHEN COUNT(*) = 0 THEN 'pendente'
        WHEN COUNT(*) = SUM(CASE WHEN p.status = 'pago' THEN 1 ELSE 0 END) THEN 'pago'
        WHEN SUM(CASE WHEN p.status = 'pago' THEN 1 ELSE 0 END) > 0 THEN 'parcialmente_pago'
        WHEN SUM(CASE WHEN p.status = 'inadimplente'
              OR (p.status = 'pendente' AND date(p.data_prevista) < date('now', 'localtime'))
              THEN 1 ELSE 0 END) > 0 THEN 'inadimplente'
        ELSE 'pendente'
      END
      FROM parcelas p WHERE p.lancamento_id = l.id
    )
  END
`;

const VALOR_TOTAL_SQL = `
  CASE WHEN l.forma_pagamento = 'avista' THEN l.valor
       ELSE COALESCE((SELECT SUM(valor) FROM parcelas p WHERE p.lancamento_id = l.id), 0)
  END
`;

/** Quanto já foi efetivamente pago: à vista conta só se pago; parcelado soma as parcelas pagas. */
const VALOR_RECEBIDO_SQL = `
  CASE WHEN l.status_pagamento = 'cancelado' THEN 0
       WHEN l.forma_pagamento = 'avista' THEN CASE WHEN l.status_pagamento = 'pago' THEN l.valor ELSE 0 END
       ELSE COALESCE((SELECT SUM(valor) FROM parcelas p WHERE p.lancamento_id = l.id AND p.status = 'pago'), 0)
  END
`;

// ──────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────

function tipoAllowed(natureza: string, tipo: string): boolean {
  return natureza === "entrada"
    ? TIPOS_ENTRADA.includes(tipo as TipoLancamento)
    : TIPOS_SAIDA.includes(tipo as TipoLancamento);
}

function validate(input: LancamentoInput): void {
  if (!input.cliente_id) {
    throw new ValidationError("Cliente é obrigatório.", "cliente_id");
  }
  if (input.natureza !== "entrada" && input.natureza !== "saida") {
    throw new ValidationError("Natureza inválida.", "natureza");
  }
  if (!tipoAllowed(input.natureza, input.tipo)) {
    throw new ValidationError("Tipo incompatível com a natureza selecionada.", "tipo");
  }
  if (input.natureza === "saida" && !input.centro_custo_id) {
    throw new ValidationError("Centro de custo é obrigatório para saídas.", "centro_custo_id");
  }
  if (input.natureza === "entrada" && input.centro_custo_id) {
    throw new ValidationError("Entradas não usam centro de custo.", "centro_custo_id");
  }
  if (!Number.isInteger(input.valor) || input.valor <= 0) {
    throw new ValidationError("Informe um valor maior que zero.", "valor");
  }
  if (input.forma_pagamento === "parcelado") {
    if (!input.num_parcelas || input.num_parcelas < 2) {
      throw new ValidationError("Parcelado exige no mínimo 2 parcelas.", "num_parcelas");
    }
    if (!input.data_primeira_parcela) {
      throw new ValidationError("Informe a data da primeira parcela.", "data_primeira_parcela");
    }
  } else if (input.forma_pagamento === "avista") {
    if (input.num_parcelas != null) {
      throw new ValidationError("Lançamentos à vista não têm número de parcelas.", "num_parcelas");
    }
    if (!input.data_prevista) {
      throw new ValidationError("Informe a data prevista.", "data_prevista");
    }
    if (input.status_pagamento === "parcialmente_pago") {
      throw new ValidationError(
        "O status 'parcialmente pago' aplica-se apenas a lançamentos parcelados.",
        "status_pagamento",
      );
    }
  } else {
    throw new ValidationError("Forma de pagamento inválida.", "forma_pagamento");
  }
}

/**
 * Forces garantido = false for sucumbencia and acordo (inherently uncertain).
 * Entradas and saídas otherwise carry the user-set flag — a saída incerta is a
 * planned expense that may or may not happen.
 */
function resolveGarantido(input: LancamentoInput): boolean {
  if (input.tipo === "sucumbencia" || input.tipo === "acordo") return false;
  return input.garantido;
}

// ──────────────────────────────────────────────────────────────────────
// Parcela generation & status derivation
// ──────────────────────────────────────────────────────────────────────

async function generateParcelas(
  lancamentoId: string,
  valor: number,
  numParcelas: number,
  dataPrimeira: string,
): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < numParcelas; i++) {
    await db.execute(
      `INSERT INTO parcelas (id, lancamento_id, numero, valor, data_prevista, data_pagamento, status, observacoes)
       VALUES ($1,$2,$3,$4,$5,NULL,'pendente',NULL)`,
      [uuidv4(), lancamentoId, i + 1, valor, addMonthsClamped(dataPrimeira, i)],
    );
  }
}

/**
 * Recomputes a parcelado lancamento's status_pagamento from its parcelas
 * (treating overdue pendentes as inadimplente). 'cancelado' is sticky.
 */
async function recomputeParceladoStatus(lancamentoId: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE lancamentos SET status_pagamento = (
       SELECT CASE
         WHEN COUNT(*) = 0 THEN 'pendente'
         WHEN COUNT(*) = SUM(CASE WHEN p.status = 'pago' THEN 1 ELSE 0 END) THEN 'pago'
         WHEN SUM(CASE WHEN p.status = 'pago' THEN 1 ELSE 0 END) > 0 THEN 'parcialmente_pago'
         WHEN SUM(CASE WHEN p.status = 'inadimplente'
               OR (p.status = 'pendente' AND date(p.data_prevista) < date('now', 'localtime'))
               THEN 1 ELSE 0 END) > 0 THEN 'inadimplente'
         ELSE 'pendente'
       END
       FROM parcelas p WHERE p.lancamento_id = lancamentos.id
     )
     WHERE id = $1 AND forma_pagamento = 'parcelado' AND status_pagamento != 'cancelado'`,
    [lancamentoId],
  );
}

// ──────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────

export async function lancamentosCreate(input: LancamentoInput): Promise<Lancamento> {
  validate(input);

  const id = uuidv4();
  const now = nowIsoTimestamp();
  const db = await getDb();
  const garantido = resolveGarantido(input);
  const isParcelado = input.forma_pagamento === "parcelado";

  // Avista: keep the user's status (default any 'pago' to today's date).
  // Parcelado: always starts pendente; status is derived from parcelas.
  let statusPagamento: StatusPagamento = isParcelado ? "pendente" : input.status_pagamento;
  let dataPagamento = isParcelado ? null : input.data_pagamento;
  if (!isParcelado && statusPagamento === "pago" && !dataPagamento) {
    dataPagamento = todayIso();
  }

  await db.execute(
    `INSERT INTO lancamentos (${LANC_COLUMNS})
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      id,
      input.descricao,
      input.natureza,
      input.cliente_id,
      input.contrato_id,
      input.processo_id,
      input.tipo,
      input.natureza === "saida" ? input.centro_custo_id : null,
      garantido ? 1 : 0,
      input.forma_pagamento,
      isParcelado ? input.num_parcelas : null,
      input.valor,
      isParcelado ? null : input.data_prevista,
      dataPagamento,
      statusPagamento,
      input.numero_documento,
      input.observacoes,
      now,
      now,
    ],
  );

  if (isParcelado) {
    await generateParcelas(id, input.valor, input.num_parcelas!, input.data_primeira_parcela!);
    await recomputeParceladoStatus(id);
  }

  const created = await lancamentosGet(id);
  if (!created) throw new Error("Falha ao recuperar lançamento recém-criado.");
  return created;
}

export async function lancamentosUpdate(id: string, input: LancamentoInput): Promise<Lancamento> {
  validate(input);

  const db = await getDb();
  const existing = await lancamentosGet(id);
  if (!existing) throw new ValidationError("Lançamento não encontrado.");

  const garantido = resolveGarantido(input);
  const isParcelado = input.forma_pagamento === "parcelado";
  const wasParcelado = existing.forma_pagamento === "parcelado";

  // Determine whether the parcelado structure is locked (a parcela already paid).
  const paidParcelas = wasParcelado
    ? await db.select<{ count: number }[]>(
        `SELECT COUNT(*) as count FROM parcelas WHERE lancamento_id = $1 AND status = 'pago'`,
        [id],
      )
    : [{ count: 0 }];
  const hasPaidParcela = (paidParcelas[0]?.count ?? 0) > 0;

  // The date of parcela #1 reconstructs the original data_primeira_parcela.
  const firstParcela = wasParcelado
    ? await db.select<{ data_prevista: string }[]>(
        `SELECT data_prevista FROM parcelas WHERE lancamento_id = $1 AND numero = 1`,
        [id],
      )
    : [];
  const existingPrimeira = firstParcela[0]?.data_prevista ?? null;

  const structuralChange =
    input.forma_pagamento !== existing.forma_pagamento ||
    (input.num_parcelas ?? null) !== (existing.num_parcelas ?? null) ||
    input.valor !== existing.valor ||
    (isParcelado && input.data_primeira_parcela !== existingPrimeira);

  if (wasParcelado && hasPaidParcela && structuralChange) {
    throw new ValidationError(
      "Este lançamento parcelado já possui parcelas pagas. Não é possível alterar valor, " +
        "número de parcelas, forma de pagamento ou a data da primeira parcela.",
    );
  }

  const now = nowIsoTimestamp();

  // Status: parcelado is derived; avista keeps the user's choice.
  // When a parcelado has paid parcelas its parent is recomputed below.
  let statusPagamento: StatusPagamento;
  let dataPagamento: string | null;
  if (isParcelado) {
    statusPagamento = existing.status_pagamento === "cancelado" ? "cancelado" : "pendente";
    dataPagamento = null;
  } else {
    statusPagamento = input.status_pagamento;
    dataPagamento = input.data_pagamento;
    if (statusPagamento === "pago" && !dataPagamento) dataPagamento = todayIso();
  }

  await db.execute(
    `UPDATE lancamentos SET
       descricao = $1, natureza = $2, cliente_id = $3, contrato_id = $4, processo_id = $5,
       tipo = $6, centro_custo_id = $7, garantido = $8, forma_pagamento = $9,
       num_parcelas = $10, valor = $11, data_prevista = $12, data_pagamento = $13,
       status_pagamento = $14, numero_documento = $15, observacoes = $16, atualizado_em = $17
     WHERE id = $18`,
    [
      input.descricao,
      input.natureza,
      input.cliente_id,
      input.contrato_id,
      input.processo_id,
      input.tipo,
      input.natureza === "saida" ? input.centro_custo_id : null,
      garantido ? 1 : 0,
      input.forma_pagamento,
      isParcelado ? input.num_parcelas : null,
      input.valor,
      isParcelado ? null : input.data_prevista,
      dataPagamento,
      statusPagamento,
      input.numero_documento,
      input.observacoes,
      now,
      id,
    ],
  );

  // Reconcile parcelas.
  if (!isParcelado) {
    // Avista now — drop any leftover parcelas.
    await db.execute(`DELETE FROM parcelas WHERE lancamento_id = $1`, [id]);
  } else if (!hasPaidParcela || !wasParcelado) {
    // Safe to (re)generate: nothing has been paid.
    await db.execute(`DELETE FROM parcelas WHERE lancamento_id = $1`, [id]);
    await generateParcelas(id, input.valor, input.num_parcelas!, input.data_primeira_parcela!);
    await recomputeParceladoStatus(id);
  } else {
    // Locked structure — parcelas untouched, just refresh the derived status.
    await recomputeParceladoStatus(id);
  }

  const updated = await lancamentosGet(id);
  if (!updated) throw new Error("Lançamento não encontrado após atualização.");
  return updated;
}

export async function lancamentosDelete(id: string): Promise<void> {
  const db = await getDb();
  // parcelas cascade via the ON DELETE CASCADE foreign key.
  await db.execute(`DELETE FROM lancamentos WHERE id = $1`, [id]);
}

export async function lancamentosGet(id: string): Promise<LancamentoComParcelas | null> {
  const db = await getDb();
  const rows = await db.select<Lancamento[]>(
    `SELECT ${LANC_COLUMNS} FROM lancamentos WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) return null;
  const parcelas = await parcelasList(id);
  return { ...rows[0], parcelas };
}

export async function parcelasList(lancamentoId: string): Promise<Parcela[]> {
  const db = await getDb();
  return db.select<Parcela[]>(
    `SELECT id, lancamento_id, numero, valor, data_prevista, data_pagamento, status, observacoes
       FROM parcelas WHERE lancamento_id = $1 ORDER BY numero ASC`,
    [lancamentoId],
  );
}

export async function lancamentosList(
  filters: LancamentoListFilters = {},
): Promise<LancamentoListRow[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  const push = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };

  if (filters.cliente_id) push("l.cliente_id = ?", filters.cliente_id);
  if (filters.contrato_id) push("l.contrato_id = ?", filters.contrato_id);
  if (filters.processo_id) push("l.processo_id = ?", filters.processo_id);
  if (filters.natureza && filters.natureza !== "all") push("l.natureza = ?", filters.natureza);
  if (filters.tipo && filters.tipo !== "all") push("l.tipo = ?", filters.tipo);
  if (filters.centro_custo_id) push("l.centro_custo_id = ?", filters.centro_custo_id);
  if (filters.garantido != null) push("l.garantido = ?", filters.garantido ? 1 : 0);
  if (filters.data_de) push("(l.data_prevista IS NULL OR date(l.data_prevista) >= date(?))", filters.data_de);
  if (filters.data_ate) push("(l.data_prevista IS NULL OR date(l.data_prevista) <= date(?))", filters.data_ate);
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    params.push(term);
    const p = `$${params.length}`;
    where.push(`(l.descricao LIKE ${p} COLLATE NOCASE OR l.numero_documento LIKE ${p} COLLATE NOCASE)`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const inner = `
    SELECT
      l.id, l.descricao, l.natureza, l.cliente_id, l.contrato_id, l.processo_id, l.tipo,
      l.centro_custo_id, l.garantido, l.forma_pagamento, l.num_parcelas, l.valor,
      l.data_prevista, l.data_pagamento, l.status_pagamento, l.numero_documento,
      l.observacoes, l.criado_em, l.atualizado_em,
      c.nome AS cliente_nome,
      ct.codigo AS contrato_codigo,
      (${STATUS_EFETIVO_SQL}) AS status_efetivo,
      (${VALOR_TOTAL_SQL}) AS valor_total,
      (${VALOR_RECEBIDO_SQL}) AS valor_recebido
    FROM lancamentos l
    JOIN clientes c ON c.id = l.cliente_id
    LEFT JOIN contratos ct ON ct.id = l.contrato_id
    ${whereSql}
  `;

  // Always wrap the inner query: it joins three tables that each carry a
  // `criado_em` column, so ordering on the raw join is ambiguous. Wrapping in
  // a subquery exposes a single `criado_em` and also lets the status filter
  // apply to the computed `status_efetivo`.
  const outerParams = [...params];
  let outerWhere = "";
  if (filters.status_pagamento && filters.status_pagamento !== "all") {
    outerParams.push(filters.status_pagamento);
    outerWhere = ` WHERE status_efetivo = $${outerParams.length}`;
  }
  const sql = `SELECT * FROM (${inner})${outerWhere} ORDER BY criado_em DESC`;

  return db.select<LancamentoListRow[]>(sql, outerParams);
}

// ──────────────────────────────────────────────────────────────────────
// Payment actions
// ──────────────────────────────────────────────────────────────────────

export async function parcelasMarcarPago(
  parcelaId: string,
  dataPagamento: string,
): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ lancamento_id: string }[]>(
    `SELECT lancamento_id FROM parcelas WHERE id = $1`,
    [parcelaId],
  );
  if (rows.length === 0) throw new ValidationError("Parcela não encontrada.");
  await db.execute(
    `UPDATE parcelas SET status = 'pago', data_pagamento = $1 WHERE id = $2`,
    [dataPagamento, parcelaId],
  );
  await recomputeParceladoStatus(rows[0].lancamento_id);
}

export async function parcelasDesmarcarPago(parcelaId: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ lancamento_id: string }[]>(
    `SELECT lancamento_id FROM parcelas WHERE id = $1`,
    [parcelaId],
  );
  if (rows.length === 0) throw new ValidationError("Parcela não encontrada.");
  await db.execute(
    `UPDATE parcelas SET status = 'pendente', data_pagamento = NULL WHERE id = $1`,
    [parcelaId],
  );
  await recomputeParceladoStatus(rows[0].lancamento_id);
}

export async function lancamentosMarcarPagoAvista(
  id: string,
  dataPagamento: string,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE lancamentos SET status_pagamento = 'pago', data_pagamento = $1, atualizado_em = $2
       WHERE id = $3 AND forma_pagamento = 'avista'`,
    [dataPagamento, nowIsoTimestamp(), id],
  );
}

export async function lancamentosCancelar(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE lancamentos SET status_pagamento = 'cancelado', atualizado_em = $1 WHERE id = $2`,
    [nowIsoTimestamp(), id],
  );
}

export async function lancamentosReativar(id: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ forma_pagamento: string }[]>(
    `SELECT forma_pagamento FROM lancamentos WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) throw new ValidationError("Lançamento não encontrado.");
  await db.execute(
    `UPDATE lancamentos SET status_pagamento = 'pendente', atualizado_em = $1 WHERE id = $2`,
    [nowIsoTimestamp(), id],
  );
  if (rows[0].forma_pagamento === "parcelado") {
    await recomputeParceladoStatus(id);
  }
}

/**
 * Persists inadimplência: flips overdue pendente parcelas and avista lancamentos
 * to 'inadimplente', then refreshes parcelado parents. Safe to run on app start.
 */
export async function lancamentosRecomputeInadimplencia(): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE parcelas SET status = 'inadimplente'
       WHERE status = 'pendente' AND date(data_prevista) < date('now', 'localtime')`,
  );
  await db.execute(
    `UPDATE lancamentos SET status_pagamento = 'inadimplente'
       WHERE forma_pagamento = 'avista' AND status_pagamento = 'pendente'
         AND date(data_prevista) < date('now', 'localtime')`,
  );
  await db.execute(
    `UPDATE lancamentos SET status_pagamento = (
       SELECT CASE
         WHEN COUNT(*) = 0 THEN 'pendente'
         WHEN COUNT(*) = SUM(CASE WHEN p.status = 'pago' THEN 1 ELSE 0 END) THEN 'pago'
         WHEN SUM(CASE WHEN p.status = 'pago' THEN 1 ELSE 0 END) > 0 THEN 'parcialmente_pago'
         WHEN SUM(CASE WHEN p.status = 'inadimplente' THEN 1 ELSE 0 END) > 0 THEN 'inadimplente'
         ELSE 'pendente'
       END
       FROM parcelas p WHERE p.lancamento_id = lancamentos.id
     )
     WHERE forma_pagamento = 'parcelado' AND status_pagamento != 'cancelado'`,
  );
}
