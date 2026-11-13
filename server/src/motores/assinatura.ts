import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { ErroMotor, ErroSchema, type Chamada, type Motor, type RespostaMotor } from './motor';

// Motor só para ajustar os prompts: manda os mesmos prompts ao Claude Code (`claude -p`) na assinatura do usuário,
// sem gastar crédito da API. Não reproduz o formato forçado nem o custo; nunca grava missão nem atende o ao vivo.

export function binarioClaude(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
  }
  return 'claude';
}

export function argsAssinatura<T>(c: Chamada<T>, modelo: string): string[] {
  // draft-07: o Claude Code confere o --json-schema com um Ajv padrão, que não conhece o 2020-12 (o padrão do zod).
  // Com 2020-12 ele descarta o schema sem avisar e a resposta volta sem `structured_output`.
  const schema = z.toJSONSchema(c.schema, { target: 'draft-7' });
  return [
    // --tools '' desliga as ferramentas internas; --strict-mcp-config sem --mcp-config desliga todo servidor MCP.
    '-p', '--model', modelo, '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json',
    '--system-prompt', c.sistema, '--json-schema', JSON.stringify(schema),
  ];
}

/** `claude -p` recebe um texto só: com devolução, a conversa vai transcrita em blocos marcados. */
export function transcrever(mensagens: Chamada<unknown>['mensagens']): string {
  if (mensagens.length === 1) return mensagens[0].texto;
  return mensagens
    .map((m) => `${m.papel === 'assistente' ? '[Você respondeu antes]' : '[Nova mensagem]'}\n${m.texto}`)
    .join('\n\n');
}

const SEM_CHAVE = new Set(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']);

/** Cópia do ambiente sem as credenciais da API, para o Claude Code usar a assinatura e nunca gastar crédito. */
export function ambienteSemChave(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // No Windows o nome da variável não diferencia maiúsculas, então a comparação também não.
  return Object.fromEntries(Object.entries(env).filter(([nome]) => !SEM_CHAVE.has(nome.toUpperCase())));
}

interface SaidaClaude {
  is_error?: boolean;
  subtype?: string;
  result?: string;
  structured_output?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
}

/** Lê o JSON que `claude -p --output-format json` imprime. */
export function lerResultado<T>(saida: string, schema: z.ZodType<T>): { dados: T; tokensEntrada: number; tokensSaida: number } {
  let r: SaidaClaude;
  try {
    r = JSON.parse(saida);
  } catch {
    throw new ErroMotor(`saída do claude -p não é JSON: ${saida.slice(0, 200)}`);
  }
  if (typeof r !== 'object' || r === null) throw new ErroMotor('saída do claude -p sem resultado');
  if (r.subtype === 'error_max_structured_output_retries') throw new ErroSchema('claude -p não chegou ao formato pedido');
  if (r.is_error) throw new ErroMotor(`claude -p falhou: ${(r.result ?? r.subtype ?? 'sem detalhe').slice(0, 300)}`);
  const dados = schema.safeParse(r.structured_output);
  if (!dados.success) throw new ErroSchema(`resposta fora do formato: ${dados.error.message}`);
  const u = r.usage ?? {};
  return {
    dados: dados.data,
    tokensEntrada: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    tokensSaida: u.output_tokens ?? 0,
  };
}

/**
 * Roda o binário com o texto no stdin e devolve o stdout.
 * Sem shell: os argumentos não passam por interpretação. Roda na pasta temporária, para não carregar CLAUDE.md
 * nem MCP de projeto, e sem as credenciais da API. Se o sinal abortar, o `spawn` mata o filho e a promessa
 * rejeita com `ErroMotor`.
 */
export function rodarProcesso(binario: string, args: string[], entrada: string, sinal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const filho = spawn(binario, args, { cwd: tmpdir(), env: ambienteSemChave(process.env), signal: sinal, windowsHide: true });
    const saida: Buffer[] = [];
    const erros: Buffer[] = [];
    filho.stdout.on('data', (b: Buffer) => saida.push(b));
    filho.stderr.on('data', (b: Buffer) => erros.push(b));
    filho.on('error', (e) => {
      reject(new ErroMotor(sinal?.aborted ? 'claude -p cancelado' : `claude -p não rodou: ${e.message}`, { cause: e }));
    });
    filho.on('close', (codigo) => {
      const texto = Buffer.concat(saida).toString('utf8');
      if (sinal?.aborted) {
        reject(new ErroMotor('claude -p cancelado'));
      } else if (codigo !== 0 && !texto.trim()) {
        reject(new ErroMotor(`claude -p saiu com código ${codigo}: ${Buffer.concat(erros).toString('utf8').slice(0, 300)}`));
      } else {
        resolve(texto);
      }
    });
    // Se o filho fechar a entrada antes da hora, o erro de verdade chega pelo 'close' ou pelo 'error'.
    filho.stdin.on('error', () => {});
    filho.stdin.end(entrada);
  });
}

export function motorAssinatura(modelo = 'sonnet'): Motor {
  return {
    nome: 'assinatura',
    modelo,
    async chamar<T>(c: Chamada<T>): Promise<RespostaMotor<T>> {
      const inicio = Date.now();
      const saida = await rodarProcesso(binarioClaude(), argsAssinatura(c, modelo), transcrever(c.mensagens), c.sinal);
      return { ...lerResultado(saida, c.schema), custoUsd: 0, ms: Date.now() - inicio };
    },
  };
}
