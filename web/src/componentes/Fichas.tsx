import type { ReactNode } from 'react';
import type { Resultado } from '@nave/shared';

/*
 * As duas fichas do painel, lado a lado: as duas têm os mesmos blocos, na mesma ordem, para alinhar linha a linha.
 * Tudo o que vem da loja ou do modelo entra como texto (filho de texto do React), nunca como HTML.
 */

/** Quantas imagens listar antes do "e mais N". */
const MAX_IMAGENS = 5;

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="ficha__bloco">
      <h4 className="rotulo-maiusculo ficha__rotulo">{titulo}</h4>
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

export function FichaOriginal({ r }: { r: Resultado }) {
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
        <h3 id="ficha-original" className="titulo-pixel ficha__nome">Original</h3>
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
          // Pode ser longa: rola dentro da caixa, também pelo teclado.
          <div className="ficha__texto ficha__texto--longo" tabIndex={0} role="region" aria-label="Descrição original">
            {o.descricaoTexto}
          </div>
        ) : (
          <p className="ficha__vazio">A ficha original não tem descrição.</p>
        )}
        {o.truncada && (
          <p className="ficha__nota">A ficha passava do limite (20.000 caracteres de descrição ou 30 variantes) e foi cortada.</p>
        )}
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

export function FichaNova({ r }: { r: Resultado }) {
  const f = r.fichaNova;
  return (
    <article className="ficha ficha--nova" aria-labelledby="ficha-nova">
      <header className="ficha__cabeca">
        <h3 id="ficha-nova" className="titulo-pixel ficha__nome">Pronta para IA</h3>
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
