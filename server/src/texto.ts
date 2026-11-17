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

// As regexes de tag usam `[^<>]*`, não `[^>]*`: com "<" sem fechamento, `[^>]*` varria até o fim da
// string a cada "<" (quadrático com HTML hostil). Um "<" solto agora fica no texto.
export function htmlParaTexto(html: string): string {
  const semBlocos = html.replace(/<\/?(p|br|li|h[1-6]|tr|div)\b[^<>]*>/gi, '\n');
  return decodificar(semBlocos.replace(/<[^<>]*>/g, ''))
    .replace(/ /g, ' ')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n');
}

export function normalizar(s: string): string {
  return decodificar(s.replace(/<[^<>]*>/g, ''))
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

const CELULAS = ['li', 'td', 'th', 'dt', 'dd'];

/**
 * O conteúdo de cada li/td/th/dt/dd até o primeiro fechamento da mesma tag; a busca segue depois do fechamento.
 * Faz o que fazia `<(li|…)\b[^>]*>([\s\S]*?)<\/\1\s*>`, mas em tempo linear: se uma tag não fecha a partir de
 * um ponto, nenhuma abertura dela mais adiante fecha, e o fechamento dela não é procurado de novo.
 */
function celulasHtml(html: string): string[] {
  const abre = /<(li|td|th|dt|dd)\b[^<>]*>/gi;
  const fecha = new Map(CELULAS.map((nome) => [nome, new RegExp(`</${nome}\\s*>`, 'gi')]));
  const celulas: string[] = [];
  for (let m = abre.exec(html); m; m = abre.exec(html)) {
    const nome = m[1].toLowerCase();
    const re = fecha.get(nome);
    if (!re) continue; // essa tag já não fecha mais
    re.lastIndex = abre.lastIndex;
    const f = re.exec(html);
    if (!f) {
      fecha.delete(nome);
      continue;
    }
    celulas.push(html.slice(abre.lastIndex, f.index));
    abre.lastIndex = re.lastIndex;
  }
  return celulas;
}

/** A ficha original não muda depois de lida: os campos estruturados são calculados uma vez por ficha. */
const camposPorFicha = new WeakMap<FichaOriginal, string[]>();

function camposEstruturados(f: FichaOriginal): string[] {
  let campos = camposPorFicha.get(f);
  if (!campos) {
    campos = [
      ...(f.tipo ? [f.tipo] : []),
      ...f.tags,
      ...f.opcoes.flatMap((o) => [o.nome, ...o.valores]),
      ...f.variantes.map((v) => v.titulo),
      ...celulasHtml(f.descricaoHtml),
    ].map(normalizar);
    camposPorFicha.set(f, campos);
  }
  return campos;
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
