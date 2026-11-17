# Créditos dos sprites

Todos os PNGs desta pasta foram desenhados para este projeto, em código, pelo gerador em
[`web/scripts/arte16`](../../scripts/arte16). Não há arte de terceiros.

- **Estilo:** pixel art de 16 bits, em tiles de 16×16 px. Os móveis altos (estantes, quadros, armários e arquivos) têm 16×32 px. A vista é 3/4: os móveis mostram o tampo e a frente e projetam sombra no chão.
- **Paleta:** rampas próprias em [`paleta.mjs`](../../scripts/arte16/paleta.mjs), com a sombra puxando para o azul e a luz para o amarelo.
- **Como é feito:**
  - os personagens e os objetos de forma livre são mapas de caracteres, em que cada letra é uma cor;
  - os móveis em caixa, os pisos e as paredes são desenhados por procedimento;
  - o contorno escuro e a sombra no chão são calculados pelo gerador;
  - o PNG é gravado com o `zlib` do Node, sem dependências.
- **Para gerar de novo:** `pnpm --filter @nave/web arte`. Para conferir sem gravar, use `node scripts/arte16/gerar.mjs --conferir`, o mesmo que o teste roda.

| Arquivo do gerador | O que desenha |
|---|---|
| `tripulacao.mjs` | A Capitã e o Imediato (robôs, porque são código), o Pesquisador, a Redatora e o Revisor |
| `moveis.mjs` | Cama, mesa de trabalho e computador |
| `pisos.mjs` | Pisos de cada sala, corredor e paredes |
| `enfeites-trabalho.mjs` | Laboratório, oficina e sala de inspeção |
| `enfeites-casa.mjs` | Dormitório e Ponte |
| `nave.mjs` | Chapas do casco e motores (2 quadros da chama) |
