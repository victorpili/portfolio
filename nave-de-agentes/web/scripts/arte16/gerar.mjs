// Gera os sprites da nave em web/public/sprites. Uso: node scripts/arte16/gerar.mjs [--folha prévia.html] [--so regex]
// Com --conferir, não grava nada: só diz se os PNGs da pasta batem com o desenho (sai com erro se não baterem).
// A arte é desenhada aqui, em código: mapas de caracteres para objetos e personagens, procedimento para pisos.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pixelsDoPng } from './png.mjs';
import { PISOS } from './pisos.mjs';
import { ENFEITES_CASA } from './enfeites-casa.mjs';
import { ENFEITES_TRABALHO } from './enfeites-trabalho.mjs';
import { MOVEIS } from './moveis.mjs';
import { NAVE } from './nave.mjs';
import { TRIPULACAO } from './tripulacao.mjs';

export const SPRITES = { ...PISOS, ...TRIPULACAO, ...MOVEIS, ...ENFEITES_TRABALHO, ...ENFEITES_CASA, ...NAVE };

const DESTINO = fileURLToPath(new URL('../../public/sprites/', import.meta.url));

/** Desenha todos os sprites: { nome: Buffer do PNG }. */
export function desenharTudo() {
  return Object.fromEntries(Object.entries(SPRITES).map(([nome, desenhar]) => [nome, desenhar().png()]));
}

/**
 * Compara a imagem, não os bytes: o zlib pode comprimir diferente em outra versão do Node e o PNG continuar igual.
 */
function mesmosPixels(a, b) {
  const [pa, pb] = [pixelsDoPng(a), pixelsDoPng(b)];
  return pa !== null && pb !== null && pa.largura === pb.largura && pa.altura === pb.altura && pa.rgba.equals(pb.rgba);
}

/** Página de prévia: cada sprite ampliado, e os pisos repetidos 3×3. */
function folha(pngs, z = 6) {
  const img = (b64, l, a) => `<img src="data:image/png;base64,${b64}" style="width:${l}px;height:${a}px">`;
  const itens = Object.entries(pngs).map(([nome, buf]) => {
    const b64 = buf.toString('base64');
    const largura = buf.readUInt32BE(16);
    const altura = buf.readUInt32BE(20);
    const repete = /^(piso|parede)/.test(nome);
    const ver = repete
      ? `<div style="width:${48 * z}px;height:${(nome.startsWith('parede') ? 16 : 48) * z}px;background:url(data:image/png;base64,${b64}) 0 0/${16 * z}px ${16 * z}px"></div>`
      : img(b64, largura * z, altura * z);
    return `<figure>${ver}<figcaption>${nome}</figcaption></figure>`;
  });
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#1e2344;font:12px monospace;color:#d3d9f7;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px}
img,div{image-rendering:pixelated;background-color:#141831}
</style>${itens.join('')}`;
}

// Rodando direto (e não importado). realpath dos dois lados: link, junção ou maiúscula diferente no Windows não enganam.
const direto = process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (direto) {
  const pngs = desenharTudo();
  if (process.argv.includes('--conferir')) {
    const diferentes = Object.entries(pngs)
      .filter(([nome, buf]) => !existsSync(DESTINO + nome + '.png') || !mesmosPixels(readFileSync(DESTINO + nome + '.png'), buf))
      .map(([nome]) => nome);
    if (diferentes.length) {
      console.error('Sprites desatualizados (rode pnpm --filter @nave/web arte): ' + diferentes.join(', '));
      process.exit(1);
    }
    console.log(`${Object.keys(pngs).length} sprites conferidos`);
    process.exit(0);
  }
  mkdirSync(DESTINO, { recursive: true });
  for (const [nome, buf] of Object.entries(pngs)) writeFileSync(DESTINO + nome + '.png', buf);
  const i = process.argv.indexOf('--folha');
  const so = process.argv.indexOf('--so');
  const filtro = so > 0 ? new RegExp(process.argv[so + 1]) : /./;
  const escolhidos = Object.fromEntries(Object.entries(pngs).filter(([n]) => filtro.test(n)));
  if (i > 0) writeFileSync(process.argv[i + 1], folha(escolhidos, so > 0 ? 12 : 6));
  console.log(`${Object.keys(pngs).length} sprites em public/sprites`);
}
