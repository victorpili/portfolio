import { describe, it, expect } from 'vitest';
import type { FichaOriginal } from '@nave/shared';
import { htmlParaTexto, normalizar, contemTrecho, ondeEsta } from '../src/texto';
import { originalCaneca } from './fixtures/respostas';

function fichaCom(p: Partial<FichaOriginal>): FichaOriginal {
  return {
    fonte: 'texto', url: null, loja: null, titulo: '', descricaoHtml: '', descricaoTexto: '',
    marca: null, tipo: null, tags: [], opcoes: [], variantes: [], imagens: [],
    moeda: null, jsonldPaginaValido: false, naoVerificavel: [], truncada: false, ...p,
  };
}

describe('htmlParaTexto', () => {
  it('quebra linha em tags de bloco, remove as demais e decodifica entidades', () => {
    expect(htmlParaTexto('<p>A &amp; B</p><ul><li>um <b>dois</b></li><li>três</li></ul>a<br>b'))
      .toBe('A & B\num dois\ntrês\na\nb');
  });
});

describe('normalizar', () => {
  it('decodifica entidades, aspas curvas, minúsculas e espaços', () => {
    expect(normalizar('<b>Aço&nbsp;  INOX</b> &#x41;&#66; “x” ‘y’ 12″ &lt;&apos;&gt;'))
      .toBe("aço inox ab \"x\" 'y' 12\" <'>");
  });
});

describe('contemTrecho', () => {
  it('acha trecho com entidade, nbsp e aspas curvas', () => {
    const f = fichaCom({ descricaoTexto: htmlParaTexto('<p>Feita em a&#231;o&nbsp;inox de 12” x 8”.</p>') });
    expect(contemTrecho(f, 'aço inox')).toBe(true);
    expect(contemTrecho(f, '12" x 8".')).toBe(true);
  });
  it('recusa trecho curto ou inexistente', () => {
    const f = fichaCom({ descricaoTexto: 'Caneca de cerâmica' });
    expect(contemTrecho(f, 'ce')).toBe(false);
    expect(contemTrecho(f, 'porcelana')).toBe(false);
  });
  it('procura também em título, marca, tipo, tags, opções e variantes', () => {
    expect(contemTrecho(originalCaneca, 'casa barro')).toBe(true);
    expect(contemTrecho(originalCaneca, 'Canecas')).toBe(true);
    expect(contemTrecho(originalCaneca, 'cozinha')).toBe(true);
    expect(contemTrecho(originalCaneca, 'Caneca Barro 350 ml')).toBe(true);
  });
  it('com { tags: false }, trecho que só está nas tags não conta; o padrão continua aceitando', () => {
    expect(contemTrecho(originalCaneca, 'cozinha')).toBe(true);
    expect(contemTrecho(originalCaneca, 'cozinha', { tags: false })).toBe(false);
    // "caneca" também é tag, mas está no título: continua valendo sem as tags.
    expect(contemTrecho(originalCaneca, 'caneca', { tags: false })).toBe(true);
    expect(contemTrecho(originalCaneca, 'cerâmica esmaltada', { tags: false })).toBe(true);
  });
});

describe('ondeEsta', () => {
  it('li é estruturado, parágrafo é texto, opção é estruturado', () => {
    const f = originalCaneca;
    expect(ondeEsta(f, 'cerâmica esmaltada')).toBe('estruturado');
    expect(ondeEsta(f, 'café coado')).toBe('texto');
    expect(ondeEsta(f, 'verde')).toBe('estruturado');
    expect(ondeEsta(f, 'porcelana')).toBeNull();
  });
  it('td, tipo e tags contam como estruturado', () => {
    const f = fichaCom({ descricaoHtml: '<table><tr><th>Peso</th><td>2 kg</td></tr></table>', descricaoTexto: 'Peso\n2 kg', tipo: 'Panelas', tags: ['inox'] });
    expect(ondeEsta(f, '2 kg')).toBe('estruturado');
    expect(ondeEsta(f, 'panelas')).toBe('estruturado');
    expect(ondeEsta(f, 'inox')).toBe('estruturado');
  });
});
