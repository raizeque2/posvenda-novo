import * as e from "./jsx.js";
import React from "react";
import useStore from "../store.js";

const fmtMoeda = (val) => {
  if (val == null || !isFinite(val)) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
};
const fmtMoedaCents = (val) => {
  if (val == null || !isFinite(val)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
};
const fmtPct = (val) => {
  if (val == null || !isFinite(val)) return "0,0%";
  const num = typeof val === "number" ? val : parseFloat(val) || 0;
  const p = num > 1 ? num : num * 100;
  return p.toFixed(1) + "%";
};

// Dealership stores (Alagoas Motos & Pernambuco Motos) coordinates & info
const DEALERSHIP_STORES = [
  { id: "ARA", name: "Alagoas Motos - Arapiraca", city: "Arapiraca", uf: "AL", x: 0, y: 0, color: "#cc0000" },
  { id: "FAR", name: "Alagoas Motos - Farol (Maceió)", city: "Maceió", uf: "AL", x: 0, y: 0, color: "#cc0000" },
  { id: "MAN", name: "Alagoas Motos - Mangabeiras", city: "Maceió", uf: "AL", x: 0, y: 0, color: "#cc0000" },
  { id: "TAB", name: "Alagoas Motos - Tabuleiro", city: "Maceió", uf: "AL", x: 0, y: 0, color: "#cc0000" },
  { id: "CEN", name: "Alagoas Motos - Centro Maceió", city: "Maceió", uf: "AL", x: 0, y: 0, color: "#cc0000" },
  { id: "RIO", name: "Alagoas Motos - Rio Largo", city: "Rio Largo", uf: "AL", x: 0, y: 0, color: "#cc0000" },
  { id: "PAL", name: "Alagoas Motos - Palmeira dos Índios", city: "Palmeira dos Índios", uf: "AL", x: 0, y: 0, color: "#cc0000" },
  { id: "PEN", name: "Alagoas Motos - Penedo", city: "Penedo", uf: "AL", x: 0, y: 0, color: "#cc0000" },
  { id: "REC", name: "Pernambuco Motos - Recife", city: "Recife", uf: "PE", x: 0, y: 0, color: "#1d4ed8" },
  { id: "CAR", name: "Pernambuco Motos - Caruaru", city: "Caruaru", uf: "PE", x: 0, y: 0, color: "#1d4ed8" },
  { id: "GAR", name: "Pernambuco Motos - Garanhuns", city: "Garanhuns", uf: "PE", x: 0, y: 0, color: "#1d4ed8" },
  { id: "PET", name: "Pernambuco Motos - Petrolina", city: "Petrolina", uf: "PE", x: 0, y: 0, color: "#1d4ed8" }
];

const ESTADOS = { AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins" };
const MESES = () => Object.keys(useStore.getState().pecasPorMes).filter(m => useStore.getState().pecasPorMes[m]?.length).sort((a, b) => a.split("/").reverse().join("").localeCompare(b.split("/").reverse().join("")));
const Bandeira = ({ uf, tamanho = 22 }) => e.jsx("img", { className: "geo-bandeira", src: `/flags/${uf.toLowerCase()}.png`, alt: "", width: tamanho, height: tamanho });

const normStr = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

function parseTopoJSON(topo) {
  const { scale: a, translate: n } = topo.transform;
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const updateBbox = (b, x, y) => {
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  };

  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      const pt = [(x * a[0] + n[0]) / 1000, -(y * a[1] + n[1]) / 1000];
      updateBbox(bbox, pt[0], pt[1]);
      return pt;
    });
  });

  const origin = [bbox[0], bbox[1]];
  for (const arc of arcs) {
    for (const pt of arc) {
      pt[0] -= origin[0];
      pt[1] -= origin[1];
    }
  }

  const arcUsers = arcs.map(() => []);
  const brasilBox = [Infinity, Infinity, -Infinity, -Infinity];

  const municipalities = topo.objects.municipios.geometries.map((geom, idx) => {
    const path = new Path2D();
    const mbox = [Infinity, Infinity, -Infinity, -Infinity];
    const polygonArcs = geom.type === "Polygon" ? [geom.arcs] : geom.arcs;
    let totalArea = 0, centroid = [0, 0], maxRingArea = 0;

    for (const ringGroup of polygonArcs) {
      for (const [ringIdx, ring] of ringGroup.entries()) {
        const ringPts = [];
        for (const arcIdx of ring) {
          const positive = arcIdx < 0 ? ~arcIdx : arcIdx;
          arcUsers[positive].push(idx);
          const pts = arcIdx < 0 ? [...arcs[positive]].reverse() : arcs[positive];
          ringPts.push(...pts.slice(ringPts.length ? 1 : 0));
        }
        if (!ringPts.length) continue;
        path.moveTo(...ringPts[0]);
        for (const pt of ringPts.slice(1)) path.lineTo(...pt);
        path.closePath();
        for (const pt of ringPts) updateBbox(mbox, pt[0], pt[1]);

        if (ringIdx === 0) {
          let signedArea2 = 0, cx = 0, cy = 0;
          for (let i = 0, j = ringPts.length - 1; i < ringPts.length; j = i++) {
            const cross = ringPts[j][0] * ringPts[i][1] - ringPts[i][0] * ringPts[j][1];
            signedArea2 += cross;
            cx += (ringPts[j][0] + ringPts[i][0]) * cross;
            cy += (ringPts[j][1] + ringPts[i][1]) * cross;
          }
          const ringArea = Math.abs(signedArea2 / 2);
          totalArea += ringArea;
          if (ringArea > maxRingArea) {
            maxRingArea = ringArea;
            centroid = signedArea2 ? [cx / (3 * signedArea2), cy / (3 * signedArea2)] : ringPts[0];
          }
        }
      }
    }

    const p = geom.properties;
    if (p.id !== "2605459") { // Exclude Fernando de Noronha from mainland bounding box
      updateBbox(brasilBox, mbox[0], mbox[1]);
      updateBbox(brasilBox, mbox[2], mbox[3]);
    }

    return {
      index: idx,
      id: String(p.id),
      name: p.n,
      normName: normStr(p.n),
      uf: p.uf,
      population: p.p || 10000,
      path,
      box: mbox,
      center: centroid,
      area: totalArea
    };
  });

  const states = {};
  for (const m of municipalities) {
    const st = states[m.uf] || (states[m.uf] = {
      uf: m.uf,
      municipalities: [],
      box: [Infinity, Infinity, -Infinity, -Infinity],
      center: [0, 0],
      area: 0,
      fill: new Path2D(),
      outline: new Path2D()
    });
    st.municipalities.push(m);
    st.area += m.area;
    st.fill.addPath(m.path);
    st.center[0] += m.center[0] * m.area;
    st.center[1] += m.center[1] * m.area;
    if (m.id !== "2605459") {
      updateBbox(st.box, m.box[0], m.box[1]);
      updateBbox(st.box, m.box[2], m.box[3]);
    }
  }

  for (const st of Object.values(states)) {
    st.center = [st.center[0] / st.area, st.center[1] / st.area];
  }

  // State boundaries Path2D
  const stateBorders = new Path2D();
  for (let aIdx = 0; aIdx < arcs.length; aIdx++) {
    const users = [...new Set(arcUsers[aIdx])];
    if (users.length >= 2) {
      const u1 = municipalities[users[0]];
      const u2 = municipalities[users[1]];
      if (u1 && u2 && u1.uf !== u2.uf) {
        const pts = arcs[aIdx];
        stateBorders.moveTo(...pts[0]);
        for (let i = 1; i < pts.length; i++) stateBorders.lineTo(...pts[i]);
      }
    }
  }

  return { municipalities, states, stateBorders, brasilBox };
}

export default function VisualizacaoGeografica() {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);

  const [loading, setLoading] = React.useState(true);
  const [geoData, setGeoData] = React.useState(null);
  const [salesMap, setSalesMap] = React.useState(new Map());
  const [activeMetric, setActiveMetric] = React.useState("value"); // 'value', 'share', 'potential', 'qty', 'ticket'
  const [selectedState, setSelectedState] = React.useState(null); // 'AL', 'PE', or null (all)
  const [hoveredMuni, setHoveredMuni] = React.useState(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedMonth, setSelectedMonth] = React.useState(() => MESES().at(-1) || "");

  // Camera state: x, y, k (zoom)
  const cameraRef = React.useRef({ x: 0, y: 0, k: 1 });
  const targetCamRef = React.useRef({ x: 0, y: 0, k: 1 });
  const isDraggingRef = React.useRef(false);
  const dragStartRef = React.useRef({ x: 0, y: 0 });
  const [cidade, setCidade] = React.useState(null);
  const cidadeRef = React.useRef(null);
  const voltarRef = React.useRef(() => {});
  const wakeRef = React.useRef(() => {});
  const hoverRef = React.useRef(null);
  const hitFrameRef = React.useRef(0);

  // Load TopoJSON and sales data
  React.useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        setLoading(true);
        const [topoRes, pecasRes] = await Promise.all([
          fetch("/maps/brasil.topo.json").then(r => r.json()),
          Promise.resolve(useStore.getState().pecasPorMes[selectedMonth] || [])
        ]);

        if (!mounted) return;
        const parsed = parseTopoJSON(topoRes);

        // Map sales to municipalities
        const sales = new Map();
        for (const row of pecasRes) {
          if (row.cat === 'COMPRA' || row.cat === 'INTERNA' || row.cat === 'TRANSF' || row.cat === 'SAIDA' || row.cat === 'DEV.COMPRA' || row.cat === 'OFICINA_INT') {
            continue;
          }
          const city = row.Município || row.Municipio || row.cidade;
          const uf = row.UF || row.uf || "";
          if (!city) continue;

          let val = 0;
          if (typeof row.valor === "number") {
            val = row.valor;
          } else if (row.valor != null) {
            const s = String(row.valor).trim();
            val = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s) || 0;
          } else if (row["Valor Total"] != null) {
            const s = String(row["Valor Total"]).trim();
            val = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s) || 0;
          }

          let qty = 0;
          if (typeof row.Quantidade === "number") {
            qty = row.Quantidade;
          } else if (typeof row.quantidade === "number") {
            qty = row.quantidade;
          } else {
            const qStr = String(row.Quantidade || row.quantidade || 0).trim();
            qty = Number(qStr.includes(",") ? qStr.replace(/\./g, "").replace(",", ".") : qStr) || 0;
          }

          if (val <= 0) continue;

          const nCity = normStr(city);
          // Fernando de Noronha (distrito estadual de PE) não entra nas vendas do mapa.
          if (nCity === normStr("Fernando de Noronha")) continue;
          // Com UF a chave é cidade|UF: antes o atalho só pelo nome somava cidades homônimas
          // de estados diferentes no mesmo registro. Só linhas sem UF usam o nome puro.
          const ufNorm = String(uf).trim().toUpperCase();
          const key = ufNorm ? nCity + "|" + ufNorm : nCity;

          const curr = sales.get(key) || { value: 0, qty: 0, orders: 0, city, uf };
          curr.value += val;
          curr.qty += qty;
          curr.orders += row.orders || 1;
          sales.set(key, curr);
        }

        setGeoData(parsed);
        setSalesMap(sales);

        // Fit initial camera to Alagoas & Pernambuco or full Brazil
        fitBounds(parsed.brasilBox);
        setLoading(false);
      } catch (err) {
        console.error("Error loading geographic data:", err);
        setLoading(false);
      }
    }
    init();
    return () => { mounted = false; };
  }, [selectedMonth]);

  // Afastar o zoom no máximo até o Brasil inteiro caber na tela (sem Fernando de Noronha no recorte).
  function zoomMinimo() {
    const canvas = canvasRef.current, box = geoData?.brasilBox;
    if (!canvas || !box) return 0.005;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width || 800) / dpr, h = (canvas.height || 600) / dpr;
    return Math.min(w / (box[2] - box[0]), h / (box[3] - box[1])) * 0.92;
  }

  function fitBounds(box) {
    if (!box || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const fitDpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width || 800) / fitDpr;
    const h = (canvas.height || 600) / fitDpr;
    const padding = 40;

    const bw = box[2] - box[0];
    const bh = box[3] - box[1];
    const k = Math.min((w - padding * 2) / bw, (h - padding * 2) / bh);
    const cx = (box[0] + box[2]) / 2;
    const cy = (box[1] + box[3]) / 2;

    targetCamRef.current = {
      x: w / 2 - cx * k,
      y: h / 2 - cy * k,
      k
    };
    if (cameraRef.current.k === 1) cameraRef.current = { ...targetCamRef.current };
    wakeRef.current();
  }

  // Desenha só quando algo muda; municípios da mesma cor vão num único fill
  React.useEffect(() => {
    if (!geoData || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dark = document.documentElement.dataset.theme === "dark";
    const maxVal = 250000;
    const noSale = uf => (uf === "AL" || uf === "PE") ? (dark ? "#1e293b" : "#f1f5f9") : (dark ? "#0f172a" : "#f8fafc");
    const colorOf = m => {
      const s = salesMap.get(m.normName + "|" + m.uf) || salesMap.get(m.normName);
      if (!s || s.value <= 0) return noSale(m.uf);
      if (activeMetric === "value") {
        const ratio = Math.min(1, s.value / maxVal);
        return ratio > 0.6 ? "#990000" : ratio > 0.25 ? "#cc0000" : ratio > 0.08 ? "#f87171" : "#fca5a5";
      }
      if (activeMetric === "share") {
        const share = Math.min(100, (s.value / (m.population * 25)) * 100);
        return share > 50 ? "#047857" : share > 20 ? "#10b981" : share > 5 ? "#34d399" : "#6ee7b7";
      }
      if (activeMetric === "potential") {
        const pot = m.population * 35;
        return pot > 2000000 ? "#4338ca" : pot > 800000 ? "#6366f1" : "#a5b4fc";
      }
      if (activeMetric === "qty") {
        const q = Math.min(1, s.qty / 500);
        return q > 0.5 ? "#b45309" : q > 0.15 ? "#f59e0b" : "#fde68a";
      }
      return "#cc0000";
    };
    const groups = new Map();
    const outline = new Path2D();
    for (const m of geoData.municipalities) {
      const alpha = !selectedState || m.uf === selectedState ? 1 : 0.35;
      const key = colorOf(m) + "|" + alpha;
      let group = groups.get(key);
      if (!group) groups.set(key, group = { color: key.split("|")[0], alpha, path: new Path2D() });
      group.path.addPath(m.path);
      outline.addPath(m.path);
    }
    const pins = DEALERSHIP_STORES.map(st => ({ st, m: geoData.municipalities.find(mun => mun.uf === st.uf && mun.normName === normStr(st.city)) })).filter(p => p.m);

    const vendaDe = m => (salesMap.get(m.normName + "|" + m.uf) || salesMap.get(m.normName))?.value || 0;
    const cidadesRotulo = selectedState && geoData.states[selectedState]
      ? [...geoData.states[selectedState].municipalities].sort((a, b) => vendaDe(b) - vendaDe(a) || b.population - a.population).slice(0, 10)
      : [];

    let frame = 0;
    const imagem = document.createElement("canvas");
    let imagemCam = null;
    function draw() {
      frame = 0;
      const cam = cameraRef.current;
      const target = targetCamRef.current;
      cam.x += (target.x - cam.x) * 0.18;
      cam.y += (target.y - cam.y) * 0.18;
      cam.k += (target.k - cam.k) * 0.18;
      let moving = Math.abs(target.x - cam.x) > 0.3 || Math.abs(target.y - cam.y) > 0.3 || Math.abs(target.k - cam.k) > target.k * 0.002;
      if (!moving) Object.assign(cam, target);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cacheValido = imagem.width === canvas.width && imagem.height === canvas.height && imagemCam;
      if (!cacheValido) { Object.assign(cam, target); moving = false; }
      const interagindo = cacheValido && (moving || isDraggingRef.current);
      const mesmaVista = cacheValido && imagemCam.x === cam.x && imagemCam.y === cam.y && imagemCam.k === cam.k;
      if (interagindo || mesmaVista) {
        const s = cam.k / imagemCam.k;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = dark ? "#0a0a0a" : "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imagem, dpr * (cam.x - imagemCam.x * s), dpr * (cam.y - imagemCam.y * s), canvas.width * s, canvas.height * s);
        if (mesmaVista) pintarHover(dpr);
        if (moving) wake();
        return;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = dark ? "#0a0a0a" : "#f8fafc";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * cam.x, dpr * cam.y);

      for (const group of groups.values()) {
        ctx.globalAlpha = group.alpha;
        ctx.fillStyle = group.color;
        ctx.fill(group.path);
      }
      ctx.globalAlpha = 1;
      if (!moving) {
        ctx.strokeStyle = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
        ctx.lineWidth = 0.5 / cam.k;
        ctx.stroke(outline);
      }
      ctx.strokeStyle = dark ? "#475569" : "#94a3b8";
      ctx.lineWidth = 1.5 / cam.k;
      ctx.stroke(geoData.stateBorders);
      if (selectedState && geoData.states[selectedState]) {
        ctx.strokeStyle = "#cc0000";
        ctx.lineWidth = 2.5 / cam.k;
        ctx.stroke(geoData.states[selectedState].fill);
      }
      for (const { st, m } of pins) {
        const [px, py] = m.center;
        const pinR = Math.max(3, 7 / cam.k);
        ctx.beginPath();
        ctx.arc(px, py, pinR * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = st.uf === "AL" ? "rgba(204, 0, 0, 0.25)" : "rgba(29, 78, 216, 0.25)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, pinR, 0, Math.PI * 2);
        ctx.fillStyle = st.color;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5 / cam.k;
        ctx.stroke();
        if (cam.k > 0.04) {
          ctx.font = `bold ${Math.max(10, 12 / cam.k)}px sans-serif`;
          ctx.fillStyle = dark ? "#ffffff" : "#0f172a";
          ctx.textAlign = "center";
          ctx.fillText(st.id, px, py - pinR * 1.5);
        }
      }
      if (!moving) {
        ctx.textAlign = "left";
        ctx.lineJoin = "round";
        const texto = (t, x, y, tamanho) => {
          ctx.font = `600 ${tamanho / cam.k}px Geist, sans-serif`;
          ctx.lineWidth = 3 / cam.k;
          ctx.strokeStyle = dark ? "#0a0a0a" : "#ffffff";
          ctx.strokeText(t, x, y);
          ctx.fillStyle = dark ? "#fafafa" : "#0a0a0a";
          ctx.fillText(t, x, y);
        };
        if (selectedState) for (const m of cidadesRotulo) {
          ctx.beginPath();
          ctx.arc(m.center[0], m.center[1], 3 / cam.k, 0, Math.PI * 2);
          ctx.fillStyle = dark ? "#fafafa" : "#0a0a0a";
          ctx.fill();
          texto(m.name, m.center[0] + 6 / cam.k, m.center[1] + 4 / cam.k, 13);
        } else for (const st of Object.values(geoData.states)) {
          ctx.textAlign = "center";
          texto(st.uf, st.center[0], st.center[1], 12);
        }
      }
      imagem.width = canvas.width;
      imagem.height = canvas.height;
      imagem.getContext("2d").drawImage(canvas, 0, 0);
      imagemCam = { x: cam.x, y: cam.y, k: cam.k };
      pintarHover(dpr);
    }
    function pintarHover(dpr) {
      if (!hoverRef.current) return;
      const cam = cameraRef.current;
      ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * cam.x, dpr * cam.y);
      ctx.fillStyle = "#fbbf24";
      ctx.fill(hoverRef.current.path);
    }
    function wake() {
      if (!frame) frame = requestAnimationFrame(draw);
    }
    wakeRef.current = wake;
    wake();
    return () => { cancelAnimationFrame(frame); wakeRef.current = () => {}; };
  }, [geoData, salesMap, activeMetric, selectedState]);

  React.useEffect(() => {
    hoverRef.current = hoveredMuni;
    wakeRef.current();
  }, [hoveredMuni]);

  // Handle Resize
  React.useEffect(() => {
    function handleResize() {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvasRef.current.width = Math.round(rect.width * dpr);
        canvasRef.current.height = Math.round(rect.height * dpr);
        if (geoData) fitBounds(geoData.brasilBox);
        wakeRef.current();
      }
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [geoData]);

  // onWheel do React é passivo: sem este listener a página rola junto com o zoom
  React.useEffect(() => {
    const canvas = canvasRef.current;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  function alternarTelaCheia() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.querySelector(".geo-page")?.requestFullscreen();
  }

  // Pointer & Zoom Events
  // Arrastar não pode virar clique: soma o deslocamento e o clique só vale se o ponteiro quase não andou.
  const arrastouRef = React.useRef(0);
  function handlePointerDown(e) {
    isDraggingRef.current = true;
    arrastouRef.current = 0;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e) {
    const canvas = canvasRef.current;
    if (!canvas || !geoData) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      arrastouRef.current += Math.abs(dx) + Math.abs(dy);
      if (arrastouRef.current > 4 && hoverRef.current !== null) { hoverRef.current = null; setHoveredMuni(null); }
      targetCamRef.current.x += dx;
      targetCamRef.current.y += dy;
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
      wakeRef.current();
      return;
    }

    if (hitFrameRef.current) return;
    const clientX = e.clientX, clientY = e.clientY;
    hitFrameRef.current = requestAnimationFrame(() => {
      hitFrameRef.current = 0;
      setMousePos({ x: clientX, y: clientY });

      const ctx = canvas.getContext("2d");
      const cam = cameraRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const wx = (mouseX - cam.x) / cam.k;
      const wy = (mouseY - cam.y) / cam.k;
      const list = selectedState && geoData.states[selectedState]
        ? geoData.states[selectedState].municipalities
        : geoData.municipalities;
      let found = null;
      ctx.save();
      ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * cam.x, dpr * cam.y);
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i];
        const b = m.box;
        if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) continue;
        if (ctx.isPointInPath(m.path, mouseX * dpr, mouseY * dpr)) {
          found = m;
          break;
        }
      }
      ctx.restore();
      setHoveredMuni(prev => (prev === found ? prev : found));
    });
  }

  function handlePointerUp() {
    isDraggingRef.current = false;
    wakeRef.current();
  }

  function handleWheel(e) {
    e.preventDefault();
    if (e.deltaY > 0 && cidadeRef.current) {
      voltarRef.current();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.25 : 0.8;
    const target = targetCamRef.current;
    const newK = Math.max(zoomMinimo(), Math.min(2.5, target.k * zoomFactor));

    // Zoom toward mouse pointer
    target.x = mx - (mx - target.x) * (newK / target.k);
    target.y = my - (my - target.y) * (newK / target.k);
    target.k = newK;
    wakeRef.current();
  }

  function handleClick() {
    if (arrastouRef.current > 4) return;
    if (hoveredMuni) {
      // Zoom into state if clicking an unselected state
      if (!selectedState || selectedState !== hoveredMuni.uf) selectState(hoveredMuni.uf);
      else zoomToCity(hoveredMuni);
    }
  }

  function selectState(uf) {
    if (!geoData) return;
    setCidade(null);
    cidadeRef.current = null;
    if (!uf) {
      setSelectedState(null);
      fitBounds(geoData.brasilBox);
      return;
    }
    setSelectedState(uf);
    const st = geoData.states[uf];
    if (st) fitBounds(st.box);
  }

  function zoomToCity(m) {
    if (!m) return;
    setSelectedState(m.uf);
    setCidade(m);
    cidadeRef.current = m;
    // Folga em volta para o município não encostar nas bordas
    const [x0, y0, x1, y1] = m.box;
    const folga = Math.max(x1 - x0, y1 - y0);
    fitBounds([x0 - folga, y0 - folga, x1 + folga, y1 + folga]);
    setHoveredMuni(null);
  }

  voltarRef.current = () => selectState(cidadeRef.current?.uf);

  // Aggregate summary metrics
  const summary = React.useMemo(() => {
    let totalRev = 0, totalQty = 0, totalOrders = 0, coveredMunis = 0;
    const list = [];
    if (!geoData) return { totalRev, totalQty, totalOrders, coveredMunis, topCities: [] };

    for (const m of geoData.municipalities) {
      if (selectedState && m.uf !== selectedState) continue;
      const s = salesMap.get(m.normName + "|" + m.uf) || salesMap.get(m.normName);
      if (s && s.value > 0) {
        totalRev += s.value;
        totalQty += s.qty;
        totalOrders += s.orders;
        coveredMunis += 1;
        list.push({ ...m, revenue: s.value, qty: s.qty, orders: s.orders });
      }
    }

    list.sort((a, b) => b.revenue - a.revenue);
    return {
      totalRev,
      totalQty,
      totalOrders,
      coveredMunis,
      topCities: list.slice(0, 15)
    };
  }, [geoData, salesMap, selectedState]);

  // Filtered search results
  const searchResults = React.useMemo(() => {
    if (!geoData || !searchQuery.trim() || searchQuery.length < 2) return [];
    const q = normStr(searchQuery);
    return geoData.municipalities
      .filter(m => m.normName.includes(q))
      .slice(0, 6);
  }, [geoData, searchQuery]);

  return e.jsxs("div", {
    className: "page geo-page",
    style: { display: "flex", flexDirection: "column", height: "calc(100vh - 132px)", minHeight: 680, paddingTop: 10, paddingBottom: 10, gap: 10 },
    children: [
      // Top Controls Bar
      e.jsxs("div", {
        className: "geo-header-bar",
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          background: "var(--bg2)",
          padding: "10px 18px",
          borderRadius: "14px",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
        },
        children: [
          e.jsx("select", { className: "form-input", "aria-label": "Mês", style: { width: 120 }, value: selectedMonth, onChange: ev => setSelectedMonth(ev.target.value), children: MESES().map(m => e.jsx("option", { value: m, children: m }, m)) }),

          // Metric selector pills
          e.jsxs("div", {
            style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
            children: [
              e.jsx("span", { style: { fontSize: "12px", color: "var(--text3)", marginRight: 4 }, children: "Métrica:" }),
              [
                { id: "value", label: "Faturamento Peças (R$)" },
                { id: "share", label: "Aproveitamento (%)" },
                { id: "potential", label: "Potencial Estimado" },
                { id: "qty", label: "Qtd Peças" }
              ].map(item => e.jsx("button", {
                key: item.id,
                className: `btn btn-xs ${activeMetric === item.id ? "btn-primary" : "btn-ghost"}`,
                onClick: () => setActiveMetric(item.id),
                children: item.label
              }))
            ]
          }),

          // Quick actions: Reset View
          e.jsxs("div", {
            style: { display: "flex", alignItems: "center", gap: 8 },
            children: [
              e.jsx("button", { type: "button", className: "btn btn-primary btn-sm", onClick: alternarTelaCheia, children: "Tela cheia" }),
              e.jsx("button", {
                className: "btn btn-ghost btn-sm",
                onClick: () => {
                  if (geoData) fitBounds(selectedState ? geoData.states[selectedState]?.box : geoData.brasilBox);
                },
                title: "Centralizar mapa",
                children: "⟲ Centralizar"
              }),
              e.jsx("button", {
                className: "btn btn-ghost btn-sm",
                onClick: () => { targetCamRef.current.k *= 1.35; },
                title: "Aproximar zoom",
                children: "+"
              }),
              e.jsx("button", {
                className: "btn btn-ghost btn-sm",
                onClick: () => { targetCamRef.current.k = Math.max(zoomMinimo(), targetCamRef.current.k * 0.75); wakeRef.current(); },
                title: "Afastar zoom",
                children: "−"
              })
            ]
          })
        ]
      }),

      e.jsxs("div", { className: "geo-ufs", role: "group", "aria-label": "Escolher estado", children: [
        e.jsx("button", { type: "button", className: !selectedState ? "is-ativo" : "", onClick: () => selectState(null), children: "Brasil" }),
        Object.keys(ESTADOS).map(uf => e.jsxs("button", { type: "button", title: ESTADOS[uf], className: selectedState === uf ? "is-ativo" : "", "aria-pressed": selectedState === uf, onClick: () => selectState(uf), children: [e.jsx(Bandeira, { uf }), uf] }, uf)),
      ] }),

      // Main Content Area: Map Canvas + Side Panel
      e.jsxs("div", {
        style: { display: "flex", flex: 1, minHeight: 0, gap: 14 },
        children: [
          // Left: Interactive Canvas Map
          e.jsxs("div", {
            ref: containerRef,
            style: {
              flex: 1,
              position: "relative",
              background: "var(--bg2)",
              borderRadius: "16px",
              border: "1px solid var(--border)",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)"
            },
            children: [
              loading && e.jsx("div", {
                style: {
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.8)",
                  zIndex: 10,
                  fontWeight: 600,
                  color: "var(--text)"
                },
                children: "Carregando 5.570 municípios do Brasil e base de vendas..."
              }),

              e.jsx("canvas", {
                ref: canvasRef,
                style: { width: "100%", height: "100%", display: "block", cursor: isDraggingRef.current ? "grabbing" : "grab" },
                onPointerDown: handlePointerDown,
                onPointerMove: handlePointerMove,
                onPointerUp: handlePointerUp,
                onClick: handleClick
              }),

              // Floating Legend
              e.jsxs("div", {
                style: {
                  position: "absolute",
                  bottom: 16,
                  left: 16,
                  background: "var(--bg2)",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
                  fontSize: "11px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                },
                children: [
                  e.jsx("strong", { children: activeMetric === "value" ? "Faturamento por Município" : activeMetric === "share" ? "Aproveitamento Estimado" : "Potencial Estimado" }),
                  e.jsxs("div", {
                    style: { display: "flex", alignItems: "center", gap: 6 },
                    children: [
                      e.jsx("span", { style: { display: "inline-block", width: 14, height: 14, background: "#cc0000", borderRadius: 3 } }),
                      e.jsx("span", { children: "Alto Volume (> R$ 100k)" }),
                      e.jsx("span", { style: { display: "inline-block", width: 14, height: 14, background: "#f87171", borderRadius: 3, marginLeft: 8 } }),
                      e.jsx("span", { children: "Médio" }),
                      e.jsx("span", { style: { display: "inline-block", width: 14, height: 14, background: "#fca5a5", borderRadius: 3, marginLeft: 8 } }),
                      e.jsx("span", { children: "Atendido" })
                    ]
                  }),
                  e.jsxs("div", {
                    style: { display: "flex", alignItems: "center", gap: 6, marginTop: 2 },
                    children: [
                      e.jsx("span", { style: { display: "inline-block", width: 10, height: 10, background: "#cc0000", borderRadius: "50%", border: "2px solid #fff" } }),
                      e.jsx("span", { style: { color: "var(--text2)" }, children: "Concessionária Alagoas Motos" }),
                      e.jsx("span", { style: { display: "inline-block", width: 10, height: 10, background: "#1d4ed8", borderRadius: "50%", border: "2px solid #fff", marginLeft: 6 } }),
                      e.jsx("span", { style: { color: "var(--text2)" }, children: "Pernambuco Motos" })
                    ]
                  })
                ]
              }),

              // Hover Tooltip
              hoveredMuni && (() => {
                const s = salesMap.get(hoveredMuni.normName + "|" + hoveredMuni.uf) || salesMap.get(hoveredMuni.normName);
                const pop = hoveredMuni.population;
                const rev = s ? s.value : 0;
                const qty = s ? s.qty : 0;
                const share = pop ? Math.min(100, (rev / (pop * 12)) * 100).toFixed(1) : "0";
                const potential = pop ? Math.round(pop * 15) : 0;
                const caixa = containerRef.current.getBoundingClientRect();

                return e.jsxs("div", {
                  style: {
                    position: "absolute",
                    left: Math.max(8, Math.min(mousePos.x - caixa.left + 16, caixa.width - 330)),
                    top: Math.max(8, Math.min(mousePos.y - caixa.top - 12, caixa.height - 210)),
                    zIndex: 1000,
                    pointerEvents: "none",
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "12px 16px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                    minWidth: 240,
                    maxWidth: 320
                  },
                  children: [
                    e.jsxs("div", {
                      style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
                      children: [
                        e.jsx("strong", { style: { fontSize: "14px", color: "var(--text)" }, children: hoveredMuni.name }),
                        e.jsx("span", { className: `badge ${hoveredMuni.uf === "AL" ? "badge-red" : "badge-blue"}`, children: hoveredMuni.uf })
                      ]
                    }),
                    e.jsxs("div", {
                      style: { fontSize: "12px", display: "flex", flexDirection: "column", gap: 4 },
                      children: [
                        e.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 16 }, children: [e.jsx("span", { style: { color: "var(--text3)" }, children: "População" }), e.jsx("b", { style: { textAlign: "right" }, children: pop.toLocaleString("pt-BR") })] }),                         e.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 16 }, children: [e.jsx("span", { style: { color: "var(--text3)" }, children: "Vendas de peças" }), e.jsx("b", { style: { textAlign: "right", color: rev > 0 ? "var(--honda)" : "var(--text3)" }, children: rev > 0 ? fmtMoeda(rev) : `Sem vendas em ${selectedMonth}` })] }),                         rev > 0 && e.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 16 }, children: [e.jsx("span", { style: { color: "var(--text3)" }, children: "Quantidade" }), e.jsx("b", { style: { textAlign: "right" }, children: `${qty.toLocaleString("pt-BR")} peças` })] }),                         e.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 16 }, children: [e.jsx("span", { style: { color: "var(--text3)" }, children: "Aproveitamento estimado" }), e.jsx("b", { style: { textAlign: "right", color: Number(share) <= 0 ? "var(--text3)" : Number(share) < 5 ? "var(--amber)" : "var(--green)" }, children: `${String(share).replace(".", ",")}%` })] }),                         e.jsxs("div", { style: { display: "flex", justifyContent: "space-between", gap: 16 }, children: [e.jsx("span", { style: { color: "var(--text3)" }, children: "Potencial estimado" }), e.jsx("b", { style: { textAlign: "right" }, children: fmtMoeda(potential) })] })
                      ]
                    })
                  ]
                });
              })()
            ]
          }),

          // Right: Ranking & Analysis Side Panel
          e.jsxs("div", {
            style: {
              width: "clamp(280px, 23vw, 340px)",
              display: "flex",
              flexDirection: "column",
              background: "var(--bg2)",
              borderRadius: "16px",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              overflowY: "auto"
            },
            children: [
              selectedState && e.jsxs("div", { className: "geo-estado", children: [
                e.jsx(Bandeira, { uf: selectedState, tamanho: 52 }),
                e.jsxs("div", { children: [e.jsx("h2", { children: ESTADOS[selectedState] }), e.jsx("small", { children: `${selectedState} · ${geoData?.states[selectedState]?.municipalities.length || 0} municípios · ${selectedMonth}` })] }),
                e.jsx("button", { type: "button", "aria-label": "Voltar ao Brasil", onClick: () => selectState(null), children: "×" }),
              ] }),

              cidade && (() => {
                const s = salesMap.get(cidade.normName + "|" + cidade.uf) || salesMap.get(cidade.normName);
                const venda = s?.value || 0;
                const totalEstado = geoData.states[cidade.uf].municipalities.reduce((t, m) => t + ((salesMap.get(m.normName + "|" + m.uf) || salesMap.get(m.normName))?.value || 0), 0);
                const itens = [["Faturamento", fmtMoeda(venda)], ["Peças", Math.round(s?.qty || 0).toLocaleString("pt-BR")], ["Vendas", (s?.orders || 0).toLocaleString("pt-BR")], ["Do estado", totalEstado ? `${(venda / totalEstado * 100).toFixed(1)}%` : "0%"], ["Ticket médio", fmtMoeda(s?.orders ? venda / s.orders : 0)], ["População", cidade.population.toLocaleString("pt-BR")]];
                return e.jsxs("section", { className: "geo-cidade-painel", children: [
                  e.jsxs("header", { children: [e.jsx("h3", { children: cidade.name }), e.jsx("button", { type: "button", className: "btn btn-ghost btn-xs", onClick: () => selectState(cidade.uf), children: `Voltar para ${cidade.uf}` })] }),
                  e.jsx("div", { children: itens.map(([t, v]) => e.jsxs("article", { children: [e.jsx("small", { children: t }), e.jsx("strong", { children: v })] }, t)) }),
                ] });
              })(),

              // Search Header
              e.jsxs("div", {
                style: { padding: "14px 16px", borderBottom: "1px solid var(--border)", position: "relative" },
                children: [
                  e.jsx("input", {
                    className: "form-input",
                    placeholder: "🔍 Buscar qualquer município...",
                    value: searchQuery,
                    onChange: e => setSearchQuery(e.target.value),
                    style: { width: "100%", height: 36, fontSize: "13px" }
                  }),
                  searchResults.length > 0 && e.jsx("div", {
                    style: {
                      position: "absolute",
                      top: 56,
                      left: 16,
                      right: 16,
                      zIndex: 100,
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                      overflow: "hidden"
                    },
                    children: searchResults.map(m => e.jsxs("button", {
                      key: m.id,
                      style: {
                        width: "100%",
                        padding: "8px 12px",
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        fontSize: "12px",
                        color: "var(--text)"
                      },
                      onClick: () => {
                        zoomToCity(m);
                        setSearchQuery("");
                      },
                      children: [
                        e.jsx("span", { children: m.name }),
                        e.jsx("span", { className: `badge ${m.uf === "AL" ? "badge-red" : "badge-blue"}`, children: m.uf })
                      ]
                    }))
                  })
                ]
              }),

              // Regional KPIs Cards
              e.jsxs("div", {
                style: {
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 8,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg3)"
                },
                children: [
                  e.jsxs("div", {
                    style: { background: "var(--bg2)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)" },
                    children: [
                      e.jsx("span", { style: { fontSize: "11px", color: "var(--text3)", display: "block" }, children: "Faturamento Peças" }),
                      e.jsx("strong", { style: { fontSize: "15px", color: "var(--text)" }, children: fmtMoeda(summary.totalRev) })
                    ]
                  }),
                  e.jsxs("div", {
                    style: { background: "var(--bg2)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)" },
                    children: [
                      e.jsx("span", { style: { fontSize: "11px", color: "var(--text3)", display: "block" }, children: "Cidades Atendidas" }),
                      e.jsxs("strong", { style: { fontSize: "15px", color: "var(--text)" }, children: [summary.coveredMunis, " polos"] })
                    ]
                  }),
                  e.jsxs("div", {
                    style: { background: "var(--bg2)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)" },
                    children: [
                      e.jsx("span", { style: { fontSize: "11px", color: "var(--text3)", display: "block" }, children: "Volume Entregue" }),
                      e.jsxs("strong", { style: { fontSize: "15px", color: "var(--text)" }, children: [Math.round(summary.totalQty).toLocaleString("pt-BR"), " peças"] })
                    ]
                  }),
                  e.jsxs("div", {
                    style: { background: "var(--bg2)", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)" },
                    children: [
                      e.jsx("span", { style: { fontSize: "11px", color: "var(--text3)", display: "block" }, children: "Vendas registradas" }),
                      e.jsx("strong", { style: { fontSize: "15px", color: "var(--text)" }, children: summary.totalOrders.toLocaleString("pt-BR") })
                    ]
                  })
                ]
              }),

              // Ranking of Top Municipalities
              e.jsxs("div", {
                style: { padding: "12px 16px" },
                children: [
                  e.jsxs("div", {
                    style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
                    children: [
                      e.jsx("strong", { style: { fontSize: "13px" }, children: "Top Municípios por Vendas" }),
                      e.jsx("span", { style: { fontSize: "11px", color: "var(--text3)" }, children: "Clique para focar" })
                    ]
                  }),

                  summary.topCities.map((city, rank) => {
                    const pct = summary.topCities[0] ? (city.revenue / summary.topCities[0].revenue) * 100 : 0;
                    return e.jsxs("button", {
                      key: city.id,
                      style: {
                        display: "block",
                        width: "100%",
                        padding: "12px 14px",
                        marginBottom: 8,
                        background: "var(--bg2)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "background 0.15s"
                      },
                      onClick: () => zoomToCity(city),
                      children: [
                        e.jsxs("div", {
                          style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
                          children: [
                            e.jsxs("span", { className: "geo-cidade", children: [e.jsx(Bandeira, { uf: city.uf, tamanho: 18 }), `${rank + 1}. ${city.name}`] }),
                            e.jsx("strong", { style: { fontSize: "12px", color: "var(--honda)" }, children: fmtMoeda(city.revenue) })
                          ]
                        }),
                        e.jsx("div", {
                          style: { width: "100%", height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" },
                          children: e.jsx("div", {
                            style: { width: `${pct}%`, height: "100%", background: "#cc0000", borderRadius: 3 }
                          })
                        })
                      ]
                    });
                  })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}
