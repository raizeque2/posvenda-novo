import { LOJAS } from "../data/regras.js";
import {isRevenueRecord,isVirtualAccount,mainChannel,matchesChannel} from './revenue.js'
export const number = (v) =>
  typeof v === "number"
    ? Number.isFinite(v)
      ? v
      : 0
    : Number(
        String(v ?? "")
          .replace(/\./g, "")
          .replace(",", "."),
      ) || 0;
export const key = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g,' ')
    .toUpperCase();
export function normalize(rows, service = false) {
  return rows.filter(r=>isRevenueRecord(r,service)).map((r) => {
    const dt = r.dt instanceof Date ? r.dt : new Date(r.dt);
    const demo =
      import.meta.env?.MODE === "preview" &&
      String(r.nrReq || r.osId || "").startsWith("DEMO-");
    const city =
      r.cidade ||
      r.Cidade ||
      r["Município"] ||
      r.Municipio ||
      (demo ? (r.empresa === "ARA" ? "Arapiraca" : "Recife") : "");
    const neighborhood =
      r.bairro ||
      r.Bairro ||
      r["Bairro Cliente"] ||
      (demo ? (r.empresa === "ARA" ? "Centro" : "Boa Viagem") : "");
    const region = r.regiao || r.Região || city || "";
    const person=r.responsavel || r.consultor || r.tecnico || "Sem responsável"
    return {
      person,
      teamEligible:!isVirtualAccount(person),
      store: r.empresa || "Sem loja",
      // Nº da requisição/O.S.: conta vendas (documentos), não linhas de item.
      doc: String(r.nrReq || r.osId || ""),
      source: service ? "services" : "pieces",
      channel: service ? "SERVIÇOS" : r.cat || "Sem canal",
      category:r.cat||'',
      product:
        r.produto ||
        r["Descrição Produto"] ||
        r.Mercadoria ||
        r['Descrição Mercadoria'] ||
        r["Descrição"] ||
        r["Produto"] ||
        r["Código Produto"] ||
        r['Código Mercadoria'] ||
        "",
      region,
      city,
      neighborhood,
      uf: String(
        r.uf || r.UF || r.Estado || LOJAS[r.empresa]?.uf || "",
      ).toUpperCase(),
      date: !Number.isNaN(+dt)
        ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
        : "Sem data",
      value: service
        ? number(r.mo)
        : r.eDevolucao
          ? -Math.abs(number(r.valor))
          : number(r.valor),
      quantity: service
        ? null
        : r.quantidade != null || r["Quantidade"] != null
          ? (r.eDevolucao ? -1 : 1) *
            Math.abs(number(r.quantidade ?? r["Quantidade"]))
          : null,
    };
  });
}
export function aggregate(rows, w, region = "") {
  const grouped = new Map();
  for(const r of rows){
      if((w.source&&r.source!==w.source)||(w.store&&r.store!==w.store)||!matchesChannel(r,w.channel)||!matchesTerritory(r,region)||(w.dimension==='person'&&r.teamEligible===false&&!w.includeAccounts))continue
      const name = w.dimension==='channel'&&!w.subchannels?mainChannel(r):r[w.dimension];
      if (!name || (w.metric === "quantity" && r.quantity == null)) continue;
      const groupKey = ['person','product'].includes(w.dimension) ? key(name) : name;
      const g = grouped.get(groupKey) || { name, value: 0, records: 0 };
      g.value +=
        w.metric === "records"
          ? 1
          : w.metric === "quantity"
            ? r.quantity
            : r.value;
      g.records++;
      grouped.set(groupKey, g);
    }
  return [...grouped.values()]
    .sort(
      w.dimension === "date"
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => (w.sort === "asc" ? a.value - b.value : b.value - a.value),
    )
    .slice(0, w.limit || 20);
}
export function matchesTerritory(row, filter) {
  if (!filter) return true;
  if (typeof filter === "string") return key(row.region) === key(filter);
  return (
    key(row[filter.level]) === key(filter.name) &&
    (!filter.uf ||
      row.uf === filter.uf ||
      (!row.uf && filter.allowUnknownUF === true)) &&
    (!filter.city || key(row.city) === key(filter.city))
  );
}
export const widget = (id, title, dimension, type = "bar", extra = {}) => ({
  id,
  title,
  dimension,
  type,
  metric: "value",
  channel: "",
  width: 6,
  height: 340,
  color: "#cc0000",
  limit: 20,
  ...extra,
});
export const initial = () => ({
  schema: 1,
  defaultId: "overview",
  activeId: "overview",
  profiles: [
    {
      id: "overview",
      name: "Visão geral",
      desktop: [
        widget("trend", "Evolução das vendas", "date", "colunas", {
          width: 8,
          height: 400,
          limit: 366,
        }),
        widget("sales", "Participação por canal", "channel", "donut", {
          width: 4,
          height: 400,
        }),
        widget("team", "Desempenho da equipe", "person", "table", {
          width: 4,
          height: 400,
        }),
        widget("parts", "Peças mais vendidas", "product", "bar", {
          source:'pieces',metric:'quantity',
          width: 8,
          height: 400,
          limit: 7,
        }),
      ],
      mobile: null,
      defaultWidgetsVersion: 6,
    },
  ],
});
// Versão 5 (13/11/2026, visual mais limpo): Evolução (área, 2/3) + Participação (1/3) na mesma
// linha; Desempenho da equipe (lista, 1/3) + Peças mais vendidas (2/3) logo abaixo.
// Só mexe nos blocos padrão que existem; os criados pela pessoa ficam onde estavam.
const PADRAO_V5 = { trend: { width: 8, height: 400 }, sales: { width: 4, height: 400 }, team: { width: 4, height: 400 }, parts: { width: 8, height: 400 } }
export function limparLayoutV5(list){
 if(!list)return list
 const ids=Object.keys(PADRAO_V5)
 const atualizados=list.map(w=>PADRAO_V5[w.id]?{...w,...PADRAO_V5[w.id],...(w.id==='trend'&&w.type==='line'?{type:'area'}:{})}:w)
 const ordem=ids.map(id=>atualizados.find(w=>w.id===id)).filter(Boolean)
 if(ordem.length<ids.length)return atualizados
 const resto=atualizados.filter(w=>!ids.includes(w.id))
 const pos=Math.min(...ids.map(id=>list.findIndex(w=>w.id===id)))
 return [...resto.slice(0,pos),...ordem,...resto.slice(pos)]
}export function upgradeBiProfiles(state){
 if(!state?.profiles)return initial()
 return {...state,profiles:state.profiles.map(profile=>{
  if(profile.defaultWidgetsVersion>=6)return profile
  let p=profile
  if(!(p.defaultWidgetsVersion>=3)){
   const upgrade=widgets=>widgets?.map(w=>w.id==='parts'&&w.title==='Peças mais vendidas'&&w.metric==='value'&&!w.source?{...w,metric:'quantity',source:'pieces'}:w)
   const largo=list=>list?.map(w=>w.id==="team"?{...w,width:12,height:520}:w.id==="parts"?{...w,width:12}:w)
   p={...p,desktop:largo(upgrade(p.desktop)),mobile:largo(upgrade(p.mobile))}
  }
  if(!(p.defaultWidgetsVersion>=5))p={...p,desktop:limparLayoutV5(p.desktop)}
  // Versão 6 (16/11/2026): Evolução das vendas em colunas (área ou linha do padrão viram colunas).
  const colunas=list=>list?.map(w=>w.id==='trend'&&(w.type==='area'||w.type==='line')?{...w,type:'colunas'}:w)
  return {...p,defaultWidgetsVersion:6,desktop:colunas(p.desktop),mobile:colunas(p.mobile)}
 })}
}
export function reorder(items, from, to) {
  const result = [...items];
  const a = result.findIndex((w) => w.id === from),
    b = result.findIndex((w) => w.id === to);
  if (a < 0 || b < 0) return result;
  result.splice(b, 0, result.splice(a, 1)[0]);
  return result;
}
export function validateGeo(json) {
  if (
    json?.type !== "FeatureCollection" ||
    !Array.isArray(json.features) ||
    !json.features.length ||
    json.features.length > 1000
  )
    throw Error("Use um GeoJSON FeatureCollection com 1 a 1.000 regiões.");
  const names = new Set();
  for (const f of json.features) {
    if (
      typeof f?.properties?.name !== "string" ||
      !f.properties.name.trim() ||
      !["Polygon", "MultiPolygon"].includes(f.geometry?.type)
    )
      throw Error(
        "Cada região precisa de properties.name e geometria Polygon ou MultiPolygon.",
      );
    if (names.has(key(f.properties.name)))
      throw Error("Cada região precisa de um nome único.");
    names.add(key(f.properties.name));
    const polygons =
      f.geometry.type === "Polygon"
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;
    if (
      !Array.isArray(polygons) ||
      !polygons.length ||
      polygons.some(
        (poly) =>
          !Array.isArray(poly) ||
          !poly.length ||
          poly.some(
            (ring) =>
              !Array.isArray(ring) ||
              ring.length < 4 ||
              JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1]),
          ),
      )
    )
      throw Error(
        "Cada polígono precisa de anéis fechados com pelo menos quatro coordenadas.",
      );
    const points = f.geometry.coordinates.flat(
      f.geometry.type === "Polygon" ? 1 : 2,
    );
    if (
      !points.length ||
      points.some(
        (p) =>
          !Array.isArray(p) ||
          !Number.isFinite(p[0]) ||
          !Number.isFinite(p[1]) ||
          Math.abs(p[0]) > 180 ||
          Math.abs(p[1]) > 90,
      )
    )
      throw Error("Coordenadas geográficas inválidas.");
    for (const k of ["population", "potentialParts", "potentialServices"])
      if (
        f.properties[k] != null &&
        (!Number.isFinite(f.properties[k]) || f.properties[k] < 0)
      )
        throw Error("População e potenciais devem ser números positivos.");
  }
  return json;
}

// Target comparison uses the official targets supplied for the current period.
// Store-specific cuts cannot reuse targets without an official store allocation.
export function analyze(rows, w, targets = [], region = "") {
  const compare =
    w.dimension === "person" &&
    w.metric === "value" &&
    !region &&
    !w.store &&
    !w.source;
  const targetMap = new Map();
  if (compare)
    for (const t of targets) {
      if (!matchesChannel(t,w.channel)||isVirtualAccount(t.name)) continue;
      const id = key(t.name),
        current = targetMap.get(id) || { name: t.name, meta: 0 };
      current.meta += number(t.meta);
      targetMap.set(id, current);
    }
  const data = aggregate(
    rows,
    { ...w, limit: compare ? 100000 : w.limit },
    region,
  ).map((r) => ({ ...r, meta: targetMap.get(key(r.name))?.meta || 0 }));
  if (compare)
    for (const t of targetMap.values())
      if (t.meta > 0 && !data.some((r) => key(r.name) === key(t.name)))
        data.push({ ...t, value: 0, records: 0 });
  if (w.sort === "achievement")
    data.sort(
      (a, b) =>
        (b.meta > 0 ? b.value / b.meta : -1) -
        (a.meta > 0 ? a.value / a.meta : -1),
    );
  else if (w.sort === "remaining")
    data.sort(
      (a, b) =>
        (a.meta > 0 ? Math.max(0, a.meta - a.value) : Infinity) -
        (b.meta > 0 ? Math.max(0, b.meta - b.value) : Infinity),
    );
  else if (compare)
    data.sort((a, b) =>
      w.sort === "asc" ? a.value - b.value : b.value - a.value,
    );
  return data.slice(0, w.limit || 20);
}
