import { afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type IndiceMissoes, type MissaoGravada } from '@nave/shared';
import { lerArgs, salvarMissao } from '../src/gravacao';

const missao = (nome: string, titulo = 'Caneca Barro 350 ml'): MissaoGravada => ({
  nome, titulo, loja: 'l.com', gravadaEm: '2026-11-13T12:00:00.000Z', modelo: 'claude-opus-5-5',
  eventos: [{ seq: 1, t: 0, tipo: 'missao_iniciada', mensagem: 'Capitã: missão recebida.' }],
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('lerArgs', () => {
  it('--gravar força Opus e exige API', () => {
    expect(lerArgs(['https://l.com/products/x', '--gravar', 'caneca']).modelo).toBe('claude-opus-5-5');
    expect(() => lerArgs(['https://l.com/products/x', '--motor', 'assinatura', '--gravar', 'c'])).toThrow('missão gravada só pela API');
  });

  it('padrão: API com o modelo do ao vivo; assinatura com sonnet', () => {
    vi.stubEnv('MODELO_AO_VIVO', undefined);
    expect(lerArgs(['https://l.com/products/x'])).toEqual({ url: 'https://l.com/products/x', motor: 'api', modelo: 'claude-sonnet-5-5' });
    vi.stubEnv('MODELO_AO_VIVO', 'claude-opus-5-5');
    expect(lerArgs(['https://l.com/products/x']).modelo).toBe('claude-opus-5-5');
    expect(lerArgs(['https://l.com/products/x', '--motor', 'assinatura'])).toEqual({
      url: 'https://l.com/products/x', motor: 'assinatura', modelo: 'sonnet',
    });
  });

  it('aceita --texto, --modelo e --gravar em qualquer ordem', () => {
    expect(lerArgs(['--gravar', 'cafe', '--texto', 'ficha.txt'])).toEqual({
      arquivoTexto: 'ficha.txt', motor: 'api', modelo: 'claude-opus-5-5', gravar: 'cafe',
    });
    expect(lerArgs(['--motor', 'assinatura', '--modelo', 'opus', 'https://l.com/products/x']).modelo).toBe('opus');
    expect(lerArgs(['--', 'https://l.com/products/x']).url).toBe('https://l.com/products/x');
  });

  it('recusa entrada ausente, entrada dupla e argumentos inválidos', () => {
    expect(() => lerArgs([])).toThrow('informe a URL do produto ou --texto <arquivo>');
    expect(() => lerArgs(['https://l.com/products/x', '--texto', 'f.txt'])).toThrow('informe uma entrada só');
    expect(() => lerArgs(['https://l.com/products/x', 'https://l.com/products/y'])).toThrow('informe uma entrada só');
    expect(() => lerArgs(['https://l.com/products/x', '--motor', 'gpu'])).toThrow('--motor deve ser api ou assinatura');
    expect(() => lerArgs(['https://l.com/products/x', '--modelo'])).toThrow('--modelo precisa de um valor');
    expect(() => lerArgs(['https://l.com/products/x', '--rapido'])).toThrow('opção desconhecida: --rapido');
    expect(() => lerArgs(['https://l.com/products/x', '--gravar', '../fora'])).toThrow('--gravar aceita só letras minúsculas, números e hífen');
  });
});

describe('salvarMissao', () => {
  it('salvarMissao grava o arquivo e não duplica no índice', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'missoes-'));
    await salvarMissao(dir, missao('caneca')); await salvarMissao(dir, missao('caneca'));
    expect(JSON.parse(await readFile(join(dir, 'indice.json'), 'utf8'))).toHaveLength(1);
  });

  it('cria a pasta, devolve o caminho e substitui só a entrada do mesmo nome', async () => {
    const dir = join(await mkdtemp(join(tmpdir(), 'missoes-')), 'web', 'public', 'missoes');
    const caminho = await salvarMissao(dir, missao('caneca'));
    expect(caminho).toBe(join(dir, 'caneca.json'));
    expect(JSON.parse(await readFile(caminho, 'utf8'))).toEqual(missao('caneca'));

    await salvarMissao(dir, missao('garrafa', 'Garrafa Trilha 500 ml'));
    await salvarMissao(dir, missao('caneca', 'Caneca Barro 450 ml'));
    const indice: IndiceMissoes = JSON.parse(await readFile(join(dir, 'indice.json'), 'utf8'));
    expect(indice).toEqual([
      { nome: 'caneca', titulo: 'Caneca Barro 450 ml', loja: 'l.com' },
      { nome: 'garrafa', titulo: 'Garrafa Trilha 500 ml', loja: 'l.com' },
    ]);
  });
});
