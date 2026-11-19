import { useId } from "react";

// Gráfico de área do card duplo: últimos 30 dias, curva suave com degradê na cor do canal.
// SVG puro (sem biblioteca de gráficos) para o card continuar leve.
const compacto = (n) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
const diaMes = (d) => String(d).slice(8, 10) + "/" + String(d).slice(5, 7);

function curva(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1] || pts[i], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], [x3, y3] = pts[i + 2] || pts[i + 1];
    // Catmull-Rom → Bézier, com os controles presos entre os pontos (sem "ondas" abaixo de zero).
    const c1y = Math.min(Math.max(y1 + (y2 - y0) / 6, Math.min(y1, y2)), Math.max(y1, y2));
    const c2y = Math.min(Math.max(y2 - (y3 - y1) / 6, Math.min(y1, y2)), Math.max(y1, y2));
    d += ` C${x1 + (x2 - x0) / 6},${c1y} ${x2 - (x3 - x1) / 6},${c2y} ${x2},${y2}`;
  }
  return d;
}

export default function KpiArea({ data, cor, formatar = compacto }) {
  const id = useId().replace(/:/g, "");
  const serie = data.filter((p) => p.name && p.name !== "Sem data").slice(-30);
  if (serie.length < 2) return <div className="bi-kpi-area bi-kpi-area-vazia">Sem dias suficientes para o gráfico</div>;
  const valores = serie.map((p) => Math.max(0, p.value));
  const max = Math.max(...valores, 1);
  const L = 100, A = 60;
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * L, A - (v / max) * (A - 4) - 2]);
  const linha = curva(pts);
  const ultimo = pts.at(-1);
  return (
    <figure className="bi-kpi-area" aria-label={`Últimos ${serie.length} dias, máximo ${formatar(max)} em um dia`}>
      <span className="bi-kpi-area-max">{formatar(max)}</span>
      <div className="bi-kpi-area-plot">
      <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity=".38" />
            <stop offset="100%" stopColor={cor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={L} y1={A * f} y2={A * f} className="bi-kpi-area-grade" vectorEffect="non-scaling-stroke" />)}
        <path d={`${linha} L${L},${A} L0,${A} Z`} fill={`url(#g${id})`} />
        <path d={linha} fill="none" stroke={cor} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <i className="bi-kpi-area-ponto" style={{ left: `${ultimo[0]}%`, top: `${(ultimo[1] / A) * 100}%`, background: cor }} />
      </div>
      <figcaption><span>{diaMes(serie[0].name)}</span><span>{diaMes(serie.at(-1).name)}</span></figcaption>
    </figure>
  );
}
