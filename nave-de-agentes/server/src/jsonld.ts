import type { FichaOriginal, FichaNova } from '@nave/shared';

type Obj = Record<string, any>;

export interface CamposJsonLd {
  marca: boolean; sku: boolean; gtin: boolean; preco: boolean; disponibilidade: boolean;
  imagem: boolean; descricao: boolean; avaliacoes: boolean; categoria: boolean; additionalProperty: number;
}

/** Da página, só os primeiros 10 blocos. O HTML vem de fora e tem até 2 MB; a leitura é linear (test/html-hostil.test.ts). */
const MAX_BLOCOS = 10;
const TIPO_JSONLD = /\btype\s*=\s*["']application\/ld\+json["']/i;

/**
 * O conteúdo de cada `<script type="application/ld+json">` até o primeiro `</script>`. Faz o que fazia
 * `<script\b[^>]*\btype…[^>]*>([\s\S]*?)<\/script>`, mas em tempo linear: sem `</script>` a partir de uma
 * abertura, nenhuma abertura adiante fecha, e a busca para.
 */
function blocosJsonLd(html: string): string[] {
  const abre = /<script\b[^<>]*>/gi;
  const fecha = /<\/script>/gi;
  const blocos: string[] = [];
  for (let m = abre.exec(html); m && blocos.length < MAX_BLOCOS; m = abre.exec(html)) {
    if (!TIPO_JSONLD.test(m[0])) continue;
    fecha.lastIndex = abre.lastIndex;
    const f = fecha.exec(html);
    if (!f) break;
    blocos.push(html.slice(abre.lastIndex, f.index));
    abre.lastIndex = fecha.lastIndex;
  }
  return blocos;
}

function achatar(x: unknown, acc: Obj[] = []): Obj[] {
  if (Array.isArray(x)) x.forEach((i) => achatar(i, acc));
  else if (x && typeof x === 'object') {
    acc.push(x as Obj);
    if ((x as Obj)['@graph']) achatar((x as Obj)['@graph'], acc);
  }
  return acc;
}

const ehProduto = (o: Obj) => ([] as unknown[]).concat(o['@type'] || []).some((t) => /^(Product|ProductGroup)$/i.test(String(t)));

export function extrairJsonLd(html: string): { blocos: number; invalidos: number; produtos: Obj[] } {
  const blocos = blocosJsonLd(html);
  let invalidos = 0;
  const achados: Obj[] = [];
  for (const b of blocos) {
    try {
      achatar(JSON.parse(b.trim()), achados);
    } catch {
      invalidos++;
    }
  }
  return { blocos: blocos.length, invalidos, produtos: achados.filter(ehProduto) };
}

// Dados de página são externos: listas podem trazer null, números ou strings no lugar de objetos.
const objetos = (x: unknown): Obj[] => ([] as unknown[]).concat(x || []).filter((o): o is Obj => !!o && typeof o === 'object');

export function camposProduto(p: Obj): CamposJsonLd {
  const variantes = objetos(p.hasVariant);
  const ofertas = objetos(p.offers).flatMap((o) => (o.offers ? objetos(o.offers) : [o]));
  const ofertasVariantes = variantes.flatMap((v) => objetos(v.offers));
  const todasOfertas = [...ofertas, ...ofertasVariantes];
  const temGtin = (o: Obj) => Boolean(o.gtin || o.gtin8 || o.gtin12 || o.gtin13 || o.gtin14 || o.mpn);
  return {
    marca: Boolean(p.brand && (typeof p.brand === 'string' || p.brand.name)),
    sku: Boolean(p.sku || variantes.some((v) => v.sku) || todasOfertas.some((o) => o.sku)),
    gtin: temGtin(p) || variantes.some(temGtin) || todasOfertas.some(temGtin),
    preco: todasOfertas.some((o) => o.price || o.lowPrice),
    disponibilidade: todasOfertas.some((o) => o.availability),
    imagem: Boolean(p.image),
    descricao: String(p.description || '').length > 40,
    avaliacoes: Boolean(p.aggregateRating || p.review),
    categoria: Boolean(p.category),
    additionalProperty: ([] as unknown[]).concat(p.additionalProperty || []).length,
  };
}

/** Monta o JSON-LD novo só com dados da ficha original e da ficha nova; nada é inventado. */
export function montarJsonLd(o: FichaOriginal, n: FichaNova): Obj {
  const j: Obj = { '@context': 'https://schema.org', '@type': 'Product', name: n.titulo };
  j.description = n.secoes.map((s) => s.texto).join('\n\n');
  if (o.marca) j.brand = { '@type': 'Brand', name: o.marca };
  const sku = o.variantes.find((v) => v.sku)?.sku;
  if (sku) j.sku = sku;
  const gtin = o.variantes.find((v) => v.codigoBarras)?.codigoBarras;
  if (gtin) j.gtin = gtin;
  if (o.imagens.length) j.image = o.imagens.map((i) => i.src);
  const ofertas = o.variantes.filter((v) => v.preco).map((v) => {
    const oferta: Obj = { '@type': 'Offer', price: v.preco };
    if (o.moeda) oferta.priceCurrency = o.moeda;
    if (v.disponivel !== null) oferta.availability = v.disponivel ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
    return oferta;
  });
  if (ofertas.length) j.offers = ofertas;
  if (n.atributos.length) j.additionalProperty = n.atributos.map((a) => ({ '@type': 'PropertyValue', name: a.rotulo, value: a.valor }));
  return j;
}

export function jsonLdProdutoValido(j: Obj | null): boolean {
  if (!j || j['@type'] !== 'Product' || !j.name || !j.brand?.name) return false;
  return objetos(j.offers).length >= 1;
}

export function montarAlts(o: FichaOriginal, n: FichaNova): { src: string; alt: string }[] {
  return o.imagens.map((img, i) => ({ src: img.src, alt: i === 0 ? n.titulo : `${n.titulo} — imagem ${i + 1}` }));
}
