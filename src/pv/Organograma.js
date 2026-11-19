import * as e from "./jsx.js";
import React from "react";
import useStore from "../store.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { lerOrg, salvarPeriodos, salvarEstruturaOrg, useMudancasOrg, verComo, iniciais, moeda, useEquipeDoMes, listarSupervisores, ufDe, Foto, criarSolicitacao } from "./org.js";

const LARGURA = { raiz: 280, coord: 260, sup: 240, pessoa: 112 };
const ALTURA = { raiz: 104, coord: 92, sup: 84, pessoa: 112 };
const VAO = 28;
const DESCIDA = 84;
const POR_LINHA = 4;
const CARGO = { coord: "Coordenador", sup: "Supervisor" };

// Mede cada subárvore e devolve nós posicionados e as ligações entre eles
function montar(raiz) {
  const medir = n => {
    n.filhos.forEach(medir);
    const pessoas = n.filhos.length && n.filhos[0].tipo === "pessoa";
    n.larguraFilhos = pessoas
      ? Math.min(n.filhos.length, POR_LINHA) * (LARGURA.pessoa + VAO) - VAO
      : n.filhos.reduce((s, f) => s + f.largura + VAO, -VAO);
    n.largura = Math.max(LARGURA[n.tipo], n.larguraFilhos);
  };
  const nos = [];
  const ligacoes = [];
  const posicionar = (n, x, y) => {
    n.x = x + n.largura / 2 - LARGURA[n.tipo] / 2;
    n.y = y;
    nos.push(n);
    const yFilhos = y + ALTURA[n.tipo] + DESCIDA;
    let cursor = x + (n.largura - n.larguraFilhos) / 2;
    n.filhos.forEach((f, i) => {
      if (f.tipo === "pessoa") {
        const coluna = i % POR_LINHA, linha = Math.floor(i / POR_LINHA);
        posicionar(f, cursor + coluna * (LARGURA.pessoa + VAO), yFilhos + linha * (ALTURA.pessoa + VAO));
      } else {
        posicionar(f, cursor, yFilhos);
        cursor += f.largura + VAO;
      }
      ligacoes.push({ de: n, para: f });
    });
  };
  medir(raiz);
  posicionar(raiz, 0, 0);
  return { nos, ligacoes, largura: raiz.largura };
}

function Ligacao({ de, para }) {
  const x1 = de.x + LARGURA[de.tipo] / 2, y1 = de.y + ALTURA[de.tipo];
  const x2 = para.x + LARGURA[para.tipo] / 2, y2 = para.y;
  const meio = y1 + DESCIDA / 2;
  return e.jsx("path", { d: `M${x1} ${y1} V${meio} H${x2} V${y2}`, className: `org-linha para-${para.tipo}${para.solto ? " solta" : ""}` });
}

function Periodos({ nome, mes, supervisores, onMudou, onErro }) {
  const lista = lerOrg().lotacoes?.[nome] || [];
  const [novo, setNovo] = React.useState({ supervisor: "", de: "", ate: "" });
  function gravar(proxima) {
    salvarPeriodos(mes, nome, proxima).then(onMudou, erro => onErro(erro.message));
  }
  const valido = novo.supervisor && novo.de && novo.ate && novo.de <= novo.ate;
  return e.jsxs("div", { className: "org-periodos", children: [
    e.jsx("strong", { children: "Períodos por setor" }),
    lista.map((x, i) => e.jsxs("p", { children: [`${x.de.split("-").reverse().join("/")} a ${x.ate.split("-").reverse().join("/")} · ${x.supervisor} `, e.jsx("button", { type: "button", className: "btn btn-ghost btn-xs", onClick: () => gravar(lista.filter((_, j) => j !== i)), children: "Remover" })] }, i)),
    e.jsxs("select", { className: "form-input", "aria-label": "Responsável no período", value: novo.supervisor, onChange: ev => setNovo(n => ({ ...n, supervisor: ev.target.value })), children: [e.jsx("option", { value: "", children: "Responsável no período" }), supervisores.map(s => e.jsx("option", { value: s, children: s }, s))] }),
    e.jsx("input", { className: "form-input", type: "date", "aria-label": "Início do período", value: novo.de, onChange: ev => setNovo(n => ({ ...n, de: ev.target.value })) }),
    e.jsx("input", { className: "form-input", type: "date", "aria-label": "Fim do período", value: novo.ate, onChange: ev => setNovo(n => ({ ...n, ate: ev.target.value })) }),
    e.jsx("button", { type: "button", className: "btn btn-ghost btn-sm", disabled: !valido, onClick: () => { gravar([...lista, novo]); setNovo({ supervisor: "", de: "", ate: "" }); }, children: "Adicionar período" }),
  ] });
}

function Detalhe({ pessoa, mes, supervisores, onVincular, onFechar, podeVerComo, podeDividir, onMudou, onErro }) {
  return e.jsxs("aside", { className: "org-detalhe", "aria-label": `Detalhes de ${pessoa.colaborador}`, children: [
    e.jsxs("header", { children: [
      e.jsx("span", { className: "bi-avatar sm", children: iniciais(pessoa.colaborador) }),
      e.jsxs("div", { className: "org-nome", children: [e.jsx("strong", { children: pessoa.colaborador }), e.jsx("small", { children: [pessoa.loja, pessoa.cargo].filter(Boolean).join(" · ") })] }),
      e.jsx("button", { type: "button", className: "btn btn-ghost btn-xs", "aria-label": "Fechar", onClick: onFechar, children: "×" }),
    ] }),
    e.jsxs("label", { className: "pv-campo", children: [e.jsx("span", { children: "Responsável" }), e.jsxs("select", { className: "form-input", value: pessoa.supervisor || "", onChange: ev => onVincular(pessoa, ev.target.value), children: [e.jsx("option", { value: "", children: "Sem responsável" }), [...new Set([pessoa.supervisor, ...supervisores].filter(Boolean))].map(s => e.jsx("option", { value: s, children: s }, s))] })] }),
    podeDividir && e.jsx(Periodos, { nome: pessoa.colaborador, mes, supervisores, onMudou, onErro }, pessoa.colaborador),
    podeVerComo && e.jsx("button", { type: "button", className: "btn btn-ghost btn-sm", onClick: () => verComo({ role: "operacional", nome: pessoa.colaborador }), children: "Ver como esta pessoa" }),
  ] });
}

export default function Organograma() {
  const { role, nome } = useAuth();
  const [versaoOrg, setVersaoOrg] = React.useState(0);
  const mudouOrg = () => setVersaoOrg(v => v + 1);
  const [escolha, setEscolha] = React.useState(null);
  const { mes, pessoas: todasPessoas, atribuicoes: todasAtribuicoes } = useEquipeDoMes(versaoOrg);
  const meuEstado = ufDe(todasPessoas.find(p => p.colaborador === nome) || {});
  const [uf, setUf] = React.useState(meuEstado || "AL");
  const pessoas = React.useMemo(() => todasPessoas.filter(p => ufDe(p) === uf), [todasPessoas, uf]);
  const atribuicoes = React.useMemo(() => todasAtribuicoes.filter(p => ufDe(p) === uf), [todasAtribuicoes, uf]);
  useMudancasOrg();
  const org = lerOrg();
  const [novoCoord, setNovoCoord] = React.useState("");
  const [busca, setBusca] = React.useState("");
  const [abertos, setAbertos] = React.useState(() => new Set(role === "supervisor" ? [nome] : []));
  const [selecionado, setSelecionado] = React.useState(null);
  const [camera, setCamera] = React.useState({ x: 0, y: 24, k: 0.8 });
  const [arraste, setArraste] = React.useState(null);
  const [alvo, setAlvo] = React.useState(null);
  const [aviso, setAviso] = React.useState("");
  const palco = React.useRef(null);

  const admin = role === "admin";
  const podeDividir = admin || role === "coordenador";
  const podeVerComo = !sessionStorage.getItem("pv_ver_como");
  const todosCoordenadores = org.coordenadores || [];
  const coordenadores = todosCoordenadores.filter(c => (org.coordenadorUf?.[c] || "AL") === uf);
  const coordenadorDe = org.coordenadorDe || {};
  const todosSupervisores = React.useMemo(() => listarSupervisores(pessoas), [pessoas]);
  const supervisores = admin ? todosSupervisores : role === "coordenador" ? todosSupervisores.filter(s => coordenadorDe[s] === nome) : [nome];
  const semResponsavel = pessoas.filter(p => !p.supervisor);
  const vendaDe = s => atribuicoes.filter(a => a.supervisor === s).reduce((t, a) => t + a.venda, 0);

  const pessoaNo = p => ({ id: `p:${p.colaborador}|${p.supervisor}`, tipo: "pessoa", nome: p.colaborador, pessoa: p, filhos: [] });
  const supNo = s => {
    const equipe = atribuicoes.filter(p => p.supervisor === s);
    return { id: `s:${s}`, tipo: "sup", nome: s, qtd: equipe.length, venda: vendaDe(s), solto: admin && !coordenadores.includes(coordenadorDe[s]), filhos: abertos.has(s) ? equipe.map(pessoaNo) : [] };
  };
  const arvore = React.useMemo(() => {
    const raiz = admin
      ? { id: "raiz", tipo: "raiz", nome: "Bruno Andrade", sub: `Administrador · ${uf === "AL" ? "Alagoas" : "Pernambuco"}`, filhos: [...coordenadores.map(c => ({ id: `c:${c}`, tipo: "coord", nome: c, filhos: todosSupervisores.filter(s => coordenadorDe[s] === c).map(supNo) })), ...todosSupervisores.filter(s => !coordenadores.includes(coordenadorDe[s])).map(supNo)] }
      : role === "coordenador"
        ? { id: `c:${nome}`, tipo: "raiz", nome, sub: "Coordenador", filhos: supervisores.map(supNo) }
        : { ...supNo(nome), tipo: "raiz", sub: "Supervisor" };
    return montar(raiz);
  }, [admin, role, nome, pessoas, atribuicoes, org, abertos, versaoOrg]);

  function gravarOrg(mudanca) {
    const atual = lerOrg();
    salvarEstruturaOrg({ coordenadores: atual.coordenadores || [], coordenadorUf: atual.coordenadorUf || {}, coordenadorDe: atual.coordenadorDe || {}, ...mudanca })
      .catch(erro => celebrar(erro.message));
  }
  function celebrar(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(a => (a === texto ? "" : a)), 3200);
  }
  // Divide o mês na data escolhida: quem já responde fica até ela, o novo assume no dia seguinte
  function manterNosDois({ pessoa, novo, data }) {
    const [m, a] = mes.split("/").map(Number);
    const primeiro = `${a}-${String(m).padStart(2, "0")}-01`;
    const ultimo = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
    const seguinte = new Date(Date.parse(data) + 864e5).toISOString().slice(0, 10);
    const antes = (lerOrg().lotacoes?.[pessoa.colaborador] || [{ supervisor: pessoa.supervisor, de: primeiro, ate: ultimo }])
      .filter(x => x.de <= data).map(x => (x.ate > data ? { ...x, ate: data } : x));
    setEscolha(null);
    salvarPeriodos(mes, pessoa.colaborador, [...antes, { supervisor: novo, de: seguinte, ate: ultimo }]).then(() => {
      mudouOrg();
      setAbertos(x => new Set(x).add(novo));
      celebrar(`${pessoa.colaborador} agora está em duas equipes`);
    }, erro => celebrar(erro.message));
  }
  // Quem já responde pela pessoa (ou o coordenador) muda na hora; os outros mandam pedido.
  async function pedir(tipo, pessoa, para) {
    try {
      const r = await criarSolicitacao({ tipo, pessoa, para, mes });
      if (r.repetida) return celebrar("Esse pedido já está aguardando");
      if (!r.aplicada) return celebrar(`Pedido enviado para ${r.aprovadores?.length ? r.aprovadores.join(" ou ") : "o administrador"}`);
      mudouOrg();
      if (tipo === "pessoa") setSelecionado(s => (s?.colaborador === pessoa ? { ...s, supervisor: para } : s));
      if (para) setAbertos(a => new Set(a).add(para));
      celebrar(para ? `${pessoa} agora responde a ${para}` : `${pessoa} ficou sem responsável`);
    } catch (erro) { celebrar(erro.message); }
  }
  const vincular = (p, supervisor) => pedir("pessoa", p.colaborador, supervisor);
  const ligarSupervisor = (s, c) => pedir("supervisor", s, c);
  function adicionarCoordenador() {
    const n = novoCoord.trim().toUpperCase();
    if (!n || todosCoordenadores.includes(n)) return;
    gravarOrg({ coordenadores: [...todosCoordenadores, n], coordenadorUf: { ...org.coordenadorUf, [n]: uf } });
    setNovoCoord("");
  }

  // Quem pode soltar em quem
  function aceita(item, destino) {
    if (!item || !destino) return false;
    const tipo = destino.slice(0, 1), valor = destino.slice(2);
    if (item.tipo === "pessoa") return destino === "sem" || (tipo === "s" && supervisores.includes(valor));
    if (item.tipo === "sup") return destino === "raiz" ? admin : tipo === "c" && (admin ? coordenadores.includes(valor) : valor === nome);
    return false;
  }
  function soltar(item, destino) {
    const valor = destino.slice(2);
    if (item.tipo === "pessoa") {
      const base = pessoas.find(x => x.colaborador === item.pessoa.colaborador);
      if (podeDividir && destino !== "sem" && base.supervisor && base.supervisor !== valor) {
        const [m, a] = mes.split("/");
        setEscolha({ pessoa: base, novo: valor, data: `${a}-${m}-15` });
      } else vincular(base, destino === "sem" ? "" : valor);
    }
    else ligarSupervisor(item.nome, destino === "raiz" ? "" : valor);
  }

  function iniciarArraste(ev, item) {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    const inicio = { x: ev.clientX, y: ev.clientY };
    let ativo = false, destino = null;
    const mover = m => {
      if (!ativo && Math.hypot(m.clientX - inicio.x, m.clientY - inicio.y) < 6) return;
      ativo = true;
      setArraste({ item, x: m.clientX, y: m.clientY });
      const id = document.elementFromPoint(m.clientX, m.clientY)?.closest("[data-drop]")?.dataset.drop || null;
      destino = aceita(item, id) ? id : null;
      setAlvo(destino);
    };
    const parar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", parar);
      setArraste(null);
      setAlvo(null);
      if (ativo && destino) soltar(item, destino);
      else if (!ativo) clicar(item);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", parar);
  }
  function clicar(item) {
    if (item.tipo === "pessoa") setSelecionado(item.pessoa);
    if (item.tipo === "sup") setAbertos(a => { const n = new Set(a); n.has(item.nome) ? n.delete(item.nome) : n.add(item.nome); return n; });
  }
  function arrastarPalco(ev) {
    if (ev.target.closest("[data-drop],button,select,input,.org-detalhe")) return;
    const inicio = { x: ev.clientX - camera.x, y: ev.clientY - camera.y };
    const mover = m => setCamera(c => ({ ...c, x: m.clientX - inicio.x, y: m.clientY - inicio.y }));
    const parar = () => { window.removeEventListener("pointermove", mover); window.removeEventListener("pointerup", parar); };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", parar);
  }
  const zoom = fator => setCamera(c => ({ ...c, k: Math.min(1.6, Math.max(0.25, c.k * fator)) }));
  const centralizar = () => {
    const largura = palco.current?.clientWidth || 900;
    const k = Math.min(1, Math.max(0.65, (largura - 40) / arvore.largura));
    const raiz = arvore.nos[0];
    setCamera({ k, x: largura / 2 - (raiz.x + LARGURA[raiz.tipo] / 2) * k, y: 24 });
  };
  React.useEffect(centralizar, [pessoas.length > 0]);
  React.useEffect(() => {
    const el = palco.current;
    const roda = ev => { ev.preventDefault(); zoom(ev.deltaY < 0 ? 1.1 : 0.9); };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, []);

  const termo = busca.trim().toUpperCase();
  const doca = semResponsavel.filter(p => !termo || p.colaborador.includes(termo));
  const classeAlvo = id => (alvo === id ? " is-alvo" : arraste && aceita(arraste.item, id) ? " pode-soltar" : "");

  const cartao = n => {
    const dropId = n.tipo === "raiz" ? (admin ? "raiz" : n.id) : n.id;
    const comum = {
      style: { left: n.x, top: n.y, width: LARGURA[n.tipo] }, "data-drop": dropId,
      onPointerDown: ev => (n.tipo === "pessoa" || n.tipo === "sup") && iniciarArraste(ev, n),
    };
    const origem = arraste?.item.id === n.id ? " is-origem" : "";
    if (n.tipo === "pessoa") return e.jsxs("div", { ...comum, className: `org-no no-pessoa${classeAlvo(dropId)}${origem}`, role: "button", tabIndex: 0, "aria-label": `Abrir ${n.nome}`, onKeyDown: ev => { ev.key === "Enter" && setSelecionado(n.pessoa); }, children: [
      e.jsx("span", { className: "org-foto", children: e.jsx(Foto, { nome: n.nome, tamanho: 50 }) }),
      e.jsx("strong", { title: n.nome, children: n.nome }),
      e.jsx("small", { children: `Colaborador · ${n.pessoa.loja}` }),
    ] }, n.id);
    return e.jsxs("div", { ...comum, className: `org-no no-${n.tipo}${classeAlvo(dropId)}${n.solto ? " is-solto" : ""}${origem}`, children: [
      e.jsx("span", { className: "org-selo", children: n.sub || CARGO[n.tipo] }),
      e.jsx("span", { className: "org-foto", children: e.jsx(Foto, { nome: n.nome, tamanho: 50 }) }),
      e.jsxs("div", { className: "org-nome", children: [
        e.jsx("strong", { title: n.nome, children: n.nome }),
        e.jsx("small", { children: n.tipo === "raiz" ? "" : (n.tipo === "coord" ? `${n.filhos.length} supervisores` : `${n.qtd} pessoas · ${moeda(n.venda)}`) }),
      ] }),
      n.tipo === "sup" && n.qtd > 0 && e.jsx("span", { className: "org-mais", "aria-hidden": "true", children: abertos.has(n.nome) ? "−" : "+" }),
      n.tipo === "coord" && admin && e.jsx("button", { type: "button", className: "org-tirar", "aria-label": `Remover ${n.nome}`, onPointerDown: ev => ev.stopPropagation(), onClick: () => gravarOrg({ coordenadores: todosCoordenadores.filter(c => c !== n.nome), coordenadorDe: Object.fromEntries(Object.entries(coordenadorDe).filter(([, v]) => v !== n.nome)) }), children: "×" }),
    ] }, n.id);
  };

  return e.jsxs("div", { className: "page org-page", children: [
    e.jsxs("header", { className: "org-cabeca", children: [
      e.jsxs("div", { children: [e.jsx("h1", { className: "page-title", children: "Organograma" }), e.jsx("p", { className: "page-sub", children: podeDividir ? `Arraste uma pessoa até o responsável para ligar · ${mes}` : `Arraste para mover; se a pessoa for de outra equipe, vira um pedido · ${mes}` })] }),
      e.jsx("div", { className: "org-estados", role: "group", "aria-label": "Estado", children: [["AL", "Alagoas Motos"], ["PE", "Pernambuco Motos"]].map(([id, rotulo]) => e.jsxs("button", { type: "button", className: uf === id ? "is-ativo" : "", "aria-pressed": uf === id, onClick: () => { setUf(id); setSelecionado(null); }, children: [e.jsx("img", { src: `/flags/${id.toLowerCase()}.png`, alt: "", width: 22, height: 22 }), rotulo] }, id)) }),
    ] }),
    e.jsxs("div", { className: "org-mesa", children: [
      e.jsxs("aside", { className: `org-doca${classeAlvo("sem")}`, "data-drop": "sem", children: [
        e.jsxs("h2", { children: ["Sem responsável ", e.jsx("span", { children: semResponsavel.length })] }),
        e.jsx("input", { className: "form-input", "aria-label": "Buscar pessoa", placeholder: "Buscar pessoa…", value: busca, onChange: ev => setBusca(ev.target.value) }),
        e.jsx("ul", { children: doca.map(p => e.jsxs("li", { onPointerDown: ev => iniciarArraste(ev, pessoaNo(p)), children: [
          e.jsx("span", { className: "bi-avatar sm", children: iniciais(p.colaborador) }),
          e.jsxs("div", { className: "org-nome", children: [e.jsx("strong", { children: p.colaborador }), e.jsx("small", { children: [p.loja, p.cargo].filter(Boolean).join(" · ") })] }),
        ] }, p.colaborador)) }),
        admin && e.jsxs("div", { className: "org-novo", children: [
          e.jsx("input", { className: "form-input", "aria-label": "Nome do novo coordenador", placeholder: "Novo coordenador", value: novoCoord, onChange: ev => setNovoCoord(ev.target.value), onKeyDown: ev => { ev.key === "Enter" && adicionarCoordenador(); } }),
          e.jsx("button", { type: "button", className: "btn btn-primary btn-sm", onClick: adicionarCoordenador, children: "Adicionar" }),
        ] }),
      ] }),
      e.jsxs("div", { ref: palco, className: "org-palco", onPointerDown: arrastarPalco, children: [
        e.jsxs("div", { className: "org-mundo", style: { transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})` }, children: [
          e.jsx("svg", { className: "org-linhas", width: arvore.largura, height: 1, "aria-hidden": "true", children: arvore.ligacoes.map(l => e.jsx(Ligacao, { ...l }, `${l.de.id}>${l.para.id}`)) }),
          arvore.nos.map(cartao),
        ] }),
        e.jsxs("div", { className: "org-zoom", children: [
          e.jsx("button", { type: "button", "aria-label": "Aproximar", onClick: () => zoom(1.2), children: "+" }),
          e.jsx("button", { type: "button", "aria-label": "Afastar", onClick: () => zoom(0.8), children: "−" }),
          e.jsx("button", { type: "button", "aria-label": "Centralizar", onClick: centralizar, children: "⟲" }),
        ] }),
        selecionado && e.jsx(Detalhe, { pessoa: selecionado, mes, supervisores, onVincular: vincular, onFechar: () => setSelecionado(null), podeVerComo, podeDividir, onMudou: mudouOrg, onErro: celebrar }),
      ] }),
    ] }),
    arraste && e.jsxs("div", { className: "org-fantasma", style: { left: arraste.x, top: arraste.y }, children: [e.jsx("span", { className: "bi-avatar sm", children: iniciais(arraste.item.nome) }), arraste.item.nome] }),
    escolha && e.jsx("div", { className: "pv-drawer-fundo org-escolha-fundo", children: e.jsxs("section", { className: "org-escolha", role: "dialog", "aria-modal": "true", "aria-label": "Mover ou manter nos dois", children: [
      e.jsx("h2", { children: escolha.pessoa.colaborador }),
      e.jsx("p", { children: `Hoje responde a ${escolha.pessoa.supervisor}. O que fazer com ${escolha.novo}?` }),
      e.jsxs("label", { className: "pv-campo", children: [e.jsx("span", { children: "Último dia com o responsável atual" }), e.jsx("input", { className: "form-input", type: "date", value: escolha.data, onChange: ev => setEscolha(x => ({ ...x, data: ev.target.value })) })] }),
      e.jsxs("footer", { children: [
        e.jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => setEscolha(null), children: "Cancelar" }),
        e.jsx("button", { type: "button", className: "btn btn-ghost", onClick: () => { vincular(escolha.pessoa, escolha.novo); setEscolha(null); }, children: "Mover de vez" }),
        e.jsx("button", { type: "button", className: "btn btn-primary", disabled: !escolha.data, onClick: () => manterNosDois(escolha), children: "Manter nos dois" }),
      ] }),
    ] }) }),
    aviso && e.jsx("div", { className: "org-aviso", role: "status", children: aviso }),
  ] });
}
