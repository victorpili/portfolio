import { ATRIBUTOS } from '@nave/shared';
import type { AtributoId, FichaNova, FichaOriginal, Pesquisa, Problema, Revisao } from '@nave/shared';
import { contemTrecho } from './texto';

const IDS: AtributoId[] = ATRIBUTOS.map((a) => a.id);
const rotuloDe = (id: AtributoId): string => ATRIBUTOS.find((a) => a.id === id)!.rotulo;
const perguntaDe = (id: AtributoId): string => `Confirme: ${rotuloDe(id)}`;

const RESERVADOS = new Set(['titulo', 'faq', 'resposta']);
const MOTIVO_TRECHO_AUSENTE = 'a confirmar: trecho não encontrado';

function idsDaPesquisa(p: Pesquisa): AtributoId[] {
  return [...p.atributos.map((a) => a.id), ...p.lacunas.map((l) => l.id), ...p.naoSeAplica.map((n) => n.id)];
}

export function conferirPesquisa(o: FichaOriginal, p: Pesquisa): Problema[] {
  const problemas: Problema[] = [];
  for (const a of p.atributos) {
    if (!contemTrecho(o, a.trecho)) {
      problemas.push({ item: `atributo:${a.id}`, motivo: `trecho "${a.trecho}" não está no original` });
    }
  }
  const contagem = new Map<AtributoId, number>();
  for (const id of idsDaPesquisa(p)) contagem.set(id, (contagem.get(id) ?? 0) + 1);
  for (const id of IDS) {
    const n = contagem.get(id) ?? 0;
    if (n === 0) problemas.push({ item: `atributo:${id}`, motivo: `${id} não foi classificado` });
    else if (n > 1) problemas.push({ item: `atributo:${id}`, motivo: `${id} aparece mais de uma vez` });
  }
  return problemas;
}

export function pesquisaVazia(): Pesquisa {
  return {
    tipoProduto: '',
    atributos: [],
    lacunas: IDS.map((id) => ({ id, motivo: 'resposta fora do formato' })),
    naoSeAplica: [],
  };
}

export function corrigirPesquisa(o: FichaOriginal, p: Pesquisa): { pesquisa: Pesquisa; problemas: Problema[] } {
  const problemas = conferirPesquisa(o, p);
  const vistos = new Set<AtributoId>();
  const primeira = <T extends { id: AtributoId }>(lista: T[]): T[] =>
    lista.filter((x) => {
      if (vistos.has(x.id)) return false;
      vistos.add(x.id);
      return true;
    });
  const atributos = primeira(p.atributos);
  const lacunas = primeira(p.lacunas);
  const naoSeAplica = primeira(p.naoSeAplica);

  const validos = atributos.filter((a) => contemTrecho(o, a.trecho));
  const novasLacunas = [
    ...lacunas,
    ...atributos.filter((a) => !validos.includes(a)).map((a) => ({ id: a.id, motivo: MOTIVO_TRECHO_AUSENTE })),
  ];
  for (const id of IDS) {
    if (!vistos.has(id)) novasLacunas.push({ id, motivo: `a confirmar: ${id} não foi classificado` });
  }
  return { pesquisa: { tipoProduto: p.tipoProduto, atributos: validos, lacunas: novasLacunas, naoSeAplica }, problemas };
}

export function conferirFicha(p: Pesquisa, n: FichaNova): Problema[] {
  const problemas: Problema[] = [];
  const idsPesquisa = new Set(p.atributos.map((a) => a.id));
  const fontesInvalidas = (item: string, fontes: AtributoId[]) => {
    for (const f of fontes) {
      if (!idsPesquisa.has(f)) problemas.push({ item, motivo: `fonte "${f}" não existe na pesquisa` });
    }
  };
  const contagemIds = new Map<string, number>();
  for (const id of [...n.secoes.map((s) => s.id), ...n.faq.map((f) => f.id)]) contagemIds.set(id, (contagemIds.get(id) ?? 0) + 1);
  for (const [id, qtd] of contagemIds) {
    if (RESERVADOS.has(id) || id.startsWith('atributo:')) problemas.push({ item: id, motivo: `${id} é um nome reservado` });
    if (qtd > 1) problemas.push({ item: id, motivo: `${id} aparece mais de uma vez` });
  }
  for (const s of n.secoes) fontesInvalidas(s.id, s.fontes);
  for (const f of n.faq) fontesInvalidas(f.id, f.fontes);

  for (const a of n.atributos) {
    const item = `atributo:${a.id}`;
    const da = p.atributos.find((x) => x.id === a.id);
    if (!da) problemas.push({ item, motivo: `${a.id} não foi encontrado pelo Pesquisador` });
    else if (da.valor.trim() !== a.valor.trim()) problemas.push({ item, motivo: `valor de ${a.id} diferente da pesquisa` });
  }
  if (n.titulo.length < 20 || n.titulo.length > 150) {
    problemas.push({ item: 'titulo', motivo: `título com ${n.titulo.length} caracteres (precisa de 20 a 150)` });
  }
  if (n.faq.length < 3 || n.faq.length > 6) {
    problemas.push({ item: 'faq', motivo: `FAQ com ${n.faq.length} perguntas (precisa de 3 a 6)` });
  }
  return problemas;
}

/** Acrescenta a `aConfirmar` os ids que ainda não estão lá, sem duplicar. */
function paraAConfirmar(n: FichaNova, ids: AtributoId[]): FichaNova['aConfirmar'] {
  const presentes = new Set(n.aConfirmar.map((a) => a.id));
  const novos: FichaNova['aConfirmar'] = [];
  for (const id of ids) {
    if (presentes.has(id)) continue;
    presentes.add(id);
    novos.push({ id, pergunta: perguntaDe(id) });
  }
  return [...n.aConfirmar, ...novos];
}

export function corrigirFicha(o: FichaOriginal, p: Pesquisa, n: FichaNova): { ficha: FichaNova; problemas: Problema[] } {
  const problemas = conferirFicha(p, n);
  const idsPesquisa = new Set(p.atributos.map((a) => a.id));
  const valido = (a: FichaNova['atributos'][number]): boolean => {
    const da = p.atributos.find((x) => x.id === a.id);
    return !!da && da.valor.trim() === a.valor.trim();
  };
  const ficha: FichaNova = {
    titulo: n.titulo.length < 20 || n.titulo.length > 150 ? o.titulo : n.titulo,
    secoes: n.secoes.map((s, i) => ({ ...s, id: `s${i + 1}`, fontes: s.fontes.filter((f) => idsPesquisa.has(f)) })),
    atributos: n.atributos.filter(valido),
    faq: n.faq.slice(0, 6).map((f, i) => ({ ...f, id: `f${i + 1}`, fontes: f.fontes.filter((x) => idsPesquisa.has(x)) })),
    aConfirmar: paraAConfirmar(n, n.atributos.filter((a) => !valido(a)).map((a) => a.id)),
  };
  return { ficha, problemas };
}

export function fichaDeReserva(o: FichaOriginal, p: Pesquisa): FichaNova {
  return {
    titulo: o.titulo,
    secoes: [{ id: 's1', titulo: 'Descrição', texto: o.descricaoTexto.slice(0, 1500), fontes: [] }],
    atributos: p.atributos.map((a) => ({ id: a.id, rotulo: rotuloDe(a.id), valor: a.valor })),
    faq: [],
    aConfirmar: p.lacunas.map((l) => ({ id: l.id, pergunta: perguntaDe(l.id) })),
  };
}

export function itensDaFicha(n: FichaNova): string[] {
  return ['titulo', ...n.secoes.map((s) => s.id), ...n.faq.map((f) => f.id), ...n.atributos.map((a) => `atributo:${a.id}`)];
}

export function conferirRevisao(
  o: FichaOriginal, n: FichaNova, r: Revisao,
): { reprovados: string[]; problemas: Problema[] } {
  const reprovados: string[] = [];
  const problemas: Problema[] = [];
  for (const item of itensDaFicha(n)) {
    const vereditos = r.vereditos.filter((v) => v.item === item);
    let motivo: string | null = null;
    if (vereditos.length === 0) motivo = 'item não revisado';
    for (const v of vereditos) {
      if (v.veredito !== 'sustentado') motivo = `Revisor: ${v.veredito} — ${v.comentario}`;
      else if (v.evidencia === null || !contemTrecho(o, v.evidencia)) motivo = 'evidência do Revisor não está no original';
      if (motivo) break;
    }
    if (motivo) {
      reprovados.push(item);
      problemas.push({ item, motivo });
    }
  }
  return { reprovados, problemas };
}

export function removerReprovados(o: FichaOriginal, n: FichaNova, reprovados: string[]): FichaNova {
  const fora = new Set(reprovados);
  const saem = n.atributos.filter((a) => fora.has(`atributo:${a.id}`));
  return {
    titulo: fora.has('titulo') ? o.titulo : n.titulo,
    secoes: n.secoes.filter((s) => !fora.has(s.id)),
    atributos: n.atributos.filter((a) => !fora.has(`atributo:${a.id}`)),
    faq: n.faq.filter((f) => !fora.has(f.id)),
    aConfirmar: paraAConfirmar(n, saem.map((a) => a.id)),
  };
}
