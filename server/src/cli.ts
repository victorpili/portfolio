import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EntradaMissao, Evento } from '@nave/shared';
import { carregarPrompts } from './agentes';
import { executarMissao } from './capita';
import { contarCusto, lerArgs, salvarMissao } from './gravacao';
import { motorApi } from './motores/api';
import { motorAssinatura } from './motores/assinatura';

// Linha de comando: `pnpm missao <url>` ou `pnpm missao --texto <arquivo>`, com `--motor`, `--modelo` e `--gravar <nome>`.

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const PASTA_MISSOES = join(RAIZ, 'web', 'public', 'missoes');
const USO = 'Uso: pnpm missao <url> | --texto <arquivo> [--motor api|assinatura] [--modelo <id>] [--gravar <nome>]';
// O prazo de 150 s vale para a API. Pela assinatura, cada `claude -p` leva de 50 a 90 s, e ela só serve para
// ajustar os prompts; com o prazo da API, nenhuma missão terminaria.
const PRAZO_ASSINATURA_MS = 15 * 60_000;

const usd = (x: number) => `US$ ${x.toFixed(4)}`;

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
  // O contador soma todas as chamadas que voltaram, inclusive as fora do formato, que a Capitã não registra.
  const contador = contarCusto(op.motor === 'api' ? motorApi({ modelo: op.modelo }) : motorAssinatura(op.modelo));
  const { motor } = contador;
  // O pnpm roda o script na pasta do pacote; o arquivo é relativo à pasta de onde o comando foi chamado.
  const entrada: EntradaMissao = op.arquivoTexto !== undefined
    ? { texto: await readFile(resolve(process.env.INIT_CWD ?? process.cwd(), op.arquivoTexto), 'utf8') }
    : { url: op.url! };

  console.log(`Motor: ${motor.nome}, modelo ${motor.modelo}.`);
  const eventos: Evento[] = [];
  const prazoMs = op.motor === 'assinatura' ? PRAZO_ASSINATURA_MS : undefined;
  const inicio = Date.now();
  const resultado = await executarMissao(entrada, { motor, prompts: carregarPrompts(), prazoMs }, (e) => {
    eventos.push(e);
    console.log(`[${relogio(e.t)}] ${e.mensagem}`);
  });
  const total = contador.custoUsd();
  console.log('');
  if (resultado === null) {
    console.log(`Custo até a falha: ${usd(total)}.`);
    console.log(`Duração até a falha: ${((Date.now() - inicio) / 1000).toFixed(1)} s.`);
    return 1;
  }

  console.log(`Notas: ${resultado.notaAntes.valor} → ${resultado.notaDepois.valor} (devoluções: ${resultado.devolucoes}).`);
  const diferenca = Math.abs(total - resultado.custoUsd) > 1e-9
    ? ` (o resultado registra ${usd(resultado.custoUsd)}; a diferença são recusas ou respostas fora do formato)` : '';
  console.log(`Custo total: ${usd(total)}${diferenca}.`);
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
