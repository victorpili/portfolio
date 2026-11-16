import type { FichaOriginal } from '@nave/shared';

const NOMEADAS: Record<string, string> = {
  lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', amp: '&',
};

function pontoDeCodigo(n: number, original: string): string {
  return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : original;
}

// &amp; é decodificado por último na mesma passada, para não decodificar duas vezes.
function decodificar(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (m, h: string) => pontoDeCodigo(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d: string) => pontoDeCodigo(parseInt(d, 10), m))
    .replace(/&(lt|gt|quot|apos|nbsp|amp);/gi, (_, n: string) => NOMEADAS[n.toLowerCase()]);
}

export function htmlParaTexto(html: string): string {
  const semBlocos = html.replace(/<\/?(p|br|li|h[1-6]|tr|div)\b[^>]*>/gi, '\n');
  return decodificar(semBlocos.replace(/<[^>]*>/g, ''))
    .replace(/ /g, ' ')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

export function normalizar(s: string): string {
  return decodificar(s.replace(/<[^>]*>/g, ''))
    .replace(/[“”″]/g, '"')
    .replace(/[‘’]/g, "'")
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function trechoLimpo(trecho: string): string | null {
  const t = normalizar(trecho).replace(/[.,;:]+$/, '').trim();
  return t.length >= 3 ? t : null;
}

function celulasHtml(html: string): string[] {
  const re = /<(li|td|th|dt|dd)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  return [...html.matchAll(re)].map((m) => m[2]);
}

function camposEstruturados(f: FichaOriginal): string[] {
  return [
    ...(f.tipo ? [f.tipo] : []),
    ...f.tags,
    ...f.opcoes.flatMap((o) => [o.nome, ...o.valores]),
    ...f.variantes.map((v) => v.titulo),
    ...celulasHtml(f.descricaoHtml),
  ].map(normalizar);
}

/** `{ tags: false }` ignora as tags: elas são etiquetas internas da loja e não sustentam atributo da pesquisa. */
export function contemTrecho(f: FichaOriginal, trecho: string, opcoes: { tags?: boolean } = {}): boolean {
  const t = trechoLimpo(trecho);
  if (!t) return false;
  const campos = [f.titulo, f.marca ?? '', f.tipo ?? '', ...(opcoes.tags === false ? [] : f.tags),
    ...f.opcoes.flatMap((o) => [o.nome, ...o.valores]),
    ...f.variantes.map((v) => v.titulo), f.descricaoTexto];
  return campos.some((c) => normalizar(c).includes(t));
}

export function ondeEsta(f: FichaOriginal, trecho: string): 'estruturado' | 'texto' | null {
  const t = trechoLimpo(trecho);
  if (!t) return null;
  if (camposEstruturados(f).some((c) => c.includes(t))) return 'estruturado';
  return contemTrecho(f, trecho) ? 'texto' : null;
}
