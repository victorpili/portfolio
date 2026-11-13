import { describe, it, expect } from 'vitest';
import type { Pesquisa } from '@nave/shared';
import {
  conferirPesquisa, corrigirPesquisa, pesquisaVazia, conferirFicha, corrigirFicha, fichaDeReserva,
  itensDaFicha, conferirRevisao, removerReprovados,
} from '../src/imediato';
import { originalCaneca, pesquisaBoa, pesquisaTrechoFalso, fichaNovaCaneca } from './fixtures/respostas';

describe('Imediato', () => {
  it('trecho inexistente gera problema', () => {
    const p = { ...pesquisaBoa, atributos: [...pesquisaBoa.atributos.filter((a) => a.id !== 'material'), { id: 'material' as const, valor: 'aço', trecho: 'aço inox' }] };
    expect(conferirPesquisa(originalCaneca, p)).toContainEqual({ item: 'atributo:material', motivo: 'trecho "aço inox" não está no original' });
  });
  it('pesquisa boa não gera problema', () => expect(conferirPesquisa(originalCaneca, pesquisaBoa)).toEqual([]));
  it('id faltando e duplicado', () => {
    const falta: Pesquisa = { ...pesquisaBoa, lacunas: pesquisaBoa.lacunas.filter((l) => l.id !== 'peso') };
    expect(conferirPesquisa(originalCaneca, falta)).toEqual([{ item: 'atributo:peso', motivo: 'peso não foi classificado' }]);
    const dup: Pesquisa = { ...pesquisaBoa, lacunas: [...pesquisaBoa.lacunas, { id: 'peso', motivo: 'x' }] };
    expect(conferirPesquisa(originalCaneca, dup)).toEqual([{ item: 'atributo:peso', motivo: 'peso aparece mais de uma vez' }]);
  });
  it('corrigirPesquisa move o atributo para lacunas', () => {
    const { pesquisa, problemas } = corrigirPesquisa(originalCaneca, pesquisaTrechoFalso);
    expect(pesquisa.lacunas).toContainEqual({ id: 'material', motivo: 'a confirmar: trecho não encontrado' });
    expect(pesquisa.atributos.map((a) => a.id)).not.toContain('material');
    expect(problemas).toHaveLength(1);
    expect(conferirPesquisa(originalCaneca, pesquisa)).toEqual([]);
  });
  it('corrigirPesquisa preenche id faltando, remove duplicata e não muta', () => {
    const p: Pesquisa = { ...pesquisaBoa, lacunas: [...pesquisaBoa.lacunas.filter((l) => l.id !== 'peso'), { id: 'material', motivo: 'dup' }] };
    const copia = structuredClone(p);
    const { pesquisa } = corrigirPesquisa(originalCaneca, p);
    expect(p).toEqual(copia);
    expect(pesquisa.lacunas.map((l) => l.id)).toContain('peso');
    expect(pesquisa.lacunas.map((l) => l.id)).not.toContain('material');
    expect(conferirPesquisa(originalCaneca, pesquisa)).toEqual([]);
  });
  it('pesquisaVazia tem os 8 ids como lacunas', () => {
    const v = pesquisaVazia();
    expect(v.tipoProduto).toBe('');
    expect(v.lacunas).toHaveLength(8);
    expect(v.lacunas.every((l) => l.motivo === 'resposta fora do formato')).toBe(true);
  });
  it('ficha boa não gera problema', () => expect(conferirFicha(pesquisaBoa, fichaNovaCaneca)).toEqual([]));
  it('conferirFicha: fonte, valor, atributo novo, título e FAQ', () => {
    const n = { ...fichaNovaCaneca, titulo: 'Caneca curta', faq: fichaNovaCaneca.faq.slice(0, 2),
      secoes: [{ ...fichaNovaCaneca.secoes[0], fontes: ['garantia' as const] }], atributos: [{ id: 'peso' as const, rotulo: 'Peso', valor: '300 g' }] };
    const motivos = conferirFicha(pesquisaBoa, n).map((p) => p.motivo);
    expect(motivos).toEqual(expect.arrayContaining(['fonte "garantia" não existe na pesquisa', 'peso não foi encontrado pelo Pesquisador',
      'título com 12 caracteres (precisa de 20 a 150)', 'FAQ com 2 perguntas (precisa de 3 a 6)']));
  });
  it('conferirFicha: valor diferente; atributo novo é problema mesmo listado em aConfirmar', () => {
    const n = { ...fichaNovaCaneca, atributos: [{ id: 'material' as const, rotulo: 'Material ou composição', valor: 'plástico' },
      { id: 'peso' as const, rotulo: 'Peso', valor: '300 g' }], aConfirmar: [{ id: 'peso' as const, pergunta: 'Confirme: Peso' }] };
    expect(conferirFicha(pesquisaBoa, n).map((p) => p.motivo)).toEqual(['valor de material diferente da pesquisa', 'peso não foi encontrado pelo Pesquisador']);
  });
  it('corrigirFicha corrige o que dá', () => {
    const faq = [...fichaNovaCaneca.faq, ...[4, 5, 6, 7].map((i) => ({ ...fichaNovaCaneca.faq[0], id: `f${i}` }))];
    const n = { ...fichaNovaCaneca, titulo: 'curto', faq,
      secoes: [{ ...fichaNovaCaneca.secoes[0], fontes: ['material' as const, 'garantia' as const] }],
      atributos: [...fichaNovaCaneca.atributos, { id: 'peso' as const, rotulo: 'Peso', valor: '300 g' }],
      aConfirmar: fichaNovaCaneca.aConfirmar.filter((a) => a.id !== 'peso') };
    const copia = structuredClone(n);
    const { ficha, problemas } = corrigirFicha(originalCaneca, pesquisaBoa, n);
    expect(n).toEqual(copia);
    expect(problemas.length).toBeGreaterThan(0);
    expect(ficha.titulo).toBe(originalCaneca.titulo);
    expect(ficha.faq).toHaveLength(6);
    expect(ficha.secoes[0].fontes).toEqual(['material']);
    expect(ficha.atributos.map((a) => a.id)).not.toContain('peso');
    expect(ficha.aConfirmar.filter((a) => a.id === 'peso')).toEqual([{ id: 'peso', pergunta: 'Confirme: Peso' }]);
  });
  it('fichaDeReserva usa o original e as lacunas', () => {
    const f = fichaDeReserva(originalCaneca, pesquisaBoa);
    expect(f.titulo).toBe(originalCaneca.titulo);
    expect(f.secoes).toEqual([{ id: 's1', titulo: 'Descrição', texto: originalCaneca.descricaoTexto, fontes: [] }]);
    expect(f.faq).toEqual([]);
    expect(f.atributos.map((a) => a.id)).toEqual(['material', 'dimensoes', 'variacoes', 'uso']);
    expect(f.aConfirmar).toContainEqual({ id: 'garantia', pergunta: 'Confirme: Garantia ou troca' });
  });
  it('itensDaFicha lista título, seções, FAQ e atributos', () => {
    expect(itensDaFicha(fichaNovaCaneca)).toEqual(['titulo', 's1', 's2', 'f1', 'f2', 'f3',
      'atributo:material', 'atributo:dimensoes', 'atributo:variacoes', 'atributo:uso']);
  });
  it('revisão: evidência falsa e item não revisado são reprovados', () => {
    const r = { vereditos: [{ item: 'titulo', veredito: 'sustentado' as const, evidencia: 'feita à mão no Japão', comentario: '' }] };
    const { reprovados, problemas } = conferirRevisao(originalCaneca, fichaNovaCaneca, r);
    expect(reprovados).toEqual(itensDaFicha(fichaNovaCaneca));
    expect(problemas[0]).toEqual({ item: 'titulo', motivo: 'evidência do Revisor não está no original' });
    expect(problemas[1]).toEqual({ item: 's1', motivo: 'item não revisado' });
  });
  it('revisão: veredito ruim, id estranho ignorado, duplo julgamento reprova', () => {
    const itens = itensDaFicha(fichaNovaCaneca);
    const bons = itens.map((item) => ({ item, veredito: 'sustentado' as const, evidencia: 'cerâmica esmaltada', comentario: '' }));
    const r = { vereditos: [...bons, { item: 'inexistente', veredito: 'contradiz' as const, evidencia: null, comentario: 'x' },
      { item: 's2', veredito: 'sem_fonte' as const, evidencia: null, comentario: 'sem base' }] };
    const out = conferirRevisao(originalCaneca, fichaNovaCaneca, r);
    expect(out.reprovados).toEqual(['s2']);
    expect(out.problemas).toEqual([{ item: 's2', motivo: 'Revisor: sem_fonte — sem base' }]);
  });
  it('removerReprovados: título volta ao original, atributo vai para a confirmar', () => {
    const n = removerReprovados(originalCaneca, fichaNovaCaneca, ['titulo', 'atributo:material', fichaNovaCaneca.secoes[1].id]);
    expect(n.titulo).toBe(originalCaneca.titulo);
    expect(n.aConfirmar).toContainEqual({ id: 'material', pergunta: 'Confirme: Material ou composição' });
    expect(n.secoes).toHaveLength(fichaNovaCaneca.secoes.length - 1);
    expect(n.atributos.map((a) => a.id)).not.toContain('material');
  });
});

describe('Imediato: atributo inventado listado em aConfirmar', () => {
  it('corrigirFicha tira de atributos e não duplica em aConfirmar', () => {
    const n = { ...fichaNovaCaneca, atributos: [...fichaNovaCaneca.atributos, { id: 'peso' as const, rotulo: 'Peso', valor: '300 g' }] };
    const { ficha } = corrigirFicha(originalCaneca, pesquisaBoa, n);
    expect(ficha.atributos.map((a) => a.id)).not.toContain('peso');
    expect(ficha.aConfirmar.filter((a) => a.id === 'peso')).toHaveLength(1);
  });
});

describe('Imediato: ids de item repetidos ou reservados', () => {
  it('FAQs com o mesmo id são acusadas', () => {
    const n = { ...fichaNovaCaneca, faq: fichaNovaCaneca.faq.map((f) => ({ ...f, id: f.id === 'f3' ? 'f2' : f.id })) };
    expect(conferirFicha(pesquisaBoa, n)).toContainEqual({ item: 'f2', motivo: 'f2 aparece mais de uma vez' });
  });
  it('seção com id reservado é acusada', () => {
    const n = { ...fichaNovaCaneca, secoes: [{ ...fichaNovaCaneca.secoes[0], id: 'titulo' }, fichaNovaCaneca.secoes[1]] };
    expect(conferirFicha(pesquisaBoa, n)).toContainEqual({ item: 'titulo', motivo: 'titulo é um nome reservado' });
  });
  it('corrigirFicha renumera e a ficha corrigida não acusa id repetido', () => {
    const n = { ...fichaNovaCaneca,
      secoes: [{ ...fichaNovaCaneca.secoes[0], id: 'f1' }, { ...fichaNovaCaneca.secoes[1], id: 'f1' }],
      faq: fichaNovaCaneca.faq.map((f) => ({ ...f, id: 'f2' })) };
    const { ficha } = corrigirFicha(originalCaneca, pesquisaBoa, n);
    expect(ficha.secoes.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(ficha.faq.map((f) => f.id)).toEqual(['f1', 'f2', 'f3']);
    expect(conferirFicha(pesquisaBoa, ficha)).toEqual([]);
  });
});
