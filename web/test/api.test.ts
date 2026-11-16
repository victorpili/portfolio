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
});

describe('acordar', () => {
  it('insiste até o servidor responder', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error()).mockResolvedValue(new Response('{"ok":true}'));
    expect(await acordar('http://x', { fetch: f, intervaloMs: 0 })).toBe(true);
    expect(f).toHaveBeenCalledTimes(3);
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
