import { describe, it, expect, vi } from 'vitest';
import { validarUrlProduto, ipPrivado, buscarSeguro } from '../src/url-segura';

const publico = async () => ['93.184.216.34'];

function corpoEmPedacos(n: number, tam: number): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i++ < n) c.enqueue(new Uint8Array(tam).fill(97));
      else c.close();
    },
  });
}

describe('validarUrlProduto', () => {
  it.each([
    ['http://loja.com/products/x', false], ['https://127.0.0.1/products/x', false], ['https://localhost/products/x', false],
    ['https://loja.local/products/x', false], ['https://loja.com/pages/x', false],
    ['https://loja.com/products/caneca-azul?variant=1', true], ['https://loja.com/collections/canecas/products/caneca-azul', true],
  ])('validarUrlProduto(%s) ok=%s', (u, ok) => expect(validarUrlProduto(u).ok).toBe(ok));

  it('handle e loja extraídos', () =>
    expect(validarUrlProduto('https://loja.com/products/caneca-azul')).toEqual({ ok: true, loja: 'loja.com', handle: 'caneca-azul' }));

  it.each([['https://[::1]/products/x'], ['https://loja.internal/products/x'], ['nao é url'], ['https://loja.com/products/Caneca_Azul']])(
    'recusa %s', (u) => expect(validarUrlProduto(u).ok).toBe(false));
});

describe('ipPrivado', () => {
  it.each([['10.1.2.3', true], ['172.20.0.1', true], ['192.168.0.10', true], ['127.0.0.1', true], ['169.254.169.254', true],
    ['100.64.0.1', true], ['0.0.0.0', true], ['8.8.8.8', false], ['172.32.0.1', false], ['::1', true], ['fe80::1', true], ['fd00::1', true],
    ['::ffff:192.168.0.1', true], ['0:0:0:0:0:ffff:7f00:1', true], ['::0:ffff:10.0.0.1', true], ['::ffff:c0a8:1', true], ['::ffff:8.8.8.8', false], ['2606:4700::1111', false],
  ])('ipPrivado(%s)=%s', (ip, v) => expect(ipPrivado(ip)).toBe(v));
});

describe('buscarSeguro', () => {
  it('recusa host que resolve para IP privado sem chamar fetch', async () => {
    const f = vi.fn();
    await expect(buscarSeguro('https://x.com/a', { resolver: async () => ['10.0.0.5'], fetch: f })).rejects.toMatchObject({ motivo: 'host_bloqueado' });
    expect(f).not.toHaveBeenCalled();
  });

  it('recusa se qualquer um dos IPs resolvidos for privado', async () => {
    const f = vi.fn();
    await expect(buscarSeguro('https://x.com/a', { resolver: async () => ['8.8.8.8', '127.0.0.1'], fetch: f })).rejects.toMatchObject({ motivo: 'host_bloqueado' });
    expect(f).not.toHaveBeenCalled();
  });

  it('devolve status, cabeçalhos e corpo, com User-Agent e Accept', async () => {
    const f = vi.fn(async (_u: any, _i: any) => new Response('olá', { status: 200, headers: { 'x-a': '1' } }));
    const r = await buscarSeguro('https://x.com/a', { resolver: publico, fetch: f as any, aceitar: 'application/json' });
    expect(r.status).toBe(200);
    expect(r.corpo).toBe('olá');
    expect(r.cabecalhos.get('x-a')).toBe('1');
    const init = f.mock.calls[0]![1];
    expect(init.redirect).toBe('manual');
    expect(init.headers['User-Agent']).toBe('NaveDeAgentes/1.0 (demo)');
    expect(init.headers['Accept']).toBe('application/json');
  });

  it('segue redirecionamento relativo e confere o host de cada salto', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { Location: '/b' } }))
      .mockResolvedValueOnce(new Response('fim', { status: 200 }));
    const r = await buscarSeguro('https://x.com/a', { resolver: publico, fetch: f });
    expect(r.corpo).toBe('fim');
    expect(String(f.mock.calls[1]![0])).toBe('https://x.com/b');
  });

  it('recusa redirecionamento para http', async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'http://x.com/b' } }));
    await expect(buscarSeguro('https://x.com/a', { resolver: publico, fetch: f })).rejects.toMatchObject({ motivo: 'host_bloqueado' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('recusa redirecionamento para host que resolve a IP privado', async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'https://interno.com/b' } }));
    const resolver = async (h: string) => (h === 'interno.com' ? ['192.168.1.1'] : ['93.184.216.34']);
    await expect(buscarSeguro('https://x.com/a', { resolver, fetch: f })).rejects.toMatchObject({ motivo: 'host_bloqueado' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('recusa mais de 2 saltos', async () => {
    const f = vi.fn().mockImplementation(async () => new Response(null, { status: 301, headers: { Location: '/prox' } }));
    await expect(buscarSeguro('https://x.com/a', { resolver: publico, fetch: f })).rejects.toMatchObject({ motivo: 'muitos_redirecionamentos' });
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('aceita exatamente 2 saltos', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { Location: '/b' } }))
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { Location: '/c' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await expect(buscarSeguro('https://x.com/a', { resolver: publico, fetch: f })).resolves.toMatchObject({ corpo: 'ok' });
  });

  it('recusa corpo maior que maxBytes', async () => {
    const f = vi.fn().mockResolvedValue(new Response(corpoEmPedacos(3, 1000), { status: 200 }));
    await expect(buscarSeguro('https://x.com/a', { resolver: publico, fetch: f, maxBytes: 2500 })).rejects.toMatchObject({ motivo: 'grande_demais' });
  });

  it('aceita corpo dentro de maxBytes', async () => {
    const f = vi.fn().mockResolvedValue(new Response(corpoEmPedacos(3, 1000), { status: 200 }));
    const r = await buscarSeguro('https://x.com/a', { resolver: publico, fetch: f, maxBytes: 3000 });
    expect(r.corpo.length).toBe(3000);
  });

  it('estouro de tempo vira tempo_esgotado', async () => {
    const f = vi.fn((_u: any, init: any) => new Promise((_, rej) => {
      init.signal.addEventListener('abort', () => rej(init.signal.reason));
    }));
    await expect(buscarSeguro('https://x.com/a', { resolver: publico, fetch: f as any, timeoutMs: 20 })).rejects.toMatchObject({ motivo: 'tempo_esgotado' });
  });

  it('falha de rede vira falha_rede', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(buscarSeguro('https://x.com/a', { resolver: publico, fetch: f })).rejects.toMatchObject({ motivo: 'falha_rede' });
  });

  it('falha do resolver vira falha_rede', async () => {
    const f = vi.fn();
    await expect(buscarSeguro('https://x.com/a', { resolver: async () => { throw new Error('ENOTFOUND'); }, fetch: f })).rejects.toMatchObject({ motivo: 'falha_rede' });
    expect(f).not.toHaveBeenCalled();
  });
});
