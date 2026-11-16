import type { Agente, CodigoErro, Evento, Nota, Resultado, Sala } from '@nave/shared';

export type Atividade = 'dormindo' | 'andando' | 'trabalhando' | 'devolvido' | 'pronto';

export interface EstadoAgente { sala: Sala; atividade: Atividade; balao: string | null }

export interface LinhaTerminal {
  seq: number;
  agente: Agente | null;
  texto: string;
  tom: 'normal' | 'alerta' | 'sucesso' | 'erro';
}

export interface EstadoNave {
  fase: 'parada' | 'em_missao' | 'concluida' | 'erro';
  agentes: Record<Agente, EstadoAgente>;
  salasConcluidas: Sala[];
  linhas: LinhaTerminal[];
  notaAntes: Nota | null;
  notaDepois: Nota | null;
  resultado: Resultado | null;
  erro: { codigo: CodigoErro; mensagem: string; sugestao: string } | null;
}

const AGENTES: Agente[] = ['capita', 'imediato', 'pesquisador', 'redator', 'revisor'];
const DORMINDO: EstadoAgente = { sala: 'dormitorio', atividade: 'dormindo', balao: null };

function todosDormindo(): Record<Agente, EstadoAgente> {
  return Object.fromEntries(AGENTES.map((a) => [a, { ...DORMINDO }])) as Record<Agente, EstadoAgente>;
}

export function estadoInicial(): EstadoNave {
  return {
    fase: 'parada',
    agentes: todosDormindo(),
    salasConcluidas: [],
    linhas: [],
    notaAntes: null,
    notaDepois: null,
    resultado: null,
    erro: null,
  };
}

function comAgente(s: EstadoNave, a: Agente, novo: EstadoAgente): EstadoNave {
  return { ...s, agentes: { ...s.agentes, [a]: novo } };
}

function comLinha(s: EstadoNave, e: Evento, tom: LinhaTerminal['tom']): EstadoNave {
  const agente = 'agente' in e ? e.agente : null;
  return { ...s, linhas: [...s.linhas, { seq: e.seq, agente, texto: e.mensagem, tom }] };
}

export function reduzir(s: EstadoNave, e: Evento): EstadoNave {
  switch (e.tipo) {
    case 'batimento':
      return s;
    case 'missao_iniciada':
      return comLinha({ ...estadoInicial(), fase: 'em_missao' }, e, 'normal');
    case 'agente_convocado': {
      const n = comAgente(s, e.agente, { sala: e.sala, atividade: 'andando', balao: null });
      return comLinha({ ...n, salasConcluidas: n.salasConcluidas.filter((x) => x !== e.sala) }, e, 'normal');
    }
    case 'agente_trabalhando':
      return comLinha(comAgente(s, e.agente, { ...s.agentes[e.agente], atividade: 'trabalhando', balao: 'pensando…' }), e, 'normal');
    case 'agente_entregou':
      return comLinha(comAgente(s, e.agente, { ...s.agentes[e.agente], atividade: 'pronto', balao: null }), e, 'normal');
    case 'imediato_conferindo':
      return comLinha(comAgente(s, 'imediato', { ...s.agentes.imediato, balao: 'conferindo…' }), e, 'normal');
    case 'imediato_devolveu':
      return comLinha(comAgente(s, e.agente, { ...s.agentes[e.agente], atividade: 'devolvido', balao: '!' }), e, 'alerta');
    case 'agente_dispensado': {
      const sala = s.agentes[e.agente].sala;
      const acende = sala !== 'ponte' && sala !== 'dormitorio' && !s.salasConcluidas.includes(sala);
      const n = comAgente(s, e.agente, { ...DORMINDO });
      return comLinha(acende ? { ...n, salasConcluidas: [...n.salasConcluidas, sala] } : n, e, 'normal');
    }
    case 'nota':
      return comLinha(e.qual === 'antes' ? { ...s, notaAntes: e.nota } : { ...s, notaDepois: e.nota }, e, 'normal');
    case 'missao_concluida':
      return comLinha({ ...s, fase: 'concluida', resultado: e.resultado }, e, 'sucesso');
    case 'erro':
      return comLinha(
        { ...s, fase: 'erro', agentes: todosDormindo(), erro: { codigo: e.codigo, mensagem: e.mensagem, sugestao: e.sugestao } },
        e,
        'erro',
      );
    default:
      // aviso, imediato_aprovou, imediato_corrigiu: só entram no terminal.
      return comLinha(s, e, 'normal');
  }
}
