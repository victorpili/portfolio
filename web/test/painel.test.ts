import { describe, expect, it } from 'vitest';
import type { ItemNota, Nota, Resultado } from '@nave/shared';
import { agruparChecklist, descreverBastidores, nomeDoArquivo, nomeDoModelo } from '../src/componentes/Painel';
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
  const base = { devolucoes: 1, chamadas: [{}, {}, {}, {}], duracaoMs: 25_260, custoUsd: 0, modelo: 'falso' };

  it('devoluções, chamadas, duração, custo e modelo', () => {
    expect(descreverBastidores(base as unknown as Resultado)).toEqual([
      '1 devolução do Imediato', '4 chamadas ao modelo', '25 s', 'US$ 0,00', 'motor falso',
    ]);
  });

  it('plural, minutos e custo pequeno', () => {
    const r = { ...base, devolucoes: 0, chamadas: [{}], duracaoMs: 125_400, custoUsd: 0.004, modelo: 'claude-opus-5-5' };
    expect(descreverBastidores(r as unknown as Resultado)).toEqual([
      'nenhuma devolução', '1 chamada ao modelo', '2 min 05 s', 'menos de US$ 0,01', 'Claude Opus 5.5',
    ]);
    const r2 = { ...base, devolucoes: 2, custoUsd: 0.3149 };
    expect(descreverBastidores(r2 as unknown as Resultado).slice(0, 4)).toEqual([
      '2 devoluções do Imediato', '4 chamadas ao modelo', '25 s', 'US$ 0,31',
    ]);
  });
});
