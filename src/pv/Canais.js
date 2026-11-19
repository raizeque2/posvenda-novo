import * as e from "./jsx.js";
import React from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import useStore from "../store.js";
import { moeda, iniciais } from "./org.js";

const CANAIS = [["VAREJO", "Varejo"], ["WEB", "Web"], ["TELEVENDAS", "Televendas"], ["ATACADO", "Atacado"]];
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CORES = ["#0d9488", "#f97316", "#3b82f6", "#7c3aed", "#f59e0b", "#a3a3a3"];
const POR_PAGINA = 5;
const DIA_MS = 864e5;
const numero = v => (typeof v === "number" ? v : Number(String(v ?? 0).replace(/\./g, "").replace(",", ".")) || 0);
const quantidade = r => numero(r.quantidade ?? r.Quantidade);
const peca = r => r.Mercadoria || r.mercadoria || "Sem descrição";
const ordemMes = m => m.split("/").reverse().join("");
const hora = r => (r.dt ? new Date(r.dt).getTime() : NaN);
const pct = v => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const Icone = ({ id, tamanho = 18 }) => e.jsx("svg", { width: tamanho, height: tamanho, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": "true", children: e.jsx("use", { href: `/icons/iconoir.svg#${id}` }) });

function agrupar(linhas, chave) {
  const mapa = new Map();
  for (const r of linhas) {
    const nome = chave(r);
    if (!nome) continue;
    const item = mapa.get(nome) || { nome, valor: 0, custo: 0, qtd: 0, vendas: 0 };
    item.valor += r.valor || 0;
    item.custo += r.custo || 0;
    item.qtd += quantidade(r);
    item.vendas += 1;
    mapa.set(nome, item);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

function resumo(linhas) {
  const receita = linhas.reduce((s, r) => s + (r.valor || 0), 0);
  const custo = linhas.reduce((s, r) => s + (r.custo || 0), 0);
  return { receita, custo, margem: receita - custo, vendas: linhas.length, pecas: linhas.reduce((s, r) => s + quantidade(r), 0), ticket: linhas.length ? receita / linhas.length : 0 };
}

// Semanas fixas do mês: 01–07, 08–14, 15–21, 22–28 e o restante
function semanasDe(mes) {
  const [m, a] = mes.split("/").map(Number);
  if (!m) return [];
  const ultimo = new Date(a, m, 0).getDate();
  const lista = [];
  for (let d = 1; d <= ultimo; d += 7) lista.push({ id: `s${lista.length}`, rotulo: `${String(d).padStart(2, "0")}–${String(Math.min(d + 6, ultimo)).padStart(2, "0")}`, ini: new Date(a, m - 1, d).getTime(), fim: new Date(a, m - 1, Math.min(d + 6, ultimo), 23, 59, 59).getTime() });
  return lista;
}

function Rosca({ itens }) {
  const total = itens.reduce((s, i) => s + Math.max(0, i.valor), 0) || 1;
  const partes = [...itens.slice(0, 5), ...(itens.length > 5 ? [{ nome: "Outras", valor: itens.slice(5).reduce((s, i) => s + i.valor, 0) }] : [])];
  let acumulado = 0;
  const raio = 15.9;
  return e.jsxs("div", { className: "can-rosca", children: [
    e.jsx("svg", { viewBox: "0 0 42 42", "aria-hidden": "true", children: partes.map((p, i) => {
      const fatia = Math.max(0, p.valor) / total * 100;
      const circulo = e.jsx("circle", { cx: 21, cy: 21, r: raio, fill: "none", stroke: CORES[i % CORES.length], strokeWidth: 5, strokeDasharray: `${fatia} ${100 - fatia}`, strokeDashoffset: 25 - acumulado }, p.nome);
      acumulado += fatia;
      return circulo;
    }) }),
    e.jsx("ul", { children: partes.map((p, i) => e.jsxs("li", { children: [e.jsx("i", { style: { background: CORES[i % CORES.length] } }), e.jsx("span", { children: p.nome }), e.jsx("b", { children: pct(Math.max(0, p.valor) / total * 100) })] }, p.nome)) }),
  ] });
}

function Tile({ id, icone, rotulo, valor, atual, anterior, cor, formato, comparando, onComparar, modo, setModo, podeSemana }) {
  const delta = anterior > 0 ? (atual - anterior) / anterior * 100 : null;
  return e.jsxs("article", { className: "can-tile", children: [
    e.jsxs("header", { children: [
      e.jsx("i", { style: { background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor }, children: e.jsx(Icone, { id: icone }) }),
      delta !== null && e.jsxs("button", { type: "button", className: delta >= 0 ? "sobe" : "desce", title: `Antes: ${formato(anterior)}`, "aria-expanded": comparando, onClick: () => onComparar(comparando ? null : id), children: [delta >= 0 ? "+" : "", delta.toFixed(0), "% ", delta >= 0 ? "↑" : "↓"] }),
    ] }),
    e.jsx("strong", { children: valor }),
    e.jsx("small", { children: rotulo }),
    comparando && e.jsxs("div", { className: "can-comparar", children: [
      e.jsxs("div", { className: "pv-grafico-modo", role: "group", "aria-label": "Comparar com", children: [
        e.jsx("button", { type: "button", disabled: !podeSemana, title: podeSemana ? undefined : "Escolha uma semana no gráfico", className: modo === "semana" ? "is-ativo" : "", onClick: () => setModo("semana"), children: "Semana passada" }),
        e.jsx("button", { type: "button", className: modo === "mes" ? "is-ativo" : "", onClick: () => setModo("mes"), children: "Mês passado" }),
      ] }),
      e.jsxs("p", { children: [e.jsx("span", { children: "Agora" }), e.jsx("b", { children: formato(atual) })] }),
      e.jsxs("p", { children: [e.jsx("span", { children: "Antes" }), e.jsx("b", { children: formato(anterior) })] }),
      e.jsxs("p", { children: [e.jsx("span", { children: "Diferença" }), e.jsx("b", { children: formato(atual - anterior) })] }),
    ] }),
  ] });
}

function Lista({ titulo, sub, icone, itens, valor, onItem, onVerTudo, children }) {
  const topo = itens[0]?.valor || 1;
  return e.jsxs("section", { className: "card can-bloco", children: [
    e.jsxs("header", { children: [e.jsx("i", { children: e.jsx(Icone, { id: icone }) }), e.jsxs("div", { children: [e.jsx("h2", { children: titulo }), e.jsx("p", { children: sub })] })] }),
    children,
    e.jsx("ol", { children: itens.slice(0, 5).map(i => e.jsx("li", { children: e.jsxs("button", { type: "button", onClick: () => onItem(i), children: [
      e.jsx("span", { className: "bi-avatar sm", children: iniciais(i.nome) }),
      e.jsxs("div", { children: [e.jsx("strong", { title: i.nome, children: i.nome }), e.jsx("span", { className: "bi-rank-bar", children: e.jsx("i", { style: { width: `${Math.max(0, i.valor / topo * 100)}%` } }) })] }),
      e.jsx("b", { children: valor(i) }),
    ] }) }, i.nome)) }),
    e.jsx("button", { type: "button", className: "btn btn-ghost btn-sm", onClick: onVerTudo, children: "Ver lista completa" }),
  ] });
}

function Painel({ titulo, sub, onFechar, children }) {
  React.useEffect(() => {
    const tecla = ev => { ev.key === "Escape" && onFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);
  return ReactDOM.createPortal(e.jsx("div", { className: "pv-drawer-fundo", onMouseDown: ev => { ev.target === ev.currentTarget && onFechar(); }, children: e.jsxs("aside", { className: "pv-drawer can-painel", role: "dialog", "aria-modal": "true", "aria-label": titulo, children: [
    e.jsxs("header", { children: [e.jsxs("div", { children: [e.jsx("h2", { children: titulo }), sub && e.jsx("small", { children: sub })] }), e.jsx("button", { type: "button", autoFocus: true, "aria-label": "Fechar", onClick: onFechar, children: "×" })] }),
    children,
  ] }) }), document.body);
}

function ListaCompleta({ tipo, itens, total, onItem, onFechar }) {
  const [ordem, setOrdem] = React.useState("mais");
  const [busca, setBusca] = React.useState("");
  const termo = busca.trim().toUpperCase();
  const lista = (ordem === "mais" ? itens : [...itens].reverse()).filter(i => !termo || i.nome.toUpperCase().includes(termo));
  return e.jsxs(Painel, { titulo: tipo.titulo, sub: `${itens.length} no período`, onFechar, children: [
    e.jsxs("div", { className: "pv-grafico-modo", role: "group", "aria-label": "Ordenar", children: [
      e.jsx("button", { type: "button", className: ordem === "mais" ? "is-ativo" : "", onClick: () => setOrdem("mais"), children: "Mais vendidos" }),
      e.jsx("button", { type: "button", className: ordem === "menos" ? "is-ativo" : "", onClick: () => setOrdem("menos"), children: "Menos vendidos" }),
    ] }),
    e.jsx("input", { className: "form-input", "aria-label": "Buscar", placeholder: "Buscar", value: busca, onChange: ev => setBusca(ev.target.value) }),
    e.jsx("ol", { className: "can-completa", children: lista.map(i => e.jsx("li", { children: e.jsxs("button", { type: "button", onClick: () => onItem(i), children: [
      e.jsx("strong", { title: i.nome, children: i.nome }),
      e.jsx("small", { children: `${i.vendas} vendas · ${pct(total ? i.valor / total * 100 : 0)} do total` }),
      e.jsx("b", { children: moeda(i.valor) }),
    ] }) }, i.nome)) }),
  ] });
}

function DetalheItem({ item, tipo, linhas, totalCanal, onFechar, onVendedor, onLoja }) {
  const minhas = linhas.filter(tipo === "peca" ? r => peca(r) === item.nome : r => r.empresa === item.nome);
  const r = resumo(minhas);
  const aproveitamento = r.receita ? r.margem / r.receita * 100 : 0;
  const lojas = agrupar(minhas, x => x.empresa);
  const vendedores = agrupar(minhas, x => x.responsavel);
  const pecas = agrupar(minhas, peca);
  const bloco = (titulo, itens, clique) => e.jsxs("section", { children: [e.jsx("h3", { children: titulo }), e.jsx("ol", { className: "can-completa", children: itens.slice(0, 6).map(i => e.jsx("li", { children: e.jsxs("button", { type: "button", onClick: () => clique?.(i), children: [e.jsx("strong", { title: i.nome, children: i.nome }), e.jsx("small", { children: pct(r.receita ? i.valor / r.receita * 100 : 0) }), e.jsx("b", { children: moeda(i.valor) })] }) }, i.nome)) })] });
  return e.jsxs(Painel, { titulo: item.nome, sub: tipo === "peca" ? "Peça" : "Loja", onFechar, children: [
    e.jsxs("div", { className: "can-resumo", children: [
      [["Receita", moeda(r.receita)], ["Vendas", r.vendas.toLocaleString("pt-BR")], ["Aproveitamento", pct(aproveitamento)], ["Do canal", pct(totalCanal ? r.receita / totalCanal * 100 : 0)]].map(([t, v]) => e.jsxs("article", { children: [e.jsx("small", { children: t }), e.jsx("strong", { children: v })] }, t)),
    ] }),
    e.jsx("p", { className: "can-nota", children: "Aproveitamento é a margem sobre a receita." }),
    tipo === "peca" && bloco("Onde mais vende", lojas, onLoja),
    bloco("Quem mais vende", vendedores, onVendedor),
    tipo === "loja" && bloco("O que mais vende", pecas),
  ] });
}

export default function Canais() {
  const pecasPorMes = useStore(s => s.pecasPorMes);
  const filtroMes = useStore(s => s.filtrosGlobais.mes);
  const ir = useNavigate();
  const meses = React.useMemo(() => Object.keys(pecasPorMes).filter(m => pecasPorMes[m]?.length).sort((a, b) => ordemMes(a).localeCompare(ordemMes(b))), [pecasPorMes]);
  const [canal, setCanal] = React.useState("VAREJO");
  const [mesEscolhido, setMes] = React.useState("");
  const [semana, setSemana] = React.useState("");
  const [modo, setModo] = React.useState("mes");
  const [comparando, setComparando] = React.useState(null);
  const [lista, setLista] = React.useState(null);
  const [detalhe, setDetalhe] = React.useState(null);
  const [busca, setBusca] = React.useState("");
  const [pagina, setPagina] = React.useState(0);
  const mes = mesEscolhido || (meses.includes(filtroMes) ? filtroMes : meses.at(-1)) || "";
  const semanas = React.useMemo(() => semanasDe(mes), [mes]);
  const semanaAtual = semanas.find(s => s.id === semana);
  const modoEfetivo = semanaAtual ? modo : "mes";

  const dados = React.useMemo(() => {
    const todas = Object.values(pecasPorMes).flat().filter(r => r.cat === canal);
    const doMes = (pecasPorMes[mes] || []).filter(r => r.cat === canal);
    const linhas = semanaAtual ? doMes.filter(r => hora(r) >= semanaAtual.ini && hora(r) <= semanaAtual.fim) : doMes;
    let antes;
    if (semanaAtual && modoEfetivo === "semana") antes = todas.filter(r => hora(r) >= semanaAtual.ini - 7 * DIA_MS && hora(r) <= semanaAtual.fim - 7 * DIA_MS);
    else {
      const anterior = meses[meses.indexOf(mes) - 1];
      const base = (pecasPorMes[anterior] || []).filter(r => r.cat === canal);
      const dia = r => new Date(r.dt).getDate();
      const de = semanaAtual ? new Date(semanaAtual.ini).getDate() : 1;
      const ate = semanaAtual ? new Date(semanaAtual.fim).getDate() : 31;
      antes = base.filter(r => r.dt && dia(r) >= de && dia(r) <= ate);
    }
    const dias = DIAS.map(() => 0);
    for (const r of linhas) if (r.dt) dias[new Date(r.dt).getDay()] += r.valor || 0;
    return { linhas, atual: resumo(linhas), antes: resumo(antes), dias, vendedores: agrupar(linhas, r => r.responsavel), lojas: agrupar(linhas, r => r.empresa), pecas: agrupar(linhas, peca) };
  }, [pecasPorMes, meses, mes, canal, semanaAtual, modoEfetivo]);

  const { linhas, atual, antes, dias, vendedores, lojas, pecas } = dados;
  const maiorDia = Math.max(1, ...dias);
  const melhorDia = dias.indexOf(Math.max(...dias));
  const termo = busca.trim().toUpperCase();
  const filtradas = pecas.filter(p => !termo || p.nome.toUpperCase().includes(termo));
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const atualPagina = Math.min(pagina, paginas - 1);
  const inicio = atualPagina * POR_PAGINA;
  const verVendedor = i => ir(`/conta/${encodeURIComponent(i.nome)}`);
  const abrir = (tipo, item) => { setLista(null); setDetalhe({ tipo, item }); };
  const LISTAS = {
    vendedores: { titulo: "Vendedores", itens: vendedores, clique: verVendedor },
    lojas: { titulo: "Lojas", itens: lojas, clique: i => abrir("loja", i) },
    pecas: { titulo: "Peças", itens: pecas, clique: i => abrir("peca", i) },
  };
  const inteiro = v => Math.round(v).toLocaleString("pt-BR");
  const tiles = [
    ["receita", "percentage-circle", "Receita líquida", moeda, "#0d9488"],
    ["vendas", "shopping-bag", "Vendas", inteiro, "#f97316"],
    ["ticket", "label", "Ticket médio", moeda, "#3b82f6"],
    ["pecas", "packages", "Peças vendidas", inteiro, "#7c3aed"],
  ];
  const mini = [["Receita", atual.receita, 100, "#0d9488"], ["Margem", atual.margem, atual.receita ? atual.margem / atual.receita * 100 : 0, "var(--green)"], ["Custo", atual.custo, atual.receita ? atual.custo / atual.receita * 100 : 0, "var(--red)"]];

  return e.jsxs("div", { className: "page can-page", children: [
    e.jsxs("header", { className: "can-topo", children: [
      e.jsxs("div", { children: [e.jsx("h1", { className: "page-title", children: "Canais de venda" }), e.jsx("p", { className: "page-sub", children: `Visão detalhada de ${semanaAtual ? `${semanaAtual.rotulo} de ` : ""}${mes}` })] }),
      e.jsx("select", { className: "form-input", "aria-label": "Mês", value: mes, onChange: ev => { setMes(ev.target.value); setSemana(""); }, children: meses.map(m => e.jsx("option", { value: m, children: m }, m)) }),
    ] }),
    e.jsx("div", { className: "tab-nav", children: CANAIS.map(([id, rotulo]) => e.jsx("button", { type: "button", className: `tab-btn${canal === id ? " active" : ""}`, onClick: () => { setCanal(id); setPagina(0); setBusca(""); }, children: rotulo }, id)) }),
    e.jsxs("div", { className: "can-linha", children: [
      e.jsx("div", { className: "can-tiles", children: tiles.map(([id, icone, rotulo, formato, cor]) => e.jsx(Tile, { id, icone, rotulo, formato, cor, valor: formato(atual[id]), atual: atual[id], anterior: antes[id], comparando: comparando === id, onComparar: setComparando, modo: modoEfetivo, setModo, podeSemana: !!semanaAtual }, id)) }),
      e.jsxs("section", { className: "card can-insight", children: [
        e.jsxs("header", { children: [
          e.jsxs("div", { children: [e.jsx("h2", { children: "Vendas por dia da semana" }), e.jsx("p", { children: `Melhor dia: ${DIAS[melhorDia]}` })] }),
          e.jsxs("select", { className: "form-input", "aria-label": "Período do gráfico", value: semana, onChange: ev => { setSemana(ev.target.value); setPagina(0); }, children: [e.jsx("option", { value: "", children: "Mês inteiro" }), semanas.map(s => e.jsx("option", { value: s.id, children: `Semana ${s.rotulo}` }, s.id))] }),
        ] }),
        e.jsxs("div", { className: "can-grafico", children: [
          e.jsx("strong", { children: moeda(atual.receita) }),
          e.jsx("div", { className: "can-barras", children: dias.map((v, i) => e.jsxs("div", { title: `${DIAS[i]}: ${moeda(v)}`, children: [e.jsx("i", { className: i === melhorDia ? "is-topo" : "", style: { height: `${Math.max(3, v / maiorDia * 100)}%` } }), e.jsx("small", { children: DIAS[i] })] }, i)) }),
        ] }),
        e.jsx("div", { className: "can-mini", children: mini.map(([rotulo, valor, parte, cor]) => e.jsxs("div", { children: [e.jsx("small", { children: rotulo }), e.jsx("strong", { style: { color: rotulo === "Receita" ? undefined : cor }, children: moeda(valor) }), e.jsx("span", { className: "bi-rank-bar", children: e.jsx("i", { style: { width: `${Math.min(100, Math.max(0, parte))}%`, background: cor } }) })] }, rotulo)) }),
      ] }),
    ] }),
    e.jsxs("div", { className: "can-tres", children: [
      e.jsx(Lista, { titulo: "Melhores vendedores", icone: "trophy", sub: `${vendedores.length} pessoas venderam`, itens: vendedores, valor: i => moeda(i.valor), onItem: verVendedor, onVerTudo: () => setLista("vendedores") }),
      e.jsx(Lista, { titulo: "Lojas", icone: "building", sub: `${lojas.length} lojas no canal`, itens: lojas, valor: i => moeda(i.valor), onItem: i => abrir("loja", i), onVerTudo: () => setLista("lojas"), children: e.jsx(Rosca, { itens: lojas }) }),
      e.jsx(Lista, { titulo: "Peças populares", icone: "box", sub: "Por receita no período", itens: pecas, valor: i => `${inteiro(i.qtd)} un.`, onItem: i => abrir("peca", i), onVerTudo: () => setLista("pecas") }),
    ] }),
    e.jsxs("section", { className: "card can-tabela", children: [
      e.jsx("div", { className: "pv-equipe-barra", children: e.jsx("input", { className: "form-input", "aria-label": "Buscar peça", placeholder: "Buscar peça", value: busca, onChange: ev => { setBusca(ev.target.value); setPagina(0); } }) }),
      e.jsx("div", { className: "table-wrap", children: e.jsxs("table", { children: [
        e.jsx("thead", { children: e.jsx("tr", { children: ["Peça", "Vendas", "Quantidade", "Receita", "Aproveitamento"].map(c => e.jsx("th", { children: c }, c)) }) }),
        e.jsx("tbody", { children: filtradas.slice(inicio, inicio + POR_PAGINA).map(p => e.jsxs("tr", { className: "can-linha-clique", onClick: () => abrir("peca", p), children: [e.jsx("td", { children: e.jsx("button", { type: "button", className: "can-link", children: p.nome }) }), e.jsx("td", { children: p.vendas }), e.jsx("td", { children: inteiro(p.qtd) }), e.jsx("td", { children: moeda(p.valor) }), e.jsx("td", { children: pct(p.valor ? (p.valor - p.custo) / p.valor * 100 : 0) })] }, p.nome)) }),
      ] }) }),
      e.jsxs("div", { className: "pv-equipe-rodape", children: [
        e.jsx("span", { children: filtradas.length ? `Mostrando ${inicio + 1} a ${Math.min(inicio + POR_PAGINA, filtradas.length)} de ${filtradas.length}` : "Nenhuma peça" }),
        e.jsxs("div", { children: [
          e.jsx("button", { type: "button", className: "btn btn-ghost btn-xs", disabled: atualPagina === 0, onClick: () => setPagina(atualPagina - 1), children: "Anterior" }),
          e.jsx("b", { children: `${atualPagina + 1} / ${paginas}` }),
          e.jsx("button", { type: "button", className: "btn btn-ghost btn-xs", disabled: atualPagina >= paginas - 1, onClick: () => setPagina(atualPagina + 1), children: "Próxima" }),
        ] }),
      ] }),
    ] }),
    lista && e.jsx(ListaCompleta, { tipo: LISTAS[lista], itens: LISTAS[lista].itens, total: atual.receita, onItem: LISTAS[lista].clique, onFechar: () => setLista(null) }),
    detalhe && e.jsx(DetalheItem, { ...detalhe, linhas, totalCanal: atual.receita, onFechar: () => setDetalhe(null), onVendedor: verVendedor, onLoja: i => setDetalhe({ tipo: "loja", item: i }) }),
  ] });
}
