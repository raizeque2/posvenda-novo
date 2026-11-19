/**
 * Gera `public/maps/brasil-silhueta.json` — o contorno do Brasil usado como
 * fundo do mapa de calor.
 *
 * Por que existe: a malha municipal (3 MB, milhares de polígonos) é pesada
 * demais para servir de fundo. Este script lê as mesmas malhas do IBGE que já
 * estão em `public/maps`, rasteriza tudo numa grade, extrai só a borda do
 * país e simplifica o resultado. O arquivo final tem alguns milhares de pontos
 * — o mapa abre sem esperar pela malha.
 *
 * Uso: node scripts/build-brasil-outline.mjs
 * Saída: { "bounds": [w,s,e,n], "rings": [[[lon,lat], ...], ...] }
 */

import { readFile, writeFile } from "node:fs/promises";

const STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS",
  "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC",
  "SE", "SP", "TO",
];

// Resolução da grade: 0,04° ≈ 4,5 km. Menor que 1 pixel na escala do mapa
// (640 px para ~40°), então a escada da grade desaparece no desenho.
const STEP = 0.04;
const WEST = -74.5;
const NORTH = 6.5;
const WIDTH = Math.round((-33.5 - WEST) / STEP);
const HEIGHT = Math.round((NORTH - -34.5) / STEP);
const TOLERANCE = 0.03;
const MIN_AREA = 0.02;

const lonOf = (x) => WEST + x * STEP;
const latOf = (y) => NORTH - y * STEP;

function ringsOf(geometry) {
  if (!geometry) return [];
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  return polygons.flat();
}

const mask = new Uint8Array(WIDTH * HEIGHT);

/** Preenche um anel na grade, alternando as células (even-odd por município). */
function fillRing(ring) {
  let minLat = Infinity,
    maxLat = -Infinity;
  for (const [, lat] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const first = Math.max(0, Math.floor((NORTH - maxLat) / STEP));
  const last = Math.min(HEIGHT - 1, Math.ceil((NORTH - minLat) / STEP));
  const xs = [];
  for (let y = first; y <= last; y++) {
    const lat = latOf(y + 0.5);
    xs.length = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      if (y1 > lat === y2 > lat) continue;
      xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.max(0, Math.ceil((xs[i] - WEST) / STEP - 0.5));
      const to = Math.min(WIDTH - 1, Math.floor((xs[i + 1] - WEST) / STEP - 0.5));
      for (let x = from; x <= to; x++) mask[y * WIDTH + x] ^= 1;
    }
  }
}

for (const uf of STATES) {
  const raw = await readFile(
    new URL(`../public/maps/${uf}.json`, import.meta.url),
    "utf8",
  );
  const collection = JSON.parse(raw);
  for (const feature of collection.features) {
    for (const ring of ringsOf(feature.geometry)) fillRing(ring);
  }
}

/** Liga as bordas das células cheias em contornos fechados. */
function outline() {
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const key = `${x1},${y1}`;
    const list = edges.get(key);
    if (list) list.push([x2, y2]);
    else edges.set(key, [[x2, y2]]);
  };
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!mask[y * WIDTH + x]) continue;
      const filled = (dx, dy) =>
        x + dx >= 0 && y + dy >= 0 && x + dx < WIDTH && y + dy < HEIGHT
          ? mask[(y + dy) * WIDTH + x + dx]
          : 0;
      if (!filled(0, -1)) add(x, y, x + 1, y);
      if (!filled(1, 0)) add(x + 1, y, x + 1, y + 1);
      if (!filled(0, 1)) add(x + 1, y + 1, x, y + 1);
      if (!filled(-1, 0)) add(x, y + 1, x, y);
    }
  }
  const loops = [];
  for (const [key, list] of edges) {
    while (list.length) {
      const start = key.split(",").map(Number);
      const loop = [start];
      let [x, y] = list.pop();
      let guard = 0;
      while ((x !== start[0] || y !== start[1]) && guard++ < 1e6) {
        loop.push([x, y]);
        const next = edges.get(`${x},${y}`);
        if (!next || !next.length) break;
        [x, y] = next.pop();
      }
      if (loop.length > 8) loops.push(loop);
    }
  }
  return loops;
}

function area(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Douglas–Peucker: descarta os pontos que não mudam a forma. */
function simplify(ring, tolerance) {
  if (ring.length < 4) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  let guard = 0;
  while (stack.length) {
    if (++guard > 1e6) break;
    const [from, to] = stack.pop();
    const [x1, y1] = ring[from];
    const [x2, y2] = ring[to];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const size = Math.hypot(dx, dy) || 1;
    let farthest = -1;
    let index = -1;
    for (let i = from + 1; i < to; i++) {
      const [x, y] = ring[i];
      const distance = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / size;
      if (distance > farthest) {
        farthest = distance;
        index = i;
      }
    }
    if (farthest > tolerance) {
      keep[index] = 1;
      stack.push([from, index], [index, to]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const rings = [];
for (const loop of outline()) {
  const geographic = loop.map(([x, y]) => [
    Math.round(lonOf(x) * 1000) / 1000,
    Math.round(latOf(y) * 1000) / 1000,
  ]);
  if (area(geographic) < MIN_AREA) continue;
  const result = simplify(geographic, TOLERANCE);
  if (result.length > 3) rings.push(result);
}

rings.sort((a, b) => area(b) - area(a));
const points = rings.reduce((sum, ring) => sum + ring.length, 0);
await writeFile(
  new URL("../public/maps/brasil-silhueta.json", import.meta.url),
  JSON.stringify({ bounds: [WEST, -34.5, -33.5, NORTH], rings }),
);
console.log(`${rings.length} contornos · ${points} pontos`);
