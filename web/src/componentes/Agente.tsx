import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Agente as NomeAgente } from '@nave/shared';
import type { Atividade, EstadoAgente } from '../estado';
import { SALAS, planoDeMovimento, posto, type Ponto } from '../mapa';

/** Duração da caminhada inteira, de posto a posto. */
export const CAMINHADA_MS = 1300;

export const NOME_AGENTE: Record<NomeAgente, string> = {
  capita: 'Capitã', imediato: 'Imediato', pesquisador: 'Pesquisador', redator: 'Redator', revisor: 'Revisor',
};

const DESCRICAO: Record<Atividade, string> = {
  dormindo: 'dormindo', andando: 'a postos', trabalhando: 'trabalhando', devolvido: 'trabalho devolvido',
  pronto: 'trabalho entregue',
};

/** O que o leitor de tela ouve sobre o tripulante. O "!" do balão não é lido: "trabalho devolvido" já diz isso. */
export function descreverAgente(agente: NomeAgente, estado: EstadoAgente, caminhando: boolean): string {
  const sala = SALAS[estado.sala];
  if (caminhando) return `${NOME_AGENTE[agente]}: a caminho ${sala.destino}`;
  const balao = estado.balao && estado.atividade !== 'devolvido' ? ` (${estado.balao})` : '';
  return `${NOME_AGENTE[agente]}: ${DESCRICAO[estado.atividade]} ${sala.local}${balao}`;
}

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
  // Se há uma caminhada em curso. Ref, e não estado, porque o efeito da sala nova precisa ler o valor na hora.
  const caminhando = useRef(false);

  useEffect(() => {
    const de = salaAnterior.current;
    const para = estado.sala;
    salaAnterior.current = para;
    const plano = planoDeMovimento(agente, de, para, { andando: caminhando.current, reduzido: semMovimento() });
    if (plano.tipo === 'parado') return;
    if (plano.tipo === 'saltar') {
      // Sala nova no meio de uma caminhada (a cleanup já parou o timer) ou movimento reduzido:
      // salta direto ao posto, sem transição, em vez de cortar caminho pelas paredes.
      caminhando.current = false;
      setAndando(false);
      setTrechoMs(0);
      setPos(plano.posto);
      return;
    }
    const { pontos } = plano;
    const trechos = pontos.slice(1).map((p, i) => distancia(pontos[i], p));
    const total = trechos.reduce((s, d) => s + d, 0) || 1;
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const proximo = () => {
      if (i >= trechos.length) {
        caminhando.current = false;
        setAndando(false);
        return;
      }
      const ms = (CAMINHADA_MS * trechos[i]) / total;
      setTrechoMs(ms);
      setPos(pontos[i + 1]);
      i++;
      timer = setTimeout(proximo, ms);
    };
    caminhando.current = true;
    setAndando(true);
    proximo();
    // Só para o timer: `caminhando` continua verdadeiro para o próximo efeito saber que interrompeu uma caminhada.
    return () => clearTimeout(timer);
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
    <li className={`agente agente--${agente} agente--${visual}`} style={estilo}>
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
      <span className="so-leitor">{descreverAgente(agente, estado, andando)}</span>
    </li>
  );
}
