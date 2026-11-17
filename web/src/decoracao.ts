import type { Sala } from '@nave/shared';
import type { Ponto } from './mapa';

/** Animação de um enfeite. Todas param com `prefers-reduced-motion`. */
export type AnimacaoEnfeite = 'bolhas' | 'girar' | 'brilho' | 'piscar' | 'virar' | 'radar';

/**
 * Um enfeite da sala: um sprite de `/sprites/<sprite>.png` num tile.
 * `sobre`: fica em cima do móvel do mesmo tile (um frasco na bancada), como o computador na mesa.
 * Na linha da parede (a primeira linha da sala), o enfeite fica pendurado nela.
 */
export type Enfeite = Ponto & { sala: Sala; sprite: string; sobre?: boolean; animacao?: AnimacaoEnfeite };

const em = (sala: Sala, sprite: string, x: number, y: number, extra: Partial<Enfeite> = {}): Enfeite => ({ sala, sprite, x, y, ...extra });

/**
 * Cada sala tem a cara da sua função. Os enfeites ficam fora do caminho dos agentes (porta ↔ posto ↔ cama),
 * dos postos, das camas e das mesas de trabalho; `test/decoracao.test.ts` confere isso.
 */
export const ENFEITES: Enfeite[] = [
  // Pesquisa: laboratório. Estantes de livros, bancada com frascos borbulhando, quadro de dados e globo.
  em('pesquisa', 'alerta', 6, 0),
  em('pesquisa', 'estante-livros', 0, 1),
  em('pesquisa', 'estante-livros', 1, 1),
  em('pesquisa', 'quadro-dados', 2, 1),
  em('pesquisa', 'mesa', 6, 1),
  em('pesquisa', 'frasco-verde', 6, 1, { sobre: true }),
  em('pesquisa', 'bolhas', 6, 1, { sobre: true, animacao: 'bolhas' }),
  em('pesquisa', 'mesa', 7, 1),
  em('pesquisa', 'frasco-azul', 7, 1, { sobre: true }),
  em('pesquisa', 'mesa', 6, 3),
  em('pesquisa', 'frasco-amarelo', 6, 3, { sobre: true }),
  em('pesquisa', 'globo', 0, 3),
  em('pesquisa', 'mesa', 1, 4),
  em('pesquisa', 'pergaminho', 1, 4, { sobre: true }),
  em('pesquisa', 'planta', 0, 5),
  em('pesquisa', 'planta', 7, 5),

  // Criação: oficina. Ferramentas na parede, engrenagem girando, quadro de ideias, bancada comprida, caixotes e lâmpada.
  em('criacao', 'engrenagem', 12, 0, { animacao: 'girar' }),
  em('criacao', 'martelo', 13, 0),
  em('criacao', 'serrote', 14, 0),
  em('criacao', 'bancada', 8, 1),
  em('criacao', 'bancada', 9, 1),
  em('criacao', 'lampada', 10, 1, { animacao: 'brilho' }),
  em('criacao', 'quadro-ideias', 14, 1),
  em('criacao', 'barril', 15, 1),
  em('criacao', 'mesa', 14, 3),
  em('criacao', 'lapis', 14, 3, { sobre: true }),
  em('criacao', 'mesa', 15, 3),
  em('criacao', 'papeis', 15, 3, { sobre: true }),
  em('criacao', 'caixote', 8, 3),
  em('criacao', 'caixote', 8, 4),
  em('criacao', 'barril', 9, 5),
  em('criacao', 'planta', 15, 5),

  // Qualidade: inspeção. Arquivos, checklist, ampulheta, caixa de rejeitados, troféu e o escudo de aprovado.
  em('qualidade', 'escudo', 21, 0),
  em('qualidade', 'arquivo-alto', 16, 1),
  em('qualidade', 'arquivo-alto', 17, 1),
  em('qualidade', 'arquivo', 18, 1),
  em('qualidade', 'quadro-qualidade', 22, 1),
  em('qualidade', 'mesa', 23, 1),
  em('qualidade', 'trofeu', 23, 1, { sobre: true }),
  em('qualidade', 'mesa', 16, 3),
  em('qualidade', 'checklist', 16, 3, { sobre: true }),
  em('qualidade', 'mesa', 22, 3),
  em('qualidade', 'ampulheta', 22, 3, { sobre: true, animacao: 'virar' }),
  em('qualidade', 'rejeitado', 23, 4),
  em('qualidade', 'planta', 16, 5),
  em('qualidade', 'caixote', 23, 5),

  // Dormitório: quarto. Armários, TV com videogame, abajures e criados-mudos entre as camas, quadro e relógio.
  em('dormitorio', 'quadro-parede', 5, 8),
  em('dormitorio', 'relogio', 7, 8),
  em('dormitorio', 'armario', 0, 9),
  em('dormitorio', 'armario', 1, 9),
  em('dormitorio', 'tv', 3, 9),
  em('dormitorio', 'controle', 2, 10),
  em('dormitorio', 'abajur', 2, 12, { animacao: 'brilho' }),
  em('dormitorio', 'criado-mudo', 4, 12),
  em('dormitorio', 'abajur', 6, 12, { animacao: 'brilho' }),
  em('dormitorio', 'criado-mudo', 8, 12),
  em('dormitorio', 'planta', 10, 10),
  em('dormitorio', 'planta', 0, 13),
  em('dormitorio', 'planta', 10, 13),

  // Ponte: comando. Consoles piscando dos dois lados, radar e a mesa com o globo.
  em('ponte', 'console-grade', 11, 9, { animacao: 'piscar' }),
  em('ponte', 'console-tela', 11, 10, { animacao: 'piscar' }),
  em('ponte', 'console-grade', 22, 9, { animacao: 'piscar' }),
  em('ponte', 'console-tela', 23, 9, { animacao: 'piscar' }),
  em('ponte', 'console-botoes', 23, 10, { animacao: 'piscar' }),
  em('ponte', 'console-painel', 23, 11, { animacao: 'piscar' }),
  em('ponte', 'radar', 23, 12, { animacao: 'radar' }),
  em('ponte', 'mesa', 13, 12),
  em('ponte', 'globo', 13, 12, { sobre: true }),
  em('ponte', 'planta', 11, 13),
  em('ponte', 'planta', 23, 13),
];
