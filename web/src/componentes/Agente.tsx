import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Agente as NomeAgente } from '@nave/shared';
import type { Atividade, EstadoAgente } from '../estado';
import { SALAS, posto, rota, type Ponto } from '../mapa';

/** Duração da caminhada inteira, de posto a posto. */
export const CAMINHADA_MS = 1300;

export const NOME_AGENTE: Record<NomeAgente, string> = {
  capita: 'Capitã', imediato: 'Imediato', pesquisador: 'Pesquisador', redator: 'Redator', revisor: 'Revisor',
};

const DESCRICAO: Record<Atividade, string> = {
  dormindo: 'dormindo', andando: 'a postos', trabalhando: 'trabalhando', devolvido: 'trabalho devolvido', pronto: 'entregou',
};

const distancia = (a: Ponto, b: Ponto) => Math.hypot(b.x - a.x, b.y - a.y);

function semMovimento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Um tripulante no mapa. Quando a sala muda, percorre a `rota` em 1.300 ms, um trecho por vez
 * (transição linear com a duração proporcional ao tamanho do trecho), e alterna 2 quadros de passo enquanto anda.
 */
export function Agente({ agente, estado }: { agente: NomeAgente; estado: EstadoAgente }) {
  const [pos, setPos] = useState<Ponto>(() => posto(agente, estado.sala));
  const [trechoMs, setTrechoMs] = useState(0);
  const [andando, setAndando] = useState(false);
  const salaAnterior = useRef(estado.sala);

  useEffect(() => {
    const de = salaAnterior.current;
    const para = estado.sala;
    if (de === para) return;
    salaAnterior.current = para;
    const pontos = rota(agente, de, para);
    if (semMovimento()) {
      setTrechoMs(0);
      setPos(pontos[pontos.length - 1]);
      return;
    }
    // Começa do ponto onde o sprite está (se a caminhada anterior foi interrompida, ele segue dali).
    const trechos = pontos.slice(1).map((p, i) => distancia(pontos[i], p));
    const total = trechos.reduce((s, d) => s + d, 0) || 1;
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const proximo = () => {
      if (i >= trechos.length) {
        setAndando(false);
        return;
      }
      const ms = (CAMINHADA_MS * trechos[i]) / total;
      setTrechoMs(ms);
      setPos(pontos[i + 1]);
      i++;
      timer = setTimeout(proximo, ms);
    };
    setAndando(true);
    proximo();
    return () => {
      clearTimeout(timer);
      setAndando(false);
    };
  }, [agente, estado.sala]);

  // Na caminhada de volta, o estado já diz "dormindo": deita só ao chegar na cama.
  const visual: Atividade | 'caminhando' = andando ? 'caminhando' : estado.atividade;
  const estilo: CSSProperties = {
    transform: `translate(${pos.x * 100}%, ${pos.y * 100}%)`,
    transitionDuration: `${trechoMs}ms`,
    zIndex: 10 + Math.round(pos.y * 10),
  };
  const devolvido = estado.atividade === 'devolvido';

  return (
    <div className={`agente agente--${agente} agente--${visual}`} style={estilo}>
      <div className="agente__corpo" aria-hidden="true">
        <img className="agente__sprite" src={`/sprites/${agente}.png`} alt="" draggable={false} />
      </div>
      {visual === 'dormindo' && (
        <span className="agente__zzz" aria-hidden="true">
          <span>z</span> <span>z</span> <span>z</span>
        </span>
      )}
      {estado.balao && visual !== 'dormindo' && (
        <span className={`balao${devolvido ? ' balao--alerta' : ''}`} aria-hidden="true">
          {estado.balao}
        </span>
      )}
      <span className="agente__nome" aria-hidden="true">{NOME_AGENTE[agente]}</span>
      <span className="so-leitor">
        {NOME_AGENTE[agente]}: {andando ? `a caminho de ${SALAS[estado.sala].nome}` : `${DESCRICAO[estado.atividade]} em ${SALAS[estado.sala].nome}`}
        {estado.balao ? ` (${estado.balao})` : ''}
      </span>
    </div>
  );
}
