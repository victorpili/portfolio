import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../lib/db";
import { onlyDigits } from "../../lib/format/documents";
import { nowIsoTimestamp } from "../../lib/format/dates";
import { ConflictError, DeleteBlockedError, ValidationError } from "../../lib/errors";
import type {
  Cliente,
  ClienteInput,
  ClienteListFilters,
  ClienteListRow,
  ContatoPJ,
  ContatoPJInput,
  InscricaoEstadual,
  InscricaoEstadualDraft,
  StatusFinanceiro,
} from "./types";

const CLIENTE_COLUMNS = `
  id, tipo, nome, cpf, rg, data_nascimento, cnpj, data_fundacao,
  email, telefone, cep, logradouro, numero, complemento, bairro,
  cidade, estado, origem_id, status_relacionamento, observacoes,
  tipo_unidade, matriz_id, criado_em, atualizado_em
`;

function normalizeInput(input: ClienteInput): ClienteInput {
  // Strip punctuation from all digit-only fields up front. Pure function.
  const cpf = input.cpf ? onlyDigits(input.cpf) : null;
  const cnpj = input.cnpj ? onlyDigits(input.cnpj) : null;
  const cep = input.cep ? onlyDigits(input.cep) : null;
  const telefone = input.telefone ? onlyDigits(input.telefone) : null;
  return { ...input, cpf, cnpj, cep, telefone };
}

function validateClienteInput(input: ClienteInput): void {
  if (!input.nome || !input.nome.trim()) {
    throw new ValidationError("Nome é obrigatório.", "nome");
  }
  if (input.tipo !== "pf" && input.tipo !== "pj") {
    throw new ValidationError("Tipo de cliente inválido.", "tipo");
  }

  if (input.tipo === "pf") {
    if (input.cnpj || input.data_fundacao) {
      throw new ValidationError("Cliente PF não pode ter CNPJ ou data de fundação.", "cnpj");
    }
    if (input.cpf && input.cpf.length !== 11) {
      throw new ValidationError("CPF deve conter 11 dígitos.", "cpf");
    }
    if (input.tipo_unidade != null || input.matriz_id != null) {
      throw new ValidationError("Matriz/filial aplica-se apenas a Pessoa Jurídica.", "tipo_unidade");
    }
  } else {
    if (input.cpf || input.rg || input.data_nascimento) {
      throw new ValidationError("Cliente PJ não pode ter CPF, RG ou data de nascimento.", "cpf");
    }
    if (input.cnpj && input.cnpj.length !== 14) {
      throw new ValidationError("CNPJ deve conter 14 dígitos.", "cnpj");
    }
    if (input.tipo_unidade !== "matriz" && input.tipo_unidade !== "filial") {
      throw new ValidationError("Indique se a empresa é matriz ou filial.", "tipo_unidade");
    }
    if (input.tipo_unidade === "matriz" && input.matriz_id != null) {
      throw new ValidationError("Uma matriz não possui matriz vinculada.", "matriz_id");
    }
  }
}

/**
 * Validates the matriz/filial relationship with DB lookups.
 * `selfId` is the cliente's own id on update (null on create).
 */
async function assertMatrizRelationship(input: ClienteInput, selfId: string | null): Promise<void> {
  if (input.tipo !== "pj" || input.tipo_unidade !== "filial") return;

  if (!input.matriz_id) {
    throw new ValidationError("Selecione a matriz desta filial.", "matriz_id");
  }
  if (selfId && input.matriz_id === selfId) {
    throw new ValidationError("Um cliente não pode ser matriz de si mesmo.", "matriz_id");
  }

  const db = await getDb();
  const matriz = await db.select<{ tipo: string; tipo_unidade: string | null }[]>(
    `SELECT tipo, tipo_unidade FROM clientes WHERE id = $1`,
    [input.matriz_id],
  );
  if (matriz.length === 0) {
    throw new ValidationError("A matriz selecionada não existe.", "matriz_id");
  }
  if (matriz[0].tipo !== "pj") {
    throw new ValidationError("A matriz precisa ser um cliente Pessoa Jurídica.", "matriz_id");
  }
  if (matriz[0].tipo_unidade === "filial") {
    throw new ValidationError("A matriz selecionada é uma filial. Escolha uma matriz.", "matriz_id");
  }

  // Block converting an existing matriz that still has filiais into a filial.
  if (selfId) {
    const filiais = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM clientes WHERE matriz_id = $1`,
      [selfId],
    );
    if ((filiais[0]?.count ?? 0) > 0) {
      throw new ValidationError(
        "Este cliente é matriz de outras filiais. Reatribua ou converta as filiais antes de torná-lo uma filial.",
        "tipo_unidade",
      );
    }
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

export async function clientesCreate(rawInput: ClienteInput): Promise<Cliente> {
  const input = normalizeInput(rawInput);
  validateClienteInput(input);
  await assertMatrizRelationship(input, null);

  const id = uuidv4();
  const now = nowIsoTimestamp();
  const db = await getDb();

  try {
    await db.execute(
      `INSERT INTO clientes (${CLIENTE_COLUMNS})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
      [
        id,
        input.tipo,
        input.nome.trim(),
        input.cpf,
        input.rg,
        input.data_nascimento,
        input.cnpj,
        input.data_fundacao,
        input.email,
        input.telefone,
        input.cep,
        input.logradouro,
        input.numero,
        input.complemento,
        input.bairro,
        input.cidade,
        input.estado,
        input.origem_id,
        input.status_relacionamento ?? "ativo",
        input.observacoes,
        input.tipo === "pj" ? input.tipo_unidade : null,
        input.tipo === "pj" && input.tipo_unidade === "filial" ? input.matriz_id : null,
        now,
        now,
      ],
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ConflictError(
        input.tipo === "pf"
          ? "Já existe um cliente PF com este CPF."
          : "Já existe um cliente PJ com este CNPJ.",
      );
    }
    if (isCheckViolation(e)) {
      throw new ValidationError("Os campos do cadastro não respeitam as restrições do tipo escolhido.");
    }
    throw e;
  }

  const created = await clientesGet(id);
  if (!created) throw new Error("Falha ao recuperar cliente recém-criado.");
  return created;
}

export async function clientesUpdate(id: string, rawInput: ClienteInput): Promise<Cliente> {
  const input = normalizeInput(rawInput);
  validateClienteInput(input);
  await assertMatrizRelationship(input, id);

  const now = nowIsoTimestamp();
  const db = await getDb();

  try {
    const result = await db.execute(
      `UPDATE clientes SET
         tipo = $1, nome = $2, cpf = $3, rg = $4, data_nascimento = $5,
         cnpj = $6, data_fundacao = $7, email = $8, telefone = $9,
         cep = $10, logradouro = $11, numero = $12, complemento = $13,
         bairro = $14, cidade = $15, estado = $16, origem_id = $17,
         status_relacionamento = $18, observacoes = $19,
         tipo_unidade = $20, matriz_id = $21, atualizado_em = $22
       WHERE id = $23`,
      [
        input.tipo,
        input.nome.trim(),
        input.cpf,
        input.rg,
        input.data_nascimento,
        input.cnpj,
        input.data_fundacao,
        input.email,
        input.telefone,
        input.cep,
        input.logradouro,
        input.numero,
        input.complemento,
        input.bairro,
        input.cidade,
        input.estado,
        input.origem_id,
        input.status_relacionamento,
        input.observacoes,
        input.tipo === "pj" ? input.tipo_unidade : null,
        input.tipo === "pj" && input.tipo_unidade === "filial" ? input.matriz_id : null,
        now,
        id,
      ],
    );
    if (result.rowsAffected === 0) {
      throw new ValidationError("Cliente não encontrado.");
    }
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new ConflictError(
        input.tipo === "pf"
          ? "Já existe outro cliente PF com este CPF."
          : "Já existe outro cliente PJ com este CNPJ.",
      );
    }
    if (isCheckViolation(e)) {
      throw new ValidationError("Os campos do cadastro não respeitam as restrições do tipo escolhido.");
    }
    throw e;
  }

  const updated = await clientesGet(id);
  if (!updated) throw new Error("Cliente não encontrado após atualização.");
  return updated;
}

export async function clientesDelete(id: string): Promise<void> {
  const db = await getDb();

  // Existence checks for downstream tables — modules may not be installed yet.
  const tables = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table'
       AND name IN ('contratos', 'processos')`,
  );
  const hasContratos = tables.some((t) => t.name === "contratos");
  const hasProcessos = tables.some((t) => t.name === "processos");

  // 1. Block if any ATIVO contrato references this cliente.
  if (hasContratos) {
    const activos = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM contratos WHERE cliente_id = $1 AND status = 'ativo'`,
      [id],
    );
    const count = activos[0]?.count ?? 0;
    if (count > 0) {
      throw new DeleteBlockedError(
        `Cliente possui ${count} contrato(s) ativo(s). Inative-os antes de excluir.`,
        [{ table: "contratos", count }],
      );
    }
  }

  // 2. Block if any EM_ANDAMENTO processo references this cliente.
  if (hasProcessos) {
    const ativos = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM processos WHERE cliente_id = $1 AND status = 'em_andamento'`,
      [id],
    );
    const count = ativos[0]?.count ?? 0;
    if (count > 0) {
      throw new DeleteBlockedError(
        `Cliente possui ${count} processo(s) em andamento. Encerre ou suspenda-os antes de excluir.`,
        [{ table: "processos", count }],
      );
    }
  }

  // 3. Block if this cliente is a matriz with filiais. The matriz_id FK has no
  //    ON DELETE action, so deleting the matriz row would fail anyway — surface
  //    a clear message instead.
  const filiais = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM clientes WHERE matriz_id = $1`,
    [id],
  );
  const filialCount = filiais[0]?.count ?? 0;
  if (filialCount > 0) {
    throw new DeleteBlockedError(
      `Cliente é matriz de ${filialCount} filial(is). Reatribua ou exclua as filiais antes.`,
      [{ table: "clientes", count: filialCount }],
    );
  }

  // 4. Cascade delete.
  //    IMPORTANT: tauri-plugin-sql runs every `db.execute()` on a connection
  //    drawn from a pool, so a manual BEGIN/COMMIT spanning several execute()
  //    calls would leave an open transaction dangling on a pooled connection
  //    and lock the database. We therefore issue the deletes as independent
  //    statements (each auto-committed by SQLite).
  //
  //    Order matters: contratos first (they FK both cliente and processo),
  //    then processos, then cliente — which cascades into contatos_pj via the
  //    existing ON DELETE CASCADE foreign key. The validation gates above
  //    guarantee, in the current schema, that none of these deletes can fail
  //    on a foreign-key constraint.
  if (hasContratos) {
    await db.execute(`DELETE FROM contratos WHERE cliente_id = $1`, [id]);
  }
  if (hasProcessos) {
    await db.execute(`DELETE FROM processos WHERE cliente_id = $1`, [id]);
  }
  await db.execute(`DELETE FROM clientes WHERE id = $1`, [id]);
}

export async function clientesGet(id: string): Promise<Cliente | null> {
  const db = await getDb();
  const rows = await db.select<Cliente[]>(
    `SELECT ${CLIENTE_COLUMNS} FROM clientes WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function clientesList(filters: ClienteListFilters = {}): Promise<ClienteListRow[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.tipo && filters.tipo !== "all") {
    params.push(filters.tipo);
    where.push(`tipo = $${params.length}`);
  }
  if (filters.status_relacionamento && filters.status_relacionamento !== "all") {
    params.push(filters.status_relacionamento);
    where.push(`status_relacionamento = $${params.length}`);
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    const termDigits = onlyDigits(filters.search);
    params.push(term);
    const nameParam = `$${params.length}`;
    let clause = `nome LIKE ${nameParam} COLLATE NOCASE`;
    if (termDigits) {
      params.push(`%${termDigits}%`);
      const digitParam = `$${params.length}`;
      clause += ` OR cpf LIKE ${digitParam} OR cnpj LIKE ${digitParam}`;
    }
    where.push(`(${clause})`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db.select<Cliente[]>(
    `SELECT ${CLIENTE_COLUMNS} FROM clientes ${whereSql} ORDER BY nome COLLATE NOCASE ASC`,
    params,
  );

  // Compute status_financeiro per row.
  const lancamentosExists = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'lancamentos'`,
  );
  if (lancamentosExists.length === 0) {
    return rows.map((r) => ({ ...r, status_financeiro: "sem_movimentacao" as StatusFinanceiro }));
  }

  return Promise.all(
    rows.map(async (row) => {
      const status = await clientesStatusFinanceiro(row.id);
      return { ...row, status_financeiro: status };
    }),
  );
}

export async function clientesStatusFinanceiro(id: string): Promise<StatusFinanceiro> {
  const db = await getDb();
  // Guard: lancamentos may not exist yet during early-stage development.
  const exists = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'lancamentos'`,
  );
  if (exists.length === 0) return "sem_movimentacao";

  const total = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM lancamentos WHERE cliente_id = $1`,
    [id],
  );
  if ((total[0]?.count ?? 0) === 0) return "sem_movimentacao";

  // Inadimplente when an avista lancamento is overdue/inadimplente OR any
  // parcela of a parcelado lancamento is overdue/inadimplente.
  const overdueAvista = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM lancamentos
      WHERE cliente_id = $1 AND forma_pagamento = 'avista'
        AND (status_pagamento = 'inadimplente'
             OR (status_pagamento = 'pendente'
                 AND date(data_prevista) < date('now', 'localtime')))`,
    [id],
  );
  const overdueParcela = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM parcelas p
       JOIN lancamentos l ON l.id = p.lancamento_id
      WHERE l.cliente_id = $1 AND l.status_pagamento != 'cancelado'
        AND (p.status = 'inadimplente'
             OR (p.status = 'pendente'
                 AND date(p.data_prevista) < date('now', 'localtime')))`,
    [id],
  );
  const inadimplente =
    (overdueAvista[0]?.count ?? 0) > 0 || (overdueParcela[0]?.count ?? 0) > 0;
  return inadimplente ? "inadimplente" : "adimplente";
}

// ──────────────────────────────────────────────────────────────────────
// Contatos PJ
// ──────────────────────────────────────────────────────────────────────

async function assertClienteIsPJ(cliente_id: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ tipo: string }[]>(
    `SELECT tipo FROM clientes WHERE id = $1`,
    [cliente_id],
  );
  if (rows.length === 0) throw new ValidationError("Cliente não encontrado.");
  if (rows[0].tipo !== "pj") {
    throw new ValidationError("Contatos só podem ser vinculados a clientes PJ.");
  }
}

export async function contatosPjList(cliente_id: string): Promise<ContatoPJ[]> {
  const db = await getDb();
  return db.select<ContatoPJ[]>(
    `SELECT id, cliente_id, nome, cargo, email, telefone, observacoes, criado_em
       FROM contatos_pj WHERE cliente_id = $1 ORDER BY nome COLLATE NOCASE ASC`,
    [cliente_id],
  );
}

export async function contatosPjCreate(input: ContatoPJInput): Promise<ContatoPJ> {
  await assertClienteIsPJ(input.cliente_id);
  if (!input.nome || !input.nome.trim()) {
    throw new ValidationError("Nome do contato é obrigatório.", "nome");
  }
  const id = uuidv4();
  const now = nowIsoTimestamp();
  const telefone = input.telefone ? onlyDigits(input.telefone) : null;
  const db = await getDb();
  await db.execute(
    `INSERT INTO contatos_pj (id, cliente_id, nome, cargo, email, telefone, observacoes, criado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, input.cliente_id, input.nome.trim(), input.cargo, input.email, telefone, input.observacoes, now],
  );
  return {
    id,
    cliente_id: input.cliente_id,
    nome: input.nome.trim(),
    cargo: input.cargo,
    email: input.email,
    telefone,
    observacoes: input.observacoes,
    criado_em: now,
  };
}

export async function contatosPjUpdate(id: string, input: ContatoPJInput): Promise<void> {
  await assertClienteIsPJ(input.cliente_id);
  if (!input.nome || !input.nome.trim()) {
    throw new ValidationError("Nome do contato é obrigatório.", "nome");
  }
  const telefone = input.telefone ? onlyDigits(input.telefone) : null;
  const db = await getDb();
  await db.execute(
    `UPDATE contatos_pj SET nome=$1, cargo=$2, email=$3, telefone=$4, observacoes=$5
       WHERE id=$6 AND cliente_id=$7`,
    [input.nome.trim(), input.cargo, input.email, telefone, input.observacoes, id, input.cliente_id],
  );
}

export async function contatosPjDelete(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM contatos_pj WHERE id = $1`, [id]);
}

// ──────────────────────────────────────────────────────────────────────
// Inscrições Estaduais (PJ only — one per UF)
// ──────────────────────────────────────────────────────────────────────

export async function inscricoesEstaduaisList(cliente_id: string): Promise<InscricaoEstadual[]> {
  const db = await getDb();
  return db.select<InscricaoEstadual[]>(
    `SELECT id, cliente_id, estado, inscricao, criado_em
       FROM inscricoes_estaduais WHERE cliente_id = $1
       ORDER BY estado ASC`,
    [cliente_id],
  );
}

/**
 * Replaces all inscrições estaduais for a cliente with the supplied drafts.
 * Validates (PJ only, no empty fields, no duplicate UF) before touching the DB,
 * so the delete-then-insert sequence cannot fail mid-way.
 */
export async function inscricoesEstaduaisSync(
  cliente_id: string,
  drafts: InscricaoEstadualDraft[],
): Promise<void> {
  const db = await getDb();

  const cli = await db.select<{ tipo: string }[]>(
    `SELECT tipo FROM clientes WHERE id = $1`,
    [cliente_id],
  );
  if (cli.length === 0) throw new ValidationError("Cliente não encontrado.");

  const cleaned = drafts
    .map((d) => ({ estado: d.estado.trim(), inscricao: d.inscricao.trim() }))
    .filter((d) => d.estado || d.inscricao);

  if (cli[0].tipo !== "pj") {
    if (cleaned.length > 0) {
      throw new ValidationError("Inscrições estaduais aplicam-se apenas a Pessoa Jurídica.");
    }
    // Defensive cleanup in case a client was converted PJ → PF.
    await db.execute(`DELETE FROM inscricoes_estaduais WHERE cliente_id = $1`, [cliente_id]);
    return;
  }

  const seen = new Set<string>();
  for (const d of cleaned) {
    if (!d.estado) throw new ValidationError("Selecione o estado da inscrição estadual.");
    if (!d.inscricao) throw new ValidationError("Informe o número da inscrição estadual.");
    if (seen.has(d.estado)) {
      throw new ValidationError(`Há mais de uma inscrição estadual para ${d.estado}.`);
    }
    seen.add(d.estado);
  }

  // Validated — delete-all then insert-all (independent statements; see the
  // no-manual-transaction note on clientesDelete).
  await db.execute(`DELETE FROM inscricoes_estaduais WHERE cliente_id = $1`, [cliente_id]);
  const now = nowIsoTimestamp();
  for (const d of cleaned) {
    await db.execute(
      `INSERT INTO inscricoes_estaduais (id, cliente_id, estado, inscricao, criado_em)
       VALUES ($1,$2,$3,$4,$5)`,
      [uuidv4(), cliente_id, d.estado, d.inscricao, now],
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Matriz / Filial
// ──────────────────────────────────────────────────────────────────────

/** Lists the filiais (branch clients) whose `matriz_id` points at the given cliente. */
export async function clientesListFiliais(matriz_id: string): Promise<Cliente[]> {
  const db = await getDb();
  return db.select<Cliente[]>(
    `SELECT ${CLIENTE_COLUMNS} FROM clientes WHERE matriz_id = $1
     ORDER BY nome COLLATE NOCASE ASC`,
    [matriz_id],
  );
}
