import type { Nota, Resultado } from './resultado';

export type Agente = 'capita' | 'imediato' | 'pesquisador' | 'redator' | 'revisor';
export type Sala = 'ponte' | 'pesquisa' | 'criacao' | 'qualidade' | 'dormitorio';
export type CodigoErro = 'entrada_invalida' | 'url_invalida' | 'texto_invalido' | 'loja_bloqueou'
  | 'produto_nao_encontrado' | 'cota_esgotada' | 'missao_em_andamento' | 'sem_credito' | 'api_fora'
  | 'tempo_esgotado' | 'conexao_perdida';
export type Problema = { item: string; motivo: string };
export type EntradaMissao = { url: string } | { texto: string };
type Base = { seq: number; t: number; mensagem: string };
export type Evento = Base & (
  | { tipo: 'missao_iniciada' } | { tipo: 'aviso' } | { tipo: 'batimento' }
  | { tipo: 'agente_convocado'; agente: Agente; sala: Sala }
  | { tipo: 'agente_trabalhando'; agente: Agente; tentativa: 1 | 2 }
  | { tipo: 'agente_entregou'; agente: Agente }
  | { tipo: 'agente_dispensado'; agente: Agente }
  | { tipo: 'imediato_conferindo' | 'imediato_aprovou'; agente: Agente }
  | { tipo: 'imediato_devolveu' | 'imediato_corrigiu'; agente: Agente; problemas: Problema[] }
  | { tipo: 'nota'; qual: 'antes' | 'depois'; nota: Nota }
  | { tipo: 'missao_concluida'; resultado: Resultado }
  | { tipo: 'erro'; codigo: CodigoErro; recuperavel: boolean; sugestao: string });
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type EventoSemCarimbo = DistributiveOmit<Evento, 'seq' | 't'>;
