import * as e from "./jsx.js";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import Onboarding from "../components/Onboarding.jsx";
import { Foto, lerSolicitacoes, decidirSolicitacao, useMudancasOrg, tempoAtras, textoSolicitacao } from "./org.js";

const CARGOS = { admin: "Administrador", coordenador: "Coordenador", supervisor: "Supervisor", operacional: "Colaborador" };
const icone = id => e.jsx("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": "true", children: e.jsx("use", { href: `/icons/iconoir.svg#${id}` }) });

function useFecharFora(aberto, fechar) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!aberto) return;
    const fora = ev => { ref.current && !ref.current.contains(ev.target) && fechar(); };
    const tecla = ev => { ev.key === "Escape" && fechar(); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", tecla); };
  }, [aberto]);
  return ref;
}

const chaveTour = nome => `pv_tour_visto_${nome}`;

function Item({ s }) {
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState("");
  const status = { aprovada: "Aprovada", recusada: "Recusada", expirada: "Sem efeito: a equipe mudou antes da decisão" }[s.status];
  const decidir = async decisao => {
    setEnviando(true); setErro("");
    try { await decidirSolicitacao(s.id, decisao); } catch (falha) { setErro(falha.message); } finally { setEnviando(false); }
  };
  return e.jsxs("li", { className: "topo-item", children: [
    e.jsx(Foto, { nome: s.por, tamanho: 40 }),
    e.jsxs("div", { children: [
      e.jsx("p", { children: textoSolicitacao(s) }),
      e.jsxs("small", { children: [tempoAtras(s.quando), " · ", status || (s.podeDecidir ? "Aguardando você" : "Aguardando aprovação"), s.decididoPor && s.decididoPor !== s.por ? ` por ${s.decididoPor}` : ""] }),
      s.podeDecidir && s.status === "pendente" && e.jsxs("div", { className: "topo-acoes", children: [
        e.jsx("button", { type: "button", className: "btn btn-ghost btn-sm", disabled: enviando, onClick: () => decidir("recusada"), children: "Recusar" }),
        e.jsx("button", { type: "button", className: "btn btn-primary btn-sm", disabled: enviando, onClick: () => decidir("aprovada"), children: "Aprovar" }),
      ] }),
      erro && e.jsx("small", { role: "alert", style: { color: "var(--red)" }, children: erro }),
    ] }),
  ] });
}

function Notificacoes({ role, nome }) {
  useMudancasOrg();
  const [aberto, setAberto] = React.useState(false);
  const [aba, setAba] = React.useState("entrada");
  const ref = useFecharFora(aberto, () => setAberto(false));
  // O servidor já devolve só os pedidos que envolvem esta pessoa (todos, para o admin).
  const minhas = lerSolicitacoes().slice().reverse();
  const pendentes = minhas.filter(s => s.status === "pendente");
  const lista = aba === "entrada" ? pendentes : minhas.filter(s => s.status !== "pendente");
  return e.jsxs("div", { className: "topo-menu", ref, children: [
    e.jsxs("button", { type: "button", className: "topo-botao", "aria-label": `Notificações, ${pendentes.length} pendentes`, "aria-expanded": aberto, onClick: () => setAberto(a => !a), children: [icone("mail-in"), pendentes.length > 0 && e.jsx("i", { className: "topo-ponto" })] }),
    aberto && e.jsxs("section", { className: "topo-painel topo-notificacoes", "aria-label": "Notificações", children: [
      e.jsxs("header", { children: [e.jsx("span", { children: "NOTIFICAÇÕES" }), e.jsx("b", { children: `${pendentes.length} ${pendentes.length === 1 ? "nova" : "novas"}` })] }),
      e.jsxs("div", { className: "topo-abas", children: [
        e.jsx("button", { type: "button", className: aba === "entrada" ? "is-ativa" : "", onClick: () => setAba("entrada"), children: "Caixa de entrada" }),
        e.jsx("button", { type: "button", className: aba === "geral" ? "is-ativa" : "", onClick: () => setAba("geral"), children: "Decididas" }),
      ] }),
      lista.length ? e.jsx("ul", { children: lista.map(s => e.jsx(Item, { s }, s.id)) }) : e.jsx("p", { className: "topo-vazio", children: "Nada por aqui." }),
    ] }),
  ] });
}

function Perfil({ role, nome, email, sair, onTour }) {
  const [aberto, setAberto] = React.useState(false);
  const ref = useFecharFora(aberto, () => setAberto(false));
  const ir = useNavigate();
  useMudancasOrg();
  const abrir = rota => { setAberto(false); ir(rota); };
  return e.jsxs("div", { className: "topo-menu", ref, children: [
    e.jsx("button", { type: "button", className: "topo-avatar", "aria-label": "Abrir menu do perfil", "aria-expanded": aberto, onClick: () => setAberto(a => !a), children: e.jsx(Foto, { nome, tamanho: 34 }) }),
    aberto && e.jsxs("section", { className: "topo-painel topo-perfil", "aria-label": "Perfil", children: [
      e.jsxs("header", { children: [e.jsx(Foto, { nome, tamanho: 42 }), e.jsxs("div", { children: [e.jsx("strong", { children: nome }), e.jsx("small", { children: CARGOS[role] || email })] })] }),
      e.jsxs("button", { type: "button", onClick: () => abrir("/conta"), children: [icone("user"), "Meu perfil"] }),
      e.jsxs("button", { type: "button", onClick: () => abrir("/desempenho"), children: [icone("star"), "Meu desempenho"] }),
      e.jsxs("button", { type: "button", onClick: () => { setAberto(false); onTour(); }, children: [icone("help-circle"), "Rever apresentação"] }),
      e.jsxs("button", { type: "button", onClick: sair, children: [icone("log-out"), "Sair"] }),
    ] }),
  ] });
}

export default function Topo() {
  const { role, nome, user, logout } = useAuth();
  const nomeVisivel = nome || user?.displayName || user?.email || "";
  const [tema, setTema] = React.useState(document.documentElement.dataset.theme);
  const [tour, setTour] = React.useState(() => { try { return !localStorage.getItem(chaveTour(nomeVisivel)); } catch { return false; } });
  if (!user) return null;
  const fecharTour = () => {
    try { localStorage.setItem(chaveTour(nomeVisivel), "1"); } catch {}
    setTour(false);
  };
  return e.jsxs("div", { className: "topo-acoes-barra", children: [
    e.jsx("button", { type: "button", className: "topo-botao", "aria-label": "Alternar tema claro e escuro", onClick: () => { document.querySelector(".theme-toggle")?.click(); setTimeout(() => setTema(document.documentElement.dataset.theme), 50); }, children: icone(tema === "dark" ? "sun-light" : "half-moon") }),
    e.jsx(Notificacoes, { role, nome: nomeVisivel }),
    e.jsx(Perfil, { role, nome: nomeVisivel, email: user.email, sair: logout, onTour: () => setTour(true) }),
    tour && e.jsx(Onboarding, { nome: nomeVisivel, onFechar: fecharTour }),
  ] });
}
