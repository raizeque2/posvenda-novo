import BklitChart from "./BklitChart.jsx";
import Colunas from "./Colunas.jsx";
export const money = (n) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);
export function Chart({
  data,
  type = "bar",
  color = "#cc0000",
  metric = "value",
  onSelect,
  compare = false,
  options = {},
  metaDiaria = 0,
}) {
  const fmt =
    metric === "value"
      ? money
      : (n) => new Intl.NumberFormat("pt-BR").format(n);
  if (!data.length)
    return (
      <div className="bi-empty">
        Sem dados para esta combinação.
        <small>Escolha outros campos ou confira o arquivo importado.</small>
      </div>
    );
  if (type === "grid" || type === "table")
    return (
      <div className={type === "grid" ? "bi-person-grid" : "bi-table"}>
        {data.map((r, i) => (
          <button key={r.name} onClick={() => onSelect?.(r.name)}>
            <span className="bi-avatar">{i + 1}</span>
            <span>
              <strong>{r.name}</strong>
              <small>
                {fmt(r.value)}
                {r.meta > 0 && options.meta !== false
                  ? ` / ${money(r.meta)} · ${Math.round((r.value / r.meta) * 100)}%`
                  : ""}
              </small>
              {r.meta > 0 && options.meta !== false && (
                <progress
                  max={r.meta}
                  value={Math.max(0, Math.min(r.value, r.meta))}
                />
              )}
            </span>
            {r.meta > 0 && options.meta !== false && (
              <em>
                {r.value >= r.meta
                  ? "Meta batida"
                  : `Faltam ${money(r.meta - r.value)}`}
              </em>
            )}
          </button>
        ))}
      </div>
    );
  if ((type === "pie" || type === "donut") && data.some((r) => r.value < 0))
    return (
      <div className="bi-negative-chart">
        <small>Receita negativa por devoluções: exibida em barras para preservar os valores.</small>
        <BklitChart data={data} type="bar" color={color} metric={metric} onSelect={onSelect} compare={compare} options={options} format={fmt}/>
      </div>
    );
  if (type === "colunas")
    return <Colunas data={data} color={color} format={fmt} onSelect={onSelect} metaDiaria={metaDiaria} />;
  if((type==='pie'||type==='donut')&&!data.some(r=>r.value>0))return <div className="bi-empty">Sem faturamento neste recorte.</div>
  return (
    <BklitChart
      data={type==='pie'||type==='donut'?data.filter(r=>r.value>0):data}
      type={type}
      color={color}
      metric={metric}
      onSelect={onSelect}
      compare={compare}
      options={options}
      format={fmt}
      metaDiaria={metaDiaria}
    />
  );
}
