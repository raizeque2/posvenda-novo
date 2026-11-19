import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp, Minus } from '../icons/iconoir';
import { kpiInsights } from "./kpiInsights.js";

export default function KpiInsight({ rows, history, channel, metric }) {
  const insights = useMemo(
    () => kpiInsights(rows, history, channel, metric),
    [rows, history, channel, metric],
  );
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (
      insights.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const timer = window.setInterval(
      () => setIndex((value) => value + 1),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [insights.length]);
  const item = insights[index % insights.length];
  if (!item)
    return (
      <span className="bi-kpi-insight neutral">
        Comparativo disponível com mais histórico
      </span>
    );
  const amount =
    metric === "value"
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(Math.abs(item.difference))
      : Math.abs(item.difference).toLocaleString("pt-BR");
  // Card enxuto: só o percentual (ou o valor, sem base de comparação) e o período curto.
  // A frase completa fica no title, ao passar o mouse.
  const number =
    item.percent == null
      ? amount
      : `${Math.abs(item.percent).toFixed(1).replace(".", ",")}%`;
  const periodo = item.label.startsWith("nos últimos 7") ? "7 dias" : item.label.startsWith("no mês") ? "mês" : "dia";
  const Icon =
    item.difference > 0
      ? TrendingUp
      : item.difference < 0
        ? TrendingDown
        : Minus;
  const curto = item.difference === 0 ? "Sem variação" : `${number} a ${item.difference > 0 ? "mais" : "menos"}`;
  const completo =
    item.difference === 0
      ? `Sem variação ${item.label}`
      : `${amount}${item.percent == null ? "" : ` (${Math.abs(item.percent).toFixed(1).replace(".", ",")}%)`} a ${item.difference > 0 ? "mais" : "menos"} ${item.label}`;
  return (
    <span
      className={`bi-kpi-insight ${item.difference > 0 ? "positive" : item.difference < 0 ? "negative" : "neutral"}`}
      title={completo}
      aria-label={completo}
    >
      <Icon size={13} aria-hidden="true" />
      <span key={index % insights.length}>{curto} <small className="bi-kpi-insight-periodo">· {periodo}</small></span>
    </span>
  );
}
