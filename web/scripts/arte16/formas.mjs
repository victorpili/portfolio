// Formas que se repetem nos móveis, em vista 3/4: o tampo aparece de cima e a frente, de frente.

/**
 * Caixa em 3/4: tampo de `topo` linhas (a primeira mais clara, a última é a quina iluminada) e frente de `frente`
 * linhas (escurece embaixo e à direita). `c` = { luz, topo, quina, frente, sombra }.
 */
export function caixa(t, x, y, l, topo, frente, c) {
  t.ret(x, y, l, topo, c.topo).h(x, y, l, c.luz);
  if (topo > 1) t.h(x, y + topo - 1, l, c.quina);
  t.ret(x, y + topo, l, frente, c.frente);
  t.v(x + l - 1, y + topo, frente, c.sombra).h(x, y + topo + frente - 1, l, c.sombra);
  return t;
}

/** Cores de caixa a partir de uma rampa: o tampo em cima, a frente dois tons abaixo. */
export function coresDe(r, n = r.length - 2) {
  return { luz: r[n + 1], topo: r[n], quina: r[n + 1], frente: r[n - 2], sombra: r[n - 3] };
}

/** Pés de móvel: duas colunas curtas. */
export function pes(t, x1, x2, y, a, cor) {
  return t.v(x1, y, a, cor).v(x2, y, a, cor);
}

/** Preenche um disco: `cor(dx, dy, d)` diz a cor de cada pixel (dx, dy em relação ao centro; d = distância). */
export function disco(t, cx, cy, r, cor) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d <= r) t.p(x, y, cor(dx, dy, d));
    }
  }
  return t;
}

/** Tom de uma rampa conforme a luz (de cima e da esquerda): -1 = no escuro, 1 = na luz. */
export function tom(rampa, luz) {
  const i = Math.round(((luz + 1) / 2) * (rampa.length - 1));
  return rampa[Math.max(0, Math.min(rampa.length - 1, i))];
}

/** Quadro sobre cavalete, para móveis de 16×32: pernas, pés e a moldura; o miolo fica para quem chama. */
export function cavalete(t, moldura, pe) {
  t.v(3, 19, 11, pe[0]).v(12, 19, 11, pe[1]);
  t.h(1, 29, 5, pe[1]).h(10, 29, 5, pe[1]).h(1, 30, 5, pe[0]).h(10, 30, 5, pe[0]);
  caixa(t, 1, 5, 14, 1, 15, { luz: moldura[2], topo: moldura[1], quina: moldura[1], frente: moldura[1], sombra: moldura[0] });
  t.v(1, 6, 14, moldura[2]);
  return t;
}
