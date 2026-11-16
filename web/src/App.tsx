import { useEffect, useReducer, useState } from 'react';
import type { MissaoGravada } from '@nave/shared';
import { carregarGravada, carregarIndice } from './api';
import { Nave } from './componentes/Nave';
import { estadoInicial, reduzir } from './estado';
import { criarFila } from './fila';
import './pagina-provisoria.css';

/** Pausa entre o fim da missão e o recomeço do loop. */
const PAUSA_LOOP_MS = 5000;

/**
 * A primeira missão do índice. Sem índice, em desenvolvimento, a missão de exemplo do motor falso
 * (o `import()` fica dentro do `if`, para o build de produção não levar o arquivo). Em produção sem índice: nada.
 */
async function primeiraMissao(): Promise<MissaoGravada | null> {
  try {
    const indice = await carregarIndice();
    if (indice[0]) return await carregarGravada(indice[0].nome);
  } catch {
    /* sem missões gravadas ainda */
  }
  if (import.meta.env.DEV) {
    const exemplo = await import('./dev/missao-exemplo.json');
    return exemplo.default as unknown as MissaoGravada;
  }
  return null;
}

// Provisório: toca a primeira missão gravada em loop. O terminal e o painel de verdade chegam na Task 14.
export function App() {
  const [estado, aplicar] = useReducer(reduzir, undefined, estadoInicial);
  const [missao, setMissao] = useState<MissaoGravada | null>(null);

  useEffect(() => {
    let cancelado = false;
    let fila: ReturnType<typeof criarFila> | null = null;
    let recomeco: ReturnType<typeof setTimeout> | undefined;

    const tocar = (m: MissaoGravada) => {
      fila?.parar();
      fila = criarFila((e) => {
        aplicar(e);
        if (e.tipo === 'missao_concluida' || e.tipo === 'erro') recomeco = setTimeout(() => tocar(m), PAUSA_LOOP_MS);
      }, 'replay');
      for (const e of m.eventos) fila.empurrar(e);
    };

    primeiraMissao().then((m) => {
      if (cancelado || !m) return;
      setMissao(m);
      tocar(m);
    });

    return () => {
      cancelado = true;
      fila?.parar();
      clearTimeout(recomeco);
    };
  }, []);

  return (
    <main className="pagina">
      <header className="topo">
        <h1>Nave de Agentes</h1>
        <p>
          Três agentes de IA reescrevem uma ficha de produto para ser lida por assistentes de IA. A Capitã coordena,
          o Imediato confere cada entrega e devolve o que não tem fonte.
        </p>
        {missao && (
          <p className="missao-atual">
            Missão: <strong>{missao.titulo}</strong> ({missao.loja}){missao.modelo === 'falso' ? ', exemplo com o motor falso' : ''}
          </p>
        )}
      </header>

      <Nave estado={estado} />

      <section className="linhas-cruas" aria-label="Terminal da nave">
        <h2>Terminal</h2>
        <ol aria-live="polite">
          {estado.linhas.map((l) => (
            <li key={l.seq} className={`linha--${l.tom}`}>
              {l.texto}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
