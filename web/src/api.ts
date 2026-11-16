import type { CodigoErro, EntradaMissao, Evento, IndiceMissoes, MissaoGravada } from '@nave/shared';

export class ErroApi extends Error {
  constructor(public codigo: CodigoErro, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

/** Lê um stream SSE (`data: <json>\n\n`) e entrega cada evento; batimentos são ignorados. */
export async function lerEventosSse(corpo: ReadableStream<Uint8Array>, aoEvento: (e: Evento) => void): Promise<void> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let resto = '';

  const processar = (quadro: string): void => {
    const dados = quadro
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!dados) return;
    const e = JSON.parse(dados) as Evento;
    if (e.tipo !== 'batimento') aoEvento(e);
  };

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    resto += decodificador.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    let fim: number;
    while ((fim = resto.indexOf('\n\n')) !== -1) {
      processar(resto.slice(0, fim));
      resto = resto.slice(fim + 2);
    }
  }
  resto += decodificador.decode();
  if (resto.trim()) processar(resto);
}

function foiCancelado(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export async function iniciarMissao(
  base: string,
  entrada: EntradaMissao,
  aoEvento: (e: Evento) => void,
  sinal?: AbortSignal,
): Promise<void> {
  let resposta: Response;
  try {
    resposta = await fetch(`${base}/api/missao`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entrada),
      signal: sinal,
    });
  } catch (err) {
    if (foiCancelado(err)) throw err;
    throw new ErroApi('conexao_perdida', 'Não consegui falar com o servidor.');
  }

  if (!resposta.ok || !resposta.body) {
    let corpo: { codigo?: CodigoErro; mensagem?: string } = {};
    try { corpo = await resposta.json(); } catch { /* corpo vazio ou não-JSON */ }
    throw new ErroApi(corpo.codigo ?? 'api_fora', corpo.mensagem ?? 'O servidor recusou a missão.');
  }

  let terminou = false;
  try {
    await lerEventosSse(resposta.body, (e) => {
      if (e.tipo === 'missao_concluida' || e.tipo === 'erro') terminou = true;
      aoEvento(e);
    });
  } catch (err) {
    if (foiCancelado(err)) throw err;
    if (!terminou) throw new ErroApi('conexao_perdida', 'A conexão caiu no meio da missão.');
  }
  if (!terminou) throw new ErroApi('conexao_perdida', 'A conexão caiu no meio da missão.');
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** O Render grátis dorme: insiste na saúde do servidor (12 x 5 s = 60 s) até ele responder. */
export async function acordar(
  base: string,
  o: { tentativas?: number; intervaloMs?: number; fetch?: typeof fetch } = {},
): Promise<boolean> {
  const { tentativas = 12, intervaloMs = 5000, fetch: buscar = fetch } = o;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await buscar(`${base}/api/saude`);
      if (r.ok) return true;
    } catch { /* ainda dormindo */ }
    if (i < tentativas - 1) await dormir(intervaloMs);
  }
  return false;
}

export async function lerCota(
  base: string,
  o: { fetch?: typeof fetch } = {},
): Promise<{ restantes: number; porDia: number } | null> {
  const buscar = o.fetch ?? fetch;
  try {
    const r = await buscar(`${base}/api/cota`);
    if (!r.ok) return null;
    return (await r.json()) as { restantes: number; porDia: number };
  } catch {
    return null;
  }
}

async function buscarJson<T>(caminho: string, o: { fetch?: typeof fetch }): Promise<T> {
  const r = await (o.fetch ?? fetch)(caminho);
  if (!r.ok) throw new Error(`Não consegui carregar ${caminho} (${r.status}).`);
  return (await r.json()) as T;
}

export function carregarIndice(o: { fetch?: typeof fetch } = {}): Promise<IndiceMissoes> {
  return buscarJson<IndiceMissoes>('/missoes/indice.json', o);
}

export function carregarGravada(nome: string, o: { fetch?: typeof fetch } = {}): Promise<MissaoGravada> {
  return buscarJson<MissaoGravada>(`/missoes/${encodeURIComponent(nome)}.json`, o);
}
