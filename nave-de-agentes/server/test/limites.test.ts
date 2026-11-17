import { describe, it, expect } from 'vitest';
import { criarCota, diaEmBrasilia, type Reserva } from '../src/limites';

describe('cotas', () => {
  it('5 por dia: a sexta é recusada', () => {
    const c = criarCota({ porDia: 5, porVisitante: 9 });
    for (let i = 0; i < 5; i++) { const r = c.reservar(`ip${i}`) as Reserva; r.confirmar(); r.liberar(); }
    expect(c.reservar('ip9')).toMatchObject({ ok: false, motivo: 'cota_dia' });
  });

  it('3 por visitante; reserva liberada sem confirmar não conta', () => {
    const c = criarCota({ porDia: 50, porVisitante: 3 });
    for (let i = 0; i < 3; i++) { const r = c.reservar('ipA') as Reserva; r.confirmar(); r.liberar(); }
    expect(c.reservar('ipA')).toMatchObject({ ok: false, motivo: 'cota_visitante' });
    const outro = c.reservar('ipB');
    expect(outro.ok).toBe(true);
    (outro as Reserva).liberar();
    expect(c.restantes()).toBe(47);
    expect(c.porDia).toBe(50);
  });

  it('simultâneas: mesmo visitante e limite total de 3', () => {
    const c = criarCota({ porDia: 50, porVisitante: 9 });
    const a = c.reservar('a') as Reserva;
    expect(c.reservar('a')).toMatchObject({ ok: false, motivo: 'ocupado' });
    c.reservar('b'); c.reservar('c');
    expect(c.reservar('d')).toMatchObject({ ok: false, motivo: 'ocupado' });
    a.liberar();
    a.liberar(); // liberar duas vezes não abre vaga a mais
    expect(c.reservar('d').ok).toBe(true);
    expect(c.reservar('e')).toMatchObject({ ok: false, motivo: 'ocupado' });
  });

  it('reservas em andamento ocupam a cota do dia: com 1 por dia, a segunda espera', () => {
    const c = criarCota({ porDia: 1, porVisitante: 9 });
    const a = c.reservar('a') as Reserva;
    expect(c.reservar('b')).toMatchObject({ ok: false, motivo: 'ocupado' });
    a.liberar();
    expect(c.reservar('b').ok).toBe(true);
  });

  it('visitante que já usou as suas vê cota_visitante, não ocupado, mesmo com o dia quase cheio', () => {
    const c = criarCota({ porDia: 2, porVisitante: 1 });
    const a = c.reservar('a') as Reserva;
    a.confirmar();
    a.liberar();
    c.reservar('b'); // pendente: usadas 1 + pendentes 1 = porDia
    expect(c.reservar('a')).toMatchObject({ ok: false, motivo: 'cota_visitante' });
  });

  it('reserva confirmada esgota o dia: a seguinte vê cota_dia', () => {
    const c = criarCota({ porDia: 1, porVisitante: 9 });
    const a = c.reservar('a') as Reserva;
    a.confirmar();
    a.liberar();
    expect(c.reservar('b')).toMatchObject({ ok: false, motivo: 'cota_dia' });
  });

  it('confirmar duas vezes conta uma só', () => {
    const c = criarCota({ porDia: 5, porVisitante: 9 });
    const r = c.reservar('a') as Reserva;
    r.confirmar(); r.confirmar();
    expect(c.restantes()).toBe(4);
  });

  it('a cota zera quando o dia vira em Brasília', () => {
    let agora = new Date('2026-11-14T02:59:00Z');
    const c = criarCota({ porDia: 1, porVisitante: 1, agora: () => agora });
    const r = c.reservar('a') as Reserva; r.confirmar(); r.liberar();
    expect(c.reservar('a').ok).toBe(false);
    agora = new Date('2026-11-14T03:01:00Z');
    expect(c.restantes()).toBe(1);
    expect(c.reservar('a').ok).toBe(true);
  });

  it('dia vira à meia-noite de Brasília', () => {
    expect(diaEmBrasilia(new Date('2026-11-14T02:59:00Z'))).toBe('2026-11-13');
    expect(diaEmBrasilia(new Date('2026-11-14T03:01:00Z'))).toBe('2026-11-14');
  });
});
