import { key } from "./model.js";
import { geometryCenter } from "./mapGeometry.js";

export function territoryGroups(rows, level) {
  const grouped = new Map();
  for (const row of rows) {
    const name = String(row[level] || "").trim();
    if (!name) continue;
    const city = level === "neighborhood" ? row.city : "",
      uf = row.uf || "";
    const id = `${key(name)}:${key(city)}:${uf}`;
    const item = grouped.get(id) || {
      id,
      name,
      city,
      uf,
      value: 0,
      records: 0,
      parts: 0,
      services: 0,
    };
    item.value += row.value;
    item.records++;
    item[row.channel === "SERVIÇOS" ? "services" : "parts"] += row.value;
    grouped.set(id, item);
  }
  return [...grouped.values()].sort((a, b) => b.value - a.value);
}
export function matchMunicipality(row, index) {
  let lookup=municipalityIndexes.get(index)
  if(!lookup){lookup=new Map();for(const item of index){const name=key(item[0]),found=lookup.get(name)||[];found.push(item);lookup.set(name,found)}municipalityIndexes.set(index,lookup)}
  const matches=(lookup.get(key(row.city))||[]).filter(([,uf])=>!row.uf||uf===row.uf)
  return matches.length === 1 ? matches[0] : null;
}
const municipalityIndexes=new WeakMap()

let indexPromise, centersPromise;
async function localJSON(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw Error(
      "Não foi possível carregar a base geográfica. Tente novamente.",
    );
  return response.json();
}
// Nomes e UF de cada município (mesma base e mesma comparação de antes).
export async function loadMunicipalityIndex() {
  if (!indexPromise)
    indexPromise = localJSON("/maps/municipios-index.json").catch((error) => {
      indexPromise = null;
      throw error;
    });
  return indexPromise;
}
// Só o centro de cada município — ~140 KB no lugar das malhas estaduais
// completas (3 MB com o Brasil inteiro). É o que permite desenhar pontos de
// calor em vez de um polígono por cidade.
export async function loadCityCenters() {
  if (!centersPromise)
    centersPromise = localJSON("/maps/municipios-centros.json")
      .then((rows) => new Map(rows.map(([id, lon, lat]) => [id, [lon, lat]])))
      .catch((error) => {
        centersPromise = null;
        throw error;
      });
  return centersPromise;
}

// Contorno do país (já simplificado) que serve de fundo do mapa: poucos
// milhares de pontos, no lugar dos 3 MB de malha municipal.
let outlinePromise;
export async function loadBrazilOutline() {
  if (!outlinePromise)
    outlinePromise = localJSON("/maps/brasil-silhueta.json")
      .then((data) => data.rings)
      .catch((error) => {
        outlinePromise = null;
        throw error;
      });
  return outlinePromise;
}

function blankTotal() {
  return { parts: 0, services: 0, value: 0, records: 0 };
}
function addRow(total, row) {
  const channel = row.source === "services" || row.channel === "SERVIÇOS" ? "services" : "parts";
  total[channel] += row.value;
  total.value += row.value;
  total.records += row.recordCount ?? 1;
}

/**
 * Agrega os registros compactados em pontos de calor com o código IBGE de
 * cada município. Devolve um ponto por cidade — nunca um polígono.
 */
export function aggregateCityPoints(rows, index, centers) {
  const meta = new Map();
  for (const [name, uf, id] of index) meta.set(id, [name, uf]);
  const matched = new Map();
  const totals = new Map();
  for (const row of rows) {
    // Uma leitura por registro: o resto da conta usa os valores já lidos, então
    // o custo não cresce com o tamanho da malha municipal.
    const city = row.city;
    if (!city) continue;
    const uf = row.uf || "";
    const cityKey = `${key(city)}:${uf}`;
    if (!matched.has(cityKey))
      matched.set(cityKey, matchMunicipality({ city, uf }, index)?.[2] ?? null);
    const id = matched.get(cityKey);
    if (id == null || !centers.has(id)) continue;
    const total = totals.get(id) || blankTotal();
    addRow(total, row);
    totals.set(id, total);
  }
  const points = [];
  for (const [id, total] of totals) {
    const [name, uf] = meta.get(id) || ["", ""];
    const [lon, lat] = centers.get(id);
    points.push({
      id,
      name,
      uf,
      lon,
      lat,
      ...total,
      filter: {
        level: "city",
        name,
        uf,
        allowUnknownUF: matched.get(`${key(name)}:`) === id,
      },
      potential: null,
      properties: { name, uf, id },
    });
  }
  return points;
}

/**
 * Mesma ideia para o mapa importado pelo usuário: agrega por região e usa o
 * centro da geometria de cada região como ponto.
 */
export function aggregateCustomPoints(rows, features) {
  const totals = new Map();
  for (const row of rows) {
    const id = key(row.region);
    if (!id) continue;
    const total = totals.get(id) || blankTotal();
    addRow(total, row);
    totals.set(id, total);
  }
  return features.map((feature) => {
    const properties = feature.properties;
    const [lon, lat] = geometryCenter(feature.geometry);
    const potentialParts = properties.potentialParts;
    const potentialServices = properties.potentialServices;
    return {
      id: key(properties.name),
      name: properties.name,
      uf: properties.uf || "",
      lon,
      lat,
      ...(totals.get(key(properties.name)) || blankTotal()),
      filter: properties.name,
      potential:
        Number.isFinite(potentialParts) && Number.isFinite(potentialServices)
          ? potentialParts + potentialServices
          : null,
      properties,
    };
  });
}
