import type { Evento } from '@nave/shared';

export const MIN_MS: Partial<Record<Evento['tipo'], number>> = {
  agente_convocado: 1300,
  agente_dispensado: 1300,
  imediato_conferindo: 800,
  imediato_devolveu: 1500,
  imediato_corrigiu: 1500,
  nota: 1200,
};
const MIN_PADRAO = 250;
export const ESPERA_MAX_REPLAY = 2500;

export type Modo = 'ao_vivo' | 'replay';

/** Quanto esperar, depois de mostrar `anterior`, antes de mostrar `proximo`. */
export function esperaAntesDoProximo(anterior: Evento, proximo: Evento, modo: Modo): number {
  const minimo = MIN_MS[anterior.tipo] ?? MIN_PADRAO;
  if (modo === 'ao_vivo') return minimo;
  return Math.max(minimo, Math.min(proximo.t - anterior.t, ESPERA_MAX_REPLAY));
}

/** Fila que solta os eventos num ritmo que dá para acompanhar. O primeiro sai na hora. */
export function criarFila(aplicar: (e: Evento) => void, modo: Modo): { empurrar(e: Evento): void; parar(): void } {
  let pendentes: Evento[] = [];
  let ultimo: { e: Evento; em: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let parada = false;

  function drenar(): void {
    timer = null;
    if (parada) return;
    const proximo = pendentes[0];
    if (!proximo) return;
    const falta = ultimo ? ultimo.em + esperaAntesDoProximo(ultimo.e, proximo, modo) - Date.now() : 0;
    if (falta > 0) {
      timer = setTimeout(drenar, falta);
      return;
    }
    pendentes.shift();
    ultimo = { e: proximo, em: Date.now() };
    aplicar(proximo);
    drenar();
  }

  return {
    empurrar(e) {
      if (parada) return;
      pendentes.push(e);
      if (timer === null) drenar();
    },
    parar() {
      parada = true;
      pendentes = [];
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
