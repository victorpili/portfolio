import { useEffect, useRef, useState } from 'react';
import type { ItemNota, Resultado } from '@nave/shared';
import { editandoCampo } from '../interface-dados';
import {
  agruparChecklist, descreverBastidores, foraDaNota, fraseAConfirmar, jsonLdParaCopiar, nomeDoArquivo, rotuloAtributo,
  type GrupoChecklist, type Pontos,
} from '../painel-dados';
import { SITUACAO } from '../textos';
import { FichaNova, FichaOriginal } from './Fichas';

/* Tudo o que vem da loja ou do modelo entra como texto (filho de texto do React), nunca como HTML. */

const MS_COPIADO = 2000;

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
      <h3 id="checklist-titulo" className="titulo-pixel painel__subtitulo">Checklist da nota</h3>
      <table className="checklist">
        <caption className="so-leitor">Cada item da nota, antes e depois</caption>
        <thead>
          <tr>
            <th scope="col" className="rotulo-maiusculo">Item</th>
            <th scope="col" className="rotulo-maiusculo">Antes</th>
            <th scope="col" className="rotulo-maiusculo">Depois</th>
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

/** Devoluções, chamadas, duração, custo e modelo, cada um com o seu rótulo; o custo da API leva nota de rodapé. */
function Bastidores({ r }: { r: Resultado }) {
  const itens = descreverBastidores(r);
  const rodape = itens.find((i) => i.dica)?.dica;
  return (
    <>
      <ul className="placar__bastidores" aria-label="Bastidores da missão">
        {itens.map((i) => (
          <li key={i.rotulo} title={i.dica}>
            <span className="placar__item-rotulo">{i.rotulo}:</span>{' '}
            <span className="placar__item-valor">
              {i.valor}
              {i.dica && <span aria-hidden="true">*</span>}
            </span>
          </li>
        ))}
      </ul>
      {rodape && (
        <p className="placar__rodape">
          <span aria-hidden="true">* </span>Custo estimado: {rodape}.
        </p>
      )}
    </>
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

/** O painel do fim da missão: notas, as duas fichas, checklist, o que confirmar com o lojista e os botões. */
export function Painel({ resultado: r }: { resultado: Resultado }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const areaJsonld = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [copia, setCopia] = useState<'ocioso' | 'copiado' | 'falhou'>('ocioso');
  /** Conta as falhas, para focar o texto de novo a cada falha (o estado `copia` já estaria em "falhou"). */
  const [falhas, setFalhas] = useState(0);
  const [jsonldAberto, setJsonldAberto] = useState(false);

  // O painel é o resultado da missão: leva a vista (e o foco do leitor de tela) até ele.
  // Se a pessoa está digitando ou escolhendo num campo, não rouba o foco nem rola a página.
  useEffect(() => {
    if (editandoCampo(document.activeElement)) return;
    titulo.current?.focus({ preventScroll: true });
    titulo.current?.scrollIntoView({ behavior: semMovimento() ? 'auto' : 'smooth', block: 'start' });
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Cópia que falhou: o JSON-LD já está aberto (mesma renderização); seleciona o texto para copiar à mão.
  useEffect(() => {
    if (copia !== 'falhou') return;
    areaJsonld.current?.focus();
    areaJsonld.current?.select();
  }, [copia, falhas]);

  const jsonld = jsonLdParaCopiar(r.jsonld);
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
      setFalhas((n) => n + 1);
      setJsonldAberto(true);
    }
  };

  return (
    <section className="painel" aria-labelledby="painel-titulo">
      <header className="painel__topo">
        <div>
          <h2 id="painel-titulo" ref={titulo} tabIndex={-1} className="titulo-pixel painel__titulo">Antes e depois</h2>
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
            <span className="rotulo-maiusculo">antes</span>
            <span className="placar__valor">{antes}</span>
          </span>
          <span className="placar__seta" aria-hidden="true">→</span>
          <span className="placar__nota placar__nota--depois">
            <span className="rotulo-maiusculo">depois</span>
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
            {fraseAConfirmar(r.aConfirmar.length)}
          </p>
          <Bastidores r={r} />
        </div>
      </div>

      <div className="comparacao">
        <FichaOriginal r={r} />
        <FichaNova r={r} />
      </div>

      <div className="painel__baixo">
        <Checklist grupos={grupos} />
        <section className="painel__caixa painel__caixa--confirmar" aria-labelledby="confirmar-titulo">
          <h3 id="confirmar-titulo" className="titulo-pixel painel__subtitulo">A confirmar com o lojista</h3>
          {r.aConfirmar.length > 0 ? (
            <>
              <p className="painel__explica">A ficha original não diz. A nave não inventa: pergunta.</p>
              <ol className="confirmar">
                {r.aConfirmar.map((c) => (
                  <li key={c.id}>
                    <span className="rotulo-maiusculo confirmar__atributo">{rotuloAtributo(r, c.id)}</span>
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
