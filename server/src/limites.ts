// Cotas do ao vivo: missões por dia (dia de Brasília), por visitante e simultâneas.

const FUSO = 'America/Sao_Paulo';
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** `AAAA-MM-DD` no fuso de Brasília. */
export function diaEmBrasilia(d: Date): string {
  return formatoDia.format(d);
}

export interface Reserva { ok: true; confirmar(): void; liberar(): void }
export type Recusa = { ok: false; motivo: 'cota_dia' | 'cota_visitante' | 'ocupado' };
export interface Cota {
  porDia: number;
  reservar(visitante: string): Reserva | Recusa;
  restantes(): number;
}

/**
 * Só `confirmar()` gasta a cota (a missão que falha antes da primeira chamada ao Claude não conta).
 * `liberar()` sempre solta a vaga simultânea e pode ser chamado mais de uma vez.
 */
export function criarCota(o: { porDia: number; porVisitante: number; maxSimultaneas?: number; agora?: () => Date }): Cota {
  const maxSimultaneas = o.maxSimultaneas ?? 3;
  const agora = o.agora ?? (() => new Date());
  let dia = diaEmBrasilia(agora());
  let usadasHoje = 0;
  // Reservadas que ainda não foram confirmadas nem liberadas: já ocupam uma vaga do dia, para não estourar a cota.
  let pendentes = 0;
  const porVisitante = new Map<string, number>();
  const ativos = new Map<string, number>();
  let totalAtivas = 0;

  const virarDia = () => {
    const hoje = diaEmBrasilia(agora());
    if (hoje === dia) return;
    dia = hoje;
    usadasHoje = 0;
    porVisitante.clear();
  };

  return {
    porDia: o.porDia,
    restantes() {
      virarDia();
      return Math.max(0, o.porDia - usadasHoje);
    },
    reservar(visitante) {
      virarDia();
      if (usadasHoje >= o.porDia) return { ok: false, motivo: 'cota_dia' };
      if ((porVisitante.get(visitante) ?? 0) >= o.porVisitante) return { ok: false, motivo: 'cota_visitante' };
      if (usadasHoje + pendentes >= o.porDia) return { ok: false, motivo: 'ocupado' };
      if ((ativos.get(visitante) ?? 0) >= 1 || totalAtivas >= maxSimultaneas) return { ok: false, motivo: 'ocupado' };

      ativos.set(visitante, 1);
      totalAtivas++;
      pendentes++;
      const diaDaReserva = dia;
      let confirmada = false;
      let liberada = false;
      return {
        ok: true,
        confirmar() {
          if (confirmada || liberada) return;
          confirmada = true;
          pendentes--;
          // Missão que atravessa a meia-noite conta no dia em que começou, que já foi zerado.
          if (diaDaReserva !== dia) return;
          usadasHoje++;
          porVisitante.set(visitante, (porVisitante.get(visitante) ?? 0) + 1);
        },
        liberar() {
          if (liberada) return;
          liberada = true;
          if (!confirmada) pendentes--;
          ativos.delete(visitante);
          totalAtivas--;
        },
      };
    },
  };
}
