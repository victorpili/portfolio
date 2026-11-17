import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Agente, Sala } from '@nave/shared';
import { ENFEITES } from '../src/decoracao';
import { POSTOS, SALAS, rota, type Ponto } from '../src/mapa';

const SALA_DE: Record<Agente, Sala> = {
  capita: 'ponte', imediato: 'ponte', pesquisador: 'pesquisa', redator: 'criacao', revisor: 'qualidade',
};
const AGENTES = Object.keys(SALA_DE) as Agente[];
const nome = (p: Ponto) => `${p.x},${p.y}`;

/** Tiles ocupados pelos móveis fixos: postos, camas e a mesa à direita de cada posto de trabalho. */
const OCUPADOS = new Set(AGENTES.flatMap((a) => {
  const trabalho = POSTOS[a][SALA_DE[a]]!;
  return [nome(POSTOS[a].dormitorio!), nome(trabalho), nome({ x: trabalho.x + 1, y: trabalho.y })];
}));

/** Área (de 0 a 1) em que o agente, um quadrado de 1 tile com o canto em `a`, cobre o tile `t`. */
function sobreposicao(a: Ponto, t: Ponto): number {
  const w = Math.max(0, Math.min(a.x + 1, t.x + 1) - Math.max(a.x, t.x));
  const h = Math.max(0, Math.min(a.y + 1, t.y + 1) - Math.max(a.y, t.y));
  return w * h;
}

/** Posições do agente ao longo da rota, a cada 1/20 de tile. */
function amostras(pontos: Ponto[]): Ponto[] {
  const out: Ponto[] = [pontos[0]];
  for (let i = 1; i < pontos.length; i++) {
    const [a, b] = [pontos[i - 1], pontos[i]];
    const passos = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 20);
    for (let k = 1; k <= passos; k++) out.push({ x: a.x + ((b.x - a.x) * k) / passos, y: a.y + ((b.y - a.y) * k) / passos });
  }
  return out;
}

const CAMINHOS = AGENTES.map((a) => ({ agente: a, posicoes: amostras(rota(a, 'dormitorio', SALA_DE[a])) }));
const noChao = ENFEITES.filter((e) => e.y !== SALAS[e.sala].y);

describe('decoracao', () => {
  it('cada enfeite fica dentro da sua sala', () => {
    const fora = ENFEITES.filter((e) => {
      const s = SALAS[e.sala];
      return e.x < s.x || e.x >= s.x + s.w || e.y < s.y || e.y >= s.y + s.h;
    });
    expect(fora).toEqual([]);
  });

  it('cada sprite existe em public/sprites', () => {
    const faltando = [...new Set(ENFEITES.map((e) => e.sprite))]
      .filter((s) => !existsSync(fileURLToPath(new URL(`../public/sprites/${s}.png`, import.meta.url))));
    expect(faltando).toEqual([]);
  });

  it('nenhum enfeite fica nas portas, nos postos, nas camas ou nas mesas de trabalho', () => {
    const portas = new Set(Object.values(SALAS).map((s) => nome(s.porta)));
    expect(ENFEITES.filter((e) => portas.has(nome(e)) || OCUPADOS.has(nome(e))).map(nome)).toEqual([]);
  });

  /**
   * O z-index vem da linha: um agente acima do enfeite (y menor) é desenhado atrás dele e parece passar por trás,
   * como ao levantar da cama ao lado de um criado-mudo. Só conta quando ele passaria na frente, por cima do enfeite.
   */
  it('nenhum agente passa por cima de um enfeite no chão entre a cama e o posto', () => {
    const noCaminho = noChao.flatMap((e) => CAMINHOS
      .filter(({ posicoes }) => posicoes.some((p) => p.y >= e.y && sobreposicao(p, e) > 0.2))
      .map(({ agente }) => `${e.sprite} em ${nome(e)} (${agente})`));
    expect(noCaminho).toEqual([]);
  });

  it('o que fica "sobre" tem um móvel no mesmo tile', () => {
    const moveis = new Set(ENFEITES.filter((e) => !e.sobre).map(nome));
    expect(ENFEITES.filter((e) => e.sobre && !moveis.has(nome(e))).map(nome)).toEqual([]);
  });

  it('dois enfeites que não são "sobre" não dividem um tile', () => {
    const vistos = ENFEITES.filter((e) => !e.sobre).map(nome);
    expect(vistos.filter((n, i) => vistos.indexOf(n) !== i)).toEqual([]);
  });
});
