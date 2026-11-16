import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { CodigoErro, EntradaMissao, Evento, FichaOriginal } from '@nave/shared';
import type { Prompts } from './agentes';
import { executarMissao } from './capita';
import type { Cota } from './limites';
import { contarCusto, type Motor } from './motores/motor';
import { validarUrlProduto } from './url-segura';

export interface DepsApp {
  motor: Motor;
  prompts: Prompts;
  cota: Cota;
  origens: string[];
  lerProduto?: (url: string) => Promise<FichaOriginal>;
  /** Prazo da missão; sem ele vale o da Capitã (150 s). */
  prazoMs?: number;
}

const BATIMENTO_MS = 15_000;
const TEXTO_MIN = 80;
const TEXTO_MAX = 20_000;
const usd = (x: number) => `US$ ${x.toFixed(4)}`;

const recusar = (res: Response, status: number, codigo: CodigoErro, mensagem: string) => {
  res.status(status).json({ codigo, mensagem });
};

export function criarApp(d: DepsApp): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const origem = req.headers.origin;
    if (origem !== undefined && d.origens.includes(origem)) {
      res.setHeader('Access-Control-Allow-Origin', origem);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/saude', (_req, res) => { res.json({ ok: true }); });
  app.get('/api/cota', (_req, res) => { res.json({ restantes: d.cota.restantes(), porDia: d.cota.porDia }); });

  app.post('/api/missao', async (req, res) => {
    const corpo: { url?: unknown; texto?: unknown } = req.body ?? {};
    let entrada: EntradaMissao;
    if (typeof corpo.url === 'string') {
      const v = validarUrlProduto(corpo.url);
      if (!v.ok) return recusar(res, 400, 'url_invalida', v.motivo);
      entrada = { url: corpo.url.trim() };
    } else if (typeof corpo.texto === 'string') {
      if (corpo.texto.length < TEXTO_MIN || corpo.texto.length > TEXTO_MAX) {
        return recusar(res, 400, 'texto_invalido', 'Cole um texto de 80 a 20.000 caracteres.');
      }
      entrada = { texto: corpo.texto };
    } else {
      return recusar(res, 400, 'entrada_invalida', 'Envie a URL do produto ou o texto da ficha.');
    }

    const reserva = d.cota.reservar(req.ip ?? 'desconhecido');
    if (!reserva.ok) {
      if (reserva.motivo === 'ocupado') {
        return recusar(res, 429, 'missao_em_andamento', 'Você já tem uma missão em andamento, ou a nave está cheia. Tente em instantes.');
      }
      return recusar(res, 429, 'cota_esgotada', 'A cota de missões ao vivo acabou. Veja uma missão gravada.');
    }

    res.status(200).set({
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const inicio = Date.now();
    // Depois do fechamento a Capitã ainda emite até a próxima checagem do sinal: escrever aqui tem de ser inofensivo.
    const escrever = (e: unknown) => {
      if (res.writableEnded || res.destroyed) return;
      try {
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      } catch { /* o cliente já foi embora */ }
    };
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const batimento = setInterval(() => {
      escrever({ seq: 0, t: Date.now() - inicio, tipo: 'batimento', mensagem: 'Nave: batimento.' } satisfies Evento);
    }, BATIMENTO_MS);

    const contador = contarCusto(d.motor);
    try {
      const resultado = await executarMissao(entrada, {
        motor: contador.motor, prompts: d.prompts, lerProduto: d.lerProduto, sinal: abort.signal, prazoMs: d.prazoMs,
        aoPrimeiraChamada: () => reserva.confirmar(),
      }, escrever);
      if (resultado === null) {
        console.log(`missão sem resultado; custo até a falha (mínimo): ${usd(contador.custoUsd())}`);
      } else {
        for (const c of resultado.chamadas) {
          console.log(`chamada ${c.agente} tentativa ${c.tentativa}: ${c.tokensEntrada} tokens de entrada, ${c.tokensSaida} de saída, ${usd(c.custoUsd)}`);
        }
        console.log(`missão concluída; custo total: ${usd(contador.custoUsd())}`);
      }
    } finally {
      clearInterval(batimento);
      reserva.liberar();
      if (!res.writableEnded) res.end();
    }
  });

  // Corpo grande demais ou JSON quebrado.
  app.use((err: { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.status === 413) return recusar(res, 413, 'entrada_invalida', 'O corpo da requisição é grande demais.');
    if (err.status !== undefined && err.status < 500) return recusar(res, 400, 'entrada_invalida', 'Corpo da requisição inválido.');
    console.error('[rotas]', err);
    res.status(500).json({ codigo: 'api_fora', mensagem: 'Erro interno.' });
  });

  return app;
}
