import { useEffect, useMemo, useState, useRef, useId } from "react";
import { MapPin, Upload, RotateCcw } from '../icons/iconoir';
import { key, validateGeo } from "./model.js";
import { Chart, money } from "./Chart.jsx";
import { territoryGroups } from "./territory.js";
import { compactMapRows } from "./mapGeometry.js";

const levels = { region: "Região", city: "Cidade", neighborhood: "Bairro" };
const groupLabel = (item) =>
  [item.name, item.city, item.uf].filter(Boolean).join(" · ");
// Escala de calor: verde (venda pequena) → âmbar → vermelho (venda grande).
// Só tokens do tema, para o mapa seguir o resto do app.
const HEAT = ["--green", "--amber", "--honda"];
const bucketOf = (ratio) => (ratio < 0.34 ? 0 : ratio < 0.67 ? 1 : 2);
// Área proporcional à raiz do valor: a cidade campeã não engole as demais.
const heatRadius = (ratio) => 4 + 13 * Math.sqrt(Math.max(0, Math.min(1, ratio)));
export default function RegionMap({ rows, geo, setGeo, selected, onSelect }) {
  const container=useRef(null)
  const layerId=useId().replace(/:/g,"")
  const [visible,setVisible]=useState(()=>typeof IntersectionObserver==='undefined')
  useEffect(()=>{if(visible)return;const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setVisible(true);observer.disconnect()}},{rootMargin:'300px'});if(container.current)observer.observe(container.current);return()=>observer.disconnect()},[visible])
  const [error, setError] = useState(""),
    [base, setBase] = useState({ points: [], outline: [], context: null }),
    [loading, setLoading] = useState(false);
  const [level, setLevel] = useState("city"),
    [style, setStyle] = useState("map"),
    [retry, setRetry] = useState(0),
    [hovered, setHovered] = useState(null);
  const compactRows=useMemo(()=>compactMapRows(rows),[rows])
  useEffect(() => {
    if (!visible || style!=="map") return;
    let active = true;
    setLoading(true);
    setError("");
    const worker=new Worker(new URL("./map.worker.js", import.meta.url), { type: "module" });
    worker.onmessage=({data})=>{
      if (!active) return;
      if (data.error) setError(data.error);
      else setBase(data.result);
      setLoading(false);
    };
    worker.onerror=()=>{
      if (!active) return;
      setError("Não foi possível preparar o mapa. Tente novamente.");
      setLoading(false);
    };
    worker.postMessage({ rows: compactRows, geo });
    return () => {
      active = false;
      worker.terminate();
    };
  }, [compactRows, geo, retry,visible,style]);
  // Uma única passada por nível: a lista de cidades já é reaproveitada pelo
  // painel lateral e pelo ranking, em vez de recalcular o agrupamento.
  const cityGroups=useMemo(()=>territoryGroups(rows,'city'),[rows])
  const groups = useMemo(() => level==='city'?cityGroups:territoryGroups(rows, level), [rows, level,cityGroups]);
  const ranking = groups.slice(0, 12);
  const points=base.points;
  const soldPoints=useMemo(()=>points.filter(point=>point.records),[points])
  // Mapa importado mostra as regiões sem venda só como contexto (igual ao
  // desenho antigo, que pintava o polígono sem registro em cinza).
  const drawn=useMemo(()=>geo?points:soldPoints,[geo,points,soldPoints])
  const max = useMemo(()=>Math.max(1,...soldPoints.map(point=>Math.abs(point.value))),[soldPoints])
  // Contorno do país: um único traço, desenhado atrás dos pontos de calor.
  const outline=useMemo(()=>base.outline?.length?base.outline.map(ring=>`M${ring.map(([x,y])=>`${x} ${y}`).join("L")}Z`).join(""):"",[base.outline])
  const labels=useMemo(()=>{
    const occupied=[];
    return [...soldPoints].sort((a,b)=>b.value-a.value).filter((point)=>{
      if(occupied.some(([x,y])=>Math.hypot(x-point.x,y-point.y)<58)) return false;
      occupied.push([point.x,point.y]);
      return occupied.length<=3;
    });
  },[soldPoints])
  const active = useMemo(()=>points.find((point)=>
    typeof selected === "string"
      ? key(selected) === key(point.name)
      : selected?.level === "city" &&
        key(selected.name) === key(point.name) &&
        (!selected.uf || selected.uf === point.uf),
  ),[points,selected]);
  const matched = soldPoints.reduce((sum, point) => sum + point.records, 0);
  const tooltip = hovered || active || null;
  const selectGroup = (item) =>
    onSelect({ level, name: item.name, uf: item.uf, city: item.city });
  async function upload(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 8e6) throw Error("Limite de 8 MB por arquivo.");
      const data = validateGeo(JSON.parse(await file.text()));
      if (new TextEncoder().encode(JSON.stringify(data)).length > 500000)
        throw Error(
          "Simplifique o mapa para menos de 500 KB antes de importar.",
        );
      setGeo(data);
      setError("");
      setStyle("map");
      onSelect("");
    } catch (error) {
      setError(error.message);
    }
    event.target.value = "";
  }
  return (
    <section ref={container} className="bi-region">
      <div className="bi-heading">
        <div>
          <h2>Análise regional</h2>
          <p>Onde as vendas aconteceram · receita líquida por localidade.</p>
        </div>
        <details className="bi-view-options">
          <summary aria-label="Opções do mapa" title="Opções do mapa">
            <MapPin size={17} />
          </summary>
          <div className="bi-view-menu">
            <label className="bi-button">
              <Upload size={14} />
              Importar mapa próprio
              <input
                type="file"
                accept=".json,.geojson"
                onChange={upload}
                hidden
              />
            </label>
            {geo && (
              <button
                onClick={() => {
                  setGeo(null);
                  onSelect("");
                }}
              >
                <RotateCcw size={14} />
                Usar mapa do IBGE
              </button>
            )}
          </div>
        </details>
      </div>
      <div className="bi-territory-controls">
        <label>
          Visualizar por
          <select
            aria-label="Localidade da análise regional"
            value={level}
            onChange={(event) => {
              const next = event.target.value;
              setLevel(next);
              onSelect("");
              if (next !== "city" && style === "map" && !geo)
                setStyle("heatmap");
            }}
          >
            {Object.entries(levels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Formato
          <select
            aria-label="Formato da análise regional"
            value={style}
            onChange={(event) => setStyle(event.target.value)}
          >
            <option value="map" disabled={level !== "city" && !geo}>
              Mapa geográfico
            </option>
            <option value="heatmap">Mapa de calor em blocos</option>
            <option value="bar">Barras</option>
            <option value="donut">Rosca</option>
            <option value="table">Tabela</option>
          </select>
        </label>
        {selected && (
          <button className="bi-button" onClick={() => onSelect("")}>
            Limpar seleção
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="bi-map-error">
          {error}
          <button onClick={() => setRetry((value) => value + 1)}>
            Tentar novamente
          </button>
        </p>
      )}
      {!groups.length ? (
        <div className="bi-empty">
          Nenhuma venda contém {levels[level].toLowerCase()} nesta base.
        </div>
      ) : style === "map" ? (
        <div className="bi-map-layout">
          <div className="bi-geographic-map">
            {loading ? (
              <p className="bi-empty">Carregando mapa…</p>
            ) : points.length ? (
              <svg
                viewBox="0 0 640 370"
                role="group"
                aria-label="Mapa de calor das vendas por município"
              >
                <defs>
                  {HEAT.map((token, index) => (
                    <radialGradient key={token} id={`${layerId}-${index}`}>
                      <stop offset="0" stopColor={`var(${token})`} stopOpacity="0.9" />
                      <stop offset="0.5" stopColor={`var(${token})`} stopOpacity="0.5" />
                      <stop offset="1" stopColor={`var(${token})`} stopOpacity="0" />
                    </radialGradient>
                  ))}
                  <radialGradient id={`${layerId}-off`}>
                    <stop offset="0" stopColor="var(--text3)" stopOpacity="0.5" />
                    <stop offset="1" stopColor="var(--text3)" stopOpacity="0" />
                  </radialGradient>
                  {/* Um único desfoque para a camada inteira: o custo não cresce
                      com o número de cidades. */}
                  <filter id={`${layerId}-soft`} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.2" />
                  </filter>
                </defs>
                {outline && <path className="bi-map-country" d={outline} />}
                <g
                  className="bi-heat-layer"
                  filter={`url(#${layerId}-soft)`}
                  aria-hidden="true"
                >
                  {drawn.map((point) => {
                    const ratio = Math.abs(point.value) / max;
                    const fill = !point.records || point.value < 0
                      ? `url(#${layerId}-off)`
                      : `url(#${layerId}-${bucketOf(ratio)})`;
                    return (
                      <circle
                        key={point.id}
                        cx={point.x}
                        cy={point.y}
                        r={point.records ? heatRadius(ratio) : 5}
                        fill={fill}
                      />
                    );
                  })}
                </g>
                {soldPoints.map((point) => (
                  <circle
                    key={`hit-${point.id}`}
                    className="bi-heat-point"
                    cx={point.x}
                    cy={point.y}
                    r={Math.max(9, heatRadius(Math.abs(point.value) / max))}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${point.name}${point.uf ? " · " + point.uf : ""}: ${money(point.value)}`}
                    onClick={() => onSelect(point.filter)}
                    onFocus={() => setHovered(point)}
                    onBlur={() => setHovered(null)}
                    onPointerEnter={() => setHovered(point)}
                    onPointerLeave={() => setHovered(null)}
                    onKeyDown={(event) => {
                      if (["Enter", " "].includes(event.key)) {
                        event.preventDefault();
                        onSelect(point.filter);
                      }
                    }}
                  >
                    <title>
                      {point.name}: {money(point.value)}
                    </title>
                  </circle>
                ))}
                {active && (
                  <circle
                    className="bi-heat-active"
                    cx={active.x}
                    cy={active.y}
                    r={heatRadius(Math.abs(active.value || 0) / max) + 4}
                    aria-hidden="true"
                  />
                )}
                {labels.map((point) => (
                    <g key={`label-${point.id}`} pointerEvents="none">
                      <text
                        x={point.x + 10}
                        y={point.y - 9}
                        fill="var(--text)"
                        fontSize="11"
                        paintOrder="stroke"
                        stroke="var(--bg2)"
                        strokeWidth="3"
                      >
                        {point.name}
                      </text>
                    </g>
                  ))}
              </svg>
            ) : (
              <div className="bi-empty">
                Localidades não reconhecidas no mapa. Veja os dados em Mapa de
                calor em blocos ou Tabela.
              </div>
            )}
            <div className="bi-map-legend">
              <span>Menor receita</span>
              <i />
              <span>Maior receita</span>
            </div>
            <small>
              {geo ? "Mapa importado" : "Contorno do IBGE · pontos de calor"} ·{" "}
              {loading
                ? "…"
                : `${matched} de ${rows.length} registros localizados`}
            </small>
          </div>
          <aside className="bi-region-detail">
            <h3>{tooltip?.name || "Vendas por cidade"}</h3>
            {tooltip ? (
              <>
                <strong className="bi-region-value">
                  {money(tooltip.value)}
                </strong>
                <p>
                  Peças <b>{money(tooltip.parts)}</b>
                </p>
                <p>
                  Serviços <b>{money(tooltip.services)}</b>
                </p>
                <p>{tooltip.records} registros</p>
                {tooltip.uf && <p>UF {tooltip.uf}</p>}
                {tooltip.properties?.population != null && (
                  <p>
                    Habitantes{" "}
                    {tooltip.properties.population.toLocaleString("pt-BR")}
                  </p>
                )}
                {geo && (
                  <small>
                    {tooltip.properties?.populationYear || ""} ·{" "}
                    {tooltip.properties?.source || "Fonte não informada"}
                  </small>
                )}
                {tooltip.potential > 0 && (
                  <>
                    <p>
                      Aproveitamento estimado{" "}
                      <b>
                        {(
                          (tooltip.value / tooltip.potential) *
                          100
                        ).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        %
                      </b>
                    </p>
                    <p>
                      Potencial ainda não capturado{" "}
                      <b>
                        {money(Math.max(0, tooltip.potential - tooltip.value))}
                      </b>
                    </p>
                    <small>
                      Estimativa contra o potencial cadastrado; não representa
                      vendas perdidas comprovadas.
                    </small>
                  </>
                )}
                <button onClick={() => onSelect("")}>Todas as cidades</button>
              </>
            ) : (
              <>
                {cityGroups
                  .slice(0, 6)
                  .map((item) => (
                    <button
                      key={item.id}
                      onMouseEnter={() => setHovered(points.find((point) => key(point.name) === key(item.name) && (!item.uf || point.uf === item.uf)) || null)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() =>
                        onSelect({
                          level: "city",
                          name: item.name,
                          uf: item.uf,
                        })
                      }
                    >
                      <span>
                        {item.name}
                        {item.uf ? " · " + item.uf : ""}
                      </span>
                      <b>{money(item.value)}</b>
                    </button>
                  ))}
                <small>Selecione uma cidade para filtrar os gráficos.</small>
              </>
            )}
          </aside>
        </div>
      ) : style === "heatmap" ? (
        <div
          className="bi-heat-grid"
          aria-label={`Mapa de calor por ${levels[level].toLowerCase()}`}
        >
          {ranking.map((item) => (
            <button
              key={item.id}
              onClick={() => selectGroup(item)}
              style={{
                "--heat-intensity": Math.max(0.08, Math.abs(item.value) / max),
              }}
            >
              <span>{groupLabel(item)}</span>
              <strong>{money(item.value)}</strong>
              <small>{item.records} registros</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="bi-territory-chart">
          <Chart
            data={ranking.map((item) => ({
              ...item,
              name: groupLabel(item),
            }))}
            type={style}
            onSelect={(name) => {
              const item = ranking.find((item) => name === groupLabel(item));
              if (item) selectGroup(item);
            }}
            options={{ legend: true, values: true }}
          />
        </div>
      )}
      {rows.some((row) => !row[level]) && (
        <small className="bi-map-missing">
          {rows.filter((row) => !row[level]).length} registros sem{" "}
          {levels[level].toLowerCase()} informada.
        </small>
      )}
    </section>
  );
}
