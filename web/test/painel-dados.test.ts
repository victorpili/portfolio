import { describe, expect, it } from 'vitest';
import type { ItemNota, Nota, Resultado } from '@nave/shared';
import { agruparChecklist, descreverBastidores, fraseAConfirmar, jsonLdParaCopiar, nomeDoArquivo, nomeDoModelo } from '../src/painel-dados';
import missao from '../src/dev/missao-exemplo.json';

const item = (p: Partial<ItemNota> & Pick<ItemNota, 'id' | 'grupo'>): ItemNota =>
  ({ rotulo: p.id, pontos: 5, maximo: 5, situacao: 'ok', ...p }) as ItemNota;
const nota = (itens: ItemNota[]): Nota => ({ valor: 0, obtidos: 0, possiveis: 0, itens });

describe('nomeDoArquivo', () => {
  it('slug do título, sem acentos', () => {
    expect(nomeDoArquivo('Caneca Barro 350 ml')).toBe('nave-caneca-barro-350-ml.json');
    expect(nomeDoArquivo('  Água & Sabão — Edição 2!  ')).toBe('nave-agua-sabao-edicao-2.json');
  });

  it('título sem letras nem números: nome padrão', () => {
    expect(nomeDoArquivo('!!! ???')).toBe('nave-ficha.json');
    expect(nomeDoArquivo('')).toBe('nave-ficha.json');
  });

  it('título longo: corta em 60 caracteres, sem hífen no fim', () => {
    const nome = nomeDoArquivo(`${'a'.repeat(59)} bbbb`);
    expect(nome).toBe(`nave-${'a'.repeat(59)}.json`);
    expect(nomeDoArquivo('x'.repeat(200))).toBe(`nave-${'x'.repeat(60)}.json`);
  });
});

describe('agruparChecklist', () => {
  it('agrupa na ordem fixa dos grupos, com rótulos legíveis e antes/depois lado a lado', () => {
    const antes = nota([
      item({ id: 'titulo', grupo: 'conteudo', pontos: 0, situacao: 'ausente' }),
      item({ id: 'marca', grupo: 'identificacao' }),
      item({ id: 'atributo:peso', grupo: 'atributos', pontos: 2, situacao: 'parcial' }),
      item({ id: 'jsonld', grupo: 'dados_estruturados', pontos: 0, maximo: 0, situacao: 'nao_verificavel' }),
    ]);
    const depois = nota([
      item({ id: 'titulo', grupo: 'conteudo' }),
      item({ id: 'marca', grupo: 'identificacao' }),
      item({ id: 'atributo:peso', grupo: 'atributos', pontos: 0, situacao: 'a_confirmar' }),
      item({ id: 'jsonld', grupo: 'dados_estruturados', pontos: 0, maximo: 0, situacao: 'nao_verificavel' }),
    ]);
    const grupos = agruparChecklist(antes, depois);
    expect(grupos.map((g) => g.rotulo)).toEqual(['Identificação', 'Atributos', 'Conteúdo', 'Dados estruturados']);
    const atributos = grupos[1]!;
    expect(atributos.linhas).toHaveLength(1);
    expect(atributos.linhas[0]!.antes!.situacao).toBe('parcial');
    expect(atributos.linhas[0]!.depois!.situacao).toBe('a_confirmar');
    expect(atributos.antes).toEqual({ pontos: 2, maximo: 5 });
    expect(atributos.depois).toEqual({ pontos: 0, maximo: 5 });
    expect(grupos[3]!.depois).toEqual({ pontos: 0, maximo: 0 });
  });

  it('item que só existe de um lado aparece com o outro lado vazio', () => {
    const grupos = agruparChecklist(nota([]), nota([item({ id: 'faq', grupo: 'conteudo' })]));
    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.linhas[0]).toMatchObject({ id: 'faq', antes: null });
  });

  it('a missão de exemplo: 5 grupos, 19 itens, somas batem com as notas', () => {
    const r = (missao.eventos.at(-1) as unknown as { resultado: Resultado }).resultado;
    const grupos = agruparChecklist(r.notaAntes, r.notaDepois);
    expect(grupos.map((g) => g.grupo)).toEqual(['identificacao', 'oferta', 'atributos', 'conteudo', 'dados_estruturados']);
    expect(grupos.flatMap((g) => g.linhas)).toHaveLength(19);
    expect(grupos.reduce((s, g) => s + g.antes.pontos, 0)).toBe(r.notaAntes.obtidos);
    expect(grupos.reduce((s, g) => s + g.depois.pontos, 0)).toBe(r.notaDepois.obtidos);
    expect(grupos.reduce((s, g) => s + g.depois.maximo, 0)).toBe(r.notaDepois.possiveis);
  });
});

describe('nomeDoModelo', () => {
  it('nomes legíveis', () => {
    expect(nomeDoModelo('claude-opus-5-5')).toBe('Claude Opus 5.5');
    expect(nomeDoModelo('claude-sonnet-5-5')).toBe('Claude Sonnet 5.5');
    expect(nomeDoModelo('falso')).toBe('motor falso');
    expect(nomeDoModelo('outro-modelo')).toBe('outro-modelo');
    expect(nomeDoModelo('sonnet')).toBe('Claude Sonnet');
    expect(nomeDoModelo('opus')).toBe('Claude Opus');
  });
});

describe('descreverBastidores', () => {
  const base = { motor: 'falso', devolucoes: 1, chamadas: [{}, {}, {}, {}], duracaoMs: 25_260, custoUsd: 0, modelo: 'falso' };
  const bastidores = (r: object) => descreverBastidores(r as unknown as Resultado);

  it('motor falso: itens com rótulo e sem custo', () => {
    expect(bastidores(base)).toEqual([
      { rotulo: 'devoluções do Imediato', valor: '1' },
      { rotulo: 'chamadas ao motor', valor: '4' },
      { rotulo: 'duração', valor: '25 s' },
      { rotulo: 'motor', valor: 'falso (sem IA)' },
    ]);
  });

  it('API: custo aproximado do modelo, com a dica de que não inclui as tentativas que falharam', () => {
    const r = { ...base, motor: 'api', devolucoes: 0, chamadas: [{}], duracaoMs: 125_400, custoUsd: 0.3149, modelo: 'claude-opus-5-5' };
    expect(bastidores(r)).toEqual([
      { rotulo: 'devoluções do Imediato', valor: 'nenhuma' },
      { rotulo: 'chamadas ao modelo', valor: '1' },
      { rotulo: 'duração', valor: '2 min 05 s' },
      { rotulo: 'custo do modelo', valor: '≈ US$ 0,31', dica: 'não inclui tentativas que falharam' },
      { rotulo: 'modelo', valor: 'Claude Opus 5.5' },
    ]);
    expect(bastidores({ ...r, custoUsd: 0.004 })[3]!.valor).toBe('menos de US$ 0,01');
  });

  it('assinatura: custo coberto pela assinatura, não medido', () => {
    const r = { ...base, motor: 'assinatura', devolucoes: 2, custoUsd: 0, modelo: 'sonnet' };
    expect(bastidores(r).slice(3)).toEqual([
      { rotulo: 'custo', valor: 'coberto pela assinatura (não medido)' },
      { rotulo: 'modelo', valor: 'Claude Sonnet' },
    ]);
    expect(bastidores(r)[0]).toEqual({ rotulo: 'devoluções do Imediato', valor: '2' });
  });
});

describe('fraseAConfirmar', () => {
  it('nenhum, um e vários itens a confirmar', () => {
    expect(fraseAConfirmar(0)).toBe('.');
    expect(fraseAConfirmar(1)).toBe(': o item a confirmar vale zero até o lojista responder.');
    expect(fraseAConfirmar(4)).toBe(': os 4 itens a confirmar valem zero até o lojista responder.');
  });
});

describe('jsonLdParaCopiar', () => {
  /** Os seis caracteres do escape, não o "<". */
  const ESCAPE = '\\u003c';

  it('troca "<" pelo escape unicode: não fecha o <script> da página do lojista e continua sendo o mesmo JSON', () => {
    const jsonld = { '@type': 'Product', name: 'Caneca </script><script>alert(1)</script>', description: 'a < b <!-- x -->' };
    const texto = jsonLdParaCopiar(jsonld);
    expect(ESCAPE).toHaveLength(6);
    expect(texto).not.toContain('<');
    expect(texto).toContain(`Caneca ${ESCAPE}/script>${ESCAPE}script>alert(1)${ESCAPE}/script>`);
    expect(texto).toContain(`a ${ESCAPE} b ${ESCAPE}!-- x -->`);
    expect(JSON.parse(texto)).toEqual(jsonld);
  });

  it('sem "<", é o JSON indentado de sempre', () => {
    const jsonld = { '@type': 'Product', name: 'Caneca' };
    expect(jsonLdParaCopiar(jsonld)).toBe(JSON.stringify(jsonld, null, 2));
  });
});
