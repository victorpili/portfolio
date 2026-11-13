import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, realpathSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { Pesquisa } from '@nave/shared';
import { ErroMotor, ErroSchema, ErroSemCredito, type Chamada } from '../src/motores/motor';
import { motorFalso } from '../src/motores/falso';
import { custoUsd, motorApi, traduzirErroApi } from '../src/motores/api';
import { ambienteSemChave, argsAssinatura, binarioClaude, lerResultado, rodarProcesso, transcrever } from '../src/motores/assinatura';
import { pesquisaBoa } from './fixtures/respostas';

const chamada = (sinal?: AbortSignal): Chamada<Pesquisa> => ({
  agente: 'pesquisador', sistema: 'S', mensagens: [{ papel: 'usuario', texto: 'oi' }], schema: Pesquisa, sinal,
});

/** Cliente real do SDK com um fetch falso: nada sai da máquina, mas o SDK monta o pedido e lê a resposta de verdade. */
function clienteFalso(status: number, corpo: unknown) {
  const pedidos: { corpo: Record<string, unknown>; cabecalhos: Headers }[] = [];
  const cliente = new Anthropic({
    apiKey: 'chave-de-teste',
    fetch: async (_url, init) => {
      pedidos.push({ corpo: JSON.parse(String(init?.body)), cabecalhos: new Headers(init?.headers) });
      return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
    },
  });
  return { cliente, pedidos };
}

const mensagem = (texto: string | null, stop_reason = 'end_turn') => ({
  id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
  content: texto === null ? [] : [{ type: 'text', text: texto }],
  stop_reason, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 500 },
});

describe('motor da API', () => {
  it('custo do Opus 5.5', () => expect(custoUsd('claude-opus-5-5', { input_tokens: 10000, output_tokens: 5000 })).toBeCloseTo(0.14));
  it('modelo sem preço falha na criação', () => expect(() => motorApi({ modelo: 'x' })).toThrow());
  it('saldo baixo vira ErroSemCredito', () => {
    const e = Object.assign(Object.create(Anthropic.APIError.prototype), { status: 400, message: 'Your credit balance is too low to access the Anthropic API.' });
    expect(traduzirErroApi(e)).toBeInstanceOf(ErroSemCredito);
  });
  it('outros erros viram ErroMotor', () => {
    const e = Object.assign(Object.create(Anthropic.APIError.prototype), { status: 400, message: 'max_tokens: too large' });
    expect(traduzirErroApi(e)).toBeInstanceOf(ErroMotor);
    expect(traduzirErroApi(new Error('rede caiu'))).toBeInstanceOf(ErroMotor);
  });

  it('manda pensamento adaptativo, esforço, formato e fallbacks, e devolve dados e custo', async () => {
    const { cliente, pedidos } = clienteFalso(200, mensagem(JSON.stringify(pesquisaBoa)));
    const m = motorApi({ modelo: 'claude-sonnet-5-5', cliente });
    expect(m).toMatchObject({ nome: 'api', modelo: 'claude-sonnet-5-5' });
    const r = await m.chamar(chamada());
    expect(r.dados).toEqual(pesquisaBoa);
    expect(r).toMatchObject({ tokensEntrada: 1000, tokensSaida: 500 });
    expect(r.custoUsd).toBeCloseTo(0.007);
    expect(r.ms).toBeGreaterThanOrEqual(0);
    const { corpo, cabecalhos } = pedidos[0];
    expect(corpo).toMatchObject({
      model: 'claude-sonnet-5-5', max_tokens: 16000, system: 'S',
      messages: [{ role: 'user', content: 'oi' }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: { type: 'json_schema' } },
      fallbacks: 'default',
    });
    expect(JSON.stringify(corpo)).toContain('tipoProduto');
    expect(corpo).not.toHaveProperty('temperature');
    expect(cabecalhos.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(cabecalhos.get('x-stainless-timeout')).toBe('45');
  });

  it('esforço configurável', async () => {
    const { cliente, pedidos } = clienteFalso(200, mensagem(JSON.stringify(pesquisaBoa)));
    await motorApi({ modelo: 'claude-opus-5-5', esforco: 'high', cliente }).chamar(chamada());
    expect(pedidos[0].corpo).toMatchObject({ model: 'claude-opus-5-5', output_config: { effort: 'high' } });
  });

  it('recusa e resposta fora do formato viram ErroSchema', async () => {
    for (const resposta of [mensagem(null, 'refusal'), mensagem(JSON.stringify(pesquisaBoa), 'refusal'), mensagem('não é JSON'), mensagem('{}')]) {
      const { cliente } = clienteFalso(200, resposta);
      await expect(motorApi({ modelo: 'claude-sonnet-5-5', cliente }).chamar(chamada())).rejects.toBeInstanceOf(ErroSchema);
    }
  });

  it('erros do SDK passam por traduzirErroApi', async () => {
    const saldo = { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } };
    const { cliente: semSaldo } = clienteFalso(400, saldo);
    await expect(motorApi({ modelo: 'claude-sonnet-5-5', cliente: semSaldo }).chamar(chamada())).rejects.toBeInstanceOf(ErroSemCredito);

    const { cliente: semChave } = clienteFalso(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
    await expect(motorApi({ modelo: 'claude-sonnet-5-5', cliente: semChave }).chamar(chamada())).rejects.toBeInstanceOf(ErroMotor);

    const { cliente, pedidos } = clienteFalso(200, mensagem(JSON.stringify(pesquisaBoa)));
    await expect(motorApi({ modelo: 'claude-sonnet-5-5', cliente }).chamar(chamada(AbortSignal.abort()))).rejects.toBeInstanceOf(ErroMotor);
    expect(pedidos).toHaveLength(0);
  });

  it('abortar no meio da chamada cancela o pedido e vira ErroMotor', async () => {
    const controle = new AbortController();
    // O fetch só termina quando o sinal que o SDK repassa abortar; se o sinal não chegasse, o teste pararia no tempo limite.
    const cliente = new Anthropic({
      apiKey: 'chave-de-teste',
      fetch: (_url, init) => new Promise<Response>((_, rejeitar) => {
        init?.signal?.addEventListener('abort', () => rejeitar(init.signal!.reason));
        controle.abort();
      }),
    });
    await expect(motorApi({ modelo: 'claude-sonnet-5-5', cliente }).chamar(chamada(controle.signal))).rejects.toBeInstanceOf(ErroMotor);
  });
});

describe('motor da assinatura', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('assinatura: sem ferramentas, com schema, sem chave no ambiente', () => {
    const args = argsAssinatura({ agente: 'pesquisador', sistema: 'S', mensagens: [], schema: Pesquisa }, 'sonnet');
    expect(args).toEqual(expect.arrayContaining(['-p', '--tools', '', '--strict-mcp-config', '--system-prompt', 'S']));
    expect(args[args.indexOf('--json-schema') + 1]).toContain('tipoProduto');
    expect(ambienteSemChave({ ANTHROPIC_API_KEY: 'k', PATH: 'p' })).toEqual({ PATH: 'p' });
  });

  it('argumentos completos e na ordem', () => {
    const args = argsAssinatura({ agente: 'pesquisador', sistema: 'S', mensagens: [], schema: Pesquisa }, 'sonnet');
    expect(args.slice(0, 11)).toEqual([
      '-p', '--model', 'sonnet', '--tools', '', '--strict-mcp-config', '--no-session-persistence',
      '--output-format', 'json', '--system-prompt', 'S',
    ]);
    expect(args[11]).toBe('--json-schema');
    expect(JSON.parse(args[12])).toMatchObject({ type: 'object', required: expect.arrayContaining(['tipoProduto', 'atributos']) });
    expect(args).toHaveLength(13);
  });

  it('o processo filho roda na pasta temporária, sem a chave, e recebe o prompt pelo stdin', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'chave-falsa');
    const eco = "let s='';process.stdin.on('data',(d)=>s+=d).on('end',()=>process.stdout.write(JSON.stringify({cwd:process.cwd(),chave:'ANTHROPIC_API_KEY' in process.env,entrada:s})))";
    const saida = JSON.parse(await rodarProcesso(process.execPath, ['-e', eco], 'prompt com acentuação'));
    expect(realpathSync.native(saida.cwd).toLowerCase()).toBe(realpathSync.native(tmpdir()).toLowerCase());
    expect(saida).toMatchObject({ chave: false, entrada: 'prompt com acentuação' });
  });

  it('abortar mata o processo filho e lança ErroMotor', async () => {
    const arquivoPid = join(await mkdtemp(join(tmpdir(), 'filho-')), 'pid');
    const preso = `require('fs').writeFileSync(${JSON.stringify(arquivoPid)}, String(process.pid)); setInterval(() => {}, 1000)`;
    const controle = new AbortController();
    const rodando = rodarProcesso(process.execPath, ['-e', preso], '', controle.signal);
    const pid = await vi.waitFor(() => Number(readFileSync(arquivoPid, 'utf8')), { timeout: 4000, interval: 20 });
    controle.abort();
    await expect(rodando).rejects.toBeInstanceOf(ErroMotor);
    await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow(), { timeout: 4000, interval: 20 });
  });

  it('schema em draft-07: o Claude Code valida o --json-schema com Ajv padrão e ignora o 2020-12', () => {
    const args = argsAssinatura({ agente: 'pesquisador', sistema: 'S', mensagens: [], schema: Pesquisa }, 'sonnet');
    expect(JSON.parse(args[args.indexOf('--json-schema') + 1]).$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  it('ambienteSemChave tira também o token e não muda o original', () => {
    const env = { ANTHROPIC_API_KEY: 'k', ANTHROPIC_AUTH_TOKEN: 't', APPDATA: 'a' };
    expect(ambienteSemChave(env)).toEqual({ APPDATA: 'a' });
    expect(env).toEqual({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_AUTH_TOKEN: 't', APPDATA: 'a' });
  });

  it('binarioClaude respeita CLAUDE_BIN', () => {
    vi.stubEnv('CLAUDE_BIN', 'C:/outro/claude.exe');
    expect(binarioClaude()).toBe('C:/outro/claude.exe');
    vi.stubEnv('CLAUDE_BIN', undefined);
    if (process.platform === 'win32') expect(binarioClaude()).toMatch(/npm[\\/]node_modules[\\/]@anthropic-ai[\\/]claude-code[\\/]bin[\\/]claude\.exe$/);
    else expect(binarioClaude()).toBe('claude');
  });

  it('transcrever: uma mensagem vai pura; várias vão marcadas na ordem', () => {
    expect(transcrever([{ papel: 'usuario', texto: 'tarefa' }])).toBe('tarefa');
    expect(transcrever([
      { papel: 'usuario', texto: 'tarefa' },
      { papel: 'assistente', texto: '{"a":1}' },
      { papel: 'usuario', texto: 'corrija' },
    ])).toBe('[Nova mensagem]\ntarefa\n\n[Você respondeu antes]\n{"a":1}\n\n[Nova mensagem]\ncorrija');
  });

  it('lerResultado: valida structured_output, soma os tokens e trata is_error', () => {
    const saida = (extra: object) => JSON.stringify({
      type: 'result', is_error: false, usage: { input_tokens: 10, cache_creation_input_tokens: 200, cache_read_input_tokens: 3000, output_tokens: 400 }, ...extra,
    });
    expect(lerResultado(saida({ structured_output: pesquisaBoa }), Pesquisa)).toEqual({ dados: pesquisaBoa, tokensEntrada: 3210, tokensSaida: 400 });
    expect(() => lerResultado(saida({ structured_output: { tipoProduto: 1 } }), Pesquisa)).toThrow(ErroSchema);
    expect(() => lerResultado(saida({}), Pesquisa)).toThrow(ErroSchema);
    expect(() => lerResultado(saida({ is_error: true, result: 'limite atingido' }), Pesquisa)).toThrow(ErroMotor);
    expect(() => lerResultado('isto não é JSON', Pesquisa)).toThrow(ErroMotor);
  });
});

describe('motorFalso', () => {
  it('motorFalso: entrega, valida e lança', async () => {
    const semCredito = new ErroSemCredito('x');
    const m = motorFalso({ pesquisador: [pesquisaBoa, { tipoProduto: 1 }, semCredito] });
    expect(m).toMatchObject({ nome: 'falso' });
    const r = await m.chamar(chamada());
    expect(r.dados).toEqual(pesquisaBoa);
    expect(r).toMatchObject({ tokensEntrada: 0, tokensSaida: 0, custoUsd: 0 });
    await expect(m.chamar(chamada())).rejects.toBeInstanceOf(ErroSchema);
    await expect(m.chamar(chamada())).rejects.toBe(semCredito);
    await expect(m.chamar(chamada())).rejects.toThrow('roteiro acabou');
    expect(m.chamadas).toHaveLength(4);
    expect(m.chamadas[0].sistema).toBe('S');
  });

  it('cada agente tem a própria fila e o roteiro original não muda', async () => {
    const roteiro = { pesquisador: [pesquisaBoa] };
    const m = motorFalso(roteiro);
    await expect(m.chamar({ ...chamada(), agente: 'redator' })).rejects.toThrow('roteiro acabou');
    await m.chamar(chamada());
    expect(roteiro.pesquisador).toHaveLength(1);
  });
});
