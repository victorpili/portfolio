import type {
  Agente, ChamadaRegistrada, EntradaMissao, Evento, EventoSemCarimbo, FichaNova, FichaOriginal, Pesquisa, Problema, Resultado, Sala,
} from '@nave/shared';
import { pesquisar, redigir, revisar, type Devolucao, type Prompts } from './agentes';
import {
  conferirFicha, conferirPesquisa, conferirRevisao, corrigirFicha, corrigirPesquisa, fichaDeReserva, itensDaFicha, pesquisaVazia,
  removerReprovados,
} from './imediato';
import { montarAlts, montarJsonLd } from './jsonld';
import { ErroMotor, ErroSchema, ErroSemCredito, type Motor, type NomeAgente, type RespostaMotor } from './motores/motor';
import { calcularNota, entradaAntes, entradaDepois } from './nota';
import { ErroEntrada, fichaDeTexto, lerProduto } from './shopify';

export interface DepsMissao {
  motor: Motor;
  prompts: Prompts;
  lerProduto?: (url: string) => Promise<FichaOriginal>;
  agora?: () => number;
  /** Sinal do cliente: abortado, a missão para sem evento. */
  sinal?: AbortSignal;
  prazoMs?: number;
  /** Roda uma vez, logo antes da primeira chamada ao motor (o servidor confirma a cota aqui). */
  aoPrimeiraChamada?: () => void;
  /** Recebe a causa dos erros inesperados (`api_fora` e falhas do `emitir`). Padrão: `console.error`. */
  aoErro?: (e: unknown) => void;
}

const PRAZO_MS = 150_000;
const CHAMADAS_POR_AGENTE = 2;
const FORA_DO_FORMATO: Problema = { item: 'resposta', motivo: 'resposta fora do formato' };
const SUGESTAO_TENTAR = 'Tente de novo ou veja uma missão gravada.';

const NOME: Record<Agente, string> = {
  capita: 'Capitã', imediato: 'Imediato', pesquisador: 'Pesquisador', redator: 'Redator', revisor: 'Revisor',
};
const SALA: Record<NomeAgente, Sala> = { pesquisador: 'pesquisa', redator: 'criacao', revisor: 'qualidade' };
const NOME_SALA: Record<NomeAgente, string> = { pesquisador: 'Pesquisa', redator: 'Criação', revisor: 'Qualidade' };
const FALAS: Record<NomeAgente, { trabalho: [string, string]; aprovado: string }> = {
  pesquisador: { trabalho: ['lendo a ficha original.', 'refazendo a pesquisa.'], aprovado: 'todos os trechos estão no original. Aprovado.' },
  redator: { trabalho: ['escrevendo a ficha nova.', 'refazendo a ficha.'], aprovado: 'fontes e valores batem com a pesquisa. Aprovado.' },
  revisor: { trabalho: ['julgando cada item contra o original.', 'revisando de novo.'], aprovado: 'todos os itens sustentados. Aprovado.' },
};

const contar = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const resumir = (ps: Problema[]) => (ps.length === 1 ? ps[0].motivo : `${ps.length} problemas (${ps.map((p) => p.item).join(', ')})`);

/** O que muda de um agente para outro no ciclo convocar → trabalhar → conferir → dispensar. */
interface Etapa<T> {
  agente: 'pesquisador' | 'redator';
  chamar: (dev: Devolucao<T> | undefined, sinal: AbortSignal) => Promise<RespostaMotor<T>>;
  resumo: (d: T) => string;
  conferir: (d: T) => Problema[];
  /** Sem tentativa e com problema: o código corrige a entrega. */
  corrigir: (d: T) => T;
  /** Sem tentativa e fora do formato: o código usa a reserva. */
  reserva: () => T;
}

class Missao {
  private seq = 0;
  private readonly inicio: number;
  private readonly usadas: Record<NomeAgente, number> = { pesquisador: 0, redator: 0, revisor: 0 };
  private readonly chamadas: ChamadaRegistrada[] = [];
  private devolucoes = 0;
  private chamou = false;
  readonly prazo: AbortSignal;
  private readonly sinal: AbortSignal;

  constructor(private readonly deps: DepsMissao, private readonly emitir: (e: Evento) => void) {
    this.inicio = this.agora();
    this.prazo = AbortSignal.timeout(deps.prazoMs ?? PRAZO_MS);
    this.sinal = deps.sinal ? AbortSignal.any([deps.sinal, this.prazo]) : this.prazo;
  }

  private agora(): number {
    return (this.deps.agora ?? Date.now)();
  }

  emit(e: EventoSemCarimbo): void {
    this.emitir({ ...e, seq: ++this.seq, t: this.agora() - this.inicio });
  }

  async executar(entrada: EntradaMissao): Promise<Resultado> {
    const { motor, prompts } = this.deps;
    this.emit({ tipo: 'missao_iniciada', mensagem: 'Capitã: missão recebida.' });
    this.emit({ tipo: 'agente_convocado', agente: 'capita', sala: 'ponte', mensagem: 'Capitã: assumindo a Ponte.' });
    this.emit({ tipo: 'agente_convocado', agente: 'imediato', sala: 'ponte', mensagem: 'Capitã: Imediato, para a Ponte.' });

    const ler = this.deps.lerProduto ?? ((url: string) => lerProduto(url));
    const o = 'url' in entrada ? await ler(entrada.url) : fichaDeTexto(entrada.texto);
    if (o.truncada) this.emit({ tipo: 'aviso', mensagem: 'Capitã: ficha longa; usei os primeiros 20.000 caracteres e 30 variantes.' });

    const pesquisa = await this.ciclo<Pesquisa>({
      agente: 'pesquisador',
      chamar: (dev, sinal) => pesquisar(motor, prompts, o, dev, sinal),
      resumo: (p) => `Pesquisador: ${contar(p.atributos.length, 'atributo', 'atributos')}, ${contar(p.lacunas.length, 'lacuna', 'lacunas')}.`,
      conferir: (p) => conferirPesquisa(o, p),
      corrigir: (p) => corrigirPesquisa(o, p).pesquisa,
      reserva: pesquisaVazia,
    });
    const notaAntes = calcularNota(entradaAntes(o, pesquisa));
    this.emit({ tipo: 'nota', qual: 'antes', nota: notaAntes, mensagem: `Capitã: nota antes ${notaAntes.valor}/100.` });

    const rascunho = await this.ciclo(this.etapaRedator(o, pesquisa, () => fichaDeReserva(o, pesquisa)));
    const fichaNova = await this.revisao(o, pesquisa, rascunho);

    const jsonld = montarJsonLd(o, fichaNova);
    const notaDepois = calcularNota(entradaDepois(o, pesquisa, fichaNova, jsonld));
    this.emit({ tipo: 'nota', qual: 'depois', nota: notaDepois, mensagem: `Capitã: nota depois ${notaDepois.valor}/100.` });
    this.emit({ tipo: 'agente_dispensado', agente: 'capita', mensagem: 'Capitã: deixando a Ponte.' });
    this.emit({ tipo: 'agente_dispensado', agente: 'imediato', mensagem: 'Capitã: Imediato dispensado.' });

    const resultado: Resultado = {
      original: o, pesquisa, fichaNova, jsonld, imagens: montarAlts(o, fichaNova), notaAntes, notaDepois,
      aConfirmar: fichaNova.aConfirmar, devolucoes: this.devolucoes, chamadas: this.chamadas,
      custoUsd: this.chamadas.reduce((s, c) => s + c.custoUsd, 0), duracaoMs: this.agora() - this.inicio,
      motor: motor.nome, modelo: motor.modelo,
    };
    this.emit({
      tipo: 'missao_concluida', resultado,
      mensagem: `Capitã: missão concluída. Nota ${notaAntes.valor} → ${notaDepois.valor}.`,
    });
    return resultado;
  }

  private etapaRedator(o: FichaOriginal, p: Pesquisa, reserva: () => FichaNova): Etapa<FichaNova> {
    const { motor, prompts } = this.deps;
    return {
      agente: 'redator',
      chamar: (dev, sinal) => redigir(motor, prompts, o, p, dev, sinal),
      resumo: (n) => `Redator: ficha nova com ${contar(n.secoes.length, 'seção', 'seções')}, `
        + `${contar(n.atributos.length, 'atributo', 'atributos')} e ${contar(n.faq.length, 'pergunta', 'perguntas')}.`,
      conferir: (n) => conferirFicha(p, n),
      corrigir: (n) => corrigirFicha(o, p, n).ficha,
      reserva,
    };
  }

  /** Pesquisador ou Redator: até a 2ª tentativa; depois disso, o código corrige ou usa a reserva. */
  private async ciclo<T>(et: Etapa<T>, dev?: Devolucao<T>): Promise<T> {
    const { agente } = et;
    this.convocar(agente);
    let devolucao = dev;
    for (;;) {
      const dados = await this.trabalhar(agente, (sinal) => et.chamar(devolucao, sinal));
      this.entregar(agente, dados === null ? `${NOME[agente]}: resposta entregue.` : et.resumo(dados));
      const problemas = dados === null ? [FORA_DO_FORMATO] : et.conferir(dados);
      let final: T;
      if (dados !== null && problemas.length === 0) {
        this.emit({ tipo: 'imediato_aprovou', agente, mensagem: `Imediato: ${FALAS[agente].aprovado}` });
        final = dados;
      } else if (this.restam(agente)) {
        this.devolver(agente, problemas, `Imediato: ${resumir(problemas)}. Devolvido ao ${NOME[agente]}.`);
        devolucao = { anterior: dados, problemas };
        continue;
      } else {
        final = dados === null ? et.reserva() : et.corrigir(dados);
        this.corrigir(agente, problemas, `Imediato: ${resumir(problemas)}. Sem nova tentativa; corrigi no código.`);
      }
      this.dispensar(agente);
      return final;
    }
  }

  /**
   * O Revisor julga a ficha e o Imediato confere a revisão. Item reprovado volta ao Redator se os dois ainda
   * tiverem tentativa (o Revisor fica na sala e julga a ficha refeita); senão, o código tira o item da ficha.
   */
  private async revisao(o: FichaOriginal, p: Pesquisa, inicial: FichaNova): Promise<FichaNova> {
    const { motor, prompts } = this.deps;
    let ficha = inicial;
    this.convocar('revisor');
    for (;;) {
      const rev = await this.trabalhar('revisor', (sinal) => revisar(motor, prompts, o, p, ficha, sinal));
      const sustentados = rev?.vereditos.filter((v) => v.veredito === 'sustentado').length ?? 0;
      this.entregar('revisor', rev === null ? 'Revisor: resposta entregue.' : `Revisor: ${sustentados}/${rev.vereditos.length} itens sustentados.`);
      if (rev === null) {
        if (this.restam('revisor')) {
          this.devolver('revisor', [FORA_DO_FORMATO], `Imediato: ${FORA_DO_FORMATO.motivo}. Devolvido ao Revisor.`);
          continue;
        }
        const reprovados = itensDaFicha(ficha).filter((i) => !i.startsWith('atributo:'));
        ficha = removerReprovados(o, ficha, reprovados);
        this.corrigir('redator', reprovados.map((item) => ({ item, motivo: 'item não revisado' })),
          'Imediato: revisão fora do formato. Tirei da ficha o que não foi revisado.');
        break;
      }
      const { reprovados, problemas } = conferirRevisao(o, ficha, rev);
      if (reprovados.length === 0) {
        this.emit({ tipo: 'imediato_aprovou', agente: 'revisor', mensagem: `Imediato: ${FALAS.revisor.aprovado}` });
        break;
      }
      const lista = reprovados.join(', ');
      if (this.restam('redator') && this.restam('revisor')) {
        this.devolver('redator', problemas, `Imediato: o Revisor reprovou ${lista}. Devolvido ao Redator.`);
        const anterior = ficha;
        // Se o Redator sair do formato agora, a reserva é a ficha anterior sem os itens reprovados.
        ficha = await this.ciclo(this.etapaRedator(o, p, () => removerReprovados(o, anterior, reprovados)), { anterior, problemas });
        continue;
      }
      ficha = removerReprovados(o, ficha, reprovados);
      this.corrigir('redator', problemas, `Imediato: o Revisor reprovou ${lista}. Sem nova tentativa; tirei da ficha.`);
      break;
    }
    this.dispensar('revisor');
    return ficha;
  }

  /** Uma chamada ao motor. Confere o sinal antes; resposta fora do formato vira `null`. */
  private async trabalhar<T>(agente: NomeAgente, fazer: (sinal: AbortSignal) => Promise<RespostaMotor<T>>): Promise<T | null> {
    const tentativa = (this.usadas[agente] + 1) as 1 | 2;
    this.emit({ tipo: 'agente_trabalhando', agente, tentativa, mensagem: `${NOME[agente]}: ${FALAS[agente].trabalho[tentativa - 1]}` });
    this.sinal.throwIfAborted();
    if (!this.chamou) {
      this.chamou = true;
      this.deps.aoPrimeiraChamada?.();
    }
    this.usadas[agente] = tentativa;
    try {
      const r = await fazer(this.sinal);
      this.chamadas.push({ agente, tentativa, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida, custoUsd: r.custoUsd, ms: r.ms });
      return r.dados;
    } catch (e) {
      if (e instanceof ErroSchema && !this.sinal.aborted) return null;
      throw e;
    }
  }

  private restam(agente: NomeAgente): boolean {
    return this.usadas[agente] < CHAMADAS_POR_AGENTE;
  }

  private convocar(agente: NomeAgente): void {
    this.emit({ tipo: 'agente_convocado', agente, sala: SALA[agente], mensagem: `Capitã: ${NOME[agente]}, para a sala de ${NOME_SALA[agente]}.` });
  }

  private entregar(agente: NomeAgente, resumo: string): void {
    this.emit({ tipo: 'agente_entregou', agente, mensagem: resumo });
    this.emit({ tipo: 'imediato_conferindo', agente, mensagem: `Imediato: conferindo a entrega do ${NOME[agente]}.` });
  }

  private devolver(agente: NomeAgente, problemas: Problema[], mensagem: string): void {
    this.devolucoes++;
    this.emit({ tipo: 'imediato_devolveu', agente, problemas, mensagem });
  }

  private corrigir(agente: NomeAgente, problemas: Problema[], mensagem: string): void {
    this.emit({ tipo: 'imediato_corrigiu', agente, problemas, mensagem });
  }

  private dispensar(agente: NomeAgente): void {
    this.emit({ tipo: 'agente_dispensado', agente, mensagem: `Capitã: ${NOME[agente]} dispensado.` });
  }
}

function eventoDeErro(e: unknown, prazoEstourou: boolean): Extract<EventoSemCarimbo, { tipo: 'erro' }> {
  if (prazoEstourou) {
    return { tipo: 'erro', codigo: 'tempo_esgotado', recuperavel: true, sugestao: SUGESTAO_TENTAR,
      mensagem: 'Capitã: a missão passou do tempo limite e parou.' };
  }
  if (e instanceof ErroEntrada) {
    const sugestao = e.codigo === 'loja_bloqueou' || e.codigo === 'produto_nao_encontrado' ? 'Cole o texto da ficha.'
      : e.codigo === 'texto_invalido' ? 'Cole um texto de 80 a 20.000 caracteres.' : 'Confira a URL do produto.';
    return { tipo: 'erro', codigo: e.codigo, recuperavel: true, sugestao, mensagem: `Capitã: ${e.message}` };
  }
  if (e instanceof ErroSemCredito) {
    return { tipo: 'erro', codigo: 'sem_credito', recuperavel: false, sugestao: 'Veja uma missão gravada.',
      mensagem: 'Capitã: a API do Claude está sem crédito. A missão parou.' };
  }
  return { tipo: 'erro', codigo: 'api_fora', recuperavel: true, sugestao: SUGESTAO_TENTAR,
    mensagem: e instanceof ErroMotor ? 'Capitã: a API do Claude não respondeu. A missão parou.' : 'Capitã: algo deu errado na missão.' };
}

/**
 * Roda uma missão: lê a entrada, coordena Pesquisador → Redator → Revisor (no máximo 2 chamadas cada),
 * calcula as notas e emite os eventos. Nunca lança: em erro, emite `erro` e devolve `null`.
 * Se o cliente abortar (`deps.sinal`), devolve `null` sem evento.
 */
export async function executarMissao(
  entrada: EntradaMissao, deps: DepsMissao, emitir: (e: Evento) => void,
): Promise<Resultado | null> {
  const missao = new Missao(deps, emitir);
  try {
    return await missao.executar(entrada);
  } catch (e) {
    if (deps.sinal?.aborted) return null;
    const registrar = (x: unknown) => {
      try {
        (deps.aoErro ?? ((y: unknown) => console.error('[capita]', y)))(x);
      } catch { /* registrar não pode derrubar a missão */ }
    };
    const evento = eventoDeErro(e, missao.prazo.aborted);
    // Entrada inválida, falta de crédito e abortos são resultados esperados; só o inesperado é registrado.
    if (evento.codigo === 'api_fora') registrar(e);
    try {
      missao.emit(evento);
    } catch (falha) {
      registrar(falha); // quem recebe os eventos falhou; não há mais a quem avisar
    }
    return null;
  }
}
