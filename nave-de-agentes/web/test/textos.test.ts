import { describe, expect, it } from 'vitest';
import type { CodigoErro } from '@nave/shared';
import { ErroApi } from '../src/api';
import { eventoDeErro, SITUACAO, TEXTOS_ERRO, textoDoErro } from '../src/textos';

const CODIGOS: CodigoErro[] = [
  'entrada_invalida', 'url_invalida', 'texto_invalido', 'loja_bloqueou', 'produto_nao_encontrado', 'cota_esgotada',
  'missao_em_andamento', 'sem_credito', 'api_fora', 'tempo_esgotado', 'conexao_perdida',
];

describe('TEXTOS_ERRO', () => {
  it('tem título e sugestão para todos os códigos', () => {
    expect(Object.keys(TEXTOS_ERRO).sort()).toEqual([...CODIGOS].sort());
    for (const c of CODIGOS) {
      expect(TEXTOS_ERRO[c].titulo.length).toBeGreaterThan(0);
      expect(TEXTOS_ERRO[c].sugestao.length).toBeGreaterThan(0);
    }
  });

  it('os textos combinados', () => {
    expect(TEXTOS_ERRO.cota_esgotada).toEqual({ titulo: 'A cota de hoje acabou', sugestao: 'Veja uma missão gravada.' });
    expect(TEXTOS_ERRO.sem_credito.titulo).toBe('Sem combustível hoje');
    expect(TEXTOS_ERRO.conexao_perdida.titulo).toBe('A conexão com a nave caiu');
  });

  it('código desconhecido cai no texto de api_fora', () => {
    expect(textoDoErro('codigo_novo_do_servidor')).toBe(TEXTOS_ERRO.api_fora);
    expect(textoDoErro('toString')).toBe(TEXTOS_ERRO.api_fora);
    expect(textoDoErro('cota_esgotada')).toBe(TEXTOS_ERRO.cota_esgotada);
  });
});

describe('eventoDeErro', () => {
  it('ErroApi vira evento erro local (seq −1), com a mensagem da Capitã e a sugestão de TEXTOS_ERRO', () => {
    const e = eventoDeErro(new ErroApi('cota_esgotada', 'A cota de missões ao vivo acabou.'), 1234);
    expect(e).toEqual({
      seq: -1, t: 1234, tipo: 'erro', codigo: 'cota_esgotada', recuperavel: true,
      mensagem: 'Capitã: A cota de hoje acabou.', sugestao: 'Veja uma missão gravada.',
    });
  });

  it('conexão perdida', () => {
    const e = eventoDeErro(new ErroApi('conexao_perdida', 'A conexão caiu no meio da missão.'), 0);
    expect(e.codigo).toBe('conexao_perdida');
    expect(e.mensagem).toBe('Capitã: A conexão com a nave caiu.');
  });

  it('erro que não é ErroApi (bug) vira api_fora, sem o texto cru do navegador', () => {
    const e = eventoDeErro(new TypeError('Failed to fetch'), 5);
    expect(e.codigo).toBe('api_fora');
    expect(e.mensagem).toBe(`Capitã: ${TEXTOS_ERRO.api_fora.titulo}.`);
    expect(e.sugestao).toBe(TEXTOS_ERRO.api_fora.sugestao);
    expect(JSON.stringify(e)).not.toContain('Failed to fetch');
  });

  it('ErroApi com código que o front não conhece também vira api_fora', () => {
    const e = eventoDeErro(new ErroApi('xyz' as CodigoErro, 'algo'), 0);
    expect(e.codigo).toBe('api_fora');
  });
});

describe('SITUACAO', () => {
  it('ícones e textos para leitor de tela', () => {
    expect(SITUACAO.ok).toMatchObject({ icone: '✓', texto: 'ok' });
    expect(SITUACAO.parcial).toMatchObject({ icone: '◐', texto: 'parcial' });
    expect(SITUACAO.ausente).toMatchObject({ icone: '✗', texto: 'ausente' });
    expect(SITUACAO.a_confirmar).toMatchObject({ icone: '?', texto: 'a confirmar' });
    expect(SITUACAO.nao_se_aplica).toMatchObject({ icone: '—', texto: 'não se aplica' });
    expect(SITUACAO.nao_verificavel).toMatchObject({ icone: '—', texto: 'não verificável' });
    expect(SITUACAO.nao_se_aplica.dica).toBeTruthy();
    expect(SITUACAO.nao_verificavel.dica).toBeTruthy();
  });
});
