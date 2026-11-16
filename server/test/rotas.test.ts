import { afterEach, describe, it, expect, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Evento } from '@nave/shared';
import type { Prompts } from '../src/agentes';
import { criarCota, type Cota } from '../src/limites';
import { motorFalso } from '../src/motores/falso';
import type { Chamada, Motor, RespostaMotor } from '../src/motores/motor';
import { criarApp } from '../src/rotas';
import { fichaNovaCaneca, originalCaneca, pesquisaBoa, revisaoAprova } from './fixtures/respostas';

const prompts: Prompts = { pesquisador: 'P', redator: 'R', revisor: 'V' };
const URL_OK = 'https://l.com/products/x';
const ORIGEM = 'https://nave.exemplo.com';
const servidores: Server[] = [];

afterEach(() => {
  for (const s of servidores.splice(0)) {
    s.closeAllConnections();
    s.close();
  }
  vi.restoreAllMocks();
});

const motorFeliz = () => motorFalso({ pesquisador: [pesquisaBoa], redator: [fichaNovaCaneca], revisor: [revisaoAprova] });
const cotaPadrao = () => criarCota({ porDia: 5, porVisitante: 3 });

async function subir(o: { motor?: Motor; cota?: Cota; lerProduto?: (url: string) => Promise<typeof originalCaneca> } = {}) {
  const cota = o.cota ?? cotaPadrao();
  const app = criarApp({
    motor: o.motor ?? motorFeliz(), prompts, cota, origens: [ORIGEM], lerProduto: o.lerProduto ?? (async () => originalCaneca),
  });
  const servidor = await new Promise<Server>((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  servidores.push(servidor);
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const post = (corpo: unknown, init: RequestInit = {}) => fetch(`${base}/api/missao`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), ...init,
  });
  return { cota, base, post };
}

/** Lê o SSE até o fim e devolve os eventos. */
async function lerEventos(res: Response): Promise<Evento[]> {
  const texto = await res.text();
  return texto.split('\n\n').filter((b) => b.startsWith('data: ')).map((b) => JSON.parse(b.slice(6)) as Evento);
}

/** Motor que só termina quando o sinal da chamada aborta; avisa quando a primeira chamada começa. */
function motorPreso(aoChamar: () => void): Motor {
  return {
    nome: 'falso', modelo: 'falso',
    chamar: <T>(c: Chamada<T>) => new Promise<RespostaMotor<T>>((_, rejeitar) => {
      c.sinal!.addEventListener('abort', () => rejeitar(new Error('cancelado')));
      aoChamar();
    }),
  };
}

/** Roda `corpo` com um vigia de exceções não tratadas e devolve as que apareceram. */
async function vigiandoErros(corpo: () => Promise<void>): Promise<unknown[]> {
  const erros: unknown[] = [];
  const naoTratado = (e: unknown) => erros.push(e);
  process.on('unhandledRejection', naoTratado);
  process.on('uncaughtException', naoTratado);
  try {
    await corpo();
    await new Promise((ok) => setTimeout(ok, 100));
  } finally {
    process.off('unhandledRejection', naoTratado);
    process.off('uncaughtException', naoTratado);
  }
  return erros;
}

describe('POST /api/missao: entrada', () => {
  it.each([
    [{}, 400, 'entrada_invalida'],
    [{ url: 'http://l.com/products/x' }, 400, 'url_invalida'],
    [{ texto: 'curto' }, 400, 'texto_invalido'],
    [{ texto: 'a'.repeat(20_001) }, 400, 'texto_invalido'],
  ])('POST %j → %i %s', async (corpo, status, codigo) => {
    const { post, cota } = await subir();
    const res = await post(corpo);
    expect(res.status).toBe(status);
    expect((await res.json()).codigo).toBe(codigo);
    expect(cota.restantes()).toBe(5);
  });

  it('JSON quebrado → 400 entrada_invalida', async () => {
    const { base } = await subir();
    const res = await fetch(`${base}/api/missao`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oi' });
    expect(res.status).toBe(400);
    expect((await res.json()).codigo).toBe('entrada_invalida');
  });

  it('corpo acima de 64 kb é recusado', async () => {
    const { post } = await subir();
    const res = await post({ texto: 'a'.repeat(70_000) });
    expect(res.status).toBe(413);
  });

  it('cota zerada → 429 cota_esgotada', async () => {
    const { post } = await subir({ cota: criarCota({ porDia: 0, porVisitante: 3 }) });
    const res = await post({ url: URL_OK });
    expect(res.status).toBe(429);
    expect((await res.json()).codigo).toBe('cota_esgotada');
  });

  it('visitante ocupado → 429 missao_em_andamento', async () => {
    const cota = cotaPadrao();
    cota.reservar('127.0.0.1');
    cota.reservar('::ffff:127.0.0.1');
    const { post } = await subir({ cota });
    const res = await post({ url: URL_OK });
    expect(res.status).toBe(429);
    expect((await res.json()).codigo).toBe('missao_em_andamento');
  });
});

describe('POST /api/missao: missão', () => {
  it('missão feliz chega em SSE, consome a cota e registra o custo por chamada', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const base = motorFeliz();
    const motor: Motor = {
      ...base,
      async chamar<T>(c: Chamada<T>) {
        return { ...(await base.chamar(c)), tokensEntrada: 100, tokensSaida: 50, custoUsd: 0.01 };
      },
    };
    const { post, cota } = await subir({ motor });
    const res = await post({ url: URL_OK });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    const eventos = await lerEventos(res);
    expect(eventos[0].tipo).toBe('missao_iniciada');
    expect(eventos.at(-1)!.tipo).toBe('missao_concluida');
    expect(cota.restantes()).toBe(4);

    const linhas = log.mock.calls.map((c) => String(c[0]));
    expect(linhas.filter((l) => /^chamada /.test(l))).toHaveLength(3);
    expect(linhas.some((l) => l.includes('pesquisador') && l.includes('tentativa 1') && l.includes('100') && l.includes('0.0100'))).toBe(true);
    expect(linhas.some((l) => l.includes('total') && l.includes('0.0300'))).toBe(true);
    expect(linhas.join('\n')).not.toContain('127.0.0.1');
  });

  it('erro antes da primeira chamada: evento de erro e a cota não cai', async () => {
    const { post, cota } = await subir({ lerProduto: async () => { throw new Error('x'); } });
    const eventos = await lerEventos(await post({ url: URL_OK }));
    expect(eventos.at(-1)).toMatchObject({ tipo: 'erro' });
    expect(cota.restantes()).toBe(5);
  });

  it('aceita texto colado e abre o SSE (o conteúdo não bate com o roteiro falso, então a missão pode acabar em erro)', async () => {
    const { post } = await subir();
    const res = await post({ texto: 'Caneca de barro esmaltado, 350 ml. '.repeat(5) });
    expect(res.status).toBe(200);
    expect((await lerEventos(res))[0].tipo).toBe('missao_iniciada');
  });

  it('cliente fecha no meio, depois da primeira chamada: a confirmação vale e a vaga é liberada', async () => {
    const erros = await vigiandoErros(async () => {
      let chamou!: () => void;
      const primeira = new Promise<void>((ok) => { chamou = ok; });
      const { post, cota } = await subir({ motor: motorPreso(chamou) });
      const ctrl = new AbortController();
      const res = await post({ url: URL_OK }, { signal: ctrl.signal });
      await primeira;
      ctrl.abort();
      await expect(res.text()).rejects.toThrow();
      await vi.waitFor(() => expect(cota.restantes()).toBe(4));
      await vi.waitFor(() => {
        const r = cota.reservar('127.0.0.1');
        expect(r.ok).toBe(true);
        (r as { liberar(): void }).liberar();
      });
    });
    expect(erros).toEqual([]);
  });

  it('cliente fecha antes da primeira chamada: a cota não cai e nada estoura', async () => {
    const erros = await vigiandoErros(async () => {
      let abrirPortao!: () => void;
      const portao = new Promise<void>((ok) => { abrirPortao = ok; });
      let leu!: () => void;
      const comecou = new Promise<void>((ok) => { leu = ok; });
      const { post, cota } = await subir({ lerProduto: async () => { leu(); await portao; return originalCaneca; } });
      const ctrl = new AbortController();
      const res = await post({ url: URL_OK }, { signal: ctrl.signal });
      await comecou;
      ctrl.abort();
      await expect(res.text()).rejects.toThrow();
      await new Promise((ok) => setTimeout(ok, 30));
      abrirPortao(); // a Capitã ainda emite até a próxima checagem do sinal, já com o socket fechado
      await new Promise((ok) => setTimeout(ok, 100));
      expect(cota.restantes()).toBe(5);
      const r = cota.reservar('127.0.0.1');
      expect(r.ok).toBe(true);
    });
    expect(erros).toEqual([]);
  });

  it('batimento a cada 15 s enquanto a missão roda', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      let chamou!: () => void;
      const primeira = new Promise<void>((ok) => { chamou = ok; });
      const { base } = await subir({ motor: motorPreso(chamou) });
      const ctrl = new AbortController();
      const res = await fetch(`${base}/api/missao`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: URL_OK }), signal: ctrl.signal,
      });
      await primeira;
      vi.advanceTimersByTime(15_000);
      const leitor = res.body!.getReader();
      const dec = new TextDecoder();
      let texto = '';
      while (!texto.includes('"batimento"')) texto += dec.decode((await leitor.read()).value);
      expect(texto).toContain('"tipo":"batimento"');
      ctrl.abort();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('outras rotas', () => {
  it('CORS só para origem permitida', async () => {
    const { base } = await subir();
    const ok = await fetch(`${base}/api/saude`, { headers: { origin: ORIGEM } });
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGEM);
    const outra = await fetch(`${base}/api/saude`, { headers: { origin: 'https://outra.com' } });
    expect(outra.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await fetch(`${base}/api/missao`, { method: 'OPTIONS', headers: { origin: ORIGEM } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type');
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('GET /api/saude', async () => {
    const { base } = await subir();
    expect(await (await fetch(`${base}/api/saude`)).json()).toEqual({ ok: true });
  });

  it('GET /api/cota', async () => {
    const { base } = await subir();
    expect(await (await fetch(`${base}/api/cota`)).json()).toEqual({ restantes: 5, porDia: 5 });
  });
});
