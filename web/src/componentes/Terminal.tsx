import { useLayoutEffect, useRef } from 'react';
import type { LinhaTerminal } from '../estado';
import { estaNoFim } from '../interface-dados';

const PREFIXO: Record<LinhaTerminal['tom'], string> = { normal: '>', alerta: '!', sucesso: '✓', erro: '✗' };

/**
 * O terminal da nave: uma linha por evento, na cor de quem fala, com o estilo do tom.
 * Rola sozinho para a linha nova só se o usuário já estava no fim; se ele subiu para ler, fica onde está.
 */
export function Terminal({ linhas, missao }: { linhas: LinhaTerminal[]; missao: string | null }) {
  const lista = useRef<HTMLOListElement>(null);
  const noFim = useRef(true);
  const quantas = useRef(0);

  useLayoutEffect(() => {
    const el = lista.current;
    if (!el) return;
    // Missão nova (a lista encolheu): volta a acompanhar o fim.
    if (linhas.length < quantas.current) noFim.current = true;
    quantas.current = linhas.length;
    if (noFim.current) el.scrollTop = el.scrollHeight;
  }, [linhas]);

  return (
    <section className={`terminal${linhas.length === 0 ? ' terminal--vazio' : ''}`} aria-labelledby="terminal-titulo">
      <header className="terminal__topo">
        <h2 id="terminal-titulo" className="titulo-pixel terminal__titulo">Terminal da nave</h2>
        {missao && <p className="terminal__missao">{missao}</p>}
      </header>
      <div className="terminal__corpo">
        {linhas.length === 0 && (
          <p className="terminal__vazio">
            Nenhuma missão ainda. Assista a uma missão gravada ou inicie uma ao vivo.
            <span className="terminal__cursor" aria-hidden="true">_</span>
          </p>
        )}
        <ol
          ref={lista}
          className="terminal__linhas"
          aria-live="polite"
          aria-label="Linhas do terminal"
          tabIndex={0}
          onScroll={(e) => {
            noFim.current = estaNoFim(e.currentTarget);
          }}
        >
          {linhas.map((l, i) => (
            <li key={`${i}-${l.seq}`} className={`linha linha--${l.tom} cor--${l.agente ?? 'nave'}`}>
              <span className="linha__prefixo" aria-hidden="true">
                {PREFIXO[l.tom]}
              </span>
              <span className="linha__texto">{l.texto}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
