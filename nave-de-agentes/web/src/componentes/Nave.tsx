import type { CSSProperties } from 'react';
import type { Agente as NomeAgente, Sala } from '@nave/shared';
import type { EstadoNave } from '../estado';
import { CORREDOR, GRADE, POSTOS, SALAS, type Ponto, type Retangulo } from '../mapa';
import { Agente } from './Agente';

const AGENTES: NomeAgente[] = ['capita', 'imediato', 'pesquisador', 'redator', 'revisor'];
const ORDEM_SALAS: Sala[] = ['pesquisa', 'criacao', 'qualidade', 'dormitorio', 'ponte'];

type Movel = { tipo: 'cama' | 'mesa' | 'computador'; x: number; y: number };

/** A sala de trabalho de cada agente; a Capitã e o Imediato, na Ponte. */
const SALA_DE: Record<NomeAgente, Sala> = {
  capita: 'ponte', imediato: 'ponte', pesquisador: 'pesquisa', redator: 'criacao', revisor: 'qualidade',
};

/** A cama fica no posto do dormitório; a mesa com o computador, logo à direita do posto de trabalho. */
const MOVEIS: Movel[] = AGENTES.flatMap((a): Movel[] => {
  const cama = POSTOS[a].dormitorio!;
  const trabalho = POSTOS[a][SALA_DE[a]]!;
  const mesa = { x: trabalho.x + 1, y: trabalho.y };
  return [{ tipo: 'cama', ...cama }, { tipo: 'mesa', ...mesa }, { tipo: 'computador', ...mesa }];
});

const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Posição e tamanho em porcentagem da grade: a nave escala com a largura da tela. */
function caixa(r: Retangulo): CSSProperties {
  return { left: pct(r.x, GRADE.colunas), top: pct(r.y, GRADE.linhas), width: pct(r.w, GRADE.colunas), height: pct(r.h, GRADE.linhas) };
}

/** O CSS divide cada área em tiles com `--colunas` e `--linhas` (o tamanho do agente, o piso do corredor). */
const GRADE_CSS = { '--colunas': GRADE.colunas, '--linhas': GRADE.linhas } as CSSProperties;
const CORREDOR_CSS = { ...caixa(CORREDOR), '--colunas': CORREDOR.w, '--linhas': CORREDOR.h } as CSSProperties;

/** Um tile dentro de uma sala, em porcentagem da sala. */
function tileNaSala(p: Ponto, s: Retangulo): CSSProperties {
  return { left: pct(p.x - s.x, s.w), top: pct(p.y - s.y, s.h), width: pct(1, s.w), height: pct(1, s.h) };
}

function SalaDaNave({ sala, concluida }: { sala: Sala; concluida: boolean }) {
  const s = SALAS[sala];
  const portaEmCima = s.porta.y === s.y;
  const estilo = { ...caixa(s), '--colunas': s.w, '--linhas': s.h } as CSSProperties;
  return (
    <section className={`sala sala--${sala}${concluida ? ' sala--concluida' : ''}`} style={estilo}>
      <div className="sala__parede" aria-hidden="true" />
      <h2 className="sala__nome">
        {s.nome}
        {concluida && <span className="so-leitor">, concluída</span>}
      </h2>
      <span className="sala__luz" aria-hidden="true" />
      <div className={`porta ${portaEmCima ? 'porta--fundo' : 'porta--frente'}`} style={tileNaSala(s.porta, s)} aria-hidden="true" />
    </section>
  );
}

/** O mapa da nave: salas, corredor, móveis e a tripulação. */
export function Nave({ estado }: { estado: EstadoNave }) {
  return (
    <div className="nave">
      <div className="nave__motor" aria-hidden="true" />
      <div className="nave__casco">
        <div className="nave__grade" style={GRADE_CSS}>
          {ORDEM_SALAS.map((s) => (
            <SalaDaNave key={s} sala={s} concluida={estado.salasConcluidas.includes(s)} />
          ))}
          <div className="corredor" style={CORREDOR_CSS} aria-hidden="true" />
          {MOVEIS.map((m) => (
            <img
              key={`${m.tipo}-${m.x}-${m.y}`}
              className={`movel movel--${m.tipo}`}
              src={`/sprites/${m.tipo}.png`}
              alt=""
              draggable={false}
              style={{ ...caixa({ ...m, w: 1, h: 1 }), zIndex: 10 + m.y * 10 }}
            />
          ))}
          <ul className="tripulacao" aria-label="Tripulação">
            {AGENTES.map((a) => (
              <Agente key={a} agente={a} estado={estado.agentes[a]} />
            ))}
          </ul>
        </div>
      </div>
      <div className="nave__bico" aria-hidden="true" />
    </div>
  );
}
