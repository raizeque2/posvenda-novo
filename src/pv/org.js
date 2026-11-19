import * as e from "./jsx.js";
import React from "react";
import { LOJAS as Lojas } from "../data/regras.js";
import useStore from "../store.js";
import { norm, resolveNome as resolverNome } from "../utils/normalizacao.js";

// Organograma, pedidos de troca de equipe e fotos ficam no servidor (função gestaoEquipe e
// coleção equipeFotos), iguais para todo mundo. O navegador guarda só uma cópia para abrir rápido.
const CHAVE_ORG = "pv_org_v1";
const CHAVE_SOLICITACOES = "pv_solicitacoes_v1";
const CHAVE_FOTOS = "pv_fotos_v1";
const EVENTO = "pv-org-mudou";

const ler = (chave, padrao) => { try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; } };
const guardar = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {} };
const avisar = () => window.dispatchEvent(new Event(EVENTO));
const cache = { org: ler(CHAVE_ORG, {}), solicitacoes: ler(CHAVE_SOLICITACOES, []), fotos: ler(CHAVE_FOTOS, {}) };

async function chamar(acao, dados = {}) {
  const [{ httpsCallable }, { functions }] = await Promise.all([import("firebase/functions"), import("../firebase.js")]);
  try { return (await httpsCallable(functions, "gestaoEquipe", { timeout: 30000 })({ acao, ...dados })).data; }
  catch (erro) { throw new Error(erro?.message || "Não foi possível salvar agora."); }
}

let ultimaLeitura = 0, lendo = null, ouvindoFotos = false;
export function sincronizarEquipe(forcar = false) {
  if (lendo) return lendo;
  if (!forcar && Date.now() - ultimaLeitura < 60000) return Promise.resolve();
  lendo = chamar("ler").then(async ({ org, solicitacoes }) => {
    ultimaLeitura = Date.now();
    await migrarDoNavegador(org);
    cache.org = org || {}; cache.solicitacoes = solicitacoes || [];
    guardar(CHAVE_ORG, cache.org); guardar(CHAVE_SOLICITACOES, cache.solicitacoes);
    avisar();
  }).catch(() => {}).finally(() => { lendo = null; });
  ouvirFotos();
  return lendo;
}
function ouvirFotos() {
  if (ouvindoFotos) return;
  ouvindoFotos = true;
  Promise.all([import("firebase/firestore"), import("../firebase.js")]).then(([{ collection, onSnapshot }, { db }]) => {
    onSnapshot(collection(db, "equipeFotos"), snap => {
      const fotos = {};
      snap.docs.forEach(d => { const x = d.data(); if (x?.nome && x.foto) fotos[x.nome] = x.foto; });
      cache.fotos = fotos; guardar(CHAVE_FOTOS, fotos); avisar();
    }, () => { ouvindoFotos = false; });
  }).catch(() => { ouvindoFotos = false; });
}
// Antes desta versão o organograma vivia só no navegador do administrador: na primeira
// sincronização dele, o que estava aqui sobe para o servidor (se o servidor ainda estiver vazio).
// O servidor recusa quem não é administrador; tenta uma vez só por sessão.
let migracaoTentada = false;
async function migrarDoNavegador(doServidor) {
  if (migracaoTentada) return;
  migracaoTentada = true;
  const local = cache.org;
  const servidorVazio = !(doServidor?.coordenadores?.length) && !Object.keys(doServidor?.lotacoes || {}).length;
  const localTem = local?.coordenadores?.length || Object.keys(local?.lotacoes || {}).length || Object.keys(local?.coordenadorDe || {}).length;
  if (!servidorVazio || !localTem) return;
  try {
    await chamar("estrutura", { coordenadores: local.coordenadores || [], coordenadorUf: local.coordenadorUf || {}, coordenadorDe: local.coordenadorDe || {}, lotacoes: local.lotacoes || {} });
    Object.assign(doServidor, local);
  } catch {}
}

export function useMudancasOrg() {
  const [versao, tick] = React.useState(0);
  React.useEffect(() => {
    const ouvir = () => tick(v => v + 1);
    window.addEventListener(EVENTO, ouvir);
    sincronizarEquipe();
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);
  return versao;
}

export const ufDe = p => Lojas[p.loja]?.uf;

export const fotoDe = nome => cache.fotos[nome];
export async function salvarFoto(nome, foto) {
  await chamar("foto", { nome, foto: foto || null });
  if (foto) cache.fotos = { ...cache.fotos, [nome]: foto };
  else { const { [nome]: _, ...resto } = cache.fotos; cache.fotos = resto; }
  guardar(CHAVE_FOTOS, cache.fotos); avisar();
}
export function Foto({ nome, tamanho = 40 }) {
  const src = fotoDe(nome);
  const [falhou, setFalhou] = React.useState(null);
  const estilo = { width: tamanho, height: tamanho, minWidth: tamanho, maxWidth: tamanho, fontSize: tamanho * 0.32 };
  // Foto que não carrega (link quebrado) volta para as iniciais em vez de deixar um quadro vazio.
  return src && falhou !== src
    ? e.jsx("img", { className: "pv-foto", src, alt: "", style: estilo, decoding: "async", onError: () => setFalhou(src) })
    : e.jsx("span", { className: "pv-foto", style: estilo, children: iniciais(nome) });
}

export const lerSolicitacoes = () => cache.solicitacoes;
// O servidor devolve as pessoas alteradas: entram no cadastro local sem regravar o blob
// (e a versão vista é atualizada, para o próximo "salvar" do admin não acusar conflito).
async function aplicarResposta(resposta) {
  if (resposta?.alterados?.length) useStore.getState().aplicarColaboradoresRemotos?.(resposta.alterados);
  if (resposta?.versoes) {
    const { marcarVersaoConfig } = await import("../services/firestoreService.js");
    for (const [chaveConfig, ts] of Object.entries(resposta.versoes)) marcarVersaoConfig(chaveConfig, ts);
  }
  await sincronizarEquipe(true);
  return resposta;
}
// Pede (ou faz direto, se quem pede já é quem aprova). Devolve { aplicada, repetida }.
export async function criarSolicitacao({ tipo, pessoa, para, mes }) {
  return aplicarResposta(await chamar("solicitar", { tipo, pessoa, para: para || "", mes }));
}
export async function decidirSolicitacao(id, status) {
  return aplicarResposta(await chamar("decidir", { id, status }));
}
export async function salvarPeriodos(mes, pessoa, periodos) {
  return aplicarResposta(await chamar("periodos", { mes, pessoa, periodos }));
}
export async function salvarEstruturaOrg({ coordenadores, coordenadorUf, coordenadorDe }) {
  return aplicarResposta(await chamar("estrutura", { coordenadores, coordenadorUf, coordenadorDe }));
}
export async function salvarMetasEquipe(mes, lista) {
  const resposta = await chamar("metas", { mes, lista });
  useStore.getState().aplicarMetasRemotas?.(resposta.mes, resposta.metas);
  return aplicarResposta({ versoes: resposta.versoes });
}
export const textoSolicitacao = s => {
  if (s.tipo === "conta") return `${s.por} pediu acesso · ${s.detalhe}`;
  const direto = s.status === "aprovada" && s.decididoPor === s.por;
  if (s.tipo === "supervisor") return direto ? `${s.por} ligou ${s.pessoa} a ${s.para || "nenhum coordenador"}` : `${s.por} pediu ${s.pessoa} para a coordenação de ${s.para || "ninguém"}`;
  if (direto) return s.para ? `${s.por} moveu ${s.pessoa} para a equipe de ${s.para}` : `${s.por} desvinculou ${s.pessoa}`;
  return !s.para ? `${s.por} pediu para desvincular ${s.pessoa}` : s.para === s.por ? `${s.por} pediu ${s.pessoa} para a própria equipe` : `${s.por} pediu ${s.pessoa} para a equipe de ${s.para}`;
};
export function tempoAtras(quando) {
  const minutos = Math.floor((Date.now() - quando) / 6e4);
  if (minutos < 1) return "Agora";
  if (minutos < 60) return `${minutos} min atrás`;
  const horas = Math.floor(minutos / 60);
  return horas < 24 ? `${horas} h atrás` : `${Math.floor(horas / 24)} d atrás`;
}
const CANAIS = ["VAREJO", "ATACADO", "WEB", "TELEVENDAS"];

export const lerOrg = () => cache.org || {};

export function verComo(pessoa) {
  try {
    if (pessoa) sessionStorage.setItem("pv_ver_como", JSON.stringify(pessoa));
    else sessionStorage.removeItem("pv_ver_como");
  } catch {}
  location.href = "/painel";
}

export const iniciais = nome => {
  const p = String(nome).trim().split(/\s+/).filter(x => !["DA", "DE", "DO", "DAS", "DOS", "E"].includes(x.toUpperCase()));
  return ((p[0]?.[0] || "") + (p.length > 1 ? p.at(-1)[0] : "")).toUpperCase();
};
export const moeda = v => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);

const diaDa = r => String(r.dt?.toISOString?.() ?? r.dt ?? "").slice(0, 10);
const supervisorNoDia = (periodos, dia, padrao) => (periodos || []).find(p => dia >= p.de && dia <= p.ate)?.supervisor ?? padrao;

// Pessoas do mês com a venda de cada uma, já com o nome resolvido pelos apelidos
export function useEquipeDoMes(versaoLocal = 0) {
  const versaoOrg = useMudancasOrg() + versaoLocal;
  const colaboradoresPorMes = useStore(s => s.colaboradoresPorMes);
  const pecasPorMes = useStore(s => s.pecasPorMes);
  const apelidoMap = useStore(s => s.apelidoMap);
  const filtroMes = useStore(s => s.filtrosGlobais.mes);
  return React.useMemo(() => {
    const comVendas = Object.keys(pecasPorMes).filter(m => pecasPorMes[m]?.length);
    const ordenar = m => m.split("/").reverse().join("");
    const ultimo = comVendas.sort((a, b) => ordenar(a).localeCompare(ordenar(b))).at(-1);
    const mes = pecasPorMes[filtroMes]?.length ? filtroMes : ultimo || filtroMes;
    const lotacoes = lerOrg().lotacoes || {};
    const base = Object.values(colaboradoresPorMes[mes] || {});
    const porNome = new Map(base.map(p => [norm(p.colaborador), p]));
    const vendas = new Map();
    const fatias = new Map();
    for (const r of pecasPorMes[mes] || []) {
      if (!CANAIS.includes(r.cat)) continue;
      const chave = norm(resolverNome(r.responsavel, apelidoMap));
      const valor = Number(r.valor) || 0;
      vendas.set(chave, (vendas.get(chave) || 0) + valor);
      const pessoa = porNome.get(chave);
      if (!pessoa) continue;
      const responsavel = supervisorNoDia(lotacoes[pessoa.colaborador], diaDa(r), pessoa.supervisor);
      const fatia = `${chave}|${responsavel}`;
      fatias.set(fatia, (fatias.get(fatia) || 0) + valor);
    }
    const pessoas = base.map(p => ({ ...p, venda: vendas.get(norm(p.colaborador)) || 0 }));
    const atribuicoes = base.flatMap(p => {
      const periodos = lotacoes[p.colaborador] || [];
      const responsaveis = [...new Set([p.supervisor, ...periodos.map(x => x.supervisor)].filter(Boolean))];
      return responsaveis
        .map(supervisor => ({ ...p, supervisor, venda: fatias.get(`${norm(p.colaborador)}|${supervisor}`) || 0 }))
        .filter(a => !periodos.length || a.venda > 0 || periodos.some(x => x.supervisor === a.supervisor));
    });
    return { mes, pessoas, atribuicoes };
  }, [colaboradoresPorMes, pecasPorMes, apelidoMap, filtroMes, versaoOrg]);
}

// Recorte de gestão de cada cargo (Início e Meu Painel): admin vê todos os supervisores,
// coordenador os ligados a ele no organograma, supervisor só a própria equipe.
export function useEscopoGestao(role, nome) {
  const { mes, pessoas, atribuicoes } = useEquipeDoMes();
  const todos = React.useMemo(() => listarSupervisores(pessoas), [pessoas]);
  const coordenadorDe = lerOrg().coordenadorDe || {};
  const supervisores = role === "admin" ? todos
    : role === "coordenador" ? todos.filter(s => Object.entries(coordenadorDe).some(([sup, c]) => norm(sup) === norm(s) && norm(c) === norm(nome)))
    : role === "supervisor" ? todos.filter(s => norm(s) === norm(nome)) : [];
  return { mes, pessoas, atribuicoes, supervisores };
}

// Quem é supervisor: o que aparece vinculado a alguém ou tem esse cargo
export function listarSupervisores(pessoas) {
  const nomes = new Set(pessoas.map(p => p.supervisor).filter(Boolean));
  pessoas.filter(p => /SUPERVISOR/.test(p.cargo || "")).forEach(p => nomes.add(p.colaborador));
  return [...nomes].sort();
}
