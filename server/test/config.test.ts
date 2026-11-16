import { describe, it, expect } from 'vitest';
import { escolherMotor, lerLimite } from '../src/config';
import { PRAZO_ASSINATURA_MS } from '../src/motores/assinatura';

describe('escolherMotor', () => {
  it('MOTOR=assinatura fora do Render: assinatura e prazo de 15 min', () => {
    const r = escolherMotor({ MOTOR: 'assinatura' });
    expect(r.motor.nome).toBe('assinatura');
    expect(r.prazoMs).toBe(PRAZO_ASSINATURA_MS);
    expect(PRAZO_ASSINATURA_MS).toBe(15 * 60_000);
  });

  it('MOTOR=assinatura no Render é recusado: vale a API e o prazo padrão', () => {
    const r = escolherMotor({ MOTOR: 'assinatura', RENDER: 'true' });
    expect(r.motor.nome).toBe('api');
    expect(r.prazoMs).toBeUndefined();
  });

  it('sem MOTOR: API com o modelo ao vivo padrão ou o de MODELO_AO_VIVO', () => {
    expect(escolherMotor({ ANTHROPIC_API_KEY: 'x' }).motor).toMatchObject({ nome: 'api', modelo: 'claude-sonnet-5-5' });
    expect(escolherMotor({ ANTHROPIC_API_KEY: 'x', MODELO_AO_VIVO: 'claude-opus-5-5' }).motor.modelo).toBe('claude-opus-5-5');
  });
});

describe('lerLimite', () => {
  it('usa o padrão quando falta e aceita inteiros, inclusive 0', () => {
    expect(lerLimite({}, 'COTA_DIA', 5)).toBe(5);
    expect(lerLimite({ COTA_DIA: '7' }, 'COTA_DIA', 5)).toBe(7);
    expect(lerLimite({ COTA_DIA: '0' }, 'COTA_DIA', 5)).toBe(0);
  });

  it.each(['abc', '-1', '2.5', '1e3'])('"%s" derruba a subida', (v) => {
    expect(() => lerLimite({ COTA_DIA: v }, 'COTA_DIA', 5)).toThrow(/COTA_DIA/);
  });
});
