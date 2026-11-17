function semBarraNoFim(s: string): string {
  let fim = s.length;
  while (fim > 0 && s[fim - 1] === '/') fim--;
  return s.slice(0, fim);
}

/**
 * Endereço da API, sem as barras do fim (o front monta `${API_URL}/api/...`). `null` quando não há servidor
 * configurado (build de produção sem VITE_API_URL): o painel desliga o modo ao vivo e oferece a missão gravada.
 */
export function lerApiUrl(env: { VITE_API_URL?: string; DEV: boolean }): string | null {
  const configurada = semBarraNoFim(env.VITE_API_URL ?? '');
  if (configurada) return configurada;
  return env.DEV ? 'http://localhost:8787' : null;
}

export const API_URL: string | null = lerApiUrl(import.meta.env);
