import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IndiceMissoes, MissaoGravada } from '@nave/shared';
import { ErroSchema, type Chamada, type Motor, type RespostaMotor } from './motores/motor';

export interface OpcoesCli { url?: string; arquivoTexto?: string; motor: 'api' | 'assinatura'; modelo: string; gravar?: string }

const MODELO_GRAVACAO = 'claude-opus-5-5';
const NOME_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Lê `<url>` ou `--texto <arquivo>`, mais `--motor`, `--modelo` e `--gravar <nome>`.
 * A missão gravada é a que o público vê: só pela API e sempre com o Opus.
 */
export function lerArgs(argv: string[]): OpcoesCli {
  let arquivoTexto: string | undefined;
  let motor: string | undefined;
  let modelo: string | undefined;
  let gravar: string | undefined;
  const entradas: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue; // o pnpm às vezes repassa o separador
    if (!arg.startsWith('--')) {
      entradas.push(arg);
      continue;
    }
    if (!['--texto', '--motor', '--modelo', '--gravar'].includes(arg)) throw new Error(`opção desconhecida: ${arg}`);
    const valor = argv[++i];
    if (valor === undefined || valor.startsWith('--')) throw new Error(`${arg} precisa de um valor`);
    if (arg === '--texto') {
      arquivoTexto = valor;
      entradas.push(valor);
    } else if (arg === '--motor') motor = valor;
    else if (arg === '--modelo') modelo = valor;
    else gravar = valor;
  }

  if (entradas.length === 0) throw new Error('informe a URL do produto ou --texto <arquivo>');
  if (entradas.length > 1) throw new Error('informe uma entrada só: a URL ou --texto <arquivo>');
  if (motor !== undefined && motor !== 'api' && motor !== 'assinatura') throw new Error('--motor deve ser api ou assinatura');
  const qual = (motor ?? 'api') as OpcoesCli['motor'];

  if (gravar !== undefined) {
    if (qual !== 'api') throw new Error('missão gravada só pela API');
    if (!NOME_VALIDO.test(gravar)) throw new Error('--gravar aceita só letras minúsculas, números e hífen');
  }
  const padrao = qual === 'api' ? process.env.MODELO_AO_VIVO ?? 'claude-sonnet-5-5' : 'sonnet';
  const opcoes: OpcoesCli = { motor: qual, modelo: gravar !== undefined ? MODELO_GRAVACAO : modelo ?? padrao };
  if (arquivoTexto !== undefined) opcoes.arquivoTexto = arquivoTexto;
  else opcoes.url = entradas[0];
  if (gravar !== undefined) opcoes.gravar = gravar;
  return opcoes;
}

async function lerIndice(caminho: string): Promise<IndiceMissoes> {
  try {
    return JSON.parse(await readFile(caminho, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}

/** Grava `<dir>/<nome>.json` e insere ou substitui a entrada em `<dir>/indice.json`. Devolve o caminho da missão. */
export async function salvarMissao(dir: string, m: MissaoGravada): Promise<string> {
  await mkdir(dir, { recursive: true });
  const caminho = join(dir, `${m.nome}.json`);
  await writeFile(caminho, `${JSON.stringify(m, null, 2)}\n`);

  const caminhoIndice = join(dir, 'indice.json');
  const indice = await lerIndice(caminhoIndice);
  const entrada = { nome: m.nome, titulo: m.titulo, loja: m.loja };
  const i = indice.findIndex((x) => x.nome === m.nome);
  if (i === -1) indice.push(entrada);
  else indice[i] = entrada;
  await writeFile(caminhoIndice, `${JSON.stringify(indice, null, 2)}\n`);
  return caminho;
}

/**
 * Embrulha o motor para somar o custo de cada chamada que voltou, inclusive recusa e resposta fora do formato
 * (o `ErroSchema` traz o custo e é relançado igual). A Capitã só registra as chamadas certas; a linha de comando
 * precisa do total real, porque as regras de parada da gravação dependem dele.
 */
export function contarCusto(motor: Motor): { motor: Motor; custoUsd: () => number } {
  let total = 0;
  return {
    motor: {
      nome: motor.nome,
      modelo: motor.modelo,
      async chamar<T>(c: Chamada<T>): Promise<RespostaMotor<T>> {
        try {
          const r = await motor.chamar(c);
          total += r.custoUsd;
          return r;
        } catch (e) {
          if (e instanceof ErroSchema) total += e.custoUsd ?? 0;
          throw e;
        }
      },
    },
    custoUsd: () => total,
  };
}
