import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Evento } from '@nave/shared';
import { acordar, carregarGravada, carregarIndice, ErroApi, iniciarMissao, lerCota, lerEventosSse } from '../src/api';
import { ev } from './ev';

const enc = new TextEncoder();
function corpo(pedacos: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const p of pedacos) c.enqueue(enc.encode(p));
      c.close();
    },
  });
}
const quadro = (e: Evento) => `data: ${JSON.stringify(e)}\n\n`;

afterEach(() => vi.unstubAllGlobals());

describe('lerEventosSse', () => {
  it('SSE partido no meio de um evento; batimento ignorado', async () => {
    const e1 = ev({ tipo: 'aviso', seq: 1 });
    const e2 = ev({ tipo: 'missao_iniciada', seq: 2 });
    const tudo = quadro(e1) + quadro(e2) + quadro(ev({ tipo: 'batimento', seq: 3 }));
    const corte = quadro(e1).length + 2; // corta no "da" de "data:" do segundo quadro
    const recebidos: Evento[] = [];
    await lerEventosSse(corpo([tudo.slice(0, corte), tudo.slice(corte)]), (e) => recebidos.push(e));
    expect(recebidos).toEqual([e1, e2]);
  });
});

describe('lerEventosSse: bordas', () => {
  it('CRLF partido entre o \\r e o \\n da linha em branco, com outro quadro depois', async () => {
    const e1 = ev({ tipo: 'aviso', seq: 1 });
    const e2 = ev({ tipo: 'aviso', seq: 2 });
    const q1 = `data: ${JSON.stringify(e1)}\r\n\r\n`;
    const tudo = q1 + `data: ${JSON.stringify(e2)}\r\n\r\n`;
    const corte = q1.length - 1; // "…\r\n\r" | "\n" + segundo quadro
    const recebidos: Evento[] = [];
    await lerEventosSse(corpo([tudo.slice(0, corte), tudo.slice(corte)]), (e) => recebidos.push(e));
    expect(recebidos).toEqual([e1, e2]);
  });

  it('caractere UTF-8 de vários bytes partido entre pedaços', async () => {
    const e1 = ev({ tipo: 'aviso', seq: 1, mensagem: 'Capitã: ação ✓' });
    const bytes = enc.encode(quadro(e1));
    const i = bytes.indexOf(0xc3) + 1; // no meio do "ã"
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(bytes.slice(0, i)); c.enqueue(bytes.slice(i)); c.close(); },
    });
    const recebidos: Evento[] = [];
    await lerEventosSse(stream, (e) => recebidos.push(e));
    expect(recebidos).toEqual([e1]);
  });

  it('várias linhas data: no mesmo quadro viram um JSON só', async () => {
    const e1 = ev({ tipo: 'aviso', seq: 1 });
    const json = JSON.stringify(e1);
    const meio = json.indexOf(',');
    const recebidos: Evento[] = [];
    await lerEventosSse(corpo([`data: ${json.slice(0, meio)}\ndata: ${json.slice(meio)}\n\n`]), (e) => recebidos.push(e));
    expect(recebidos).toEqual([e1]);
  });

  it('JSON malformado rejeita e cancela o leitor', async () => {
    const cancelar = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(enc.encode('data: {nao-json\n\n')); },
      cancel: cancelar,
    });
    await expect(lerEventosSse(stream, () => {})).rejects.toBeInstanceOf(SyntaxError);
    expect(cancelar).toHaveBeenCalled();
  });

  it('erro do consumidor propaga como está e cancela o leitor', async () => {
    const cancelar = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(enc.encode(quadro(ev({ tipo: 'aviso', seq: 1 })))); },
      cancel: cancelar,
    });
    const falha = new Error('consumidor');
    await expect(lerEventosSse(stream, () => { throw falha; })).rejects.toBe(falha);
    expect(cancelar).toHaveBeenCalled();
  });
});

describe('iniciarMissao: abort', () => {
  function fetchQueObedece() {
    return vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_res, rej) => {
      init.signal!.addEventListener('abort', () => rej(init.signal!.reason));
    }));
  }
  function streamQueObedece(sinal: AbortSignal, status = 200) {
    const body = new ReadableStream<Uint8Array>({
      start(c) { sinal.addEventListener('abort', () => c.error(sinal.reason)); },
    });
    return new Response(body, { status });
  }

  for (const [nome, razao] of [['abort() padrão', undefined], ['abort(new Error)', new Error('x')]] as const) {
    it(`${nome} no fetch rejeita com sinal.reason`, async () => {
      const ac = new AbortController();
      vi.stubGlobal('fetch', fetchQueObedece());
      const p = iniciarMissao('http://x', { texto: 't' }, () => {}, ac.signal);
      ac.abort(razao);
      await expect(p).rejects.toBe(ac.signal.reason);
    });

    it(`${nome} lendo o stream rejeita com sinal.reason`, async () => {
      const ac = new AbortController();
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => streamQueObedece(ac.signal)));
      const p = iniciarMissao('http://x', { texto: 't' }, () => {}, ac.signal);
      await new Promise((r) => setTimeout(r, 0));
      ac.abort(razao);
      await expect(p).rejects.toBe(ac.signal.reason);
    });

    it(`${nome} lendo o corpo de um não-200 rejeita com sinal.reason`, async () => {
      const ac = new AbortController();
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => streamQueObedece(ac.signal, 429)));
      const p = iniciarMissao('http://x', { texto: 't' }, () => {}, ac.signal);
      await new Promise((r) => setTimeout(r, 0));
      ac.abort(razao);
      await expect(p).rejects.toBe(ac.signal.reason);
    });
  }

  it('erro do consumidor depois do evento final também propaga', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(corpo([quadro(ev({ tipo: 'erro', codigo: 'api_fora', recuperavel: true, sugestao: '' }))]), { status: 200 })));
    const falha = new Error('consumidor');
    await expect(iniciarMissao('http://x', { texto: 't' }, () => { throw falha; })).rejects.toBe(falha);
  });
});

describe('iniciarMissao', () => {
  it('stream que termina sem conclusão → conexao_perdida', async () => {
    const f = vi.fn().mockResolvedValue(new Response(corpo([quadro(ev({ tipo: 'missao_iniciada', seq: 1 })), quadro(ev({ tipo: 'aviso', seq: 2 }))]), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const recebidos: Evento[] = [];
    await expect(iniciarMissao('http://x', { url: 'https://a.com/products/b' }, (e) => recebidos.push(e)))
      .rejects.toMatchObject({ name: 'ErroApi', codigo: 'conexao_perdida' });
    expect(recebidos).toHaveLength(2);
  });

  it('termina bem com missao_concluida ou com erro', async () => {
    const finais = [
      ev({ tipo: 'missao_concluida', resultado: {} as never }),
      ev({ tipo: 'erro', codigo: 'api_fora', recuperavel: true, sugestao: 'x' }),
    ];
    for (const final of finais) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(corpo([quadro(final)]), { status: 200 })));
      await expect(iniciarMissao('http://x', { texto: 't' }, () => {})).resolves.toBeUndefined();
    }
  });

  it('429 vira ErroApi com o código do corpo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ codigo: 'cota_esgotada', mensagem: 'acabou' }), { status: 429 })));
    const p = iniciarMissao('http://x', { texto: 't' }, () => {});
    await expect(p).rejects.toBeInstanceOf(ErroApi);
    await expect(p).rejects.toMatchObject({ codigo: 'cota_esgotada', message: 'acabou' });
  });

  it('envia POST /api/missao com a entrada em JSON', async () => {
    const f = vi.fn().mockResolvedValue(new Response(corpo([quadro(ev({ tipo: 'erro', codigo: 'api_fora', recuperavel: true, sugestao: '' }))]), { status: 200 }));
    vi.stubGlobal('fetch', f);
    await iniciarMissao('http://x', { url: 'https://a.com/products/b' }, () => {});
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('http://x/api/missao');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ url: 'https://a.com/products/b' });
  });

  it('falha de rede vira conexao_perdida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(iniciarMissao('http://x', { texto: 't' }, () => {})).rejects.toMatchObject({ codigo: 'conexao_perdida' });
  });

  it('erro de leitura no meio da missão vira conexao_perdida, em português e com a causa', async () => {
    const queda = new TypeError('network error');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start(c) { c.error(queda); } }), { status: 200 })));
    const p = iniciarMissao('http://x', { texto: 't' }, () => {});
    await expect(p).rejects.toMatchObject({ name: 'ErroApi', codigo: 'conexao_perdida', message: 'A conexão caiu no meio da missão.' });
    await expect(p).rejects.toHaveProperty('cause', queda);
  });

  it('queda da conexão depois do evento final não apaga a missão concluída', async () => {
    const final = enc.encode(quadro(ev({ tipo: 'missao_concluida', resultado: {} as never })));
    let enviado = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (!enviado) { enviado = true; c.enqueue(final); } else c.error(new TypeError('network error'));
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));
    const recebidos: string[] = [];
    await expect(iniciarMissao('http://x', { texto: 't' }, (e) => recebidos.push(e.tipo))).resolves.toBeUndefined();
    expect(recebidos).toEqual(['missao_concluida']);
  });

  it('abort depois do corpo inteiro, sem evento final, rejeita com o motivo do chamador', async () => {
    const ac = new AbortController();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(corpo([quadro(ev({ tipo: 'aviso', seq: 1 }))]), { status: 200 })));
    const p = iniciarMissao('http://x', { texto: 't' }, () => ac.abort(), ac.signal);
    const motivo = await p.then(() => null, (e: unknown) => e);
    expect(ac.signal.aborted).toBe(true);
    expect(motivo).toBe(ac.signal.reason);
  });
});

describe('acordar', () => {
  it('insiste até o servidor responder', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error()).mockResolvedValue(new Response('{"ok":true}'));
    expect(await acordar('http://x', { fetch: f, intervaloMs: 0 })).toBe(true);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('503 conta como "ainda dormindo" e é tentado de novo, com timeout por tentativa', async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValue(new Response('{"ok":true}'));
    expect(await acordar('http://x', { fetch: f, intervaloMs: 5, tempoMs: 1000 })).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('corta a tentativa que trava no tempoMs', async () => {
    const trava = vi.fn((_: unknown, init: RequestInit) =>
      new Promise<Response>((_ok, falha) => init.signal!.addEventListener('abort', () => falha(init.signal!.reason))));
    expect(await acordar('http://x', { fetch: trava as unknown as typeof fetch, intervaloMs: 0, tentativas: 2, tempoMs: 10 })).toBe(false);
    expect(trava).toHaveBeenCalledTimes(2);
  });

  it('para no prazo total, mesmo com tentativas sobrando', async () => {
    const f = vi.fn().mockRejectedValue(new Error());
    const inicio = Date.now();
    expect(await acordar('http://x', { fetch: f, intervaloMs: 40, tentativas: 12, prazoMs: 100 })).toBe(false);
    expect(f.mock.calls.length).toBeLessThan(12);
    expect(Date.now() - inicio).toBeLessThan(1000);
  });

  it('desiste depois das tentativas', async () => {
    const f = vi.fn().mockRejectedValue(new Error());
    expect(await acordar('http://x', { fetch: f, intervaloMs: 0, tentativas: 4 })).toBe(false);
    expect(f).toHaveBeenCalledTimes(4);
  });
});

describe('lerCota', () => {
  it('lê a cota e devolve null se falhar', async () => {
    const ok = vi.fn().mockResolvedValue(new Response('{"restantes":2,"porDia":5}'));
    vi.stubGlobal('fetch', ok);
    expect(await lerCota('http://x')).toEqual({ restantes: 2, porDia: 5 });
    expect(ok.mock.calls[0][0]).toBe('http://x/api/cota');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error()));
    expect(await lerCota('http://x')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    expect(await lerCota('http://x')).toBeNull();
  });
});

describe('missões gravadas', () => {
  it('busca o índice e a missão em /missoes/', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response('[{"nome":"a","titulo":"A","loja":"L"}]'))
      .mockResolvedValueOnce(new Response('{"nome":"a","eventos":[]}'));
    expect(await carregarIndice({ fetch: f })).toEqual([{ nome: 'a', titulo: 'A', loja: 'L' }]);
    expect((await carregarGravada('a', { fetch: f })).nome).toBe('a');
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/missoes/indice.json', '/missoes/a.json']);
  });

  it('resposta não-ok rejeita', async () => {
    await expect(carregarIndice({ fetch: vi.fn().mockResolvedValue(new Response('', { status: 404 })) })).rejects.toThrow();
  });
});
