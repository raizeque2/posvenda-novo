import { useMemo, useState, useRef, useEffect } from "react";
import { useReducedMotion } from "motion/react";
import { AreaChart, Area } from "../components/bklit/charts/area-chart";
import { LineChart, Line } from "../components/bklit/charts/line-chart";
import { BarChart } from "../components/bklit/charts/bar-chart";
import { Bar } from "../components/bklit/charts/bar";
import { PieChart } from "../components/bklit/charts/pie-chart";
import { PieSlice } from "../components/bklit/charts/pie-slice";
import { Grid } from "../components/bklit/charts/grid";
import { useChart } from "../components/bklit/charts/chart-context";
import FloatingChartTooltip from './FloatingChartTooltip.jsx'
import "./bklit.css";
const compact = (n) =>
  Intl.NumberFormat("pt-BR", { notation: "compact" }).format(n);
const label = (s) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(s))
    ? String(s).slice(8) + "/" + String(s).slice(5, 7)
    : String(s);

function AxisAndSelection({ data, onSelect, format }) {
  const { innerWidth, innerHeight, xScale, yScale, barScale, setTooltipData } =
    useChart();
  const x = (r, i) =>
    barScale
      ? (barScale(r.name) || 0) + barScale.bandwidth() / 2
      : xScale(r.date);
  return (
    <g>
      {yScale.ticks(4).map((t) => (
        <text
          key={t}
          x={-9}
          y={yScale(t)}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={10}
          fill="var(--text3)"
        >
          {compact(t)}
        </text>
      ))}
      {data.map((r, i) => {
        const center = x(r, i),
          next = i < data.length - 1 ? x(data[i + 1], i + 1) : innerWidth,
          previous = i ? x(data[i - 1], i - 1) : 0;
        const left = i ? (center + previous) / 2 : 0,
          right = i < data.length - 1 ? (center + next) / 2 : innerWidth;
        const show =
          i === 0 ||
          i === data.length - 1 ||
          i %
            Math.max(
              1,
              Math.ceil(data.length / Math.max(2, innerWidth / 95)),
            ) ===
            0;
        return (
          <g key={r.name}>
            {show && (
              <text
                x={center}
                y={innerHeight + 22}
                fontSize={10}
                textAnchor="middle"
                fill="var(--text3)"
              >
                {label(r.name).slice(0, 17)}
              </text>
            )}
            <rect
              x={Math.max(0, left)}
              y={0}
              width={Math.max(1, right - left)}
              height={innerHeight}
              fill="transparent"
              tabIndex={onSelect ? 0 : undefined}
              role={onSelect ? "button" : undefined}
              aria-label={`${label(r.name)}: ${format(r.value)}`}
              style={{ cursor: onSelect ? "pointer" : "default" }}
              onClick={() => onSelect?.(r.name)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(r.name);
                }
              }}
              onPointerMove={() =>
                setTooltipData({
                  point: r,
                  index: i,
                  x: center,
                  yPositions: {
                    value: yScale(r.value),
                    meta: yScale(r.meta || 0),
                  },
                })
              }
              onPointerLeave={() => setTooltipData(null)}
            >
              <title>
                {label(r.name)}: {format(r.value)}
              </title>
            </rect>
          </g>
        );
      })}
    </g>
  );
}
AxisAndSelection.displayName = "ChartInteractionOverlay";
AxisAndSelection.__isPostOverlay = true;

export default function BklitChart({
  data,
  type,
  color,
  metric,
  onSelect,
  compare,
  format,
  options = {},
  metaDiaria = 0,
}) {
  const reduce = useReducedMotion(),
    [hover, setHover] = useState(null);
  // Linha tracejada da meta diária (gráfico por data): entra como série para a escala incluí-la.
  const comMetaDiaria = metaDiaria > 0 && type !== "bar" && type !== "pie" && type !== "donut";
  const points = useMemo(
    () =>
      data.map((r, i) => ({ ...r, date: new Date(Date.UTC(2000, 0, 1 + i)), ...(comMetaDiaria ? { metaDia: metaDiaria } : {}) })),
    [data, comMetaDiaria, metaDiaria],
  );
  const palette = [
    color,
    "#8979fe",
    "#3cc3e0",
    "#40a98a",
    "#e8b66c",
    "#748396",
  ];
  const duration = reduce ? 0 : 450;
  const pieRef = useRef(null),
    [pieSize, setPieSize] = useState(160);
  useEffect(() => {
    if (!pieRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setPieSize(Math.min(entry.contentRect.width, entry.contentRect.height)),
    );
    observer.observe(pieRef.current);
    return () => observer.disconnect();
  }, [type]);
  const isPie = type === "pie" || type === "donut";
  const pieTotal=data.reduce((sum,row)=>sum+row.value,0)
  const Frame =
    type === "bar" ? BarChart : type === "area" ? AreaChart : LineChart;
  const Series = type === "bar" ? Bar : type === "area" ? Area : Line;
  const seriesProps =
    type === "bar" ? { fill: color } : { stroke: color, strokeWidth: 2.5 };
  return (
    <div
      className="bklit-chart"
      data-chart-engine="bklit"
      style={{ "--chart-line-primary": color }}
    >
      {isPie ? (
        <>
          <div
            ref={pieRef}
            className="bklit-plot bklit-pie"
            onClick={() => {
              if (hover !== null) onSelect?.(data[hover]?.name);
            }}
          >
            <PieChart
              data={data.map((r, i) => ({
                label: r.name,
                value: r.value,
                color: palette[i % palette.length],
              }))}
              innerRadius={
                type === "donut" ? Math.max(0, pieSize / 2 - 10) * 0.58 : 0
              }
              padAngle={0.025}
              cornerRadius={4}
              className="bklit-frame"
              onHoverChange={setHover}
              hoveredIndex={hover}
              enterTransition={{ duration: duration / 1000 }}
              enterStaggerScale={reduce ? 0 : 1}
            >
              {data.map((r, i) => (
                <PieSlice
                  key={r.name}
                  index={i}
                  animate={!reduce}
                  showGlow={false}
                />
              ))}
            </PieChart>
            {options.tooltip !== false && hover !== null && data[hover] && (
              <div className="bklit-pie-value">
                {label(data[hover].name)} · {format(data[hover].value)}
              </div>
            )}
          </div>
          <div className="bklit-legend" hidden={options.legend === false}>
            {data.map((r, i) => (
              <button
                key={r.name}
                onClick={() => onSelect?.(r.name)}
                title={`${r.name}: ${format(r.value)}`}
              >
                <i style={{ background: palette[i % palette.length] }} />
                <span>{r.name}</span><strong>{pieTotal>0?(r.value/pieTotal*100).toLocaleString('pt-BR',{maximumFractionDigits:1}):'0'}%</strong>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <Frame
            data={points}
            xDataKey={type === "bar" ? "name" : "date"}
            className="bklit-frame bklit-plot"
            animationDuration={duration}
            enterTransition={{ duration: duration / 1000 }}
            margin={{ top: 14, right: 24, bottom: 34, left: 50 }}
            yDomainTween={!reduce}
          >
            {options.grid !== false && <Grid horizontal vertical={false} />}
            <Series dataKey="value" {...seriesProps} animate={!reduce} />
            {comMetaDiaria && (
              <Series
                dataKey="metaDia"
                stroke="var(--text3)"
                {...(type === "area" ? { fill: "var(--text3)", fillOpacity: 0 } : {})}
                strokeWidth={1.5}
                dashFromIndex={0}
                dashArray="6,5"
                showHighlight={false}
                animate={!reduce}
              />
            )}
            {compare && (
              <Series
                dataKey="meta"
                stroke="#8979fe"
                fill={type === "bar" ? "#8979fe" : undefined}
                  fillOpacity={type === "area" ? 0 : 1}
                strokeWidth={2}
                animate={!reduce}
              />
            )}
            <AxisAndSelection
              data={points}
              onSelect={onSelect}
              format={format}
            />
            {options.tooltip !== false && (
              <FloatingChartTooltip format={format} compare={compare} label={label}/>
            )}
          </Frame>
          {/* Legenda e "Ver valores" ficam desligados por padrão (visual mais limpo); dá para ligar no editor do bloco. */}
          <div className="bklit-legend" hidden={options.legend !== true}>
            <span>
              <i style={{ background: color }} />
              Realizado
            </span>
            {compare && (
              <span>
                <i style={{ background: "#8979fe" }} />
                Meta
              </span>
            )}
          </div>
        </>
      )}
      <details className="bklit-accessible" hidden={options.values !== true}>
        <summary>Ver valores</summary>
        {data.map((r) => (
          <button key={r.name} onClick={() => onSelect?.(r.name)}>
            {label(r.name)}: {format(r.value)}
            {compare ? ` · Meta: ${format(r.meta || 0)}` : ""}
          </button>
        ))}
      </details>
    </div>
  );
}
