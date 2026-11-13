import { describe, it, expect } from 'vitest';
import { ATRIBUTOS, type AtributoId } from '@nave/shared';
import { calcularNota, entradaAntes, entradaDepois, type EntradaNota, type SituacaoAtributo } from '../src/nota';
import { originalCaneca, pesquisaBoa, fichaNovaCaneca } from './fixtures/respostas';

const todos = (s: SituacaoAtributo) => Object.fromEntries(ATRIBUTOS.map((a) => [a.id, s])) as Record<AtributoId, SituacaoAtributo>;
const vazia: EntradaNota = {
  marca: false, sku: false, gtin: false, categoria: false, preco: false, disponibilidade: false,
  atributos: todos('ausente'), titulo: '', tipoProduto: 'caneca', marcaNome: null,
  descricaoOrganizada: false, faqQtd: 0, imagensComAlt: false, jsonldProduto: false, naoVerificavel: [],
};
const completa: EntradaNota = {
  ...vazia, marca: true, sku: true, gtin: true, categoria: true, preco: true, disponibilidade: true,
  atributos: todos('estruturado'), titulo: 'Caneca de cerâmica artesanal 350 ml',
  descricaoOrganizada: true, faqQtd: 3, imagensComAlt: true, jsonldProduto: true,
};

describe('calcularNota', () => {
  it('completa = 100', () => expect(calcularNota(completa).valor).toBe(100));
  it('vazia = 0', () => expect(calcularNota(vazia).valor).toBe(0));
  it('8 atributos só em texto = 16', () => expect(calcularNota({ ...vazia, atributos: todos('texto') })).toMatchObject({ obtidos: 16, possiveis: 100, valor: 16 }));
  it('não se aplica sai do total', () => {
    const n = calcularNota({ ...vazia, atributos: { ...todos('estruturado'), garantia: 'nao_se_aplica' } });
    expect(n).toMatchObject({ obtidos: 35, possiveis: 95, valor: 37 });
  });
  it('entrada por texto: itens não verificáveis saem das duas notas', () => {
    const n = calcularNota({ ...vazia, atributos: todos('estruturado'), titulo: 'Caneca de cerâmica artesanal 350 ml', tipoProduto: 'caneca',
      naoVerificavel: ['marca', 'sku', 'gtin', 'categoria', 'preco', 'disponibilidade', 'alt', 'jsonld'] });
    expect(n).toMatchObject({ obtidos: 45, possiveis: 55, valor: 82 });
    expect(n.itens.find((i) => i.id === 'sku')).toMatchObject({ pontos: 0, maximo: 0, situacao: 'nao_verificavel' });
  });
  it('a confirmar vale zero e aparece como a_confirmar', () => {
    const n = calcularNota({ ...vazia, atributos: { ...todos('ausente'), peso: 'a_confirmar' } });
    expect(n.itens.find((i) => i.id === 'atributo:peso')).toMatchObject({ pontos: 0, maximo: 5, situacao: 'a_confirmar' });
  });
  it.each([['Caneca', 'caneca', 0], ['Caneca de cerâmica artesanal 350 ml', 'caneca', 5], ['Um objeto bonito para a mesa', 'caneca', 0]])(
    'título "%s" vale %i', (titulo, tipoProduto, pts) => expect(calcularNota({ ...vazia, titulo, tipoProduto }).itens.find((i) => i.id === 'titulo')!.pontos).toBe(pts));
  it('tudo fora do total: valor 0 sem dividir por zero', () => {
    const n = calcularNota({ ...vazia, atributos: todos('nao_se_aplica'),
      naoVerificavel: ['marca', 'sku', 'gtin', 'categoria', 'preco', 'disponibilidade', 'titulo', 'descricao', 'faq', 'alt', 'jsonld'] });
    expect(n).toMatchObject({ possiveis: 0, valor: 0 });
  });
  it('antes e depois com o fixture', () => {
    expect(entradaAntes(originalCaneca, pesquisaBoa).atributos.material).toBe('estruturado');
    expect(entradaDepois(originalCaneca, pesquisaBoa, fichaNovaCaneca, {}).atributos.peso).toBe('a_confirmar'); // fichaNovaCaneca pergunta o peso
  });
  it('produto sem imagens: alt vale 0 e conta no total', () => {
    const n = calcularNota(entradaAntes({ ...originalCaneca, imagens: [], naoVerificavel: [] }, pesquisaBoa));
    expect(n.itens.find((i) => i.id === 'alt')).toMatchObject({ pontos: 0, maximo: 5, situacao: 'ausente' });
  });
});
