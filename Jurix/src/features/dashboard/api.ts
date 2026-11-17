import { getDb } from "../../lib/db";
import { addDaysIso, todayIso } from "../../lib/format/dates";
import { horizonRange, monthsInRange } from "./period";
import type {
  ConcentracaoCliente,
  ConcentracaoResult,
  DashboardKpis,
  GrupoReceita,
  HorizonteProjecao,
  InadimplenciaItem,
  MesFluxo,
  ProjecaoResult,
  RecebiveisProximos,
  RecebivelItem,
  SemChanceItem,
  SimuladorModo,
  SimuladorResult,
} from "./types";

// ──────────────────────────────────────────────────────────────────────
// Shared SQL building blocks — paid entradas / saídas treat avista lancamentos
// and parcelas uniformly. Every figure is integer cents.
// ──────────────────────────────────────────────────────────────────────

/** Entradas effectively received, anchored by the date money came in. */
const RECEBIMENTOS_ENTRADA = `
  SELECT l.data_pagamento AS data_ref, l.valor AS valor, l.cliente_id AS cliente_id, l.contrato_id AS contrato_id
  FROM lancamentos l
  WHERE l.natureza='entrada' AND l.forma_pagamento='avista'
    AND l.status_pagamento='pago' AND l.data_pagamento IS NOT NULL
  UNION ALL
  SELECT p.data_pagamento, p.valor, l.cliente_id, l.contrato_id
  FROM parcelas p JOIN lancamentos l ON l.id = p.lancamento_id
  WHERE l.natureza='entrada' AND p.status='pago' AND p.data_pagamento IS NOT NULL
`;

/** Saídas effectively paid, anchored by the date money went out. */
const SAIDAS_PAGAS = `
  SELECT l.data_pagamento AS data_ref, l.valor AS valor
  FROM lancamentos l
  WHERE l.natureza='saida' AND l.forma_pagamento='avista'
    AND l.status_pagamento='pago' AND l.data_pagamento IS NOT NULL
  UNION ALL
  SELECT p.data_pagamento, p.valor
  FROM parcelas p JOIN lancamentos l ON l.id = p.lancamento_id
  WHERE l.natureza='saida' AND p.status='pago' AND p.data_pagamento IS NOT NULL
`;

/** Unpaid entradas (avista + parcelas), anchored by the expected date. */
const RECEBIVEIS_PENDENTES = `
  SELECT l.data_prevista AS data_prev, l.valor AS valor, l.cliente_id AS cliente_id,
         l.contrato_id AS contrato_id, l.processo_id AS processo_id, l.id AS lancamento_id,
         l.descricao AS descricao, l.tipo AS tipo, NULL AS parcela_numero
  FROM lancamentos l
  WHERE l.natureza='entrada' AND l.forma_pagamento='avista'
    AND l.status_pagamento IN ('pendente','inadimplente') AND l.data_prevista IS NOT NULL
  UNION ALL
  SELECT p.data_prevista, p.valor, l.cliente_id, l.contrato_id, l.processo_id, l.id,
         l.descricao, l.tipo, p.numero
  FROM parcelas p JOIN lancamentos l ON l.id = p.lancamento_id
  WHERE l.natureza='entrada' AND p.status IN ('pendente','inadimplente')
    AND l.status_pagamento != 'cancelado'
`;

/** Future (pending) entradas with the fields the projeção needs. */
const ENTRADAS_FUTURAS = `
  SELECT l.data_prevista AS data_prev, l.valor AS valor, l.garantido AS garantido,
         l.processo_id AS processo_id, l.cliente_id AS cliente_id, l.id AS lancamento_id,
         l.descricao AS descricao, l.tipo AS tipo
  FROM lancamentos l
  WHERE l.natureza='entrada' AND l.forma_pagamento='avista'
    AND l.status_pagamento='pendente' AND l.data_prevista IS NOT NULL
  UNION ALL
  SELECT p.data_prevista, p.valor, l.garantido, l.processo_id, l.cliente_id, l.id,
         l.descricao, l.tipo
  FROM parcelas p JOIN lancamentos l ON l.id = p.lancamento_id
  WHERE l.natureza='entrada' AND p.status='pendente' AND l.status_pagamento != 'cancelado'
`;

/**
 * Every non-cancelled movement (avista + parcelas), anchored by its effective
 * date, tagged by natureza and an EFFECTIVE garantido classification.
 *
 * The effective classification overrides the user `garantido` flag with reality:
 *  - pago               → garantido (1) — o dinheiro já se movimentou
 *  - vencido e não pago → entrada: incerto (0) — a garantia de receber falhou;
 *                         saída:   garantido (1) — dívida vencida é obrigação certa
 *  - pendente em dia    → a flag `garantido` do lançamento
 */
const MOVIMENTOS = `
  SELECT l.natureza AS natureza,
         CASE
           WHEN l.status_pagamento = 'pago' THEN 1
           WHEN date(l.data_prevista) < date('now','localtime')
                THEN CASE WHEN l.natureza = 'saida' THEN 1 ELSE 0 END
           ELSE l.garantido
         END AS garantido,
         COALESCE(l.data_pagamento, l.data_prevista) AS data_ref, l.valor AS valor
  FROM lancamentos l
  WHERE l.forma_pagamento='avista' AND l.status_pagamento != 'cancelado'
    AND COALESCE(l.data_pagamento, l.data_prevista) IS NOT NULL
  UNION ALL
  SELECT l.natureza,
         CASE
           WHEN p.status = 'pago' THEN 1
           WHEN date(p.data_prevista) < date('now','localtime')
                THEN CASE WHEN l.natureza = 'saida' THEN 1 ELSE 0 END
           ELSE l.garantido
         END AS garantido,
         COALESCE(p.data_pagamento, p.data_prevista) AS data_ref, p.valor
  FROM parcelas p JOIN lancamentos l ON l.id = p.lancamento_id
  WHERE l.status_pagamento != 'cancelado'
`;

/** Future (pending) saídas, with the garantido flag. */
const SAIDAS_FUTURAS = `
  SELECT l.data_prevista AS data_prev, l.valor AS valor, l.garantido AS garantido
  FROM lancamentos l
  WHERE l.natureza='saida' AND l.forma_pagamento='avista'
    AND l.status_pagamento='pendente' AND l.data_prevista IS NOT NULL
  UNION ALL
  SELECT p.data_prevista, p.valor, l.garantido
  FROM parcelas p JOIN lancamentos l ON l.id = p.lancamento_id
  WHERE l.natureza='saida' AND p.status='pendente' AND l.status_pagamento != 'cancelado'
`;

const sum = (rows: { total: number | null }[]): number => rows[0]?.total ?? 0;

// ──────────────────────────────────────────────────────────────────────
// Visão Geral
// ──────────────────────────────────────────────────────────────────────

export async function dashboardKpis(from: string, to: string): Promise<DashboardKpis> {
  const db = await getDb();
  const today = todayIso();

  // Realizado ("garantido"): entradas recebidas e saídas pagas no período (data_pagamento).
  const entrada = await db.select<{ total: number | null; n: number }[]>(
    `SELECT COALESCE(SUM(valor),0) AS total, COUNT(DISTINCT cliente_id) AS n
     FROM (${RECEBIMENTOS_ENTRADA}) WHERE data_ref >= $1 AND data_ref <= $2`,
    [from, to],
  );
  const saida = await db.select<{ total: number | null }[]>(
    `SELECT COALESCE(SUM(valor),0) AS total
     FROM (${SAIDAS_PAGAS}) WHERE data_ref >= $1 AND data_ref <= $2`,
    [from, to],
  );
  // Cenários: somas do período por natureza × flag `garantido`.
  const cenarios = await db.select<{ natureza: string; garantido: number; total: number }[]>(
    `SELECT natureza, garantido, COALESCE(SUM(valor),0) AS total
     FROM (${MOVIMENTOS}) WHERE data_ref >= $1 AND data_ref <= $2
     GROUP BY natureza, garantido`,
    [from, to],
  );
  const inad = await db.select<{ total: number | null }[]>(
    `SELECT COALESCE(SUM(valor),0) AS total
     FROM (${RECEBIVEIS_PENDENTES}) WHERE data_prev < $1`,
    [today],
  );

  const totalRecebido = entrada[0]?.total ?? 0;
  const numClientes = entrada[0]?.n ?? 0;
  const totalSaidas = sum(saida);

  const cenario = (natureza: string, garantido: number): number =>
    cenarios.find((r) => r.natureza === natureza && r.garantido === garantido)?.total ?? 0;
  const entradasGarantidas = cenario("entrada", 1);
  const entradasIncertas = cenario("entrada", 0);
  const saidasGarantidas = cenario("saida", 1);
  const saidasIncertas = cenario("saida", 0);
  const lucroGarantido = entradasGarantidas - saidasGarantidas;

  return {
    total_recebido_cents: totalRecebido,
    total_pago_saidas_cents: totalSaidas,
    // Lucro garantido = entradas garantidas − saídas garantidas.
    resultado_liquido_cents: lucroGarantido,
    // Pior cenário: nenhuma entrada incerta entra; todas as saídas (certas + incertas) saem.
    pior_cenario_cents: lucroGarantido - saidasIncertas,
    // Melhor cenário: todas as entradas incertas entram; só as saídas garantidas saem.
    melhor_cenario_cents: lucroGarantido + entradasIncertas,
    ticket_medio_cents: numClientes > 0 ? Math.round(totalRecebido / numClientes) : null,
    inadimplencia_total_cents: sum(inad),
    num_clientes_pagantes: numClientes,
  };
}

/** The `YYYY-MM` bucket immediately before `ym`. */
function prevYm(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Every non-cancelled movement (avista + parcelas) for the Fluxo Mensal chart,
 * anchored by its effective date: `data_pagamento` when paid (cash basis — what
 * the livro-caixa needs), else `data_prevista`. Carries `pago` (0/1) and `garantido`.
 */
const CHART_MOVIMENTOS = `
  SELECT l.natureza AS natureza,
         COALESCE(l.data_pagamento, l.data_prevista) AS data_ref, l.valor AS valor,
         CASE WHEN l.status_pagamento = 'pago' THEN 1 ELSE 0 END AS pago,
         l.garantido AS garantido
  FROM lancamentos l
  WHERE l.forma_pagamento='avista' AND l.status_pagamento != 'cancelado'
    AND COALESCE(l.data_pagamento, l.data_prevista) IS NOT NULL
  UNION ALL
  SELECT l.natureza,
         COALESCE(p.data_pagamento, p.data_prevista) AS data_ref, p.valor,
         CASE WHEN p.status = 'pago' THEN 1 ELSE 0 END AS pago,
         l.garantido
  FROM parcelas p JOIN lancamentos l ON l.id = p.lancamento_id
  WHERE l.status_pagamento != 'cancelado'
`;

/**
 * Monthly cash-flow buckets for the chart, split into realised (paid) and
 * forward (pending, from today on) so the UI can project the future per scenario.
 * Paid movements show in the month they were paid; pending ones only count from
 * today onward (overdue-unpaid is excluded — past months show só o pago).
 * When the period spans a single month, the previous month is prepended so the
 * chart draws a continuous line instead of a lone dot.
 */
export async function dashboardFluxoMensal(from: string, to: string): Promise<MesFluxo[]> {
  const meses = monthsInRange(from, to);
  if (meses.length === 0) return [];
  const chartMeses = meses.length === 1 ? [prevYm(meses[0]), ...meses] : meses;

  const db = await getDb();
  const today = todayIso();
  const queryFrom = `${chartMeses[0]}-01`;
  const queryTo = `${chartMeses[chartMeses.length - 1]}-31`; // string upper bound for the month

  // Realizado — pago, ancorado pela data de pagamento (regime de caixa).
  const pagos = await db.select<{ ym: string; natureza: string; total: number }[]>(
    `SELECT strftime('%Y-%m', data_ref) AS ym, natureza, SUM(valor) AS total
     FROM (${CHART_MOVIMENTOS})
     WHERE pago = 1 AND data_ref >= $1 AND data_ref <= $2
     GROUP BY ym, natureza`,
    [queryFrom, queryTo],
  );
  // Forward — pendente de hoje em diante, por mês, natureza e flag garantido.
  const pendentes = await db.select<
    { ym: string; natureza: string; garantido: number; total: number }[]
  >(
    `SELECT strftime('%Y-%m', data_ref) AS ym, natureza, garantido, SUM(valor) AS total
     FROM (${CHART_MOVIMENTOS})
     WHERE pago = 0 AND data_ref >= $1 AND data_ref <= $2
     GROUP BY ym, natureza, garantido`,
    [today, queryTo],
  );

  const pagoMap = new Map(pagos.map((r) => [`${r.ym}|${r.natureza}`, r.total]));
  const pendMap = new Map(
    pendentes.map((r) => [`${r.ym}|${r.natureza}|${r.garantido}`, r.total]),
  );

  return chartMeses.map((ym) => ({
    ano_mes: ym,
    entradas_pagas_cents: pagoMap.get(`${ym}|entrada`) ?? 0,
    saidas_pagas_cents: pagoMap.get(`${ym}|saida`) ?? 0,
    entradas_prev_garantidas_cents: pendMap.get(`${ym}|entrada|1`) ?? 0,
    entradas_prev_incertas_cents: pendMap.get(`${ym}|entrada|0`) ?? 0,
    saidas_prev_garantidas_cents: pendMap.get(`${ym}|saida|1`) ?? 0,
    saidas_prev_incertas_cents: pendMap.get(`${ym}|saida|0`) ?? 0,
  }));
}

async function receitaPorJoin(
  from: string,
  to: string,
  lookupTable: "areas_direito" | "tipos_contrato",
  fkColumn: "area_direito_id" | "tipo_contrato_id",
): Promise<GrupoReceita[]> {
  const db = await getDb();
  const rows = await db.select<GrupoReceita[]>(
    `SELECT
       CASE WHEN ct.id IS NULL THEN '__sem_contrato__' ELSE lk.id END AS grupo_id,
       CASE WHEN ct.id IS NULL THEN 'Sem contrato'
            WHEN lk.ativo = 0 THEN lk.nome || ' (inativo)'
            ELSE lk.nome END AS grupo_nome,
       SUM(r.valor) AS total_cents
     FROM (${RECEBIMENTOS_ENTRADA}) r
     LEFT JOIN contratos ct ON ct.id = r.contrato_id
     LEFT JOIN ${lookupTable} lk ON lk.id = ct.${fkColumn}
     WHERE r.data_ref >= $1 AND r.data_ref <= $2
     GROUP BY grupo_id, grupo_nome
     ORDER BY total_cents DESC`,
    [from, to],
  );
  return rows;
}

export function dashboardReceitaPorArea(from: string, to: string): Promise<GrupoReceita[]> {
  return receitaPorJoin(from, to, "areas_direito", "area_direito_id");
}

export function dashboardReceitaPorTipoContrato(from: string, to: string): Promise<GrupoReceita[]> {
  return receitaPorJoin(from, to, "tipos_contrato", "tipo_contrato_id");
}

export async function dashboardConcentracao(from: string, to: string): Promise<ConcentracaoResult> {
  const db = await getDb();
  const rows = await db.select<{ cliente_id: string; cliente_nome: string; total: number }[]>(
    `SELECT r.cliente_id AS cliente_id, c.nome AS cliente_nome, SUM(r.valor) AS total
     FROM (${RECEBIMENTOS_ENTRADA}) r JOIN clientes c ON c.id = r.cliente_id
     WHERE r.data_ref >= $1 AND r.data_ref <= $2
     GROUP BY r.cliente_id, c.nome
     ORDER BY total DESC`,
    [from, to],
  );
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  const clientes: ConcentracaoCliente[] = rows.map((r) => ({
    cliente_id: r.cliente_id,
    cliente_nome: r.cliente_nome,
    total_cents: r.total,
    pct: total > 0 ? r.total / total : 0,
  }));
  const top = clientes[0] ?? null;
  return {
    clientes,
    total_cents: total,
    top,
    alert_eligible: clientes.length >= 3 && !!top && top.pct > 0.4,
  };
}

export async function dashboardRecebiveisProximos(dias: number): Promise<RecebiveisProximos> {
  const db = await getDb();
  const today = todayIso();
  const limite = addDaysIso(today, dias);
  const itens = await db.select<RecebivelItem[]>(
    `SELECT rp.lancamento_id AS lancamento_id, rp.parcela_numero AS parcela_numero,
            rp.descricao AS descricao, rp.tipo AS tipo, c.nome AS cliente_nome,
            rp.valor AS valor_cents, rp.data_prev AS data_prevista
     FROM (${RECEBIVEIS_PENDENTES}) rp JOIN clientes c ON c.id = rp.cliente_id
     WHERE rp.data_prev >= $1 AND rp.data_prev <= $2
     ORDER BY rp.data_prev ASC`,
    [today, limite],
  );
  return {
    dias,
    total_cents: itens.reduce((acc, i) => acc + i.valor_cents, 0),
    itens,
  };
}

export async function dashboardInadimplenciaDetalhada(): Promise<InadimplenciaItem[]> {
  const db = await getDb();
  const today = todayIso();
  return db.select<InadimplenciaItem[]>(
    `SELECT rp.lancamento_id AS lancamento_id, rp.parcela_numero AS parcela_numero,
            c.nome AS cliente_nome, ct.codigo AS contrato_codigo,
            pr.numero_processo AS processo_numero, pr.natureza AS processo_natureza,
            rp.valor AS valor_cents, rp.data_prev AS data_prevista,
            CAST(julianday($1) - julianday(rp.data_prev) AS INTEGER) AS dias_atrasado
     FROM (${RECEBIVEIS_PENDENTES}) rp
     JOIN clientes c ON c.id = rp.cliente_id
     LEFT JOIN contratos ct ON ct.id = rp.contrato_id
     LEFT JOIN processos pr ON pr.id = rp.processo_id
     WHERE rp.data_prev < $1
     ORDER BY dias_atrasado DESC`,
    [today],
  );
}

// ──────────────────────────────────────────────────────────────────────
// Projeção
// ──────────────────────────────────────────────────────────────────────

interface EntradaFuturaRow {
  lancamento_id: string;
  descricao: string | null;
  tipo: string;
  valor: number;
  data_prev: string;
  garantido: number;
  cliente_id: string;
  cliente_nome: string;
  processo_id: string | null;
  chance_exito: number | null;
}

const HORIZONTES = [3, 6, 12] as const;

export async function dashboardProjecao(): Promise<ProjecaoResult> {
  const db = await getDb();
  const today = todayIso();
  const limite12 = horizonRange(12).to;

  const entradas = await db.select<EntradaFuturaRow[]>(
    `SELECT ef.lancamento_id AS lancamento_id, ef.descricao AS descricao, ef.tipo AS tipo,
            ef.valor AS valor, ef.data_prev AS data_prev, ef.garantido AS garantido,
            ef.cliente_id AS cliente_id, c.nome AS cliente_nome,
            ef.processo_id AS processo_id, pr.chance_exito AS chance_exito
     FROM (${ENTRADAS_FUTURAS}) ef
     JOIN clientes c ON c.id = ef.cliente_id
     LEFT JOIN processos pr ON pr.id = ef.processo_id
     WHERE ef.data_prev >= $1 AND ef.data_prev <= $2`,
    [today, limite12],
  );
  const saidas = await db.select<{ valor: number; data_prev: string }[]>(
    `SELECT valor, data_prev FROM (${SAIDAS_FUTURAS})
     WHERE data_prev >= $1 AND data_prev <= $2`,
    [today, limite12],
  );

  const horizontes: HorizonteProjecao[] = HORIZONTES.map((meses) => {
    const limite = horizonRange(meses).to;
    let garantidas = 0;
    let ponderadas = 0;
    for (const e of entradas) {
      if (e.data_prev > limite) continue;
      if (e.garantido === 1) {
        garantidas += e.valor;
      } else if (e.chance_exito != null) {
        ponderadas += Math.round((e.valor * e.chance_exito) / 100);
      }
    }
    const saidasTotal = saidas
      .filter((s) => s.data_prev <= limite)
      .reduce((acc, s) => acc + s.valor, 0);
    return {
      meses,
      garantidas_cents: garantidas,
      nao_garantidas_ponderadas_cents: ponderadas,
      saidas_cents: saidasTotal,
      resultado_cents: garantidas + ponderadas - saidasTotal,
    };
  });

  // "Sem chance_exito" — não garantidas without an assessable processo, deduped by lancamento.
  const semChanceMap = new Map<string, SemChanceItem>();
  for (const e of entradas) {
    if (e.garantido === 1 || e.chance_exito != null) continue;
    const existing = semChanceMap.get(e.lancamento_id);
    if (existing) {
      existing.valor_cents += e.valor;
    } else {
      semChanceMap.set(e.lancamento_id, {
        lancamento_id: e.lancamento_id,
        processo_id: e.processo_id,
        descricao: e.descricao,
        tipo: e.tipo,
        cliente_nome: e.cliente_nome,
        valor_cents: e.valor,
      });
    }
  }

  // Per-cliente entrada contribution (garantida + ponderada) per horizon — feeds the simulador.
  const clienteMap = new Map<string, { cliente_nome: string; contrib: Record<number, number> }>();
  for (const e of entradas) {
    let entry = clienteMap.get(e.cliente_id);
    if (!entry) {
      entry = { cliente_nome: e.cliente_nome, contrib: { 3: 0, 6: 0, 12: 0 } };
      clienteMap.set(e.cliente_id, entry);
    }
    const weighted =
      e.garantido === 1
        ? e.valor
        : e.chance_exito != null
          ? Math.round((e.valor * e.chance_exito) / 100)
          : 0;
    if (weighted === 0) continue;
    for (const meses of HORIZONTES) {
      if (e.data_prev <= horizonRange(meses).to) entry.contrib[meses] += weighted;
    }
  }

  return {
    horizontes,
    sem_chance: [...semChanceMap.values()].sort((a, b) => b.valor_cents - a.valor_cents),
    por_cliente: [...clienteMap.entries()]
      .map(([cliente_id, v]) => ({ cliente_id, cliente_nome: v.cliente_nome, contrib: v.contrib }))
      .sort((a, b) => b.contrib[12] - a.contrib[12]),
  };
}

/**
 * Computes a what-if simulation against the projection baseline.
 * `valorMensalCents` is used by novo_contrato / despesa_fixa; `clienteId` by perda_cliente.
 */
export function simular(
  projecao: ProjecaoResult,
  modo: SimuladorModo,
  params: { valorMensalCents?: number; clienteId?: string },
): SimuladorResult {
  const baseline: Record<number, number> = {};
  const delta: Record<number, number> = {};
  const novo: Record<number, number> = {};

  for (const h of projecao.horizontes) {
    baseline[h.meses] = h.resultado_cents;
    if (modo === "novo_contrato") {
      delta[h.meses] = (params.valorMensalCents ?? 0) * h.meses;
    } else if (modo === "despesa_fixa") {
      delta[h.meses] = -(params.valorMensalCents ?? 0) * h.meses;
    } else {
      const cliente = projecao.por_cliente.find((c) => c.cliente_id === params.clienteId);
      delta[h.meses] = -(cliente?.contrib[h.meses] ?? 0);
    }
    novo[h.meses] = baseline[h.meses] + delta[h.meses];
  }

  const novo12 = novo[12];
  const base12 = baseline[12];
  const indicador =
    novo12 < 0 ? "critico" : novo12 >= 0.8 * base12 ? "saudavel" : "atencao";

  return { baseline, delta, novo, indicador };
}
