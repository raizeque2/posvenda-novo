import { useState } from "react";

// Colunas arredondadas com o valor em cima: a maior (ou a que está sob o mouse/dedo) fica na
// cor cheia, as demais num tom escuro da mesma cor. Meta diária vira uma linha tracejada.
const curto = (n) => {
  const a = Math.abs(n);
  const f = (v, s) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 })}${s}`;
  return a >= 1e6 ? f(n / 1e6, "M") : a >= 1e3 ? f(n / 1e3, "k") : String(Math.round(n));
};
const rotulo = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? String(s).slice(8) : String(s));

export default function Colunas({ data, color, format, onSelect, metaDiaria = 0 }) {
  const [ativo, setAtivo] = useState(null);
  const teto = Math.max(metaDiaria, ...data.map((r) => r.value), 1);
  const maior = data.reduce((m, r, i) => (r.value > data[m].value ? i : m), 0);
  const destaque = ativo ?? maior;
  return (
    <div className={`bi-colunas${data.length > 10 ? " is-densa" : ""}`} style={{ "--col-cor": color }} onMouseLeave={() => setAtivo(null)}>
      <div className="bi-colunas-area">
        {metaDiaria > 0 && (
          <div className="bi-colunas-meta" style={{ bottom: `${(metaDiaria / teto) * 100}%` }} title={`Meta diária: ${format(metaDiaria)}`}>
            <span>Meta/dia {curto(metaDiaria)}</span>
          </div>
        )}
        {data.map((r, i) => (
          <button
            key={r.name}
            type="button"
            className={`bi-coluna${i === destaque ? " is-ativa" : ""}`}
            onMouseEnter={() => setAtivo(i)}
            onFocus={() => setAtivo(i)}
            onClick={() => onSelect?.(r.name)}
            aria-label={`${rotulo(r.name)}: ${format(r.value)}`}
            title={`${rotulo(r.name)}: ${format(r.value)}`}
          >
            <strong>{curto(r.value)}</strong>
            <i style={{ height: `${(Math.max(r.value, 0) / teto) * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="bi-colunas-eixo" aria-hidden="true">
        {data.map((r, i) => <span key={r.name} className={i === destaque ? "is-ativa" : ""}>{rotulo(r.name)}</span>)}
      </div>
    </div>
  );
}
