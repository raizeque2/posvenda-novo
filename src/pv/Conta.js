import * as e from "./jsx.js";
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { norm } from "../utils/normalizacao.js";
import { Foto, salvarFoto, moeda, ufDe, useEquipeDoMes, useMudancasOrg, lerSolicitacoes, tempoAtras, textoSolicitacao } from "./org.js";

const CARGOS = { admin: "Administrador", coordenador: "Coordenador", supervisor: "Supervisor", operacional: "Colaborador" };

// Reduz para 256 px antes de guardar: a foto original pode ter vários MB
function reduzirFoto(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const lado = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      canvas.getContext("2d").drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir esta imagem.")); };
    img.src = url;
  });
}

const Linha = ({ rotulo, valor }) => e.jsxs("p", { className: "conta-linha", children: [e.jsx("b", { children: `${rotulo}:` }), " ", valor || "–"] });

export default function Conta() {
  const { nome: proprio, role, user } = useAuth();
  const { nome: param } = useParams();
  const ir = useNavigate();
  const nome = param ? decodeURIComponent(param) : proprio || user?.displayName || "";
  const { mes, pessoas, atribuicoes } = useEquipeDoMes();
  useMudancasOrg();
  const [aba, setAba] = React.useState("perfil");
  const [erro, setErro] = React.useState("");
  const entrada = React.useRef(null);

  const eu = pessoas.find(p => norm(p.colaborador) === norm(nome));
  const ranking = [...pessoas].sort((a, b) => b.venda - a.venda);
  const posicao = ranking.findIndex(p => norm(p.colaborador) === norm(nome));
  const equipe = atribuicoes.filter(a => norm(a.supervisor) === norm(nome));
  const responsaveis = atribuicoes.filter(a => norm(a.colaborador) === norm(nome)).map(a => a.supervisor);
  const atividades = lerSolicitacoes().filter(s => norm(s.por) === norm(nome) || norm(s.pessoa) === norm(nome)).reverse().slice(0, 6);
  // O servidor confere de novo: a própria foto, ou a de alguém da equipe de quem edita.
  const podeEditar = !param || norm(param) === norm(proprio) || role === "admin" || responsaveis.some(r => norm(r) === norm(proprio));
  const cargo = eu?.cargo || (param ? "Colaborador" : CARGOS[role]);
  const uf = eu ? ufDe(eu) : "";

  async function trocarFoto(ev) {
    const arquivo = ev.target.files[0];
    ev.target.value = "";
    if (!arquivo) return;
    setErro("");
    if (!arquivo.type.startsWith("image/")) return setErro("Escolha um arquivo de imagem.");
    if (arquivo.size > 8e6) return setErro("Limite de 8 MB por foto.");
    try { await salvarFoto(nome, await reduzirFoto(arquivo)); }
    catch (falha) { setErro(falha.message); }
  }

  return e.jsxs("div", { className: "page conta-page", children: [
    e.jsxs("section", { className: "conta-capa", children: [
      e.jsx("div", { className: "conta-banner", "aria-hidden": "true" }),
      e.jsxs("div", { className: "conta-id", children: [
        e.jsx("div", { className: "conta-foto", children: e.jsx(Foto, { nome, tamanho: 120 }) }),
        e.jsxs("div", { className: "conta-texto", children: [
          e.jsx("h1", { children: nome }),
          e.jsx("p", { children: [cargo, eu?.loja, uf].filter(Boolean).join(" · ") }),
        ] }),
        podeEditar && e.jsxs("div", { className: "conta-botoes", children: [
          e.jsx("input", { ref: entrada, type: "file", accept: "image/*", hidden: true, onChange: trocarFoto }),
          e.jsx("button", { type: "button", className: "btn btn-primary btn-sm", onClick: () => entrada.current.click(), children: "Mudar foto" }),
          e.jsx("button", { type: "button", className: "btn btn-ghost btn-sm", onClick: () => { setErro(""); salvarFoto(nome, null).catch(falha => setErro(falha.message)); }, children: "Remover" }),
        ] }),
      ] }),
      erro && e.jsx("p", { className: "conta-erro", role: "alert", children: erro }),
    ] }),
    e.jsx("div", { className: "tab-nav", children: [["perfil", "Perfil"], ["equipe", "Equipe"]].map(([id, rotulo]) => e.jsx("button", { type: "button", className: `tab-btn${aba === id ? " active" : ""}`, onClick: () => setAba(id), children: rotulo }, id)) }),
    aba === "perfil" ? e.jsxs("div", { className: "conta-grade", children: [
      e.jsxs("div", { className: "conta-coluna", children: [
        e.jsxs("section", { className: "card conta-bloco", children: [
          e.jsx("h2", { children: "Sobre" }),
          e.jsx(Linha, { rotulo: "Nome", valor: nome }),
          e.jsx(Linha, { rotulo: "Cargo", valor: cargo }),
          e.jsx(Linha, { rotulo: "Setor", valor: eu?.cargo_movimento }),
          e.jsx(Linha, { rotulo: "Loja", valor: eu?.loja }),
          e.jsx(Linha, { rotulo: "Estado", valor: uf }),
          e.jsx(Linha, { rotulo: "Responsável", valor: [...new Set(responsaveis)].join(" e ") }),
        ] }),
        e.jsxs("section", { className: "card conta-bloco", children: [
          e.jsx("h2", { children: `Resumo de ${mes}` }),
          e.jsx(Linha, { rotulo: "Vendas", valor: eu ? moeda(eu.venda) : "–" }),
          e.jsx(Linha, { rotulo: "Posição", valor: posicao >= 0 ? `${posicao + 1}º de ${ranking.length}` : "–" }),
          e.jsx("button", { type: "button", className: "btn btn-ghost btn-sm", onClick: () => ir(`/perfil/${encodeURIComponent(nome)}`), children: "Ver desempenho completo" }),
        ] }),
      ] }),
      e.jsxs("section", { className: "card conta-bloco", children: [
        e.jsx("h2", { children: "Atividades" }),
        atividades.length ? e.jsx("ol", { className: "conta-linha-tempo", children: atividades.map(s => e.jsxs("li", { children: [
          e.jsx("strong", { children: textoSolicitacao(s) }),
          e.jsx("small", { children: `${tempoAtras(s.quando)} · ${{ pendente: "Aguardando aprovação", aprovada: "Aprovada", recusada: "Recusada" }[s.status]}` }),
        ] }, s.id)) }) : e.jsx("p", { className: "page-sub", children: "Nenhuma atividade registrada." }),
      ] }),
    ] }) : e.jsxs("section", { className: "card conta-bloco", children: [
      e.jsx("h2", { children: "Equipe" }),
      equipe.length ? e.jsx("ul", { className: "conta-equipe", children: equipe.map(p => e.jsxs("li", { children: [
        e.jsx(Foto, { nome: p.colaborador, tamanho: 40 }),
        e.jsxs("button", { type: "button", onClick: () => ir(`/conta/${encodeURIComponent(p.colaborador)}`), children: [e.jsx("strong", { children: p.colaborador }), e.jsx("small", { children: p.cargo })] }),
        e.jsx("b", { children: moeda(p.venda) }),
      ] }, p.colaborador)) }) : e.jsx("p", { className: "page-sub", children: "Nenhuma pessoa vinculada." }),
    ] }),
  ] });
}
