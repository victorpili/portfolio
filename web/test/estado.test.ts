import { describe, expect, it } from 'vitest';
import { estadoInicial, reduzir } from '../src/estado';
import { ev } from './ev';

describe('redutor', () => {
  it('convocar, trabalhar, devolver, dispensar', () => {
    let s = reduzir(estadoInicial(), ev({ tipo: 'agente_convocado', agente: 'pesquisador', sala: 'pesquisa' }));
    expect(s.agentes.pesquisador).toEqual({ sala: 'pesquisa', atividade: 'andando', balao: null });
    s = reduzir(s, ev({ tipo: 'agente_trabalhando', agente: 'pesquisador', tentativa: 1 }));
    expect(s.agentes.pesquisador.balao).toBe('pensando…');
    s = reduzir(s, ev({ tipo: 'imediato_devolveu', agente: 'pesquisador', problemas: [] }));
    expect(s.agentes.pesquisador).toMatchObject({ atividade: 'devolvido', balao: '!' });
    expect(s.linhas.at(-1)!.tom).toBe('alerta');
    s = reduzir(s, ev({ tipo: 'agente_dispensado', agente: 'pesquisador' }));
    expect(s.agentes.pesquisador).toMatchObject({ sala: 'dormitorio', atividade: 'dormindo' });
  });

  it('erro manda todos ao dormitório; batimento não muda o estado', () => {
    const emMissao = reduzir(estadoInicial(), ev({ tipo: 'agente_convocado', agente: 'redator', sala: 'criacao' }));
    const s = reduzir(emMissao, ev({ tipo: 'erro', codigo: 'api_fora', recuperavel: true, sugestao: 'x' }));
    expect(s.fase).toBe('erro');
    expect(s.agentes.redator.sala).toBe('dormitorio');
    expect(s.linhas.at(-1)!.tom).toBe('erro');
    expect(s.erro).toEqual({ codigo: 'api_fora', mensagem: 'msg erro', sugestao: 'x' });
    expect(reduzir(s, ev({ tipo: 'batimento' }))).toBe(s);
  });

  it('estado inicial: todos no dormitório, dormindo', () => {
    const s = estadoInicial();
    for (const a of Object.values(s.agentes)) expect(a).toEqual({ sala: 'dormitorio', atividade: 'dormindo', balao: null });
    expect(s.fase).toBe('parada');
  });

  it('missao_iniciada reinicia o estado em missão', () => {
    let s = reduzir(estadoInicial(), ev({ tipo: 'agente_convocado', agente: 'redator', sala: 'criacao' }));
    s = reduzir(s, ev({ tipo: 'missao_iniciada' }));
    expect(s.fase).toBe('em_missao');
    expect(s.agentes.redator.sala).toBe('dormitorio');
    expect(s.linhas).toHaveLength(1);
  });

  it('entregou, conferindo e aviso', () => {
    let s = reduzir(estadoInicial(), ev({ tipo: 'agente_convocado', agente: 'redator', sala: 'criacao' }));
    s = reduzir(s, ev({ tipo: 'agente_entregou', agente: 'redator' }));
    expect(s.agentes.redator.atividade).toBe('pronto');
    s = reduzir(s, ev({ tipo: 'imediato_conferindo', agente: 'redator' }));
    expect(s.agentes.imediato.balao).toBe('conferindo…');
    s = reduzir(s, ev({ tipo: 'aviso' }));
    expect(s.linhas).toHaveLength(4);
  });

  it('nota antes e depois; missão concluída', () => {
    const nota = { valor: 40, obtidos: 4, possiveis: 10, itens: [] };
    let s = reduzir(estadoInicial(), ev({ tipo: 'nota', qual: 'antes', nota }));
    s = reduzir(s, ev({ tipo: 'nota', qual: 'depois', nota: { ...nota, valor: 90 } }));
    expect(s.notaAntes!.valor).toBe(40);
    expect(s.notaDepois!.valor).toBe(90);
    const resultado = { custoUsd: 1 } as never;
    s = reduzir(s, ev({ tipo: 'missao_concluida', resultado }));
    expect(s.fase).toBe('concluida');
    expect(s.resultado).toBe(resultado);
    expect(s.linhas.at(-1)!.tom).toBe('sucesso');
  });

  it('salasConcluidas: dispensar o pesquisador acende a Pesquisa', () => {
    let s = reduzir(estadoInicial(), ev({ tipo: 'agente_convocado', agente: 'pesquisador', sala: 'pesquisa' }));
    s = reduzir(s, ev({ tipo: 'agente_dispensado', agente: 'pesquisador' }));
    expect(s.salasConcluidas).toEqual(['pesquisa']);
  });

  it('salasConcluidas: reconvocar o redator tira a Criação; dispensar devolve, sem repetir', () => {
    let s = reduzir(estadoInicial(), ev({ tipo: 'agente_convocado', agente: 'redator', sala: 'criacao' }));
    s = reduzir(s, ev({ tipo: 'agente_dispensado', agente: 'redator' }));
    expect(s.salasConcluidas).toEqual(['criacao']);
    s = reduzir(s, ev({ tipo: 'agente_convocado', agente: 'redator', sala: 'criacao' }));
    expect(s.salasConcluidas).toEqual([]);
    s = reduzir(s, ev({ tipo: 'agente_dispensado', agente: 'redator' }));
    expect(s.salasConcluidas).toEqual(['criacao']);
    s = reduzir(s, ev({ tipo: 'agente_dispensado', agente: 'redator' }));
    expect(s.salasConcluidas).toEqual(['criacao']);
  });

  it('o balão "conferindo…" do Imediato some em aprovou, corrigiu e devolveu', () => {
    for (const tipo of ['imediato_aprovou', 'imediato_corrigiu', 'imediato_devolveu'] as const) {
      let s = reduzir(estadoInicial(), ev({ tipo: 'agente_convocado', agente: 'redator', sala: 'criacao' }));
      s = reduzir(s, ev({ tipo: 'imediato_conferindo', agente: 'redator' }));
      expect(s.agentes.imediato.balao).toBe('conferindo…');
      s = reduzir(s, ev({ tipo, agente: 'redator', problemas: [] }));
      expect(s.agentes.imediato.balao).toBeNull();
      if (tipo === 'imediato_devolveu') expect(s.agentes.redator.balao).toBe('!');
    }
  });

  it('LinhaTerminal.agente é quem fala', () => {
    const fala = (e: Parameters<typeof reduzir>[1]) => reduzir(estadoInicial(), e).linhas[0].agente;
    expect(fala(ev({ tipo: 'imediato_conferindo', agente: 'pesquisador', mensagem: 'Imediato: conferindo a entrega do Pesquisador.' }))).toBe('imediato');
    expect(fala(ev({ tipo: 'agente_dispensado', agente: 'redator', mensagem: 'Capitã: Redator dispensado.' }))).toBe('capita');
    expect(fala(ev({ tipo: 'agente_trabalhando', agente: 'revisor', tentativa: 1 }))).toBe('revisor');
    expect(fala(ev({ tipo: 'agente_entregou', agente: 'redator' }))).toBe('redator');
    expect(fala(ev({ tipo: 'agente_convocado', agente: 'redator', sala: 'criacao' }))).toBe('capita');
    expect(fala(ev({ tipo: 'aviso' }))).toBe('capita');
  });

  it('missao_iniciada zera salas, notas, resultado e erro', () => {
    const nota = { valor: 1, obtidos: 1, possiveis: 2, itens: [] };
    const sujo = {
      ...estadoInicial(),
      fase: 'erro' as const,
      salasConcluidas: ['pesquisa' as const],
      notaAntes: nota,
      notaDepois: nota,
      resultado: {} as never,
      erro: { codigo: 'api_fora' as const, mensagem: 'm', sugestao: 's' },
    };
    const s = reduzir(sujo, ev({ tipo: 'missao_iniciada' }));
    expect(s).toMatchObject({ fase: 'em_missao', salasConcluidas: [], notaAntes: null, notaDepois: null, resultado: null, erro: null });
  });

  it('salasConcluidas: Capitã e Imediato não acendem a ponte; aprovou/corrigiu não mexem', () => {
    let s = reduzir(estadoInicial(), ev({ tipo: 'agente_convocado', agente: 'capita', sala: 'ponte' }));
    s = reduzir(s, ev({ tipo: 'imediato_aprovou', agente: 'redator' }));
    s = reduzir(s, ev({ tipo: 'imediato_corrigiu', agente: 'redator', problemas: [] }));
    expect(s.salasConcluidas).toEqual([]);
    s = reduzir(s, ev({ tipo: 'agente_dispensado', agente: 'capita' }));
    s = reduzir(s, ev({ tipo: 'agente_dispensado', agente: 'imediato' }));
    expect(s.salasConcluidas).toEqual([]);
  });
});
