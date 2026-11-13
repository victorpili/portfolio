import { it, expect } from 'vitest';
import { ATRIBUTOS, Pesquisa, Revisao } from '../src';

it('lista fixa tem os 8 atributos na ordem do desenho', () => {
  expect(ATRIBUTOS.map((a) => a.id)).toEqual(['material', 'dimensoes', 'peso', 'variacoes', 'uso', 'publico', 'cuidados', 'garantia']);
});
it('Pesquisa recusa id fora da lista', () => {
  const r = Pesquisa.safeParse({ tipoProduto: 'caneca', atributos: [{ id: 'cor', valor: 'azul', trecho: 'azul' }], lacunas: [], naoSeAplica: [] });
  expect(r.success).toBe(false);
});
it('Revisao aceita evidencia nula em sem_fonte', () => {
  expect(Revisao.safeParse({ vereditos: [{ item: 'titulo', veredito: 'sem_fonte', evidencia: null, comentario: 'x' }] }).success).toBe(true);
});
