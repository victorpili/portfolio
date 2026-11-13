import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FichaNova, Pesquisa, Revisao } from '@nave/shared';
import type { FichaOriginal, Problema } from '@nave/shared';
import { itensDaFicha } from './imediato';
import type { Chamada, Motor, NomeAgente, RespostaMotor } from './motores/motor';

export type Prompts = Record<NomeAgente, string>;
export type Devolucao<T> = { anterior: T | null; problemas: Problema[] };

const PASTA_PROMPTS = fileURLToPath(new URL('../../prompts', import.meta.url));

export function carregarPrompts(dir = PASTA_PROMPTS): Prompts {
  const ler = (nome: NomeAgente) => readFileSync(join(dir, `${nome}.md`), 'utf8');
  return { pesquisador: ler('pesquisador'), redator: ler('redator'), revisor: ler('revisor') };
}

/** Dado em JSON entre tags. `</` vira `<\/` (o mesmo texto em JSON) para o conteúdo da loja não fechar a tag. */
function bloco(tag: string, dados: unknown): string {
  return `<${tag}>\n${JSON.stringify(dados, null, 2).replaceAll('</', '<\\/')}\n</${tag}>`;
}

export function fichaParaPrompt(o: FichaOriginal): string {
  return bloco('ficha_original', {
    titulo: o.titulo,
    marca: o.marca,
    tipo: o.tipo,
    tags: o.tags,
    opcoes: o.opcoes,
    variantes: o.variantes.map((v) => ({ titulo: v.titulo, sku: v.sku, preco: v.preco })),
    descricao: o.descricaoTexto,
  });
}

/** Sem devolução: só a tarefa. Com devolução: tarefa, a entrega anterior (se houver) e a lista do Imediato. */
function conversa<T>(tarefa: string, dev?: Devolucao<T>): Chamada<T>['mensagens'] {
  if (!dev) return [{ papel: 'usuario', texto: tarefa }];
  const lista = dev.problemas.map((p) => `- ${p.item}: ${p.motivo}`).join('\n');
  return [
    { papel: 'usuario', texto: tarefa },
    ...(dev.anterior !== null ? [{ papel: 'assistente' as const, texto: JSON.stringify(dev.anterior) }] : []),
    {
      papel: 'usuario',
      texto: `O Imediato devolveu sua entrega:\n${lista}\nCorrija só esses pontos e devolva a resposta completa no mesmo formato.`,
    },
  ];
}

export function pesquisar(motor: Motor, prompts: Prompts, o: FichaOriginal, dev?: Devolucao<Pesquisa>): Promise<RespostaMotor<Pesquisa>> {
  const tarefa = `${fichaParaPrompt(o)}\n\nPesquise os 8 atributos nesta ficha.`;
  return motor.chamar({ agente: 'pesquisador', sistema: prompts.pesquisador, mensagens: conversa(tarefa, dev), schema: Pesquisa });
}

export function redigir(
  motor: Motor, prompts: Prompts, o: FichaOriginal, p: Pesquisa, dev?: Devolucao<FichaNova>,
): Promise<RespostaMotor<FichaNova>> {
  const tarefa = `${fichaParaPrompt(o)}\n\n${bloco('pesquisa', p)}\n\nEscreva a ficha nova com base nesta ficha e nesta pesquisa.`;
  return motor.chamar({ agente: 'redator', sistema: prompts.redator, mensagens: conversa(tarefa, dev), schema: FichaNova });
}

export function revisar(motor: Motor, prompts: Prompts, o: FichaOriginal, p: Pesquisa, n: FichaNova): Promise<RespostaMotor<Revisao>> {
  const tarefa = [
    fichaParaPrompt(o),
    bloco('pesquisa', p),
    bloco('ficha_nova', n),
    `<itens_para_revisar>\n${itensDaFicha(n).join('\n')}\n</itens_para_revisar>`,
    'Julgue cada item de <itens_para_revisar> contra a ficha original.',
  ].join('\n\n');
  return motor.chamar({ agente: 'revisor', sistema: prompts.revisor, mensagens: conversa(tarefa), schema: Revisao });
}
