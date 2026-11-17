import { describe, expect, it } from 'vitest';
import { descreverAgente } from '../src/componentes/Agente';

describe('descreverAgente (texto para leitor de tela)', () => {
  it('usa a preposição da sala', () => {
    expect(descreverAgente('revisor', { sala: 'dormitorio', atividade: 'dormindo', balao: null }, false))
      .toBe('Revisor: dormindo no Dormitório');
    expect(descreverAgente('pesquisador', { sala: 'pesquisa', atividade: 'trabalhando', balao: 'pensando…' }, false))
      .toBe('Pesquisador: trabalhando na Pesquisa (pensando…)');
  });

  it('caminhando: a caminho da sala nova', () => {
    expect(descreverAgente('capita', { sala: 'ponte', atividade: 'andando', balao: null }, true)).toBe('Capitã: a caminho da Ponte');
    expect(descreverAgente('redator', { sala: 'dormitorio', atividade: 'dormindo', balao: null }, true))
      .toBe('Redator: a caminho do Dormitório');
  });

  it('devolvido: não lê o "!" do balão', () => {
    expect(descreverAgente('pesquisador', { sala: 'pesquisa', atividade: 'devolvido', balao: '!' }, false))
      .toBe('Pesquisador: trabalho devolvido na Pesquisa');
  });

  it('o balão do Imediato entra no texto', () => {
    expect(descreverAgente('imediato', { sala: 'ponte', atividade: 'andando', balao: 'conferindo…' }, false))
      .toBe('Imediato: a postos na Ponte (conferindo…)');
  });
});
