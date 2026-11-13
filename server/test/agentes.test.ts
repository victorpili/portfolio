import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ATRIBUTOS, type Revisao } from '@nave/shared';
import { carregarPrompts, fichaParaPrompt, pesquisar, redigir, revisar, type Prompts } from '../src/agentes';
import { itensDaFicha } from '../src/imediato';
import { motorFalso } from '../src/motores/falso';
import { originalCaneca, pesquisaBoa, fichaNovaCaneca } from './fixtures/respostas';

const prompts: Prompts = { pesquisador: 'P', redator: 'R', revisor: 'V' };
const revisaoQualquer: Revisao = { vereditos: [{ item: 'titulo', veredito: 'sustentado', evidencia: 'Caneca Barro 350 ml', comentario: 'ok' }] };

const entre = (texto: string, tag: string): string => {
  const m = texto.match(new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`));
  if (!m) throw new Error(`sem <${tag}>`);
  return m[1];
};

describe('fichaParaPrompt', () => {
  it('leva só os campos combinados, com a descrição em texto', () => {
    const t = fichaParaPrompt(originalCaneca);
    expect(t.startsWith('<ficha_original>')).toBe(true);
    expect(t.endsWith('</ficha_original>')).toBe(true);
    const dados = JSON.parse(entre(t, 'ficha_original'));
    expect(Object.keys(dados)).toEqual(['titulo', 'marca', 'tipo', 'tags', 'opcoes', 'variantes', 'descricao']);
    expect(dados.descricao).toBe(originalCaneca.descricaoTexto);
    expect(dados.variantes[0]).toEqual({ titulo: 'Azul', sku: 'CB-350-AZ', preco: '89.90' });
  });
});

describe('agentes', () => {
  it('pesquisar monta a chamada a partir do prompt e da ficha', async () => {
    const m = motorFalso({ pesquisador: [pesquisaBoa] });
    await pesquisar(m, { pesquisador: 'P', redator: 'R', revisor: 'V' }, originalCaneca);
    expect(m.chamadas[0].sistema).toBe('P');
    expect(m.chamadas[0].mensagens[0].texto).toContain('<ficha_original>');
    expect(m.chamadas[0].mensagens[0].texto).toContain('Caneca Barro 350 ml');
  });

  it('pesquisar devolve a resposta do motor e marca o agente', async () => {
    const m = motorFalso({ pesquisador: [pesquisaBoa] });
    const r = await pesquisar(m, prompts, originalCaneca);
    expect(r.dados).toEqual(pesquisaBoa);
    expect(m.chamadas[0]).toMatchObject({ agente: 'pesquisador' });
    expect(m.chamadas[0].mensagens).toHaveLength(1);
    expect(m.chamadas[0].mensagens[0].papel).toBe('usuario');
  });

  it('devolução vira 3 mensagens com os problemas', async () => {
    const m = motorFalso({ pesquisador: [pesquisaBoa] });
    const problemas = [{ item: 'atributo:material', motivo: 'trecho "aço inox" não está no original' }];
    await pesquisar(m, prompts, originalCaneca, { anterior: pesquisaBoa, problemas });
    const msgs = m.chamadas[0].mensagens;
    expect(msgs.map((x) => x.papel)).toEqual(['usuario', 'assistente', 'usuario']);
    expect(msgs[0].texto).toContain('<ficha_original>');
    expect(msgs[1].texto).toBe(JSON.stringify(pesquisaBoa));
    expect(msgs[2].texto).toContain('O Imediato devolveu');
    expect(msgs[2].texto).toContain('trecho "aço inox" não está no original');
    expect(msgs[2].texto).toBe(
      'O Imediato devolveu sua entrega:\n- atributo:material: trecho "aço inox" não está no original\n'
      + 'Corrija só esses pontos e devolva a resposta completa no mesmo formato.',
    );
  });

  it('devolução sem resposta anterior vira 2 mensagens, uma linha por problema', async () => {
    const m = motorFalso({ redator: [fichaNovaCaneca] });
    const problemas = [{ item: 'resposta', motivo: 'resposta fora do formato' }, { item: 's2', motivo: 'Revisor: sem_fonte — x' }];
    await redigir(m, prompts, originalCaneca, pesquisaBoa, { anterior: null, problemas });
    const msgs = m.chamadas[0].mensagens;
    expect(msgs.map((x) => x.papel)).toEqual(['usuario', 'usuario']);
    expect(msgs[1].texto).toContain('- resposta: resposta fora do formato\n- s2: Revisor: sem_fonte — x\n');
  });

  it('redigir leva a ficha e a pesquisa', async () => {
    const m = motorFalso({ redator: [fichaNovaCaneca] });
    const r = await redigir(m, prompts, originalCaneca, pesquisaBoa);
    expect(r.dados).toEqual(fichaNovaCaneca);
    const c = m.chamadas[0];
    expect(c).toMatchObject({ agente: 'redator', sistema: 'R' });
    expect(c.mensagens[0].texto).toContain(fichaParaPrompt(originalCaneca));
    expect(JSON.parse(entre(c.mensagens[0].texto, 'pesquisa'))).toEqual(pesquisaBoa);
  });

  it('revisar leva a ficha, a pesquisa, a ficha nova e os itens para revisar', async () => {
    const m = motorFalso({ revisor: [revisaoQualquer] });
    const r = await revisar(m, prompts, originalCaneca, pesquisaBoa, fichaNovaCaneca);
    expect(r.dados).toEqual(revisaoQualquer);
    const c = m.chamadas[0];
    expect(c).toMatchObject({ agente: 'revisor', sistema: 'V' });
    expect(c.mensagens).toHaveLength(1);
    const texto = c.mensagens[0].texto;
    expect(texto).toContain(fichaParaPrompt(originalCaneca));
    expect(JSON.parse(entre(texto, 'pesquisa'))).toEqual(pesquisaBoa);
    expect(JSON.parse(entre(texto, 'ficha_nova'))).toEqual(fichaNovaCaneca);
    expect(entre(texto, 'itens_para_revisar').split('\n')).toEqual(itensDaFicha(fichaNovaCaneca));
  });
});

describe('carregarPrompts', () => {
  it('lê os três prompts da raiz do repositório', () => {
    const p = carregarPrompts();
    for (const nome of ['pesquisador', 'redator', 'revisor'] as const) {
      expect(p[nome].length).toBeGreaterThan(500);
      expect(p[nome]).toContain('<ficha_original>');
    }
    for (const a of ATRIBUTOS) {
      expect(p.pesquisador).toContain(`\`${a.id}\``);
      expect(p.pesquisador).toContain(a.rotulo);
    }
    expect(p.redator).toContain('<pesquisa>');
    expect(p.revisor).toContain('<ficha_nova>');
    expect(p.revisor).toContain('<itens_para_revisar>');
  });

  it('lê de outra pasta', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prompts-'));
    for (const nome of ['pesquisador', 'redator', 'revisor']) await writeFile(join(dir, `${nome}.md`), `prompt ${nome}`);
    expect(carregarPrompts(dir)).toEqual({ pesquisador: 'prompt pesquisador', redator: 'prompt redator', revisor: 'prompt revisor' });
  });
});
