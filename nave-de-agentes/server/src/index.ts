import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarPrompts } from './agentes';
import { escolherMotor, lerLimite, lerOrigens } from './config';
import { criarCota } from './limites';
import { criarApp } from './rotas';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const env = join(RAIZ, '.env');
if (existsSync(env)) process.loadEnvFile(env);

const { motor, prazoMs } = escolherMotor(process.env);
const app = criarApp({
  motor,
  prompts: carregarPrompts(),
  cota: criarCota({ porDia: lerLimite(process.env, 'COTA_DIA', 5), porVisitante: lerLimite(process.env, 'COTA_VISITANTE', 3) }),
  origens: lerOrigens(process.env),
  prazoMs,
});

const porta = Number(process.env.PORT ?? 8787);
app.listen(porta, (err?: Error) => {
  if (err) {
    console.error(`Não consegui abrir a porta ${porta}: ${err.message}`);
    process.exit(1);
  }
  console.log(`Nave no ar na porta ${porta} (motor ${motor.nome}, modelo ${motor.modelo})`);
});
