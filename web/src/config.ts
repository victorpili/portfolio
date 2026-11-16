/**
 * Endereço da API. `null` quando não há servidor configurado (build de produção sem VITE_API_URL):
 * o painel desliga o modo ao vivo e oferece a missão gravada.
 */
function lerApiUrl(): string | null {
  const configurada = import.meta.env.VITE_API_URL;
  if (configurada) return configurada;
  return import.meta.env.DEV ? 'http://localhost:8787' : null;
}

export const API_URL: string | null = lerApiUrl();
