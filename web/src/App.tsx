import { useEffect, useReducer, useRef, useState } from 'react';
import type { Agente, CodigoErro, EntradaMissao, Evento, MissaoGravada } from '@nave/shared';
import { acordar, carregarGravada, carregarIndice, ErroApi, iniciarMissao, lerCota } from './api';
import { API_URL } from './config';
import { Entrada } from './componentes/Entrada';
import { Nave } from './componentes/Nave';
import { Painel } from './componentes/Painel';
import { Terminal } from './componentes/Terminal';
import { estadoInicial, reduzir, type EstadoNave } from './estado';
import { criarFila } from './fila';
import { deveAcordarDeNovo, type EstadoServidor, type OpcaoGravada, type TipoMissao } from './interface-dados';
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
  /** Sobe a cada vez que o App acorda o servidor: só a resposta da última vale. */
  const despertar = useRef(0);
  const montado = useRef(false);
  const naveRef = useRef<HTMLDivElement>(null);

  /** Para a missão em curso (fila e pedido ao vivo) e devolve o número da próxima. */
  const encerrar = (): number => {
    fila.current?.parar();
    fila.current = null;
    controle.current?.abort();
    controle.current = null;
    return ++geracao.current;
  };

  /** Acorda o servidor (o Render grátis dorme) e lê a cota; resposta depois de desmontar ou de outra tentativa não vale. */
  const acordarServidor = (base: string): void => {
    const vez = ++despertar.current;
    const valendo = () => montado.current && vez === despertar.current;
    setServidor('aquecendo');
    acordar(base).then((ok) => {
      if (!valendo()) return;
      setServidor(ok ? 'pronto' : 'fora');
      if (ok) lerCota(base).then((c) => valendo() && setCota(c));
    });
  };

  useEffect(() => {
    montado.current = true;
    listarGravadas().then((g) => {
      if (montado.current) setGravadas(g);
    });
    // Sem API configurada, não acorda nem lê a cota: o estado fica "fora" e as gravadas funcionam.
    if (API_URL) acordarServidor(API_URL);
    return () => {
      montado.current = false;
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
  const emCurso: TipoMissao | null = aoVivoEmCurso ? 'ao_vivo' : estado.fase === 'em_missao' ? 'gravada' : null;

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
      // Arquivo que não abriu não é `ErroApi`: vira `api_fora`, como qualquer falha inesperada.
      console.error(err);
      aplicar(eventoDeErro(err, Date.now()));
      return;
    }
    if (minha !== geracao.current) return;
    setMissao({ tipo: 'gravada', descricao: descreverGravada(m) });
    const f = criarFila(aplicar, 'replay');
    fila.current = f;
    for (const e of m.eventos) f.empurrar(e);
  }

  async function iniciar(entrada: EntradaMissao) {
    if (!API_URL || servidor !== 'pronto' || emCurso !== null) return;
    const base = API_URL;
    const minha = encerrar();
    aplicar(REINICIAR);
    setMissao({ tipo: 'ao_vivo', descricao: descreverAoVivo(entrada) });
    const f = criarFila(aplicar, 'ao_vivo');
    const c = new AbortController();
    fila.current = f;
    controle.current = c;
    setPedidoAberto(true);
    // O código do erro que encerrou a missão, venha ele do servidor (evento) ou daqui (ErroApi).
    let codigoFinal = null as CodigoErro | null;
    try {
      await iniciarMissao(base, entrada, (e) => {
        if (e.tipo === 'erro') codigoFinal = e.codigo;
        f.empurrar(e);
      }, c.signal);
    } catch (err) {
      // Abort feito por nós (outra missão ou a página fechando) não é erro.
      if (!c.signal.aborted) {
        if (!(err instanceof ErroApi)) console.error(err);
        const evento = eventoDeErro(err, Date.now());
        codigoFinal = evento.codigo;
        f.empurrar(evento);
      }
    } finally {
      if (controle.current === c) controle.current = null;
      if (minha === geracao.current) setPedidoAberto(false);
      if (!c.signal.aborted && montado.current) {
        // A conexão caiu ou o servidor falhou: ele pode ter caído ou dormido. Acorda de novo (e lê a cota).
        if (deveAcordarDeNovo(codigoFinal)) acordarServidor(base);
        else lerCota(base).then((cotaNova) => montado.current && setCota(cotaNova));
      }
    }
  }

  const erro = estado.fase === 'erro' ? (estado.erro?.codigo ?? null) : null;

  return (
    <main className="pagina">
      <header className="cabecalho">
        <h1 className="titulo-pixel cabecalho__titulo">Nave de Agentes</h1>
        <p className="cabecalho__texto">
          Uma tripulação de agentes de IA prepara a ficha de um produto de loja online para ser encontrada por assistentes
          de IA como ChatGPT, Claude e Gemini. Assista a uma missão gravada ou cole a URL de um produto Shopify e veja a
          nave trabalhar ao vivo. No fim, o antes e o depois, com a nota de prontidão para IA.
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
          emCurso={emCurso}
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
