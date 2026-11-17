/**
 * Dados fictícios da demo web. Tudo é criado pelas mesmas funções de API que as
 * telas usam, então as validações, a geração de parcelas e o cálculo de
 * inadimplência rodam exatamente como no app desktop.
 *
 * Nomes, documentos e números de processo são inventados. CPFs, CNPJs e números
 * CNJ têm dígitos verificadores válidos só para passar nas máscaras e validações.
 * As datas são relativas a hoje, para a agenda e o dashboard parecerem vivos.
 */
import { clientesCreate, contatosPjCreate } from "../features/clientes/api";
import { processosCreate } from "../features/processos/api";
import { contratosCreate } from "../features/contratos/api";
import {
  lancamentosCreate,
  lancamentosGet,
  parcelasMarcarPago,
  lancamentosRecomputeInadimplencia,
} from "../features/lancamentos/api";
import { agendaCreate } from "../features/agenda/api";
import type { ClienteInput } from "../features/clientes/types";
import type { ProcessoInput } from "../features/processos/types";
import type { LancamentoInput } from "../features/lancamentos/types";
import { addDaysIso, addMonthsClamped, todayIso } from "../lib/format/dates";

// ── Lookups (ids fixos da migração 0002) ─────────────────────────────
const AREA = {
  civel: "a1000000-0000-4000-8000-000000000001",
  trabalhista: "a1000000-0000-4000-8000-000000000002",
  tributario: "a1000000-0000-4000-8000-000000000003",
  familia: "a1000000-0000-4000-8000-000000000004",
  empresarial: "a1000000-0000-4000-8000-000000000005",
  previdenciario: "a1000000-0000-4000-8000-000000000007",
  consumidor: "a1000000-0000-4000-8000-000000000008",
};
const TIPO = {
  mensalidade: "b1000000-0000-4000-8000-000000000001",
  exito: "b1000000-0000-4000-8000-000000000002",
  probono: "b1000000-0000-4000-8000-000000000003",
  pontual: "b1000000-0000-4000-8000-000000000004",
  consultoria: "b1000000-0000-4000-8000-000000000005",
};
const CENTRO = {
  custas: "c1000000-0000-4000-8000-000000000002",
};
const ORIGEM = {
  indicacao: "d1000000-0000-4000-8000-000000000001",
  site: "d1000000-0000-4000-8000-000000000002",
  rede: "d1000000-0000-4000-8000-000000000003",
  recorrente: "d1000000-0000-4000-8000-000000000004",
};
const EVENTO = {
  audiencia: "e1000000-0000-4000-8000-000000000001",
  reuniao: "e1000000-0000-4000-8000-000000000002",
  prazo: "e1000000-0000-4000-8000-000000000003",
  interno: "e1000000-0000-4000-8000-000000000004",
};

// ── Documentos fictícios com dígito verificador válido ───────────────
function cpf(base9: string): string {
  const d = base9.split("").map(Number);
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += d[i] * (len + 1 - i);
    const r = (sum * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  return d.join("");
}

function cnpj(base12: string): string {
  const d = base12.split("").map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  for (const w of [w1, w2]) {
    const sum = w.reduce((acc, wi, i) => acc + wi * d[i], 0);
    const r = sum % 11;
    d.push(r < 2 ? 0 : 11 - r);
  }
  return d.join("");
}

/** NNNNNNN-DD.AAAA.J.TR.OOOO com o dígito DD calculado pelo módulo 97 (Res. CNJ 65/2008). */
function cnj(seq: string, ano: number, j: string, tr: string, origem: string): string {
  const n = BigInt(`${seq}${ano}${j}${tr}${origem}00`);
  const dd = String(98n - (n % 97n)).padStart(2, "0");
  return `${seq}${dd}${ano}${j}${tr}${origem}`;
}

// ── Datas relativas a hoje ───────────────────────────────────────────
const HOJE = todayIso();
const dia = (n: number) => addDaysIso(HOJE, n);
const mes = (n: number, diaDoMes = 10) => {
  const base = `${HOJE.slice(0, 8)}${String(diaDoMes).padStart(2, "0")}`;
  return addMonthsClamped(base, n);
};
const hora = (n: number, hhmm: string) => `${dia(n)}T${hhmm}:00`;

// ── Construtores com padrões ─────────────────────────────────────────
function pf(nome: string, extra: Partial<ClienteInput>): ClienteInput {
  return {
    tipo: "pf", nome, cpf: null, rg: null, data_nascimento: null, cnpj: null, data_fundacao: null,
    email: null, telefone: null, cep: null, logradouro: null, numero: null, complemento: null,
    bairro: null, cidade: "São Paulo", estado: "SP", origem_id: null,
    status_relacionamento: "ativo", observacoes: null, tipo_unidade: null, matriz_id: null,
    ...extra,
  };
}

function pj(nome: string, extra: Partial<ClienteInput>): ClienteInput {
  return pf(nome, { tipo: "pj", tipo_unidade: "matriz", ...extra });
}

function proc(cliente_id: string, extra: Partial<ProcessoInput>): ProcessoInput {
  return {
    cliente_id, natureza: "judicial", numero_processo: null, vara: null, tribunal: null,
    comarca: null, fase: "conhecimento", fase_custom: null, parte_adversa: null,
    advogado_adversario: null, oab_adversario: null, valor_causa: null, chance_exito: null,
    link_documentos: null, status: "em_andamento", observacoes: null,
    ...extra,
  };
}

function lanc(cliente_id: string, extra: Partial<LancamentoInput>): LancamentoInput {
  return {
    descricao: null, natureza: "entrada", cliente_id, contrato_id: null, processo_id: null,
    tipo: "pagamento_unico", centro_custo_id: null, garantido: true, forma_pagamento: "avista",
    num_parcelas: null, valor: 0, data_prevista: null, data_primeira_parcela: null,
    data_pagamento: null, status_pagamento: "pendente", numero_documento: null, observacoes: null,
    ...extra,
  };
}

/** Marca como pagas as parcelas já vencidas, exceto as de `deixarEmAberto` (números). */
async function pagarVencidas(lancamentoId: string, deixarEmAberto: number[] = []): Promise<void> {
  const l = await lancamentosGet(lancamentoId);
  if (!l) return;
  for (const p of l.parcelas) {
    if (p.data_prevista <= HOJE && !deixarEmAberto.includes(p.numero)) {
      await parcelasMarcarPago(p.id, addDaysIso(p.data_prevista, 2) > HOJE ? HOJE : addDaysIso(p.data_prevista, 2));
    }
  }
}

export async function prepararDemo(): Promise<void> {
  // ── Clientes ───────────────────────────────────────────────────────
  const mariana = await clientesCreate(pf("Mariana Albuquerque Teixeira", {
    cpf: cpf("123456789"), data_nascimento: "1986-03-14", email: "mariana.teixeira@exemplo.com",
    telefone: "11987650001", cep: "01310100", logradouro: "Av. Paulista", numero: "1000",
    bairro: "Bela Vista", origem_id: ORIGEM.indicacao,
  }));
  const rogerio = await clientesCreate(pf("Rogério Nunes Pacheco", {
    cpf: cpf("234567891"), data_nascimento: "1972-11-02", email: "rogerio.pacheco@exemplo.com",
    telefone: "11987650002", cidade: "Campinas", origem_id: ORIGEM.site,
  }));
  const helena = await clientesCreate(pf("Helena Castro Bittencourt", {
    cpf: cpf("345678912"), telefone: "11987650003", origem_id: ORIGEM.rede,
  }));
  const jose = await clientesCreate(pf("José Aparecido Moreira", {
    cpf: cpf("456789123"), data_nascimento: "1961-07-21", telefone: "11987650004",
    cidade: "Santo André", origem_id: ORIGEM.indicacao,
    observacoes: "Prefere contato por telefone, à tarde.",
  }));
  const camila = await clientesCreate(pf("Camila Duarte Rezende", {
    cpf: cpf("567891234"), email: "camila.rezende@exemplo.com", origem_id: ORIGEM.recorrente,
  }));
  const antonio = await clientesCreate(pf("Antônio Ferraz Lima", {
    cpf: cpf("678912345"), status_relacionamento: "inativo", origem_id: ORIGEM.site,
  }));

  const padaria = await clientesCreate(pj("Padaria Trigo de Ouro Ltda.", {
    cnpj: cnpj("112223330001"), data_fundacao: "2009-05-04", email: "financeiro@trigodeouro.exemplo",
    telefone: "1133330001", cep: "04001000", logradouro: "Rua Domingos de Morais", numero: "250",
    bairro: "Vila Mariana", origem_id: ORIGEM.indicacao,
  }));
  const padariaFilial = await clientesCreate(pj("Padaria Trigo de Ouro Ltda. — Filial Moema", {
    cnpj: cnpj("112223330002"), tipo_unidade: "filial", matriz_id: padaria.id,
    telefone: "1133330002", bairro: "Moema", origem_id: ORIGEM.indicacao,
  }));
  const transportes = await clientesCreate(pj("Rota Sul Transportes S.A.", {
    cnpj: cnpj("223334440001"), email: "juridico@rotasul.exemplo", telefone: "1133330003",
    cep: "07034000", logradouro: "Rodovia Presidente Dutra", numero: "km 225", bairro: "Cumbica",
    cidade: "Guarulhos", origem_id: ORIGEM.recorrente,
  }));
  const clinica = await clientesCreate(pj("Clínica Sorriso Pleno Odontologia", {
    cnpj: cnpj("334445550001"), telefone: "1133330004", origem_id: ORIGEM.site,
  }));
  const tech = await clientesCreate(pj("Nuvem Clara Tecnologia Ltda.", {
    cnpj: cnpj("445556660001"), email: "contato@nuvemclara.exemplo", origem_id: ORIGEM.rede,
  }));

  await contatosPjCreate({
    cliente_id: padaria.id, nome: "Sérgio Tavares", cargo: "Sócio-administrador",
    email: "sergio@trigodeouro.exemplo", telefone: "11987651001", observacoes: null,
  });
  await contatosPjCreate({
    cliente_id: transportes.id, nome: "Lúcia Fontes", cargo: "Gerente de RH",
    email: "lucia.fontes@rotasul.exemplo", telefone: "11987651002", observacoes: null,
  });

  // ── Processos ──────────────────────────────────────────────────────
  const anoAtual = Number(HOJE.slice(0, 4));
  const pTrab1 = await processosCreate(proc(transportes.id, {
    numero_processo: cnj("1004521", anoAtual - 1, "5", "02", "0031"), vara: "3ª Vara do Trabalho",
    tribunal: "TRT-2", comarca: "Guarulhos", parte_adversa: "Ex-motorista (reclamante)",
    advogado_adversario: "Dr. Paulo Henrique Salles", oab_adversario: "SP 123.456",
    valor_causa: 8_650_000, chance_exito: 60,
  }));
  const pTrab2 = await processosCreate(proc(transportes.id, {
    numero_processo: cnj("1009877", anoAtual, "5", "02", "0031"), vara: "1ª Vara do Trabalho",
    tribunal: "TRT-2", comarca: "Guarulhos", parte_adversa: "Ex-conferente (reclamante)",
    valor_causa: 4_200_000, chance_exito: 75,
  }));
  const pFamilia = await processosCreate(proc(mariana.id, {
    numero_processo: cnj("1023344", anoAtual - 1, "8", "26", "0100"), vara: "2ª Vara de Família e Sucessões",
    tribunal: "TJSP", comarca: "São Paulo", parte_adversa: "Ex-cônjuge",
    fase: "recurso", chance_exito: 70,
  }));
  const pConsumidor = await processosCreate(proc(rogerio.id, {
    numero_processo: cnj("1005566", anoAtual, "8", "26", "0114"), vara: "Juizado Especial Cível",
    tribunal: "TJSP", comarca: "Campinas", parte_adversa: "Companhia aérea (ré)",
    valor_causa: 1_500_000, chance_exito: 85,
  }));
  const pPrev = await processosCreate(proc(jose.id, {
    numero_processo: cnj("5001234", anoAtual - 2, "4", "03", "6126"), vara: "1ª Vara Federal",
    tribunal: "TRF-3", comarca: "Santo André", parte_adversa: "INSS",
    fase: "execucao", valor_causa: 9_800_000, chance_exito: 90,
  }));
  const pTrib = await processosCreate(proc(padaria.id, {
    natureza: "administrativo", numero_processo: "PA 2025/004417-SEFAZ",
    tribunal: "SEFAZ-SP", parte_adversa: "Fazenda do Estado de São Paulo",
    valor_causa: 3_120_000, chance_exito: 55,
    observacoes: "Impugnação de auto de infração de ICMS.",
  }));
  const pCivel = await processosCreate(proc(clinica.id, {
    numero_processo: cnj("1031122", anoAtual - 1, "8", "26", "0002"), vara: "5ª Vara Cível",
    tribunal: "TJSP", comarca: "São Paulo", parte_adversa: "Fornecedora de equipamentos",
    valor_causa: 6_400_000, chance_exito: 50, status: "suspenso",
  }));
  await processosCreate(proc(antonio.id, {
    numero_processo: cnj("1000789", anoAtual - 3, "8", "26", "0100"), vara: "8ª Vara Cível",
    tribunal: "TJSP", comarca: "São Paulo", parte_adversa: "Banco (réu)",
    fase: "arquivado", status: "encerrado", valor_causa: 2_000_000, chance_exito: 100,
  }));

  // ── Contratos ──────────────────────────────────────────────────────
  const cTransportes = await contratosCreate({
    codigo: null, nome: "Assessoria trabalhista mensal", cliente_id: transportes.id, processo_id: null,
    area_direito_id: AREA.trabalhista, tipo_contrato_id: TIPO.mensalidade, valor_base: 450_000,
    data_inicio: mes(-6, 1), data_encerramento: null, status: "ativo", link_documentos: null, observacoes: null,
  });
  const cPadaria = await contratosCreate({
    codigo: null, nome: "Consultoria tributária e societária", cliente_id: padaria.id, processo_id: null,
    area_direito_id: AREA.tributario, tipo_contrato_id: TIPO.mensalidade, valor_base: 280_000,
    data_inicio: mes(-5, 1), data_encerramento: null, status: "ativo", link_documentos: null, observacoes: null,
  });
  const cMariana = await contratosCreate({
    codigo: null, nome: "Divórcio litigioso e partilha", cliente_id: mariana.id, processo_id: pFamilia.id,
    area_direito_id: AREA.familia, tipo_contrato_id: TIPO.pontual, valor_base: 1_200_000,
    data_inicio: mes(-4, 5), data_encerramento: null, status: "ativo", link_documentos: null, observacoes: null,
  });
  const cRogerio = await contratosCreate({
    codigo: null, nome: "Ação indenizatória — voo cancelado", cliente_id: rogerio.id, processo_id: pConsumidor.id,
    area_direito_id: AREA.consumidor, tipo_contrato_id: TIPO.exito, valor_base: 0,
    data_inicio: mes(-2, 12), data_encerramento: null, status: "ativo", link_documentos: null,
    observacoes: "30% sobre o valor obtido.",
  });
  const cJose = await contratosCreate({
    codigo: null, nome: "Aposentadoria especial — cumprimento de sentença", cliente_id: jose.id,
    processo_id: pPrev.id, area_direito_id: AREA.previdenciario, tipo_contrato_id: TIPO.exito, valor_base: 0,
    data_inicio: mes(-14, 3), data_encerramento: null, status: "ativo", link_documentos: null, observacoes: null,
  });
  const cClinica = await contratosCreate({
    codigo: null, nome: "Ação de rescisão contratual", cliente_id: clinica.id, processo_id: pCivel.id,
    area_direito_id: AREA.civel, tipo_contrato_id: TIPO.pontual, valor_base: 900_000,
    data_inicio: mes(-5, 20), data_encerramento: null, status: "suspenso", link_documentos: null, observacoes: null,
  });
  const cTech = await contratosCreate({
    codigo: null, nome: "Revisão de contratos com clientes SaaS", cliente_id: tech.id, processo_id: null,
    area_direito_id: AREA.empresarial, tipo_contrato_id: TIPO.consultoria, valor_base: 650_000,
    data_inicio: mes(-1, 15), data_encerramento: null, status: "ativo", link_documentos: null, observacoes: null,
  });
  const cHelena = await contratosCreate({
    codigo: null, nome: "Planejamento sucessório", cliente_id: helena.id, processo_id: null,
    area_direito_id: AREA.familia, tipo_contrato_id: TIPO.consultoria, valor_base: 380_000,
    data_inicio: mes(-1, 3), data_encerramento: null, status: "ativo", link_documentos: null, observacoes: null,
  });
  await contratosCreate({
    codigo: null, nome: "Orientação jurídica gratuita", cliente_id: camila.id, processo_id: null,
    area_direito_id: AREA.civel, tipo_contrato_id: TIPO.probono, valor_base: 0,
    data_inicio: mes(-3, 8), data_encerramento: null, status: "ativo", link_documentos: null, observacoes: null,
  });

  // ── Lançamentos ────────────────────────────────────────────────────
  // Mensalidades de 12 meses: as vencidas ficam pagas, salvo as deixadas em aberto.
  const mTransportes = await lancamentosCreate(lanc(transportes.id, {
    descricao: "Mensalidade assessoria trabalhista", contrato_id: cTransportes.id, tipo: "mensalidade",
    forma_pagamento: "parcelado", num_parcelas: 12, valor: 450_000, data_primeira_parcela: mes(-6, 5),
    numero_documento: "NF 1021",
  }));
  await pagarVencidas(mTransportes.id);

  const mPadaria = await lancamentosCreate(lanc(padaria.id, {
    descricao: "Mensalidade consultoria tributária", contrato_id: cPadaria.id, tipo: "mensalidade",
    forma_pagamento: "parcelado", num_parcelas: 12, valor: 280_000, data_primeira_parcela: mes(-5, 10),
  }));
  await pagarVencidas(mPadaria.id, [5]); // uma mensalidade em atraso → inadimplência

  const hMariana = await lancamentosCreate(lanc(mariana.id, {
    descricao: "Honorários do divórcio (6x)", contrato_id: cMariana.id, processo_id: pFamilia.id,
    tipo: "pagamento_unico", forma_pagamento: "parcelado", num_parcelas: 6, valor: 200_000,
    data_primeira_parcela: mes(-4, 15),
  }));
  await pagarVencidas(hMariana.id);

  const hClinica = await lancamentosCreate(lanc(clinica.id, {
    descricao: "Honorários iniciais (3x)", contrato_id: cClinica.id, processo_id: pCivel.id,
    forma_pagamento: "parcelado", num_parcelas: 3, valor: 300_000, data_primeira_parcela: mes(-4, 20),
  }));
  await pagarVencidas(hClinica.id, [3]);

  const hTech = await lancamentosCreate(lanc(tech.id, {
    descricao: "Consultoria SaaS (2x)", contrato_id: cTech.id, forma_pagamento: "parcelado",
    num_parcelas: 2, valor: 325_000, data_primeira_parcela: mes(0, 15),
  }));
  await pagarVencidas(hTech.id);

  await lancamentosCreate(lanc(helena.id, {
    descricao: "Planejamento sucessório — à vista", contrato_id: cHelena.id, valor: 380_000,
    data_prevista: dia(-20), data_pagamento: dia(-18), status_pagamento: "pago",
  }));
  await lancamentosCreate(lanc(jose.id, {
    descricao: "Honorários de êxito — RPV", contrato_id: cJose.id, processo_id: pPrev.id,
    tipo: "sucumbencia", valor: 2_940_000, data_prevista: mes(2, 25),
  }));
  await lancamentosCreate(lanc(rogerio.id, {
    descricao: "Êxito estimado — indenização", contrato_id: cRogerio.id, processo_id: pConsumidor.id,
    tipo: "acordo", valor: 450_000, data_prevista: mes(4, 10),
  }));
  await lancamentosCreate(lanc(padariaFilial.id, {
    descricao: "Parecer sobre alvará da filial", tipo: "pagamento_unico", valor: 150_000,
    data_prevista: dia(-35), data_pagamento: dia(-30), status_pagamento: "pago",
  }));
  await lancamentosCreate(lanc(transportes.id, {
    descricao: "Reembolso de custas — perícia", processo_id: pTrab1.id, tipo: "reembolso_custas",
    valor: 85_000, data_prevista: dia(-12),
  }));

  // Saídas (custas adiantadas pelo escritório em processos)
  await lancamentosCreate(lanc(mariana.id, {
    natureza: "saida", descricao: "Preparo do recurso de apelação", processo_id: pFamilia.id,
    tipo: "custas_processuais", centro_custo_id: CENTRO.custas, valor: 61_500,
    data_prevista: HOJE, data_pagamento: HOJE, status_pagamento: "pago",
  }));
  await lancamentosCreate(lanc(transportes.id, {
    natureza: "saida", descricao: "Honorários periciais", processo_id: pTrab1.id, tipo: "custas_processuais",
    centro_custo_id: CENTRO.custas, valor: 85_000, data_prevista: dia(-40), data_pagamento: dia(-40),
    status_pagamento: "pago",
  }));
  await lancamentosCreate(lanc(padaria.id, {
    natureza: "saida", descricao: "Guia de recolhimento — recurso administrativo", processo_id: pTrib.id,
    tipo: "custas_processuais", centro_custo_id: CENTRO.custas, valor: 42_000, data_prevista: dia(6),
  }));

  await lancamentosRecomputeInadimplencia();

  // ── Agenda ─────────────────────────────────────────────────────────
  const ev = (titulo: string, tipo_evento_id: string, data_hora: string, extra: Partial<Parameters<typeof agendaCreate>[0]> = {}) =>
    agendaCreate({
      titulo, tipo_evento_id, data_hora, cliente_id: null, processo_id: null, contrato_id: null,
      alerta_dias: 0, status: "pendente", descricao: null, ...extra,
    });

  await ev("Audiência de instrução", EVENTO.audiencia, hora(2, "14:00"), {
    cliente_id: transportes.id, processo_id: pTrab1.id, alerta_dias: 5,
    descricao: "Levar preposto e as testemunhas arroladas.",
  });
  await ev("Prazo: contrarrazões ao recurso", EVENTO.prazo, hora(4, "23:59"), {
    cliente_id: mariana.id, processo_id: pFamilia.id, alerta_dias: 7,
  });
  await ev("Reunião de alinhamento mensal", EVENTO.reuniao, hora(1, "10:00"), {
    cliente_id: padaria.id, contrato_id: cPadaria.id,
  });
  await ev("Prazo: impugnação do auto de infração", EVENTO.prazo, hora(9, "18:00"), {
    cliente_id: padaria.id, processo_id: pTrib.id, alerta_dias: 10,
  });
  await ev("Audiência de conciliação", EVENTO.audiencia, hora(12, "15:30"), {
    cliente_id: rogerio.id, processo_id: pConsumidor.id, alerta_dias: 3,
  });
  await ev("Entrega do parecer SaaS", EVENTO.reuniao, hora(6, "16:00"), {
    cliente_id: tech.id, contrato_id: cTech.id,
  });
  await ev("Audiência inicial", EVENTO.audiencia, hora(18, "09:00"), {
    cliente_id: transportes.id, processo_id: pTrab2.id, alerta_dias: 5,
  });
  await ev("Fechamento financeiro do mês", EVENTO.interno, hora(0, "17:00"));
  await ev("Reunião com Helena — inventário de bens", EVENTO.reuniao, hora(-3, "11:00"), {
    cliente_id: helena.id, status: "concluido",
  });
  await ev("Protocolo do cumprimento de sentença", EVENTO.prazo, hora(-8, "18:00"), {
    cliente_id: jose.id, processo_id: pPrev.id, status: "concluido",
  });
}
