import { describe, it, expect, vi } from 'vitest';
import type { Evento, FichaNova } from '@nave/shared';
import type { Prompts } from '../src/agentes';
import { executarMissao, type DepsMissao } from '../src/capita';
import { motorFalso } from '../src/motores/falso';
import { ErroMotor, ErroSemCredito, type Chamada, type Motor, type NomeAgente, type RespostaMotor } from '../src/motores/motor';
import { ErroEntrada } from '../src/shopify';
import {
  fichaComFonteFalsa, fichaNovaCaneca, originalCaneca, pesquisaBoa, pesquisaTrechoFalso, revisaoAprova, revisaoReprovaSecao2,
} from './fixtures/respostas';

const prompts: Prompts = { pesquisador: 'P', redator: 'R', revisor: 'V' };
const entrada = { url: 'https://l.com/products/x' };
const lerFalso = async () => originalCaneca;

/** Roda a missão com o motor falso e a leitura falsa; `extra` troca qualquer dependência. */
async function rodar(roteiro: Partial<Record<NomeAgente, unknown[]>>, extra: Partial<DepsMissao> = {}) {
  const m = motorFalso(roteiro);
  const ev: Evento[] = [];
  const aoErro = vi.fn();
  const r = await executarMissao(entrada, { motor: m, prompts, lerProduto: lerFalso, aoErro, ...extra }, (e) => ev.push(e));
  return { m, ev, r, aoErro };
}

/** `tipo:agente` de cada evento, para conferir a ordem da missão. */
const passos = (ev: Evento[]) => ev.map((e) => ('agente' in e ? `${e.tipo}:${e.agente}` : e.tipo));
const doTipo = <T extends Evento['tipo']>(ev: Evento[], tipo: T) => ev.filter((e): e is Evento & { tipo: T } => e.tipo === tipo);

/** Motor que só termina quando o sinal da chamada aborta, e então lança `ErroMotor`, como a API real. */
function motorPreso(aoChamar: () => void = () => {}): Motor & { chamadas: Chamada<unknown>[] } {
  const chamadas: Chamada<unknown>[] = [];
  return {
    nome: 'falso', modelo: 'falso', chamadas,
    chamar: <T>(c: Chamada<T>) => new Promise<RespostaMotor<T>>((_, rejeitar) => {
      chamadas.push(c);
      c.sinal!.addEventListener('abort', () => rejeitar(new ErroMotor('cancelado')));
      aoChamar();
    }),
  };
}

/** Motor falso que cobra US$ 0,01 e 150 tokens por chamada que volta. */
function comCusto(m: Motor): Motor {
  return {
    ...m,
    async chamar<T>(c: Chamada<T>): Promise<RespostaMotor<T>> {
      const r = await m.chamar(c);
      return { ...r, tokensEntrada: 100, tokensSaida: 50, custoUsd: 0.01, ms: 5 };
    },
  };
}

const fichaSecao2Corrigida: FichaNova = {
  ...fichaNovaCaneca,
  secoes: fichaNovaCaneca.secoes.map((s) => (s.id === 's2' ? { ...s, texto: 'Ideal para café coado. Vem nas cores azul e verde.' } : s)),
};

describe('executarMissao', () => {
  it('caminho feliz: 3 chamadas, notas, conclusão', async () => {
    const m = motorFalso({ pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [revisaoAprova] });
    const ev: Evento[] = [];
    const aoErro = vi.fn();
    const r = await executarMissao({ url: 'https://l.com/products/x' }, { motor: m, prompts, lerProduto: lerFalso, aoErro }, (e) => ev.push(e));
    expect(aoErro).not.toHaveBeenCalled();
    expect(m.chamadas).toHaveLength(3);
    expect(ev.map((e) => e.tipo)).toEqual(expect.arrayContaining(['missao_iniciada', 'nota', 'missao_concluida']));
    expect(ev.map((e) => e.seq)).toEqual(ev.map((_, i) => i + 1));
    expect(r!.devolucoes).toBe(0);
    expect(r!.notaDepois.valor).toBeGreaterThan(r!.notaAntes.valor);
  });

  it('caminho feliz: ordem completa dos eventos e mensagens', async () => {
    const { ev, r } = await rodar({ pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [revisaoAprova] });
    const ciclo = (a: string) => ['convocado', 'trabalhando', 'entregou'].map((t) => `agente_${t}:${a}`)
      .concat([`imediato_conferindo:${a}`, `imediato_aprovou:${a}`, `agente_dispensado:${a}`]);
    expect(passos(ev)).toEqual([
      'missao_iniciada', 'agente_convocado:capita', 'agente_convocado:imediato',
      ...ciclo('pesquisador'), 'nota', ...ciclo('redator'), ...ciclo('revisor'), 'nota',
      'agente_dispensado:capita', 'agente_dispensado:imediato', 'missao_concluida',
    ]);
    expect(ev[0].mensagem).toBe('Capitã: missão recebida.');
    expect(ev.filter((e) => e.tipo === 'agente_convocado').map((e) => 'sala' in e && e.sala))
      .toEqual(['ponte', 'ponte', 'pesquisa', 'criacao', 'qualidade']);
    expect(ev.find((e) => e.tipo === 'agente_entregou')!.mensagem).toBe('Pesquisador: 4 atributos, 4 lacunas.');
    const [antes, depois] = doTipo(ev, 'nota');
    expect(antes).toMatchObject({ qual: 'antes', nota: r!.notaAntes, mensagem: `Capitã: nota antes ${r!.notaAntes.valor}/100.` });
    expect(depois).toMatchObject({ qual: 'depois', nota: r!.notaDepois });
    expect(ev.at(-1)).toMatchObject({
      tipo: 'missao_concluida', resultado: r, mensagem: `Capitã: missão concluída. Nota ${r!.notaAntes.valor} → ${r!.notaDepois.valor}.`,
    });
    for (const e of ev) expect(e.mensagem).toMatch(/^(Capitã|Imediato|Pesquisador|Redator|Revisor): \S/);
  });

  it('resultado: ficha, JSON-LD, alts, motor e tempo', async () => {
    const agora = vi.fn().mockReturnValueOnce(1000).mockReturnValue(1250);
    const { ev, r } = await rodar({ pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [revisaoAprova] }, { agora });
    expect(r).toMatchObject({
      original: originalCaneca, pesquisa: pesquisaBoa, fichaNova: fichaNovaCaneca, aConfirmar: fichaNovaCaneca.aConfirmar,
      imagens: [{ src: 'https://loja.com/cdn/caneca-barro.jpg', alt: fichaNovaCaneca.titulo }],
      motor: 'falso', modelo: 'falso', duracaoMs: 250,
    });
    expect(r!.jsonld).toMatchObject({ '@type': 'Product', name: fichaNovaCaneca.titulo, sku: 'CB-350-AZ' });
    expect(ev.every((e) => e.t === 250)).toBe(true);
  });

  it('cada chamada recebe o sinal da missão; aoPrimeiraChamada roda uma vez, antes da primeira', async () => {
    let chamadasNaHora = -1;
    const m = motorFalso({ pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [revisaoAprova] });
    const aoPrimeira = vi.fn(() => { chamadasNaHora = m.chamadas.length; });
    await executarMissao(entrada, { motor: m, prompts, lerProduto: lerFalso, aoPrimeiraChamada: aoPrimeira, aoErro: vi.fn() }, () => {});
    expect(aoPrimeira).toHaveBeenCalledTimes(1);
    expect(chamadasNaHora).toBe(0);
    expect(m.chamadas.every((c) => c.sinal instanceof AbortSignal && !c.sinal.aborted)).toBe(true);
  });

  it('devolve o Pesquisador uma vez', async () => {
    const m = motorFalso({ pesquisador: [pesquisaTrechoFalso, pesquisaBoa], redator: [fichaNovaCaneca], revisor: [revisaoAprova] });
    const ev: Evento[] = [];
    const r = await executarMissao(entrada, { motor: comCusto(m), prompts, lerProduto: lerFalso, aoErro: vi.fn() }, (e) => ev.push(e));
    expect(m.chamadas.filter((c) => c.agente === 'pesquisador')).toHaveLength(2);
    expect(doTipo(ev, 'imediato_devolveu')).toEqual([expect.objectContaining({
      agente: 'pesquisador', problemas: [{ item: 'atributo:material', motivo: 'trecho "aço inox" não está no original' }],
      mensagem: 'Imediato: trecho "aço inox" não está no original. Devolvido ao Pesquisador.',
    })]);
    expect(doTipo(ev, 'agente_trabalhando').filter((e) => e.agente === 'pesquisador').map((e) => e.tentativa)).toEqual([1, 2]);
    expect(m.chamadas[1].mensagens).toHaveLength(3);
    expect(m.chamadas[1].mensagens[2].texto).toContain('aço inox');
    expect(r!.devolucoes).toBe(1);
    expect(r!.pesquisa).toEqual(pesquisaBoa);
    expect(r!.chamadas.map((c) => `${c.agente}${c.tentativa}`)).toEqual(['pesquisador1', 'pesquisador2', 'redator1', 'revisor1']);
    expect(r!.chamadas[0]).toEqual({ agente: 'pesquisador', tentativa: 1, tokensEntrada: 100, tokensSaida: 50, custoUsd: 0.01, ms: 5 });
    expect(r!.custoUsd).toBeCloseTo(0.04);
  });

  it('orçamento: segunda falha do Pesquisador é corrigida pelo código', async () => {
    const { m, ev, r } = await rodar({
      pesquisador: [pesquisaTrechoFalso, pesquisaTrechoFalso], redator: [fichaNovaCaneca, fichaNovaCaneca], revisor: [revisaoAprova],
    });
    expect(m.chamadas.filter((c) => c.agente === 'pesquisador')).toHaveLength(2);
    expect(doTipo(ev, 'imediato_corrigiu').find((e) => e.agente === 'pesquisador')).toMatchObject({
      problemas: [{ item: 'atributo:material', motivo: 'trecho "aço inox" não está no original' }],
    });
    expect(r!.pesquisa.lacunas.map((l) => l.id)).toContain('material');
    expect(r!.pesquisa.atributos.map((a) => a.id)).not.toContain('material');
  });

  it('Revisor reprova: Redator refaz e Revisor confere de novo (5 chamadas)', async () => {
    const { m, ev, r } = await rodar({
      pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca, fichaSecao2Corrigida], revisor: [revisaoReprovaSecao2, revisaoAprova],
    });
    expect(m.chamadas.map((c) => c.agente)).toEqual(['pesquisador', 'redator', 'revisor', 'redator', 'revisor']);
    const p = passos(ev);
    expect(p.slice(p.indexOf('agente_convocado:revisor'), p.lastIndexOf('agente_dispensado:revisor') + 1)).toEqual([
      'agente_convocado:revisor', 'agente_trabalhando:revisor', 'agente_entregou:revisor', 'imediato_conferindo:revisor',
      'imediato_devolveu:redator',
      'agente_convocado:redator', 'agente_trabalhando:redator', 'agente_entregou:redator', 'imediato_conferindo:redator',
      'imediato_aprovou:redator', 'agente_dispensado:redator',
      'agente_trabalhando:revisor', 'agente_entregou:revisor', 'imediato_conferindo:revisor', 'imediato_aprovou:revisor',
      'agente_dispensado:revisor',
    ]);
    expect(doTipo(ev, 'agente_trabalhando').map((e) => `${e.agente}${e.tentativa}`))
      .toEqual(['pesquisador1', 'redator1', 'revisor1', 'redator2', 'revisor2']);
    expect(doTipo(ev, 'imediato_devolveu')[0]).toMatchObject({
      problemas: [{ item: 's2', motivo: 'Revisor: sem_fonte — a ficha não diz que as duas cores estão disponíveis' }],
      mensagem: 'Imediato: o Revisor reprovou s2. Devolvido ao Redator.',
    });
    const refazer = m.chamadas[3].mensagens;
    expect(refazer).toHaveLength(3);
    expect(JSON.parse(refazer[1].texto)).toEqual(fichaNovaCaneca);
    expect(refazer[2].texto).toContain('- s2: Revisor: sem_fonte');
    expect(r!.fichaNova).toEqual(fichaSecao2Corrigida);
    expect(r!.devolucoes).toBe(1);
  });

  it('Redator sem tentativa: reprovado é removido pelo código (4 chamadas)', async () => {
    const { m, ev, r } = await rodar({ pesquisador: [pesquisaBoa], redator: [fichaComFonteFalsa, fichaNovaCaneca], revisor: [revisaoReprovaSecao2] });
    expect(m.chamadas).toHaveLength(4);
    expect(doTipo(ev, 'imediato_corrigiu')).toEqual([expect.objectContaining({
      agente: 'redator', problemas: [{ item: 's2', motivo: 'Revisor: sem_fonte — a ficha não diz que as duas cores estão disponíveis' }],
    })]);
    expect(r!.fichaNova.secoes.map((s) => s.id)).toEqual(['s1']);
    expect(r!.devolucoes).toBe(1);
    expect(passos(ev).slice(-6)).toEqual([
      'imediato_corrigiu:redator', 'agente_dispensado:revisor', 'nota', 'agente_dispensado:capita', 'agente_dispensado:imediato', 'missao_concluida',
    ]);
  });

  it('Revisor fora do formato duas vezes: sai da ficha tudo, e os atributos ficam a confirmar', async () => {
    const { m, ev, r } = await rodar({ pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [{}, {}] });
    expect(m.chamadas.map((c) => c.agente)).toEqual(['pesquisador', 'redator', 'revisor', 'revisor']);
    expect(doTipo(ev, 'imediato_devolveu')).toEqual([expect.objectContaining({
      agente: 'revisor', problemas: [{ item: 'resposta', motivo: 'resposta fora do formato' }],
    })]);
    expect(doTipo(ev, 'imediato_corrigiu')[0].problemas.map((x) => x.item)).toEqual([
      'titulo', 's1', 's2', 'f1', 'f2', 'f3', 'atributo:material', 'atributo:dimensoes', 'atributo:variacoes', 'atributo:uso',
    ]);
    expect(r!.fichaNova).toMatchObject({ titulo: originalCaneca.titulo, secoes: [], faq: [], atributos: [] });
    expect(r!.fichaNova.aConfirmar).toEqual([
      ...fichaNovaCaneca.aConfirmar,
      { id: 'material', pergunta: 'Confirme: Material ou composição' },
      { id: 'dimensoes', pergunta: 'Confirme: Dimensões' },
      { id: 'variacoes', pergunta: 'Confirme: Variações (cores e tamanhos)' },
      { id: 'uso', pergunta: 'Confirme: Uso' },
    ]);
    // Sem julgamento do Revisor, nenhum atributo conta como fato: nem na nota depois, nem no JSON-LD.
    const atributosDepois = r!.notaDepois.itens.filter((i) => i.grupo === 'atributos');
    expect(atributosDepois.map((i) => i.situacao)).toEqual(Array(8).fill('a_confirmar'));
    expect(r!.jsonld).not.toHaveProperty('additionalProperty');
    expect(r!.chamadas.map((c) => c.agente)).toEqual(['pesquisador', 'redator']);
  });

  it('Revisor sem tentativa para julgar a ficha refeita: o Redator não refaz, o código remove', async () => {
    const { m, ev, r } = await rodar({ pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [{}, revisaoReprovaSecao2] });
    expect(m.chamadas.map((c) => c.agente)).toEqual(['pesquisador', 'redator', 'revisor', 'revisor']);
    expect(doTipo(ev, 'imediato_devolveu').map((e) => e.agente)).toEqual(['revisor']);
    expect(doTipo(ev, 'imediato_corrigiu')).toEqual([expect.objectContaining({ agente: 'redator' })]);
    expect(r!.fichaNova.secoes.map((s) => s.id)).toEqual(['s1']);
  });

  it('Redator fora do formato ao refazer: fica a ficha anterior sem o reprovado, e o Revisor a julga', async () => {
    const { m, ev, r } = await rodar({
      pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca, {}], revisor: [revisaoReprovaSecao2, revisaoAprova],
    });
    expect(m.chamadas.map((c) => c.agente)).toEqual(['pesquisador', 'redator', 'revisor', 'redator', 'revisor']);
    expect(doTipo(ev, 'imediato_corrigiu')).toEqual([expect.objectContaining({
      agente: 'redator', problemas: [{ item: 'resposta', motivo: 'resposta fora do formato' }],
    })]);
    expect(r!.fichaNova).toEqual({ ...fichaNovaCaneca, secoes: [fichaNovaCaneca.secoes[0]] });
    expect(JSON.parse(m.chamadas[4].mensagens[0].texto.match(/<ficha_nova>\n([\s\S]*?)\n<\/ficha_nova>/)![1]).secoes).toHaveLength(1);
  });

  it('sem crédito: erro sem_credito e null', async () => {
    const { ev, r, aoErro } = await rodar({ pesquisador: [new ErroSemCredito('x')] });
    expect(r).toBeNull();
    expect(ev.at(-1)).toMatchObject({ tipo: 'erro', codigo: 'sem_credito', recuperavel: false, sugestao: 'Veja uma missão gravada.' });
    expect(aoErro).not.toHaveBeenCalled();
  });

  it('API fora: erro api_fora com a mensagem da API, e a causa vai para aoErro', async () => {
    const caiu = new ErroMotor('claude -p saiu com código 1: x');
    const { ev, r, aoErro } = await rodar({ pesquisador: [pesquisaBoa], redator: [caiu] });
    expect(r).toBeNull();
    expect(ev.at(-1)).toMatchObject({
      tipo: 'erro', codigo: 'api_fora', recuperavel: true, mensagem: 'Capitã: a API do Claude não respondeu. A missão parou.',
    });
    expect(ev.filter((e) => e.tipo === 'erro')).toHaveLength(1);
    expect(aoErro.mock.calls).toEqual([[caiu]]);
  });

  it('erro inesperado: api_fora com mensagem genérica, e a causa vai para aoErro', async () => {
    const bug = new TypeError('x');
    const { ev, r, aoErro } = await rodar({}, { lerProduto: async () => { throw bug; } });
    expect(r).toBeNull();
    expect(ev.at(-1)).toMatchObject({ tipo: 'erro', codigo: 'api_fora', recuperavel: true, mensagem: 'Capitã: algo deu errado na missão.' });
    expect(aoErro.mock.calls).toEqual([[bug]]);
  });

  it('emitir falhando: nunca lança, e as duas falhas vão para aoErro', async () => {
    const quebrou = new Error('conexão fechada');
    const aoErro = vi.fn();
    const r = await executarMissao(entrada, { motor: motorFalso({}), prompts, lerProduto: lerFalso, aoErro }, () => { throw quebrou; });
    expect(r).toBeNull();
    expect(aoErro.mock.calls).toEqual([[quebrou], [quebrou]]);
  });

  it('loja bloqueou: erro recuperável, nenhuma chamada, cota não confirmada', async () => {
    const ev: Evento[] = [];
    const aoPrimeira = vi.fn(); const m = motorFalso({}); const aoErro = vi.fn();
    await executarMissao({ url: 'https://l.com/products/x' }, { motor: m, prompts, aoPrimeiraChamada: aoPrimeira, aoErro,
      lerProduto: async () => { throw new ErroEntrada('loja_bloqueou', 'x'); } }, (e) => ev.push(e));
    expect(ev.at(-1)).toMatchObject({ tipo: 'erro', codigo: 'loja_bloqueou', recuperavel: true, sugestao: 'Cole o texto da ficha.' });
    expect(m.chamadas).toHaveLength(0); expect(aoPrimeira).not.toHaveBeenCalled();
    expect(aoErro).not.toHaveBeenCalled();
  });

  it.each([
    ['produto_nao_encontrado', 'Cole o texto da ficha.'],
    ['url_invalida', 'Confira a URL do produto.'],
  ] as const)('%s: sugestão "%s"', async (codigo, sugestao) => {
    const { ev, r } = await rodar({}, { lerProduto: async () => { throw new ErroEntrada(codigo, 'x'); } });
    expect(r).toBeNull();
    expect(ev.at(-1)).toMatchObject({ tipo: 'erro', codigo, recuperavel: true, sugestao });
  });

  it('texto colado curto demais: texto_invalido', async () => {
    const ev: Evento[] = [];
    const aoErro = vi.fn();
    const r = await executarMissao({ texto: 'curto' }, { motor: motorFalso({}), prompts, aoErro }, (e) => ev.push(e));
    expect(r).toBeNull();
    expect(ev.at(-1)).toMatchObject({ tipo: 'erro', codigo: 'texto_invalido', recuperavel: true });
    expect(aoErro).not.toHaveBeenCalled();
  });

  it('cliente saiu: para antes da próxima chamada', async () => {
    const ac = new AbortController();
    const m = motorFalso({ pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [revisaoAprova] });
    const ev: Evento[] = [];
    const aoErro = vi.fn();
    const r = await executarMissao(entrada, { motor: m, prompts, lerProduto: lerFalso, sinal: ac.signal, aoErro }, (e) => {
      ev.push(e);
      if (e.tipo === 'agente_entregou' && e.agente === 'pesquisador') ac.abort();
    });
    expect(m.chamadas).toHaveLength(1);
    expect(m.chamadas[0].sinal!.aborted).toBe(true);
    expect(r).toBeNull();
    expect(ev.some((e) => e.tipo === 'erro')).toBe(false);
    expect(aoErro).not.toHaveBeenCalled();
  });

  it('cliente saiu durante a chamada: a chamada é interrompida, null e nenhum evento de erro', async () => {
    const ac = new AbortController();
    const m = motorPreso(() => queueMicrotask(() => ac.abort()));
    const ev: Evento[] = [];
    const aoErro = vi.fn();
    const r = await executarMissao(entrada, { motor: m, prompts, lerProduto: lerFalso, sinal: ac.signal, aoErro }, (e) => ev.push(e));
    expect(r).toBeNull();
    expect(m.chamadas).toHaveLength(1);
    expect(ev.at(-1)).toMatchObject({ tipo: 'agente_trabalhando', agente: 'pesquisador' });
    expect(aoErro).not.toHaveBeenCalled();
  });

  it('prazo estourado no meio da chamada: tempo_esgotado, não api_fora', async () => {
    const ev: Evento[] = [];
    const aoErro = vi.fn();
    const r = await executarMissao(entrada, { motor: motorPreso(), prompts, lerProduto: lerFalso, prazoMs: 20, aoErro }, (e) => ev.push(e));
    expect(r).toBeNull();
    expect(ev.at(-1)).toMatchObject({ tipo: 'erro', codigo: 'tempo_esgotado', recuperavel: true });
    expect(aoErro).not.toHaveBeenCalled();
  });

  it('Redator fora do formato duas vezes: usa a ficha de reserva', async () => {
    const { m, r } = await rodar({ pesquisador: [pesquisaBoa], redator: [{}, {}], revisor: [revisaoAprova] });
    expect(r!.fichaNova.titulo).toBe(originalCaneca.titulo);
    expect(m.chamadas[2].mensagens).toHaveLength(2);
    expect(m.chamadas[2].mensagens[1].texto).toContain('- resposta: resposta fora do formato');
    expect(r!.chamadas.map((c) => c.agente)).toEqual(['pesquisador', 'revisor']);
  });

  it('ficha truncada emite aviso', async () => {
    const { ev } = await rodar(
      { pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [revisaoAprova] },
      { lerProduto: async () => ({ ...originalCaneca, truncada: true }) },
    );
    expect(doTipo(ev, 'aviso')).toEqual([expect.objectContaining({
      mensagem: 'Capitã: ficha longa; cortei os campos que passavam do limite.',
    })]);
  });
});
