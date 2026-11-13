import { BlockList, isIP } from 'node:net';
import { promises as dns } from 'node:dns';

export type Resolver = (host: string) => Promise<string[]>;

export class ErroBusca extends Error {
  constructor(
    public motivo: 'host_bloqueado' | 'muitos_redirecionamentos' | 'grande_demais' | 'tempo_esgotado' | 'falha_rede',
    mensagem?: string,
  ) {
    super(mensagem ?? motivo);
    this.name = 'ErroBusca';
  }
}

const bloqueioV4 = new BlockList();
for (const [rede, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
] as const) bloqueioV4.addSubnet(rede, bits, 'ipv4');

const bloqueioV6 = new BlockList();
bloqueioV6.addAddress('::1', 'ipv6');
bloqueioV6.addAddress('::', 'ipv6');
bloqueioV6.addSubnet('fc00::', 7, 'ipv6');
bloqueioV6.addSubnet('fe80::', 10, 'ipv6');

/** true se o IP é privado/interno (ou se nem é um IP válido: na dúvida, bloqueia). */
export function ipPrivado(ip: string): boolean {
  const limpo = ip.replace(/^\[|\]$/g, '');
  const versao = isIP(limpo);
  if (versao === 4) return bloqueioV4.check(limpo, 'ipv4');
  if (versao === 6) {
    // IPv4 mapeado em IPv6, nas formas ::ffff:a.b.c.d e ::ffff:hhhh:hhhh
    const pontilhado = limpo.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (pontilhado) return bloqueioV4.check(pontilhado[1]!, 'ipv4');
    const hex = limpo.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hex) {
      const a = parseInt(hex[1]!, 16), b = parseInt(hex[2]!, 16);
      return bloqueioV4.check(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`, 'ipv4');
    }
    return bloqueioV6.check(limpo, 'ipv6');
  }
  return true;
}

function hostValido(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h || isIP(h.replace(/^\[|\]$/g, '')) !== 0 || h.startsWith('[')) return false;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  return true;
}

export function validarUrlProduto(
  entrada: string,
): { ok: true; loja: string; handle: string } | { ok: false; motivo: string } {
  let u: URL;
  try { u = new URL(entrada.trim()); } catch { return { ok: false, motivo: 'URL inválida.' }; }
  if (u.protocol !== 'https:') return { ok: false, motivo: 'Use um endereço https.' };
  if (!hostValido(u.hostname)) return { ok: false, motivo: 'Endereço de loja não permitido.' };
  const m = u.pathname.match(/^(?:\/collections\/[^/]+)?\/products\/([a-z0-9-]+)\/?$/);
  if (!m) return { ok: false, motivo: 'O endereço precisa ser de um produto (/products/nome-do-produto).' };
  return { ok: true, loja: u.hostname, handle: m[1]! };
}

const resolverPadrao: Resolver = async (host) =>
  (await dns.lookup(host, { all: true })).map((r) => r.address);

export async function buscarSeguro(
  url: string,
  o: {
    resolver?: Resolver; fetch?: typeof fetch; timeoutMs?: number; maxBytes?: number;
    maxRedirects?: number; aceitar?: string;
  } = {},
): Promise<{ status: number; cabecalhos: Headers; corpo: string }> {
  const resolver = o.resolver ?? resolverPadrao;
  const buscar = o.fetch ?? fetch;
  const maxBytes = o.maxBytes ?? 2_000_000;
  const maxRedirects = o.maxRedirects ?? 2;
  const sinal = AbortSignal.timeout(o.timeoutMs ?? 8000);

  const corrida = <T>(p: Promise<T>): Promise<T> =>
    new Promise<T>((ok, erro) => {
      const aoAbortar = () => erro(sinal.reason);
      if (sinal.aborted) return aoAbortar();
      sinal.addEventListener('abort', aoAbortar, { once: true });
      p.then(ok, erro).finally(() => sinal.removeEventListener('abort', aoAbortar));
    });

  const conferirSalto = async (alvo: URL) => {
    if (alvo.protocol !== 'https:' || !hostValido(alvo.hostname)) throw new ErroBusca('host_bloqueado');
    const ips = await resolver(alvo.hostname);
    if (ips.length === 0 || ips.some(ipPrivado)) throw new ErroBusca('host_bloqueado');
  };

  try {
    let atual: URL;
    try { atual = new URL(url); } catch { throw new ErroBusca('host_bloqueado', 'URL inválida'); }

    for (let saltos = 0; ; saltos++) {
      await corrida(conferirSalto(atual));
      const headers: Record<string, string> = { 'User-Agent': 'NaveDeAgentes/1.0 (demo)' };
      if (o.aceitar) headers['Accept'] = o.aceitar;
      const resp = await corrida(buscar(atual.href, { redirect: 'manual', headers, signal: sinal }));

      if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
        await resp.body?.cancel().catch(() => {});
        if (saltos >= maxRedirects) throw new ErroBusca('muitos_redirecionamentos');
        try { atual = new URL(resp.headers.get('location')!, atual); } catch { throw new ErroBusca('host_bloqueado', 'Location inválido'); }
        continue;
      }

      const partes: Uint8Array[] = [];
      let total = 0;
      if (resp.body) {
        const leitor = resp.body.getReader();
        try {
          for (;;) {
            const { done, value } = await corrida(leitor.read());
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) throw new ErroBusca('grande_demais');
            partes.push(value);
          }
        } catch (e) {
          await leitor.cancel().catch(() => {});
          throw e;
        }
      }
      const corpo = new TextDecoder().decode(Buffer.concat(partes));
      return { status: resp.status, cabecalhos: resp.headers, corpo };
    }
  } catch (e) {
    if (e instanceof ErroBusca) throw e;
    if (sinal.aborted) throw new ErroBusca('tempo_esgotado');
    throw new ErroBusca('falha_rede', e instanceof Error ? e.message : String(e));
  }
}
