// Codificador PNG mínimo (RGBA 8 bits, sem entrelaçamento), só com o zlib do Node.
import { deflateSync, inflateSync } from 'node:zlib';

const TABELA_CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo, dados) {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}

/** `rgba`: largura × altura × 4 bytes, linha a linha. */
export function codificarPng(largura, altura, rgba) {
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho[8] = 8; // bits por canal
  cabecalho[9] = 6; // RGBA
  const linhas = Buffer.alloc((largura * 4 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    const ini = y * (largura * 4 + 1);
    linhas[ini] = 0; // sem filtro
    Buffer.from(rgba.buffer, rgba.byteOffset + y * largura * 4, largura * 4).copy(linhas, ini + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(linhas, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Lê de volta um PNG RGBA de 8 bits sem filtro, como os que `codificarPng` grava: { largura, altura, rgba }.
 * Outro formato (outro editor salvou o arquivo) devolve null, e a conferência acusa a diferença.
 */
export function pixelsDoPng(buf) {
  let pos = 8;
  let largura = 0;
  let altura = 0;
  const dados = [];
  while (pos < buf.length) {
    const tam = buf.readUInt32BE(pos);
    const tipo = buf.toString('ascii', pos + 4, pos + 8);
    const corpo = buf.subarray(pos + 8, pos + 8 + tam);
    if (tipo === 'IHDR') {
      largura = corpo.readUInt32BE(0);
      altura = corpo.readUInt32BE(4);
      if (corpo[8] !== 8 || corpo[9] !== 6 || corpo[12] !== 0) return null;
    }
    if (tipo === 'IDAT') dados.push(corpo);
    pos += tam + 12;
  }
  const linhas = inflateSync(Buffer.concat(dados));
  const rgba = Buffer.alloc(largura * altura * 4);
  for (let y = 0; y < altura; y++) {
    const ini = y * (largura * 4 + 1);
    if (linhas[ini] !== 0) return null;
    linhas.copy(rgba, y * largura * 4, ini + 1, ini + 1 + largura * 4);
  }
  return { largura, altura, rgba };
}
