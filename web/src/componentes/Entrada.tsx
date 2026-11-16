import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CodigoErro, EntradaMissao } from '@nave/shared';
import { textoDoErro } from '../textos';

export type EstadoServidor = 'aquecendo' | 'pronto' | 'fora';
export type OpcaoGravada = { nome: string; rotulo: string };
type Modo = 'url' | 'texto';

const TEXTO_MIN = 80;
const TEXTO_MAX = 20_000;
/** Erros em que colar o texto da ficha resolve. */
const SUGERE_TEXTO: string[] = ['loja_bloqueou', 'produto_nao_encontrado'] satisfies CodigoErro[];

/** O rótulo do botão da missão ao vivo. */
export function rotuloIniciar(servidor: EstadoServidor, emMissao: boolean): string {
  if (servidor === 'fora') return 'missão ao vivo indisponível agora';
  if (servidor === 'aquecendo') return 'aquecendo os motores…';
  if (emMissao) return 'missão em andamento…';
  return 'Iniciar missão';
}

const AVISO_SERVIDOR: Record<Exclude<EstadoServidor, 'pronto'>, string> = {
  aquecendo: 'O servidor grátis dorme quando ninguém usa e leva até 1 minuto para acordar. As missões gravadas já funcionam.',
  fora: 'A missão ao vivo não está disponível agora. As missões gravadas funcionam normalmente.',
};

const numero = (n: number) => n.toLocaleString('pt-BR');

interface Props {
  servidor: EstadoServidor;
  /** Alguma missão (ao vivo ou gravada) em andamento: desativa "Iniciar missão". */
  emMissao: boolean;
  /** Missão ao vivo em andamento: desativa "Assistir". */
  aoVivoEmCurso: boolean;
  cota: { restantes: number; porDia: number } | null;
  /** `null` enquanto o índice carrega. */
  gravadas: OpcaoGravada[] | null;
  erro: CodigoErro | null;
  aoIniciar(entrada: EntradaMissao): void;
  aoAssistir(nome: string): void;
}

/** Os controles: missão ao vivo (URL ou texto colado), missão gravada, cota e a caixa de erro. */
export function Entrada(p: Props) {
  const [modo, setModo] = useState<Modo>('url');
  const [url, setUrl] = useState('');
  const [texto, setTexto] = useState('');
  const [escolhida, setEscolhida] = useState('');
  const campoTexto = useRef<HTMLTextAreaElement>(null);
  const focarTexto = useRef(false);

  useEffect(() => {
    if (modo === 'texto' && focarTexto.current) campoTexto.current?.focus();
    focarTexto.current = false;
  }, [modo]);

  const gravadas = p.gravadas ?? [];
  const gravada = gravadas.some((g) => g.nome === escolhida) ? escolhida : (gravadas[0]?.nome ?? '');
  const valor = modo === 'url' ? url.trim() : texto.trim();
  const podeIniciar = p.servidor === 'pronto' && !p.emMissao && valor.length > 0;
  const aviso = p.servidor === 'pronto' ? null : AVISO_SERVIDOR[p.servidor];
  const tamanho = texto.trim().length;

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    if (!podeIniciar) return;
    p.aoIniciar(modo === 'url' ? { url: valor } : { texto: valor });
  };

  const colarTexto = () => {
    focarTexto.current = true;
    setModo('texto');
  };

  const erro = p.erro ? textoDoErro(p.erro) : null;

  return (
    <section className="entrada" aria-label="Controles da missão">
      <div className="entrada__grade">
        <form className="entrada__bloco" onSubmit={enviar} noValidate>
          <div className="entrada__cabeca">
            <h2 className="entrada__titulo">Missão ao vivo</h2>
            {p.cota && (
              <p className="entrada__cota" title="Missões ao vivo que ainda dá para rodar hoje">
                cota de hoje: {p.cota.restantes}/{p.cota.porDia}
              </p>
            )}
          </div>

          <fieldset className="alternador">
            <legend className="so-leitor">Tipo de entrada</legend>
            <label>
              <input type="radio" name="modo" value="url" checked={modo === 'url'} onChange={() => setModo('url')} />
              URL do produto
            </label>
            <label>
              <input type="radio" name="modo" value="texto" checked={modo === 'texto'} onChange={() => setModo('texto')} />
              Colar o texto
            </label>
          </fieldset>

          <div className={`entrada__linha${modo === 'texto' ? ' entrada__linha--texto' : ''}`}>
            {modo === 'url' ? (
              <>
                <label htmlFor="entrada-url" className="so-leitor">URL do produto</label>
                <input
                  id="entrada-url"
                  className="campo"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="https://loja.com/products/produto"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  aria-describedby="entrada-dica"
                />
              </>
            ) : (
              <>
                <label htmlFor="entrada-texto" className="so-leitor">Texto da ficha do produto</label>
                <textarea
                  id="entrada-texto"
                  ref={campoTexto}
                  className="campo campo--texto"
                  placeholder="Cole aqui o título e a descrição do produto, como aparecem na loja."
                  value={texto}
                  maxLength={TEXTO_MAX + 2000}
                  onChange={(e) => setTexto(e.target.value)}
                  aria-describedby="entrada-dica"
                />
              </>
            )}
            <button type="submit" className="botao" disabled={!podeIniciar} aria-describedby={aviso ? 'entrada-aviso' : undefined}>
              {rotuloIniciar(p.servidor, p.emMissao)}
            </button>
          </div>

          {modo === 'url' ? (
            <p id="entrada-dica" className="entrada__dica">
              Uma página de produto de loja Shopify. Se a loja bloquear a leitura, cole o texto da ficha.
            </p>
          ) : (
            <p
              id="entrada-dica"
              className={`entrada__dica${tamanho > 0 && (tamanho < TEXTO_MIN || tamanho > TEXTO_MAX) ? ' entrada__dica--fora' : ''}`}
            >
              {numero(tamanho)} de {numero(TEXTO_MAX)} caracteres (mínimo {TEXTO_MIN}).
            </p>
          )}
          {aviso && (
            <p id="entrada-aviso" className="entrada__aviso">
              {aviso}
            </p>
          )}
        </form>

        <div className="entrada__bloco entrada__bloco--gravada">
          <h2 className="entrada__titulo">Missão gravada</h2>
          {p.gravadas === null ? (
            <p className="entrada__dica">Carregando as missões gravadas…</p>
          ) : gravadas.length === 0 ? (
            <p className="entrada__dica">Nenhuma missão gravada ainda.</p>
          ) : (
            <>
              <div className="entrada__linha">
                <label htmlFor="entrada-gravada" className="so-leitor">Ver missão gravada</label>
                <select id="entrada-gravada" className="campo campo--lista" value={gravada} onChange={(e) => setEscolhida(e.target.value)}>
                  {gravadas.map((g) => (
                    <option key={g.nome} value={g.nome}>
                      {g.rotulo}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="botao botao--assistir"
                  disabled={p.aoVivoEmCurso}
                  onClick={() => p.aoAssistir(gravada)}
                  aria-describedby={p.aoVivoEmCurso ? 'entrada-espera' : undefined}
                >
                  Assistir
                </button>
              </div>
              <p id="entrada-espera" className="entrada__dica">
                {p.aoVivoEmCurso
                  ? 'Disponível quando a missão ao vivo terminar.'
                  : 'Gravada antes, com os mesmos agentes: abre na hora e não gasta nada.'}
              </p>
            </>
          )}
        </div>

        {erro && (
          <div className="caixa-erro" role="alert">
            <p className="caixa-erro__titulo">{erro.titulo}</p>
            <p className="caixa-erro__sugestao">{erro.sugestao}</p>
            <div className="caixa-erro__acoes">
              {p.erro && SUGERE_TEXTO.includes(p.erro) && modo === 'url' && (
                <button type="button" className="botao botao--leve" onClick={colarTexto}>
                  Colar o texto da ficha
                </button>
              )}
              {gravada && (
                <button type="button" className="botao botao--assistir" disabled={p.aoVivoEmCurso} onClick={() => p.aoAssistir(gravada)}>
                  Assistir uma missão gravada
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
