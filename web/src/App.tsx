import { useEffect, useReducer, useRef, useState } from 'react';
import type { Agente, EntradaMissao, Evento, MissaoGravada } from '@nave/shared';
import { acordar, carregarGravada, carregarIndice, ErroApi, iniciarMissao, lerCota } from './api';
import { API_URL } from './config';
import { Entrada, type EstadoServidor, type OpcaoGravada } from './componentes/Entrada';
import { Nave } from './componentes/Nave';
import { Painel } from './componentes/Painel';
import { Terminal } from './componentes/Terminal';
import { estadoInicial, reduzir, type EstadoNave } from './estado';
import { criarFila } from './fila';
import { eventoDeErro } from './textos';
import './interface.css';

type Fila = ReturnType<typeof criarFila>;
type Cota = { restantes: number; porDia: number };
type Missao = { tipo: 'gravada' | 'ao_vivo'; descricao: string };

/** Além dos eventos, o App limpa a tela ao começar outra missão (o redutor só limpa no `missao_iniciada`). */
type Acao = Evento | { tipo: 'reiniciar' };
const REINICIAR: Acao = { tipo: 'reiniciar' };

function reduzirApp(s: EstadoNave, a: Acao): EstadoNave {
  return a.tipo === 'reiniciar' ? estadoInicial() : reduzir(s, a);
}

/** Nome da opção do exemplo do motor falso, só em desenvolvimento. */
const EXEMPLO_DEV = '#exemplo';

/**
 * As missões do índice. Sem índice, em desenvolvimento, só o exemplo do motor falso; em produção, nenhuma.
 * O `import()` do exemplo fica atrás de `import.meta.env.DEV`, para o build de produção não levar o arquivo.
 */
async function listarGravadas(): Promise<OpcaoGravada[]> {
  try {
    const indice = await carregarIndice();
    if (Array.isArray(indice) && indice.length > 0) {
      return indice.map((m) => ({ nome: m.nome, rotulo: `${m.titulo} (${m.loja})` }));
    }
  } catch {
    /* sem missões gravadas ainda */
  }
  if (import.meta.env.DEV) return [{ nome: EXEMPLO_DEV, rotulo: 'Exemplo (motor falso)' }];
  return [];
}

async function buscarGravada(nome: string): Promise<MissaoGravada> {
  if (import.meta.env.DEV) {
    if (nome === EXEMPLO_DEV) {
      const exemplo = await import('./dev/missao-exemplo.json');
      return exemplo.default as unknown as MissaoGravada;
    }
  }
  return carregarGravada(nome);
}

function descreverGravada(m: MissaoGravada): string {
  return `Missão gravada · ${m.titulo} · ${m.loja}${m.modelo === 'falso' ? ' · motor falso' : ''}`;
}

function descreverAoVivo(entrada: EntradaMissao): string {
  if ('texto' in entrada) return 'Missão ao vivo · texto colado';
  try {
    return `Missão ao vivo · ${new URL(entrada.url).hostname}`;
  } catch {
    return 'Missão ao vivo';
  }
}

const TRIPULACAO: { agente: Agente; nome: string; papel: string; quem: string }[] = [
  { agente: 'capita', nome: 'Capitã', papel: 'coordena', quem: 'código' },
  { agente: 'imediato', nome: 'Imediato', papel: 'confere as entregas', quem: 'código' },
  { agente: 'pesquisador', nome: 'Pesquisador', papel: 'extrai os atributos', quem: 'Claude' },
  { agente: 'redator', nome: 'Redator', papel: 'reescreve a ficha', quem: 'Claude' },
  { agente: 'revisor', nome: 'Revisor', papel: 'julga cada item', quem: 'Claude' },
];

export function App() {
  const [estado, aplicar] = useReducer(reduzirApp, undefined, estadoInicial);
  const [servidor, setServidor] = useState<EstadoServidor>(API_URL ? 'aquecendo' : 'fora');
  const [cota, setCota] = useState<Cota | null>(null);
  const [gravadas, setGravadas] = useState<OpcaoGravada[] | null>(null);
  const [missao, setMissao] = useState<Missao | null>(null);
  /** O pedido da missão ao vivo está aberto (do envio até o stream fechar). */
  const [pedidoAberto, setPedidoAberto] = useState(false);

  const fila = useRef<Fila | null>(null);
  const controle = useRef<AbortController | null>(null);
  /** Sobe a cada missão nova: o que chega de uma missão antiga é ignorado. */
  const geracao = useRef(0);
  const naveRef = useRef<HTMLDivElement>(null);

  /** Para a missão em curso (fila e pedido ao vivo) e devolve o número da próxima. */
  const encerrar = (): number => {
    fila.current?.parar();
    fila.current = null;
    controle.current?.abort();
    controle.current = null;
    return ++geracao.current;
  };

  useEffect(() => {
    let ativo = true;
    listarGravadas().then((g) => {
      if (ativo) setGravadas(g);
    });
    // Sem API configurada, não acorda nem lê a cota: o estado fica "fora" e as gravadas funcionam.
    if (API_URL) {
      const base = API_URL;
      acordar(base).then((ok) => {
        if (!ativo) return;
        setServidor(ok ? 'pronto' : 'fora');
        if (ok) lerCota(base).then((c) => ativo && setCota(c));
      });
    }
    return () => {
      ativo = false;
      encerrar();
    };
  }, []);

  // Missão começou (o `missao_iniciada` chegou): se a nave está fora da vista (celular, controles embaixo), leva a vista até ela.
  useEffect(() => {
    if (estado.fase !== 'em_missao') return;
    const el = naveRef.current;
    if (!el) return;
    const topo = el.getBoundingClientRect().top;
    if (topo >= 0 && topo <= window.innerHeight / 2) return;
    const reduzido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    el.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'start' });
  }, [estado.fase]);

  const aoVivoEmCurso = pedidoAberto || (missao?.tipo === 'ao_vivo' && estado.fase === 'em_missao');
  const emMissao = pedidoAberto || estado.fase === 'em_missao';

  async function assistir(nome: string) {
    // Durante a missão ao vivo, assistir fica desativado (a missão ao vivo gasta cota e não é cancelada).
    if (aoVivoEmCurso) return;
    const minha = encerrar();
    aplicar(REINICIAR);
    setMissao(null);
    let m: MissaoGravada;
    try {
      m = await buscarGravada(nome);
    } catch (err) {
      if (minha !== geracao.current) return;
      console.error(err);
      aplicar(eventoDeErro(new ErroApi('conexao_perdida', 'Não consegui carregar a missão gravada.'), Date.now()));
      return;
    }
    if (minha !== geracao.current) return;
    setMissao({ tipo: 'gravada', descricao: descreverGravada(m) });
    const f = criarFila(aplicar, 'replay');
    fila.current = f;
    for (const e of m.eventos) f.empurrar(e);
  }

  async function iniciar(entrada: EntradaMissao) {
    if (!API_URL || servidor !== 'pronto' || emMissao) return;
    const base = API_URL;
    const minha = encerrar();
    aplicar(REINICIAR);
    setMissao({ tipo: 'ao_vivo', descricao: descreverAoVivo(entrada) });
    const f = criarFila(aplicar, 'ao_vivo');
    const c = new AbortController();
    fila.current = f;
    controle.current = c;
    setPedidoAberto(true);
    try {
      await iniciarMissao(base, entrada, f.empurrar, c.signal);
    } catch (err) {
      // Abort feito por nós (outra missão ou a página fechando) não é erro.
      if (!c.signal.aborted) {
        if (!(err instanceof ErroApi)) console.error(err);
        f.empurrar(eventoDeErro(err, Date.now()));
      }
    } finally {
      if (controle.current === c) controle.current = null;
      if (minha === geracao.current) setPedidoAberto(false);
      if (!c.signal.aborted) lerCota(base).then(setCota);
    }
  }

  const erro = estado.fase === 'erro' ? (estado.erro?.codigo ?? null) : null;

  return (
    <main className="pagina">
      <header className="cabecalho">
        <h1 className="cabecalho__titulo">Nave de Agentes</h1>
        <p className="cabecalho__texto">
          Uma tripulação de agentes de IA prepara a ficha de um produto de loja online para ser encontrada por assistentes
          como ChatGPT e Gemini. Assista a uma missão gravada ou cole a URL de um produto Shopify e veja a nave trabalhar
          ao vivo. No fim, o antes e o depois, com a nota de prontidão para IA.
        </p>
        <ul className="tripulantes" aria-label="Tripulação">
          {TRIPULACAO.map((t) => (
            <li key={t.agente} className={`tripulante cor--${t.agente}`}>
              <span className="tripulante__marca" aria-hidden="true" />
              <span className="tripulante__nome">{t.nome}</span>
              <span className="tripulante__papel">
                {t.papel} <span className="tripulante__quem">({t.quem})</span>
              </span>
            </li>
          ))}
        </ul>
      </header>

      <div className="console">
        <div className="console__nave" ref={naveRef}>
          <Nave estado={estado} />
        </div>
        <Entrada
          servidor={servidor}
          emMissao={emMissao}
          aoVivoEmCurso={aoVivoEmCurso}
          cota={cota}
          gravadas={gravadas}
          erro={erro}
          aoIniciar={iniciar}
          aoAssistir={assistir}
        />
        <Terminal linhas={estado.linhas} missao={missao?.descricao ?? null} />
      </div>

      {estado.fase === 'concluida' && estado.resultado && <Painel resultado={estado.resultado} />}
    </main>
  );
}
