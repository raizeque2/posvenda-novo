import * as e from "./jsx.js";
import React from "react";

const PRAZO = 30;
const ATENCAO = 21;
const VALOR_ALTO = 2000;
const moeda = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

const col = (key, label, format) => ({ key, label, format });
const TIPOS = {
  requisicoes: {
    titulo: "Monitor de Requisições",
    sub: "Requisições de peças em aberto, prazo e supervisor",
    item: "requisições",
    busca: "Cliente ou nº da requisição…",
    valor: r => r.valor,
    valorLabel: "Valor em aberto",
    filtros: [
      ["Pendentes de liberação", r => r.situacao === "Pendente de liberação"],
      ["Devoluções", r => r.tipo === "Devolução"],
      ["Transferências", r => r.tipo === "Transferência"],
    ],
    colunas: [col("numero", "Requisição"), col("loja", "Loja"), col("dias", "Dias"), col("situacao", "Situação"), col("canal", "Canal"), col("tipo", "Tipo de movimento"), col("vendedor", "Vendedor"), col("supervisor", "Supervisor"), col("cliente", "Cliente"), col("emissao", "Emissão"), col("valor", "Valor", moeda)],
  },
  reservas: {
    titulo: "Monitor de Reservas",
    sub: "Peças reservadas: alocadas, faltantes e prazo",
    item: "reservas",
    busca: "Cliente, nº da reserva ou peça…",
    valor: r => r.alocado + r.faltante,
    valorLabel: "Valor reservado",
    filtros: [
      ["Fechadas (prontas)", r => r.situacao === "Fechada"],
      ["Aguardando peça", r => r.faltante > 0],
    ],
    colunas: [col("numero", "Reserva"), col("loja", "Loja"), col("dias", "Dias"), col("situacao", "Situação"), col("vendedor", "Vendedor"), col("supervisor", "Supervisor"), col("cliente", "Cliente"), col("pecas", "Peças"), col("alocado", "Alocado", moeda), col("faltante", "Faltante", moeda), col("emissao", "Emissão")],
  },
};

const FAIXAS = [["0–7", 0, 7], ["8–14", 8, 14], ["15–20", 15, 20], ["21–30", 21, 30], ["31+", 31, Infinity]];

export default function Conferencia({ tipo }) {
  const cfg = TIPOS[tipo];
  const [dados, setDados] = React.useState(null);
  const [erro, setErro] = React.useState("");
  const [filtro, setFiltro] = React.useState("Todas");
  const [busca, setBusca] = React.useState("");

  React.useEffect(() => {
    let ativo = true;
    setDados(null); setErro(""); setFiltro("Todas"); setBusca("");
    fetch(`/assets/dados/${tipo}/atual.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { if (ativo) setDados(d); })
      .catch(err => { if (ativo) setErro(err.message); });
    return () => { ativo = false; };
  }, [tipo]);

  const linhas = dados?.linhas ?? [];
  const chips = React.useMemo(() => [
    ["Todas", () => true],
    ["Fora do prazo", r => r.dias > PRAZO],
    ["Vencendo (atenção)", r => r.dias >= ATENCAO && r.dias <= PRAZO],
    ...cfg.filtros,
    [`Valor alto (≥ ${moeda(VALOR_ALTO)})`, r => cfg.valor(r) >= VALOR_ALTO],
  ], [cfg]);

  const visiveis = React.useMemo(() => {
    const teste = chips.find(c => c[0] === filtro)?.[1] ?? chips[0][1];
    const termo = busca.trim().toLowerCase();
    return linhas
      .filter(r => teste(r) && (!termo || `${r.numero} ${r.cliente} ${r.pecas ?? ""}`.toLowerCase().includes(termo)))
      .sort((a, b) => b.dias - a.dias);
  }, [linhas, chips, filtro, busca]);

  if (erro) return e.jsx("div", { className: "page", children: e.jsx("div", { className: "card", style: { padding: 24 }, children: `Não foi possível carregar ${cfg.item}: ${erro}` }) });
  if (!dados) return e.jsx("div", { className: "page", children: e.jsx("p", { className: "page-sub", children: "Carregando…" }) });

  const fora = linhas.filter(r => r.dias > PRAZO);
  const total = linhas.reduce((s, r) => s + cfg.valor(r), 0);
  const mediaDias = linhas.length ? Math.round(linhas.reduce((s, r) => s + r.dias, 0) / linhas.length) : 0;
  const pctFora = linhas.length ? fora.length / linhas.length * 100 : 0;
  const faixas = FAIXAS.map(([nome, min, max]) => ({ nome, n: linhas.filter(r => r.dias >= min && r.dias <= max).length }));
  const maiorFaixa = Math.max(1, ...faixas.map(f => f.n));
  const kpis = [
    [`Total de ${cfg.item}`, linhas.length.toLocaleString("pt-BR")],
    [cfg.valorLabel, moeda(total)],
    ["Fora do prazo", fora.length.toLocaleString("pt-BR"), `${pctFora.toFixed(0)}% do total`],
    ["Média de dias", mediaDias, "antiguidade média"],
  ];

  return e.jsxs("div", { className: "page conf-page", children: [
    e.jsxs("header", { className: "page-header", children: [
      e.jsx("h1", { className: "page-title", children: cfg.titulo }),
      e.jsx("p", { className: "page-sub", children: cfg.sub }),
    ] }),
    dados.exemplo && e.jsx("p", { className: "conf-aviso", role: "status", children: "Dados fictícios de exemplo. Falta conectar à base real." }),
    e.jsx("div", { className: "conf-kpis", children: kpis.map(([label, valor, sub]) => e.jsxs("div", { className: "kpi-card", children: [
      e.jsx("div", { className: "kpi-label", children: label }),
      e.jsx("div", { className: "kpi-value", children: valor }),
      sub && e.jsx("div", { className: "kpi-sub", children: sub }),
    ] }, label)) }),
    e.jsxs("section", { className: "card conf-curva", children: [
      e.jsx("h2", { className: "card-title", children: "Curva de envelhecimento" }),
      e.jsx("div", { className: "conf-barras", children: faixas.map(f => e.jsxs("div", { className: "conf-barra", children: [
        e.jsx("strong", { children: f.n }),
        e.jsx("span", { style: { height: `${f.n / maiorFaixa * 100}%` }, className: f.nome === "31+" ? "is-fora" : "" }),
        e.jsx("small", { children: `${f.nome} dias` }),
      ] }, f.nome)) }),
    ] }),
    e.jsx("div", { className: "conf-chips", children: chips.map(([nome, teste]) => e.jsxs("button", {
      type: "button", className: `btn btn-sm btn-ghost${nome === filtro ? " conf-chip-ativo" : ""}`, "aria-pressed": nome === filtro, onClick: () => setFiltro(nome),
      children: [nome, " · ", linhas.filter(teste).length],
    }, nome)) }),
    e.jsxs("section", { className: "card", children: [
      e.jsx("div", { className: "conf-busca", children: e.jsx("input", { className: "form-input", "aria-label": cfg.busca, placeholder: cfg.busca, value: busca, onChange: ev => setBusca(ev.target.value) }) }),
      e.jsx("div", { className: "table-wrap", children: e.jsxs("table", { children: [
        e.jsx("thead", { children: e.jsx("tr", { children: cfg.colunas.map(c => e.jsx("th", { children: c.label }, c.key)) }) }),
        e.jsx("tbody", { children: visiveis.map(r => e.jsx("tr", { children: cfg.colunas.map(c => e.jsx("td", {
          className: c.key === "dias" && r.dias > PRAZO ? "conf-fora" : undefined,
          children: c.format ? c.format(r[c.key]) : r[c.key],
        }, c.key)) }, r.numero)) }),
      ] }) }),
      !visiveis.length && e.jsx("p", { className: "page-sub", style: { padding: 24 }, children: "Nenhum registro neste filtro." }),
    ] }),
  ] });
}
