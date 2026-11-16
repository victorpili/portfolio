import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarPrompts } from './agentes';
import { criarCota } from './limites';
import { motorApi } from './motores/api';
import { motorAssinatura, PRAZO_ASSINATURA_MS } from './motores/assinatura';
import type { Motor } from './motores/motor';
import { criarApp } from './rotas';

const RAIZ = fileURLToPath(new URL('../..', import.meta.url));
const env = join(RAIZ, '.env');
if (existsSync(env)) process.loadEnvFile(env);

// A assinatura só serve para testar a nave na máquina local, sem gastar crédito; no Render, só a API.
const pelaAssinatura = process.env.MOTOR === 'assinatura' && !process.env.RENDER;
const motor: Motor = pelaAssinatura ? motorAssinatura() : motorApi({ modelo: process.env.MODELO_AO_VIVO ?? 'claude-sonnet-5-5' });

const app = criarApp({
  motor,
  prompts: carregarPrompts(),
  cota: criarCota({ porDia: Number(process.env.COTA_DIA ?? 5), porVisitante: Number(process.env.COTA_VISITANTE ?? 3) }),
  origens: (process.env.ORIGEM_PERMITIDA ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  prazoMs: pelaAssinatura ? PRAZO_ASSINATURA_MS : undefined,
});

const porta = Number(process.env.PORT ?? 8787);
app.listen(porta, () => {
  console.log(`Nave no ar na porta ${porta} (motor ${motor.nome}, modelo ${motor.modelo})`);
});
