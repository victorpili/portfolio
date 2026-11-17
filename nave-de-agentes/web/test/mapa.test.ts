import { describe, expect, it } from 'vitest';
import type { Agente, Sala } from '@nave/shared';
import { CORREDOR, GRADE, POSTOS, SALAS, planoDeMovimento, rota, type Ponto, type Retangulo } from '../src/mapa';

const dentro = (p: Ponto, r: Retangulo) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const ehPorta = (p: Ponto) => Object.values(SALAS).some((s) => s.porta.x === p.x && s.porta.y === p.y);
const naBorda = (p: Ponto, r: Retangulo) => p.x === r.x || p.x === r.x + r.w - 1 || p.y === r.y || p.y === r.y + r.h - 1;
const vizinhos = (p: Ponto): Ponto[] => [
  { x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 },
];

describe('mapa', () => {
  it('rota passa só por portas e corredor', () => {
    for (const ag of ['pesquisador', 'redator', 'revisor'] as const) {
      const sala = ({ pesquisador: 'pesquisa', redator: 'criacao', revisor: 'qualidade' } as const)[ag];
      const r = rota(ag, 'dormitorio', sala);
      expect(r[0]).toEqual(POSTOS[ag].dormitorio);
      expect(r.at(-1)).toEqual(POSTOS[ag][sala]);
      for (const p of r.slice(1, -1)) expect(dentro(p, CORREDOR) || ehPorta(p)).toBe(true);
    }
  });

  it('rota para a mesma sala é só o posto', () => expect(rota('capita', 'ponte', 'ponte')).toEqual([POSTOS.capita.ponte]));

  it('toda sala tem a porta na borda, encostada no corredor', () => {
    for (const [nome, s] of Object.entries(SALAS)) {
      expect(dentro(s.porta, s), nome).toBe(true);
      expect(naBorda(s.porta, s), nome).toBe(true);
      expect(vizinhos(s.porta).some((v) => dentro(v, CORREDOR)), nome).toBe(true);
    }
  });

  it('nenhum posto cai fora da sala dele, e os postos de uma sala não se repetem', () => {
    const porSala = new Map<Sala, string[]>();
    for (const [agente, postos] of Object.entries(POSTOS) as [Agente, Partial<Record<Sala, Ponto>>][]) {
      for (const [sala, p] of Object.entries(postos) as [Sala, Ponto][]) {
        expect(dentro(p, SALAS[sala]), `${agente} em ${sala}`).toBe(true);
        porSala.set(sala, [...(porSala.get(sala) ?? []), `${p.x},${p.y}`]);
      }
    }
    for (const [sala, ps] of porSala) expect(new Set(ps).size, sala).toBe(ps.length);
  });

  it('cada agente tem cama no dormitório e a Capitã e o Imediato têm posto na Ponte', () => {
    for (const a of ['capita', 'imediato', 'pesquisador', 'redator', 'revisor'] as const) expect(POSTOS[a].dormitorio).toBeDefined();
    expect(POSTOS.capita.ponte).toBeDefined();
    expect(POSTOS.imediato.ponte).toBeDefined();
  });

  it('salas e corredor cabem na grade e não se sobrepõem', () => {
    const areas: Retangulo[] = [...Object.values(SALAS), CORREDOR];
    for (const a of areas) {
      expect(a.x >= 0 && a.y >= 0 && a.x + a.w <= GRADE.colunas && a.y + a.h <= GRADE.linhas).toBe(true);
    }
    for (let i = 0; i < areas.length; i++) {
      for (let j = i + 1; j < areas.length; j++) {
        const [a, b] = [areas[i], areas[j]];
        const cruza = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(cruza).toBe(false);
      }
    }
  });

  it('rota de volta ao dormitório também sai pela porta e anda pelo corredor', () => {
    const r = rota('imediato', 'ponte', 'dormitorio');
    expect(r[0]).toEqual(POSTOS.imediato.ponte);
    expect(r.at(-1)).toEqual(POSTOS.imediato.dormitorio);
    expect(r[1]).toEqual(SALAS.ponte.porta);
    expect(r.at(-2)).toEqual(SALAS.dormitorio.porta);
    for (const p of r.slice(2, -2)) expect(dentro(p, CORREDOR)).toBe(true);
  });

  describe('planoDeMovimento', () => {
    it('mesma sala, sem caminhada em curso: fica parado', () => {
      expect(planoDeMovimento('redator', 'criacao', 'criacao', { andando: false, reduzido: false })).toEqual({ tipo: 'parado' });
    });

    it('mesma sala com caminhada cortada (efeito rodou de novo sem troca de sala): salta ao posto', () => {
      expect(planoDeMovimento('redator', 'criacao', 'criacao', { andando: true, reduzido: false }))
        .toEqual({ tipo: 'saltar', posto: POSTOS.redator.criacao });
    });

    it('troca de sala com o agente parado: caminha pela rota', () => {
      expect(planoDeMovimento('pesquisador', 'dormitorio', 'pesquisa', { andando: false, reduzido: false }))
        .toEqual({ tipo: 'caminhar', pontos: rota('pesquisador', 'dormitorio', 'pesquisa') });
    });

    it('troca de sala no meio de uma caminhada: salta direto ao novo posto', () => {
      expect(planoDeMovimento('pesquisador', 'pesquisa', 'dormitorio', { andando: true, reduzido: false }))
        .toEqual({ tipo: 'saltar', posto: POSTOS.pesquisador.dormitorio });
    });

    it('movimento reduzido: salta direto ao novo posto', () => {
      expect(planoDeMovimento('capita', 'dormitorio', 'ponte', { andando: false, reduzido: true }))
        .toEqual({ tipo: 'saltar', posto: POSTOS.capita.ponte });
    });
  });

  it('cada sala diz como se fala "na sala" e "a caminho da sala"', () => {
    expect([SALAS.dormitorio.local, SALAS.dormitorio.destino]).toEqual(['no Dormitório', 'do Dormitório']);
    expect([SALAS.ponte.local, SALAS.ponte.destino]).toEqual(['na Ponte', 'da Ponte']);
    expect([SALAS.pesquisa.local, SALAS.criacao.local, SALAS.qualidade.local]).toEqual(['na Pesquisa', 'na Criação', 'na Qualidade']);
  });
});
