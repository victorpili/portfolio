import { useEffect, useId, useRef, useState } from 'react';
import type { Resultado } from '@nave/shared';
import { carregarGravada, carregarIndice } from '../api';
import {
  AGENTES_CLAUDE, CHAVE_AO_VIVO, formatarTokens, formatarUsd, juntarAoVivo, lerAoVivo, registroDaGravada, registroDoResultado,
  resumir, type AgenteClaude, type Gasto, type RegistroMissao,
} from '../creditos-dados';
import { nomeDoModelo } from '../painel-dados';

const AGENTE: Record<AgenteClaude, { nome: string; tarefa: string }> = {
  pesquisador: { nome: 'Pesquisador', tarefa: 'extrai os atributos' },
  redator: { nome: 'Redator', tarefa: 'reescreve a ficha' },
  revisor: { nome: 'Revisor', tarefa: 'julga cada item' },
};

/* ---------- Missões ao vivo deste navegador ---------- */

function lerGuardadas(): RegistroMissao[] {
  try {
    return lerAoVivo(localStorage.getItem(CHAVE_AO_VIVO));
  } catch {
    return [];
  }
}

/**
 * As missões ao vivo que gastaram crédito, guardadas neste navegador (só aqui: outro visitante não vê as suas).
 * Cada resultado entra uma vez, quando a missão ao vivo termina. Sem armazenamento (aba anônima, bloqueio), vale só nesta visita.
 */
export function useMissoesAoVivo(resultado: Resultado | null, aoVivo: boolean): RegistroMissao[] {
  const [lista, setLista] = useState<RegistroMissao[]>(lerGuardadas);
  const registrado = useRef<Resultado | null>(null);

  useEffect(() => {
    if (!resultado || !aoVivo || registrado.current === resultado) return;
    registrado.current = resultado;
    const novo = registroDoResultado(resultado, `ao-vivo:${Date.now()}`, 'ao_vivo');
    if (novo) setLista((l) => juntarAoVivo(l, novo));
  }, [resultado, aoVivo]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_AO_VIVO, JSON.stringify(lista));
    } catch {
      /* sem armazenamento: a lista vale só nesta visita */
    }
  }, [lista]);

  return lista;
}

async function lerGravadas(): Promise<RegistroMissao[]> {
  const indice = await carregarIndice();
  if (!Array.isArray(indice)) return [];
  const missoes = await Promise.all(indice.map((m) => carregarGravada(m.nome)));
  return missoes.map(registroDaGravada).filter((r): r is RegistroMissao => r !== null);
}

/* ---------- Painel ---------- */

function dicaTokens(g: Gasto): string {
  return `${formatarTokens(g.tokensEntrada)} tokens de entrada, ${formatarTokens(g.tokensSaida)} de saída`;
}

function Celula({ g }: { g: Gasto }) {
  if (g.chamadas === 0) return <td className="creditos__vazio">—</td>;
  return (
    <td title={dicaTokens(g)}>
      {formatarUsd(g.usd)}
      {g.chamadas > 1 && <small className="creditos__tentativas">{g.chamadas} tentativas</small>}
    </td>
  );
}

type Gravadas = { estado: 'nao_lidas' } | { estado: 'lendo' } | { estado: 'lidas'; lista: RegistroMissao[] } | { estado: 'falhou' };

/** O botão e o painel de créditos de API: total geral, quanto cada agente gastou e com qual missão. */
export function Creditos({ aoVivo }: { aoVivo: RegistroMissao[] }) {
  const [aberto, setAberto] = useState(false);
  const [gravadas, setGravadas] = useState<Gravadas>({ estado: 'nao_lidas' });
  const id = useId();
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // As gravadas só são lidas quando o painel abre pela primeira vez.
  useEffect(() => {
    if (!aberto || gravadas.estado !== 'nao_lidas') return;
    setGravadas({ estado: 'lendo' });
    lerGravadas().then(
      (lista) => montado.current && setGravadas({ estado: 'lidas', lista }),
      () => montado.current && setGravadas({ estado: 'falhou' }),
    );
  }, [aberto, gravadas.estado]);

  const registros = [...aoVivo, ...(gravadas.estado === 'lidas' ? gravadas.lista : [])];
  const r = resumir(registros);
  const modelos = [...new Set(registros.map((m) => nomeDoModelo(m.modelo)))].join(', ');

  return (
    <div className="creditos">
      <button
        type="button"
        className="botao botao--leve creditos__botao"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        <span className="creditos__seta" aria-hidden="true">{aberto ? '▾' : '▸'}</span>
        {aberto ? 'Fechar créditos de API' : 'Créditos de API'}
      </button>

      <section id={id} className="creditos__painel" aria-labelledby={`${id}-titulo`} hidden={!aberto}>
        <h2 id={`${id}-titulo`} className="titulo-pixel creditos__titulo">Créditos de API</h2>
        <p className="creditos__explica">
          Quanto cada missão gastou de crédito da API do Claude. Só os três agentes do Claude gastam: a Capitã e o
          Imediato são código e trabalham de graça.
        </p>

        {gravadas.estado === 'lendo' && <p className="creditos__aviso" role="status">Lendo as missões gravadas…</p>}
        {gravadas.estado === 'falhou' && (
          <p className="creditos__aviso" role="alert">Não consegui ler as missões gravadas. As ao vivo deste navegador aparecem abaixo.</p>
        )}

        {gravadas.estado !== 'lendo' && registros.length === 0 && (
          <p className="creditos__aviso">Nenhuma missão pela API ainda. Rode uma missão ao vivo e o gasto aparece aqui.</p>
        )}

        {registros.length > 0 && (
          <>
            <dl className="creditos__numeros">
              <div className="creditos__numero creditos__numero--total">
                <dt className="rotulo-maiusculo">Total gasto</dt>
                <dd>{formatarUsd(r.total.usd)}</dd>
              </div>
              <div className="creditos__numero">
                <dt className="rotulo-maiusculo">Missões</dt>
                <dd>{r.missoes}</dd>
              </div>
              <div className="creditos__numero">
                <dt className="rotulo-maiusculo">Chamadas ao Claude</dt>
                <dd>{r.total.chamadas}</dd>
              </div>
              <div className="creditos__numero">
                <dt className="rotulo-maiusculo">Tokens</dt>
                <dd>
                  {formatarTokens(r.total.tokensEntrada)} <small>entrada</small>
                  <br />
                  {formatarTokens(r.total.tokensSaida)} <small>saída</small>
                </dd>
              </div>
            </dl>

            <div className="creditos__bloco">
              <h3 className="titulo-pixel creditos__subtitulo">Por agente</h3>
              <ul className="creditos__agentes">
                {r.porAgente.map((a) => (
                  <li key={a.agente} className={`creditos__agente cor--${a.agente}`} title={dicaTokens(a)}>
                    <span className="creditos__quem">
                      <span className="tripulante__marca" aria-hidden="true" />
                      <span className="creditos__nome">{AGENTE[a.agente].nome}</span>
                      <span className="creditos__tarefa">{AGENTE[a.agente].tarefa}</span>
                    </span>
                    <span className="creditos__barra" aria-hidden="true">
                      <span style={{ width: `${(a.fatia * 100).toFixed(1)}%` }} />
                    </span>
                    <span className="creditos__valor">
                      {formatarUsd(a.usd)}
                      <small>
                        {Math.round(a.fatia * 100)}% · {a.chamadas} {a.chamadas === 1 ? 'chamada' : 'chamadas'}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="creditos__bloco">
              <h3 className="titulo-pixel creditos__subtitulo">Por missão</h3>
              <div className="creditos__rolagem" tabIndex={0} role="region" aria-label="Gasto de cada agente em cada missão">
                <table className="creditos__tabela">
                  <caption className="so-leitor">Gasto de cada agente em cada missão, em dólares</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="rotulo-maiusculo">Missão</th>
                      {AGENTES_CLAUDE.map((a) => (
                        <th key={a} scope="col" className={`rotulo-maiusculo cor--${a}`}>
                          <span className="tripulante__marca" aria-hidden="true" /> {AGENTE[a].nome}
                        </th>
                      ))}
                      <th scope="col" className="rotulo-maiusculo">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.porMissao.map((m) => (
                      <tr key={m.id}>
                        <th scope="row">
                          {m.titulo}
                          <small className="creditos__origem">
                            {m.loja} · {m.origem === 'gravada' ? 'gravada' : 'ao vivo'}
                          </small>
                        </th>
                        {AGENTES_CLAUDE.map((a) => <Celula key={a} g={m.porAgente[a]} />)}
                        <td className="creditos__total" title={dicaTokens(m.total)}>{formatarUsd(m.total.usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="creditos__rodape">
              Estimativa pelos tokens de cada chamada e o preço de tabela do modelo ({modelos}). Não inclui tentativas que
              voltaram fora do formato. As missões ao vivo ficam guardadas só neste navegador.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
