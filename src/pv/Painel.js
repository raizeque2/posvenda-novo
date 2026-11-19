import * as e from "./jsx.js";
import React from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { norm } from "../utils/normalizacao.js";
import { iniciais, moeda, listarSupervisores, useEscopoGestao } from "./org.js";
import PainelEquipe from "./PainelEquipe.jsx";

const ordenar = lista => [...lista].sort((a, b) => b.venda - a.venda);
const total = lista => lista.reduce((s, p) => s + p.venda, 0);

function Kpis({ itens }) {
  return e.jsx("div", { className: "conf-kpis", children: itens.map(([rotulo, valor, sub]) => e.jsxs("div", { className: "kpi-card", children: [
    e.jsx("div", { className: "kpi-label", children: rotulo }),
    e.jsx("div", { className: "kpi-value", children: valor }),
    sub && e.jsx("div", { className: "kpi-sub", children: sub }),
  ] }, rotulo)) });
}

function Ranking({ titulo, pessoas, destaque }) {
  const lista = ordenar(pessoas).filter(p => p.venda > 0 || norm(p.colaborador) === destaque);
  const lider = lista[0]?.venda || 1;
  return e.jsxs("section", { className: "bi-ranking", children: [
    e.jsx("div", { className: "bi-ranking-head", children: e.jsx("h2", { children: titulo }) }),
    !lista.length && e.jsx("p", { className: "page-sub", children: "Sem vendas neste mês." }),
    e.jsx("ol", { className: "bi-ranking-list", children: lista.map((p, i) => e.jsxs("li", { className: norm(p.colaborador) === destaque ? "is-voce" : undefined, children: [
      e.jsx("span", { className: "bi-rank-pos", children: i + 1 }),
      e.jsx("span", { className: "bi-avatar sm", children: iniciais(p.colaborador) }),
      e.jsxs("div", { className: "bi-rank-info", children: [
        e.jsx("strong", { title: p.colaborador, children: p.colaborador }),
        e.jsx("span", { className: "bi-rank-bar", children: e.jsx("i", { style: { width: `${p.venda / lider * 100}%` } }) }),
      ] }),
      e.jsx("div", { className: "bi-rank-valor", children: e.jsx("b", { children: moeda(p.venda) }) }),
    ] }, `${p.colaborador}|${p.supervisor}`)) }),
  ] });
}

function VisaoColaborador({ nome, pessoas }) {
  const eu = norm(nome);
  const lista = ordenar(pessoas);
  const pos = lista.findIndex(p => norm(p.colaborador) === eu);
  if (pos < 0) return e.jsx("p", { className: "page-sub", children: "Seu nome não está no cadastro deste mês." });
  const acima = lista[pos - 1];
  return e.jsxs(e.Fragment, { children: [
    e.jsx(Kpis, { itens: [
      ["Sua posição", `${pos + 1}º`, `de ${lista.length} pessoas`],
      ["Suas vendas", moeda(lista[pos].venda)],
      ["Para subir", acima ? moeda(acima.venda - lista[pos].venda + 1) : "Você lidera", acima ? `passar ${acima.colaborador}` : undefined],
    ] }),
    e.jsx(Ranking, { titulo: "Competição geral", pessoas, destaque: eu }),
  ] });
}

export default function Painel() {
  const { role, nome } = useAuth();
  // O organograma chega do servidor depois do primeiro render: o recorte acompanha (antes era lido uma vez só).
  const { mes, pessoas, atribuicoes, supervisores: doCargo } = useEscopoGestao(role, nome);
  const supervisores = role === "admin" ? doCargo : listarSupervisores(pessoas);
  const titulos = { admin: "Visão geral", coordenador: "Minha coordenação", supervisor: "Minha equipe", operacional: "Meu painel" };
  const meusSupervisores = doCargo;
  return e.jsxs("div", { className: "page conf-page", children: [
    e.jsxs("header", { className: "page-header", children: [
      e.jsx("h1", { className: "page-title", children: titulos[role] || "Meu painel" }),
      e.jsx("p", { className: "page-sub", children: `${nome || ""} · ${mes}` }),
    ] }),
    role === "admin" && e.jsx(PainelEquipe, { mes, supervisores, atribuicoes, titulo: "Todas as pessoas" }),
    role === "coordenador" && (meusSupervisores.length
      ? e.jsx(PainelEquipe, { mes, supervisores: meusSupervisores, atribuicoes, titulo: "Pessoas da coordenação" })
      : e.jsx("p", { className: "page-sub", children: "Nenhum supervisor vinculado a você no organograma." })),
    role === "supervisor" && e.jsx(PainelEquipe, { mes, supervisores: supervisores.filter(s => norm(s) === norm(nome)), atribuicoes, titulo: "Minha equipe", mostrarSupervisores: false }),
    role === "operacional" && e.jsx(VisaoColaborador, { nome, pessoas }),
  ] });
}
