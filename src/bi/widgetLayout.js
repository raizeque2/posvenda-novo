// `rowStep` é a altura de uma linha do grid somada ao espaço entre linhas.
// Sem ele a conta assumia 38 px fixos e, quando a grade usava outra altura de
// linha, o bloco reservava linhas demais — o espaço que sobrava aparecia como
// um vão gigante embaixo do widget.
export function gridSpan(item, columns, rowStep = 38, gap = 18) {
  const height = Number(item.height) || 340;
  return {
    w: Math.min(
      columns,
      Math.max(1, Math.round(((Number(item.width) || 6) / 12) * columns)),
    ),
    h: Math.max(1, Math.ceil((height + gap) / Math.max(1, rowStep))),
  };
}
export function packWidgets(items, columns, rowStep = 38, gap = 18) {
  const occupied = new Set(),
    placements = [];
  for (const item of items) {
    const { w, h } = gridSpan(item, columns, rowStep, gap);
    let col = 0,
      row = 0;
    while (true) {
      let free = col + w <= columns;
      for (let y = row; free && y < row + h; y++)
        for (let x = col; free && x < col + w; x++)
          if (occupied.has(`${x}:${y}`)) free = false;
      if (free) break;
      if (++col >= columns) {
        col = 0;
        row++;
      }
    }
    for (let y = row; y < row + h; y++)
      for (let x = col; x < col + w; x++) occupied.add(`${x}:${y}`);
    placements.push({ id: item.id, col, row, w, h });
  }
  return placements;
}
// Tamanhos permitidos. Largura em doze avos da linha: ⅓, ½, ⅔ e inteiro. Menos de ⅓
// espremia o widget até o título quebrar letra por letra. Altura em três degraus.
export const LARGURAS = [4, 6, 8, 12];
export const ALTURAS = [
  { id: "baixa", rotulo: "Baixa", px: 300 },
  { id: "media", rotulo: "Média", px: 400 },
  { id: "alta", rotulo: "Alta", px: 560 },
];
const maisPerto = (lista, v) => lista.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
export const ajustarLargura = (w) => maisPerto(LARGURAS, Number(w) || 6);
export const ajustarAltura = (h) => maisPerto(ALTURAS.map((a) => a.px), Number(h) || 400);
// Setas do teclado: um degrau por vez.
export function passoTamanho(item, tecla) {
  const w = LARGURAS.indexOf(ajustarLargura(item.width));
  const alturas = ALTURAS.map((a) => a.px), h = alturas.indexOf(ajustarAltura(item.height));
  const lim = (i, n) => Math.max(0, Math.min(n - 1, i));
  return {
    width: LARGURAS[lim(w + (tecla === "ArrowRight" ? 1 : tecla === "ArrowLeft" ? -1 : 0), LARGURAS.length)],
    height: alturas[lim(h + (tecla === "ArrowDown" ? 1 : tecla === "ArrowUp" ? -1 : 0), alturas.length)],
  };
}
export function resizedWidget(width, height, dx, dy, unit, columns) {
  return {
    width: ajustarLargura((((width + dx + 18) / (unit + 18)) * 12) / columns),
    height: ajustarAltura(height + dy),
  };
}
