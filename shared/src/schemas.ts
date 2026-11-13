import { z } from 'zod';
import { ATRIBUTOS } from './atributos';

const zAtributo = z.enum(ATRIBUTOS.map((a) => a.id) as [(typeof ATRIBUTOS)[number]['id'], ...(typeof ATRIBUTOS)[number]['id'][]]);

export const Pesquisa = z.object({
  tipoProduto: z.string(),
  atributos: z.array(z.object({ id: zAtributo, valor: z.string(), trecho: z.string() })),
  lacunas: z.array(z.object({ id: zAtributo, motivo: z.string() })),
  naoSeAplica: z.array(z.object({ id: zAtributo, justificativa: z.string() })),
});
export type Pesquisa = z.infer<typeof Pesquisa>;

export const FichaNova = z.object({
  titulo: z.string(),
  secoes: z.array(z.object({ id: z.string(), titulo: z.string(), texto: z.string(), fontes: z.array(zAtributo) })),
  atributos: z.array(z.object({ id: zAtributo, rotulo: z.string(), valor: z.string() })),
  faq: z.array(z.object({ id: z.string(), pergunta: z.string(), resposta: z.string(), fontes: z.array(zAtributo) })),
  aConfirmar: z.array(z.object({ id: zAtributo, pergunta: z.string() })),
});
export type FichaNova = z.infer<typeof FichaNova>;

export const Revisao = z.object({
  vereditos: z.array(z.object({
    item: z.string(),
    veredito: z.enum(['sustentado', 'sem_fonte', 'contradiz']),
    evidencia: z.string().nullable(),
    comentario: z.string(),
  })),
});
export type Revisao = z.infer<typeof Revisao>;
