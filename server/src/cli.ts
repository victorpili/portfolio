import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EntradaMissao, Evento } from '@nave/shared';
import { carregarPrompts } from './agentes';
import { executarMissao } from './capita';
import { lerArgs, salvarMissao } from './gravacao';
import { motorApi } from './motores/api';
import { motorAssinatura } from './motores/assinatura';

// Linha de comando: `pnpm missao <url>` ou `pnpm missao --texto <arquivo>`, com `--motor`, `--modelo` e `--gravar <nome>`.

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const PASTA_MISSOES = join(RAIZ, 'web', 'public', 'missoes');
const USO = 'Uso: pnpm missao <url> | --texto <arquivo> [--motor api|assinatura] [--modelo <id>] [--gravar <nome>]';

const relogio = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

async function main(): Promise<number> {
  const env = join(RAIZ, '.env');
  if (existsSync(env)) process.loadEnvFile(env);

  let op;
  try {
    op = lerArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${(e as Error).message}\n${USO}`);
    return 1;
  }
  const motor = op.motor === 'api' ? motorApi({ modelo: op.modelo }) : motorAssinatura(op.modelo);
  // O pnpm roda o script na pasta do pacote; o arquivo é relativo à pasta de onde o comando foi chamado.
  const entrada: EntradaMissao = op.arquivoTexto !== undefined
    ? { texto: await readFile(resolve(process.env.INIT_CWD ?? process.cwd(), op.arquivoTexto), 'utf8') }
    : { url: op.url! };

  console.log(`Motor: ${motor.nome}, modelo ${motor.modelo}.`);
  const eventos: Evento[] = [];
  const resultado = await executarMissao(entrada, { motor, prompts: carregarPrompts() }, (e) => {
    eventos.push(e);
    console.log(`[${relogio(e.t)}] ${e.mensagem}`);
  });
  if (resultado === null) return 1;

  console.log('');
  console.log(`Notas: ${resultado.notaAntes.valor} → ${resultado.notaDepois.valor} (devoluções: ${resultado.devolucoes}).`);
  console.log(`Custo total: US$ ${resultado.custoUsd.toFixed(4)}.`);
  console.log(`Duração: ${(resultado.duracaoMs / 1000).toFixed(1)} s.`);
  if (op.gravar !== undefined) {
    const caminho = await salvarMissao(PASTA_MISSOES, {
      nome: op.gravar,
      titulo: resultado.original.titulo,
      loja: resultado.original.loja ?? 'texto colado',
      gravadaEm: new Date().toISOString(),
      modelo: motor.modelo,
      eventos,
    });
    console.log(`Missão gravada em ${caminho}.`);
  }
  return 0;
}

main().then(
  (codigo) => { process.exitCode = codigo; },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
