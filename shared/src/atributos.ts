export const ATRIBUTOS = [
  { id: 'material', rotulo: 'Material ou composição' }, { id: 'dimensoes', rotulo: 'Dimensões' },
  { id: 'peso', rotulo: 'Peso' }, { id: 'variacoes', rotulo: 'Variações (cores e tamanhos)' },
  { id: 'uso', rotulo: 'Uso' }, { id: 'publico', rotulo: 'Público' },
  { id: 'cuidados', rotulo: 'Cuidados' }, { id: 'garantia', rotulo: 'Garantia ou troca' },
] as const;
export type AtributoId = (typeof ATRIBUTOS)[number]['id'];
