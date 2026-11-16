import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ItemNota, ItemNotaId, Nota, Resultado } from '@nave/shared';
import { ROTULO_GRUPO, SITUACAO } from '../textos';

/* Tudo o que vem da loja ou do modelo entra como texto (filho de texto do React), nunca como HTML. */

const ORDEM_GRUPOS: ItemNota['grupo'][] = ['identificacao', 'oferta', 'atributos', 'conteudo', 'dados_estruturados'];
/** Quantas imagens listar antes do "e mais N". */
const MAX_IMAGENS = 5;

export interface LinhaChecklist { id: ItemNotaId; rotulo: string; antes: ItemNota | null; depois: ItemNota | null }
type Pontos = { pontos: number; maximo: number };
export interface GrupoChecklist { grupo: ItemNota['grupo']; rotulo: string; linhas: LinhaChecklist[]; antes: Pontos; depois: Pontos }

/** O checklist item a item, agrupado na ordem fixa dos grupos, com o antes e o depois de cada item lado a lado. */
export function agruparChecklist(antes: Nota, depois: Nota): GrupoChecklist[] {
  const somar = (itens: ItemNota[]): Pontos =>
    itens.reduce((s, i) => ({ pontos: s.pontos + i.pontos, maximo: s.maximo + i.maximo }), { pontos: 0, maximo: 0 });
  return ORDEM_GRUPOS.map((grupo): GrupoChecklist => {
    const doGrupoAntes = antes.itens.filter((i) => i.grupo === grupo);
    const doGrupoDepois = depois.itens.filter((i) => i.grupo === grupo);
    const ids = [...new Set([...doGrupoAntes, ...doGrupoDepois].map((i) => i.id))];
    const linhas = ids.map((id) => {
      const a = doGrupoAntes.find((i) => i.id === id) ?? null;
      const d = doGrupoDepois.find((i) => i.id === id) ?? null;
      return { id, rotulo: (d ?? a)!.rotulo, antes: a, depois: d };
    });
    return { grupo, rotulo: ROTULO_GRUPO[grupo], linhas, antes: somar(doGrupoAntes), depois: somar(doGrupoDepois) };
  }).filter((g) => g.linhas.length > 0);
}

/** `nave-<slug do título>.json`: sem acentos, minúsculas, hífens, no máximo 60 caracteres no slug. */
export function nomeDoArquivo(titulo: string): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `nave-${slug || 'ficha'}.json`;
}

/** "claude-opus-5-5" → "Claude Opus 5.5"; o apelido da assinatura ("sonnet") → "Claude Sonnet". */
export function nomeDoModelo(modelo: string): string {
  if (modelo === 'falso') return 'motor falso';
  const m = /^(?:claude-)?(opus|sonnet|haiku)(?:-(\d+)-(\d+))?$/.exec(modelo);
  if (!m) return modelo;
  const familia = `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)}`;
  return m[2] ? `Claude ${familia} ${m[2]}.${m[3]}` : `Claude ${familia}`;
}

function formatarDuracao(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

function formatarCusto(usd: number): string {
  if (usd > 0 && usd < 0.005) return 'menos de US$ 0,01';
  return `US$ ${usd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A linha de bastidores do painel: devoluções, chamadas, duração, custo e modelo. */
export function descreverBastidores(r: Resultado): string[] {
  const devolucoes = r.devolucoes === 0 ? 'nenhuma devolução'
    : `${r.devolucoes} ${r.devolucoes === 1 ? 'devolução' : 'devoluções'} do Imediato`;
  const n = r.chamadas.length;
  return [devolucoes, `${n} ${n === 1 ? 'chamada' : 'chamadas'} ao modelo`, formatarDuracao(r.duracaoMs),
    formatarCusto(r.custoUsd), nomeDoModelo(r.modelo)];
}

/** O rótulo do atributo, tirado da nota (assim o front não carrega o pacote compartilhado inteiro, com o zod). */
const rotuloAtributo = (r: Resultado, id: string) => r.notaDepois.itens.find((i) => i.id === `atributo:${id}`)?.rotulo ?? id;
const foraDaNota = (i: ItemNota | null) => i?.situacao === 'nao_se_aplica' || i?.situacao === 'nao_verificavel';

function semMovimento(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function Selo({ item }: { item: ItemNota | null }) {
  if (!item) {
    return (
      <span className="selo selo--vazio">
        <span aria-hidden="true">·</span>
        <span className="so-leitor">sem dado</span>
      </span>
    );
  }
  const s = SITUACAO[item.situacao];
  return (
    <span className={`selo selo--${item.situacao}`} title={s.dica ?? undefined}>
      <span className="selo__icone" aria-hidden="true">{s.icone}</span>
      <span className="so-leitor">{s.texto}</span>
      {item.maximo > 0 && (
        <span className="selo__pontos">
          <span aria-hidden="true">{item.pontos}/{item.maximo}</span>
          <span className="so-leitor">, {item.pontos} de {item.maximo} pontos</span>
        </span>
      )}
    </span>
  );
}

function Subtotal({ p }: { p: Pontos }) {
  if (p.maximo === 0) return <span className="checklist__fora">fora da nota</span>;
  return (
    <>
      <span aria-hidden="true">{p.pontos}/{p.maximo}</span>
      <span className="so-leitor">{p.pontos} de {p.maximo} pontos</span>
    </>
  );
}

function Checklist({ grupos }: { grupos: GrupoChecklist[] }) {
  return (
    <section className="painel__caixa" aria-labelledby="checklist-titulo">
      <h3 id="checklist-titulo" className="painel__subtitulo">Checklist da nota</h3>
      <table className="checklist">
        <caption className="so-leitor">Cada item da nota, antes e depois</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Antes</th>
            <th scope="col">Depois</th>
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.grupo}>
            <tr className="checklist__grupo">
              <th scope="rowgroup">{g.rotulo}</th>
              <td><Subtotal p={g.antes} /></td>
              <td><Subtotal p={g.depois} /></td>
            </tr>
            {g.linhas.map((l) => {
              const fora = foraDaNota(l.depois) ? l.depois : foraDaNota(l.antes) ? l.antes : null;
              return (
                <tr key={l.id}>
                  <th scope="row">
                    {l.rotulo}
                    {fora && <small className="checklist__dica">{SITUACAO[fora.situacao].dica}</small>}
                  </th>
                  <td><Selo item={l.antes} /></td>
                  <td><Selo item={l.depois} /></td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
      <ul className="legenda" aria-label="Legenda">
        <li><span className="selo__icone selo--ok" aria-hidden="true">✓</span> ok</li>
        <li><span className="selo__icone selo--parcial" aria-hidden="true">◐</span> parcial: só no texto corrido</li>
        <li><span className="selo__icone selo--ausente" aria-hidden="true">✗</span> ausente</li>
        <li><span className="selo__icone selo--a_confirmar" aria-hidden="true">?</span> a confirmar com o lojista</li>
        <li><span className="selo__icone selo--nao_se_aplica" aria-hidden="true">—</span> fora da nota</li>
      </ul>
    </section>
  );
}

/** Um bloco de uma das duas fichas. As duas colunas têm os mesmos blocos, na mesma ordem, para alinhar lado a lado. */
function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="ficha__bloco">
      <h4 className="ficha__rotulo">{titulo}</h4>
      {children}
    </div>
  );
}

function ListaAlt({ alts, vazio }: { alts: (string | null)[]; vazio: string }) {
  if (alts.length === 0) return <p className="ficha__vazio">{vazio}</p>;
  const resto = alts.length - MAX_IMAGENS;
  return (
    <ul className="ficha__imagens">
      {alts.slice(0, MAX_IMAGENS).map((alt, i) => (
        <li key={i}>{alt ? alt : <span className="ficha__vazio">sem texto alternativo</span>}</li>
      ))}
      {resto > 0 && <li className="ficha__vazio">e mais {resto} {resto === 1 ? 'imagem' : 'imagens'}</li>}
    </ul>
  );
}

function FichaOriginal({ r }: { r: Resultado }) {
  const o = r.original;
  const dados: [string, string][] = [];
  if (o.marca) dados.push(['Marca', o.marca]);
  if (o.tipo) dados.push(['Tipo', o.tipo]);
  // "Title: Default Title" é o marcador da Shopify para produto sem opções: não é dado do produto.
  for (const op of o.opcoes) {
    if (op.valores.length === 1 && op.valores[0] === 'Default Title') continue;
    dados.push([op.nome, op.valores.join(', ')]);
  }
  if (o.variantes.length > 1) dados.push(['Variantes', String(o.variantes.length)]);
  const link = o.url?.startsWith('https://') ? o.url : null;

  return (
    <article className="ficha ficha--original" aria-labelledby="ficha-original">
      <header className="ficha__cabeca">
        <h3 id="ficha-original" className="ficha__nome">Original</h3>
        {link && (
          <a className="ficha__link" href={link} target="_blank" rel="noopener noreferrer">
            ver na loja<span className="so-leitor"> (abre em outra aba)</span>
          </a>
        )}
      </header>
      <Bloco titulo="Título">
        <p className="ficha__titulo">{o.titulo}</p>
      </Bloco>
      <Bloco titulo="Descrição">
        {o.descricaoTexto.trim() ? (
          <p className="ficha__texto ficha__texto--longo">{o.descricaoTexto}</p>
        ) : (
          <p className="ficha__vazio">A ficha original não tem descrição.</p>
        )}
        {o.truncada && <p className="ficha__nota">A ficha passava do limite e foi cortada em 20.000 caracteres e 30 variantes.</p>}
      </Bloco>
      <Bloco titulo="Dados da loja">
        {dados.length > 0 ? (
          <dl className="ficha__dados">
            {dados.map(([k, v], i) => (
              <div key={i}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="ficha__vazio">{o.fonte === 'texto' ? 'Texto colado: sem dados estruturados da loja.' : 'Nenhum dado estruturado.'}</p>
        )}
      </Bloco>
      <Bloco titulo="Perguntas frequentes">
        <p className="ficha__vazio">A ficha original não tem perguntas frequentes.</p>
      </Bloco>
      <Bloco titulo="Imagens (texto alternativo)">
        <ListaAlt alts={o.imagens.map((i) => i.alt)} vazio="Sem imagens." />
      </Bloco>
    </article>
  );
}

function FichaNova({ r }: { r: Resultado }) {
  const f = r.fichaNova;
  return (
    <article className="ficha ficha--nova" aria-labelledby="ficha-nova">
      <header className="ficha__cabeca">
        <h3 id="ficha-nova" className="ficha__nome">Pronta para IA</h3>
      </header>
      <Bloco titulo="Título">
        <p className="ficha__titulo">{f.titulo}</p>
      </Bloco>
      <Bloco titulo="Descrição em seções">
        {f.secoes.length > 0 ? (
          f.secoes.map((s) => (
            <div key={s.id} className="ficha__secao">
              <p className="ficha__secao-titulo">{s.titulo}</p>
              <p className="ficha__texto">{s.texto}</p>
            </div>
          ))
        ) : (
          <p className="ficha__vazio">Sem seções.</p>
        )}
      </Bloco>
      <Bloco titulo="Atributos">
        {f.atributos.length > 0 ? (
          <dl className="ficha__dados">
            {f.atributos.map((a) => (
              <div key={a.id}>
                <dt>{a.rotulo}</dt>
                <dd>{a.valor}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="ficha__vazio">Nenhum atributo com fonte.</p>
        )}
      </Bloco>
      <Bloco titulo="Perguntas frequentes">
        {f.faq.length > 0 ? (
          <dl className="ficha__faq">
            {f.faq.map((q) => (
              <div key={q.id}>
                <dt>{q.pergunta}</dt>
                <dd>{q.resposta}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="ficha__vazio">Sem perguntas frequentes.</p>
        )}
      </Bloco>
      <Bloco titulo="Imagens (texto alternativo)">
        <ListaAlt alts={r.imagens.map((i) => i.alt)} vazio="Sem imagens." />
      </Bloco>
    </article>
  );
}

function baixarJson(r: Resultado): void {
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeDoArquivo(r.original.titulo || r.fichaNova.titulo);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url));
}

const MS_COPIADO = 2000;

/** O painel do fim da missão: notas, as duas fichas, checklist, o que confirmar com o lojista e os botões. */
export function Painel({ resultado: r }: { resultado: Resultado }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const areaJsonld = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [copia, setCopia] = useState<'ocioso' | 'copiado' | 'falhou'>('ocioso');
  const [jsonldAberto, setJsonldAberto] = useState(false);

  // O painel é o resultado da missão: leva a vista (e o foco do leitor de tela) até ele.
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
    titulo.current?.scrollIntoView({ behavior: semMovimento() ? 'auto' : 'smooth', block: 'start' });
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const jsonld = JSON.stringify(r.jsonld, null, 2);
  const antes = r.notaAntes.valor;
  const depois = r.notaDepois.valor;
  const diferenca = depois - antes;
  const grupos = agruparChecklist(r.notaAntes, r.notaDepois);

  const copiar = async () => {
    clearTimeout(timer.current);
    try {
      if (!navigator.clipboard) throw new Error('sem área de transferência');
      await navigator.clipboard.writeText(jsonld);
      setCopia('copiado');
      timer.current = setTimeout(() => setCopia('ocioso'), MS_COPIADO);
    } catch {
      setCopia('falhou');
      setJsonldAberto(true);
      requestAnimationFrame(() => {
        areaJsonld.current?.focus();
        areaJsonld.current?.select();
      });
    }
  };

  return (
    <section className="painel" aria-labelledby="painel-titulo">
      <header className="painel__topo">
        <div>
          <h2 id="painel-titulo" ref={titulo} tabIndex={-1} className="painel__titulo">Antes e depois</h2>
          <p className="painel__produto">
            {r.original.titulo}
            <span className="painel__loja"> · {r.original.loja ?? 'texto colado'}</span>
          </p>
        </div>
        <div className="painel__acoes">
          <button type="button" className="botao" onClick={() => baixarJson(r)}>
            Baixar JSON
          </button>
          <button type="button" className="botao botao--leve" onClick={copiar}>
            {copia === 'copiado' ? 'Copiado' : 'Copiar JSON-LD'}
          </button>
        </div>
      </header>
      <p className="so-leitor" role="status">
        {copia === 'copiado' ? 'JSON-LD copiado.' : ''}
      </p>
      {copia === 'falhou' && (
        <p className="painel__aviso" role="alert">
          Não consegui copiar sozinho. O JSON-LD está selecionado abaixo: copie com Ctrl+C ou pelo menu do celular.
        </p>
      )}

      <div className="placar">
        <p className="placar__notas">
          <span className="placar__nota">
            <span className="placar__rotulo">antes</span>
            <span className="placar__valor">{antes}</span>
          </span>
          <span className="placar__seta" aria-hidden="true">→</span>
          <span className="placar__nota placar__nota--depois">
            <span className="placar__rotulo">depois</span>
            <span className="placar__valor">{depois}</span>
          </span>
          <span className={`placar__diferenca${diferenca < 0 ? ' placar__diferenca--queda' : ''}`}>
            {diferenca >= 0 ? '+' : '−'}{Math.abs(diferenca)}
            <span className="so-leitor"> pontos</span>
          </span>
        </p>
        <div className="placar__explica">
          <p>
            <strong>Prontidão para IA, de 0 a 100.</strong> A nota depois só conta o que tem fonte na ficha original
            {r.aConfirmar.length > 0
              ? `: os ${r.aConfirmar.length} itens a confirmar valem zero até o lojista responder.`
              : '.'}
          </p>
          <ul className="placar__bastidores" aria-label="Bastidores da missão">
            {descreverBastidores(r).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="comparacao">
        <FichaOriginal r={r} />
        <FichaNova r={r} />
      </div>

      <div className="painel__baixo">
        <Checklist grupos={grupos} />
        <section className="painel__caixa painel__caixa--confirmar" aria-labelledby="confirmar-titulo">
          <h3 id="confirmar-titulo" className="painel__subtitulo">A confirmar com o lojista</h3>
          {r.aConfirmar.length > 0 ? (
            <>
              <p className="painel__explica">A ficha original não diz. A nave não inventa: pergunta.</p>
              <ol className="confirmar">
                {r.aConfirmar.map((c) => (
                  <li key={c.id}>
                    <span className="confirmar__atributo">{rotuloAtributo(r, c.id)}</span>
                    <span className="confirmar__pergunta">{c.pergunta}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="painel__explica">Nada a confirmar: tudo na ficha nova tem fonte no original.</p>
          )}
        </section>
      </div>

      <details className="jsonld" open={jsonldAberto} onToggle={(e) => setJsonldAberto(e.currentTarget.open)}>
        <summary>Ver o JSON-LD (schema.org/Product)</summary>
        <label htmlFor="jsonld-texto" className="so-leitor">JSON-LD da ficha nova</label>
        <textarea id="jsonld-texto" ref={areaJsonld} className="jsonld__texto" readOnly value={jsonld} rows={14} spellCheck={false} />
      </details>
    </section>
  );
}
