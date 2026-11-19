import { RainbowButton } from '../components/ui/rainbow-button'
import { useInRouterContext, useNavigate } from "react-router-dom";
import { TrendingUp, User } from "../icons/iconoir";

// Atalhos do resumo da pessoa: desempenho completo e perfil.
function AtalhosPessoa({ nome, onIr }) {
  const ir = useNavigate();
  const abrir = (rota) => { onIr(); ir(rota); };
  return (
    <div className="bi-atalhos-pessoa">
      <button type="button" className="bi-button" onClick={() => abrir(`/perfil/${encodeURIComponent(nome)}`)}><TrendingUp size={16} /> Desempenho completo</button>
      <button type="button" className="bi-button" onClick={() => abrir(`/conta/${encodeURIComponent(nome)}`)}><User size={16} /> Ver perfil</button>
    </div>
  );
}
import DraggableWidgetGrid from "../components/ui/draggable-widget-grid";
import { WidgetEditor } from "./WidgetEditor.jsx";
import { KpiTrends, periodTrend, ComparativoMes } from "./KpiTrends.jsx";
import KpiArea from "./KpiArea.jsx";
import { arrumarKpis, colunasDaGrade, moverPara, TAMANHO_MAXIMO } from "./kpiGrid.js";
import { ajustarLargura, ajustarAltura } from "./widgetLayout.js";
import KpiInsight from "./KpiInsight.jsx";
import {DASHBOARD_CHANNELS,matchesChannel,mainChannel,kpiSummary,kpiBreakdown,dailyRevenueRows} from './revenue.js'
import * as Popover from '@radix-ui/react-popover'
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useProfiles } from "./useProfiles.js";
import {
  aggregate,
  analyze,
  initial,
  normalize,
  widget,
  reorder,
  key,
  matchesTerritory,
} from "./model.js";
import { Chart, money } from "./Chart.jsx";
import { corKpi, EquipeTabela, GraficoPessoa, KpiIcone, KpiSpark, RankingDoItem, ResumoPessoa } from "../pv/BiExtras.js";
import {
  GripVertical,
  Plus,
  Settings2,
  Save,
  Monitor,
  Smartphone,
  X,
  ArrowUp,
  ArrowDown,
  Copy,
  Star,
  Ellipsis,
  Search,
} from '../icons/iconoir';
import "./bi.css";
const dims = {
  person: "Pessoa",
  store: "Loja",
  channel: "Canal",
  date: "Data",
  product: "Peça",
  region: "Região",
  city: "Cidade",
  neighborhood: "Bairro",
};
const types = {
  colunas: "Colunas",
  bar: "Barras",
  line: "Linhas",
  area: "Área",
  pie: "Pizza",
  donut: "Rosca",
  grid: "Grid",
  table: "Tabela",
};
// Ícone e cor por canal nos cards de detalhamento (Total Peças etc.).
const ICONE_CANAL = { VAREJO: ["shopping-bag", "#0d9488"], WEB: ["globe", "#3b82f6"], TELEVENDAS: ["message-text", "#7c3aed"], ATACADO: ["packages", "#f97316"], "PEÇAS OS": ["box", "#16a34a"], "MÃO DE OBRA": ["wrench", "#cc0000"], OFICINA: ["wrench", "#cc0000"], "SERVIÇOS": ["wrench", "#cc0000"] };
const CORES_EXTRA = ["#0d9488", "#3b82f6", "#7c3aed", "#f97316", "#16a34a", "#f59e0b"];
function IconeCanal({ nome, indice = 0 }) {
  const [icone, cor] = ICONE_CANAL[String(nome).toUpperCase()] || ["box", CORES_EXTRA[indice % CORES_EXTRA.length]];
  return <i className="bi-kpi-breakdown-icone" style={{ color: cor, background: `color-mix(in srgb, ${cor} 14%, transparent)` }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><use href={`/icons/iconoir.svg#${icone}`} /></svg></i>;
}
export default function Workspace({
  pieces = [],
  services = [],
  historyPieces = [],
  historyServices = [],
  targets = [],
  scope = "dashboard",
  personal = false,
  person = "",
  token,
  barra = null, // { inicio, fim }: elementos da barra de filtros da página para receber os controles
}) {
  const { user, role } = useAuth() || {};
  const { state, update, save, status, ready, busy } = useProfiles(
    user?.uid || "guest",
    scope,
    token,
  );
  // Fora do app (link público do BI) não há rotas: os atalhos de perfil não aparecem.
  const comRotas = useInRouterContext();
  const [editing, setEditing] = useState(false),
    [device, setDevice] = useState(
      window.innerWidth < 768 ? "mobile" : "desktop",
    ),
    [config, setConfig] = useState(null),
    [region, setRegion] = useState(""),
    [detail, setDetail] = useState(null),
    [buscaEquipe, setBuscaEquipe] = useState(null), // id do widget de equipe com a busca aberta
    [expanded, setExpanded] = useState(null),
    [cardPeriods, setCardPeriods] = useState({}),
    [cardComparisons, setCardComparisons] = useState({}),
    [notice, setNotice] = useState(""),
    [profileName, setProfileName] = useState("");
  const fieldDrag = useRef(null);
  const profile =
    state.profiles.find((p) => p.id === state.activeId) || state.profiles[0];
  const widgets = profile[device] || profile.desktop;
  const gridItems = useMemo(
    () =>
      widgets.map((w) => ({
        id: w.id,
        label: w.title,
        // Tamanhos antigos (largura 1–3, alturas livres) caem no degrau permitido mais perto.
        width: ajustarLargura(w.tileSize ? (["wide", "lg"].includes(w.tileSize) ? 8 : 4) : w.width),
        height: ajustarAltura(w.tileSize ? (["tall", "lg"].includes(w.tileSize) ? 560 : 300) : w.height),
        size:
          w.tileSize ||
          (w.width >= 8
            ? w.height >= 400
              ? "lg"
              : "wide"
            : w.height >= 400
              ? "tall"
              : "sm"),
      })),
    [widgets],
  );
  const rows = useMemo(
    () => [...normalize(pieces), ...normalize(services, true)],
    [pieces, services],
  );
  const historicalRows = useMemo(
    () => [...normalize(historyPieces), ...normalize(historyServices, true)],
    [historyPieces, historyServices],
  );
  const regionalRows = useMemo(
    () => rows.filter((row) => matchesTerritory(row, region)),
    [rows, region],
  );
  const regionalHistory = useMemo(
    () => historicalRows.filter((row) => matchesTerritory(row, region)),
    [historicalRows, region],
  );
  const insightRows=useMemo(()=>dailyRevenueRows(regionalRows),[regionalRows])
  const insightHistory=useMemo(()=>dailyRevenueRows(regionalHistory),[regionalHistory])
  const widgetTrends=useMemo(()=>new Map(widgets.filter(w=>w.dimension==='date'&&!region&&!w.store&&!w.source).map(w=>[w.id,periodTrend(rows,w.channel,w.metric,targets.filter(t=>matchesChannel(t,w.channel)).reduce((sum,t)=>sum+(Number(t.meta)||0),0),w.periodDays||30,new Date(),historicalRows,w.comparisonDays||30)])),[widgets,rows,historicalRows,targets,region])
  const channels = [...new Set(rows.map((r) => r.channel))];
  const cards = profile.kpiLayouts?.[device] || profile;
  const updateCards = (values) =>
    updateProfile({
      kpiLayouts: {
        ...profile.kpiLayouts,
        [device]: {
          kpiOrder: cards.kpiOrder,
          kpiSizes: cards.kpiSizes,
          kpiTypes: cards.kpiTypes,
          kpiMetrics: cards.kpiMetrics,
          kpiHidden: cards.kpiHidden,
          ...values,
        },
      },
    });
  const kpiOrder = cards.kpiOrder || channels;
  const kpiChannels = personal ? [
    ...kpiOrder.filter((c) => channels.includes(c)),
    ...channels.filter((c) => !kpiOrder.includes(c)),
  ] : [
    ...(cards.kpiOrder || []).filter((c) => DASHBOARD_CHANNELS.includes(c)),
    ...DASHBOARD_CHANNELS.filter((c) => !(cards.kpiOrder || []).includes(c)),
  ];
  // Grade dos cards: colunas pela largura; arrastar e redimensionar mostram o resultado ao vivo
  // e gravam ao soltar (ver kpiGrid.js).
  const kpiGradeRef = useRef(null);
  // A grade só aparece depois que os dados chegam: medir quando o elemento existir (antes, o
  // efeito rodava uma vez com a grade ainda ausente e ficava preso em 4 colunas).
  const [kpiGradeEl, setKpiGradeEl] = useState(null);
  const refGrade = useCallback((el) => { kpiGradeRef.current = el; setKpiGradeEl(el); }, []);
  const [kpiColunas, setKpiColunas] = useState(4);
  const [kpiOrdemTemp, setKpiOrdemTemp] = useState(null);
  const [kpiTamanhoTemp, setKpiTamanhoTemp] = useState(null);
  useEffect(() => {
    const el = kpiGradeEl;
    if (!el) return;
    const medir = () => setKpiColunas(colunasDaGrade(el.clientWidth));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [kpiGradeEl]);
  const kpisVisiveis = (kpiOrdemTemp || kpiChannels).filter((c) => !personal || editing || !cards.kpiHidden?.includes(c));
  const kpiSpans = arrumarKpis(
    kpisVisiveis,
    kpiTamanhoTemp ? { ...cards.kpiSizes, [kpiTamanhoTemp.channel]: kpiTamanhoTemp.span } : cards.kpiSizes || {},
    kpiColunas,
  );
  function arrastarKpi(ev, channel) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const alca = ev.currentTarget;
    alca.setPointerCapture(ev.pointerId);
    const inicial = kpiChannels;
    let ordem = inicial;
    setKpiOrdemTemp(ordem);
    const mover = (e) => {
      const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-kpi]")?.dataset.kpi;
      if (!alvo || alvo === channel) return;
      const nova = moverPara(ordem, channel, alvo);
      if (nova !== ordem) { ordem = nova; setKpiOrdemTemp(nova); }
    };
    const fim = () => {
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", fim);
      alca.removeEventListener("pointercancel", fim);
      setKpiOrdemTemp(null);
      if (ordem.join() !== inicial.join()) updateCards({ kpiOrder: ordem });
    };
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", fim);
    alca.addEventListener("pointercancel", fim);
  }
  function redimensionarKpi(ev, channel) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    const alca = ev.currentTarget, grade = kpiGradeRef.current, card = alca.closest("[data-kpi]");
    if (!grade || !card) return;
    alca.setPointerCapture(ev.pointerId);
    const passo = (grade.clientWidth + 16) / kpiColunas, largura = card.getBoundingClientRect().width, x0 = ev.clientX;
    const salvo = Number(cards.kpiSizes?.[channel]) || 1;
    let span = salvo;
    const mover = (e) => {
      const n = Math.max(1, Math.min(TAMANHO_MAXIMO, kpiColunas, Math.round((largura + 16 + e.clientX - x0) / passo)));
      if (n !== span) { span = n; setKpiTamanhoTemp({ channel, span: n }); }
    };
    const fim = () => {
      alca.removeEventListener("pointermove", mover);
      alca.removeEventListener("pointerup", fim);
      alca.removeEventListener("pointercancel", fim);
      setKpiTamanhoTemp(null);
      if (span !== salvo) updateCards({ kpiSizes: { ...cards.kpiSizes, [channel]: span } });
    };
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", fim);
    alca.addEventListener("pointercancel", fim);
  }
  const kpis=useMemo(()=>kpiSummary(regionalRows,targets),[regionalRows,targets])
  const expandedBreakdown=useMemo(()=>expanded?kpiBreakdown(regionalRows,expanded):[],[regionalRows,expanded])
  const updateProfile = (values) =>
    update((s) => ({
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === profile.id ? { ...p, ...values } : p,
      ),
    }));
  const changeWidgets = (fn) =>
    update((s) => ({
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === profile.id
          ? { ...p, [device]: fn(p[device] || p.desktop) }
          : p,
      ),
    }));
  const patch = (id, values) =>
    changeWidgets((ws) =>
      ws.map((w) => (w.id === id ? { ...w, ...values } : w)),
    );
  const move = (from, to) => changeWidgets((ws) => reorder(ws, from, to));
  const openRetail = () =>
    update((s) => {
      const saved = s.profiles.find((p) => p.id === "retail");
      if (saved) return { ...s, activeId: saved.id };
      const retail = {
        id: "retail",
        name: "Varejo",
        mobile: null,
        desktop: [
          widget("retail-sales", "Vendas do varejo", "date", "line", {
            channel: "VAREJO",
            width: 8,
            limit: 366,
          }),
          widget("retail-team", "Equipe do varejo", "person", "bar", {
            channel: "VAREJO",
            width: 4,
          }),
          widget("retail-products", "Peças do varejo", "product", "bar", {
            channel: "VAREJO",
            limit: 10,
          }),
          widget("retail-stores", "Varejo por loja", "store", "bar", {
            channel: "VAREJO",
          }),
        ],
      };
      return { ...s, activeId: retail.id, profiles: [...s.profiles, retail] };
    });
  const dataFor=useMemo(()=>{const cache=new Map();return w=>{const id=JSON.stringify(w);if(cache.has(id))return cache.get(id);const data=compute(w);cache.set(id,data);return data}
  function compute(w) {
    if (w.dimension !== "date" || !w.periodDays)
      return analyze(rows, w, targets, region);
    const latest = rows.reduce(
      (value, row) =>
        row.date > value && row.date !== "Sem data" ? row.date : value,
      "",
    );
    if (!latest) return [];
    const end = new Date(`${latest}T12:00:00`);
    const first = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate() - w.periodDays + 1,
    );
    const start = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-${String(first.getDate()).padStart(2, "0")}`;
    return analyze(
      [...historicalRows, ...rows].filter(
        (row) => row.date >= start && row.date <= latest,
      ),
      w,
      targets,
      region,
    );
  }},[rows,historicalRows,targets,region])
  function select(w, name) {
    if (name) setDetail({ w, name });
  }
  async function copyLink(name) {
    if (import.meta.env.MODE === "preview") {
      setNotice(
        "Prévia demonstrativa: links pessoais reais são gerados em Acessos no aplicativo conectado.",
      );
      return;
    }
    try {
      if (token) {
        await navigator.clipboard.writeText(location.href);
        setNotice("Seu link permanente foi copiado.");
        return;
      }
      if (role !== "admin") {
        await navigator.clipboard.writeText(
          `${location.origin}/perfil/${encodeURIComponent(name)}`,
        );
        setNotice(
          "Link copiado; requer login. Links sem senha são criados pelo administrador.",
        );
        return;
      }
      const { data } = await httpsCallable(functions, "criarLinkBI")({ name });
      const url = `${location.origin}/pessoal/${data.token}`;
      setNotice(`Link permanente criado: ${url}`);
      await navigator.clipboard.writeText(url);
    } catch {
      setNotice(
        "Não foi possível copiar. Abra o perfil e copie o endereço do navegador.",
      );
    }
  }
  function addProfile(fresh = false) {
    if (state.profiles.length >= 20) {
      setNotice("Você já tem 20 perfis. Exclua um antes de criar outro.");
      return;
    }
    const name = profileName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    update((s) => ({
      ...s,
      activeId: id,
      profiles: [
        ...s.profiles,
        {
          ...JSON.parse(
            JSON.stringify(fresh ? initial().profiles[0] : profile),
          ),
          id,
          name,
        },
      ],
    }));
    setProfileName("");
  }
  useEffect(() => {
    if (!config && !detail) return;
    const previous = document.activeElement;
    const handler = (e) => {
      if (e.key === "Escape") {
        setConfig(null);
        setDetail(null);
      }
      if (e.key === "Tab") {
        const dialog = document.querySelector('.bi-overlay [role="dialog"]');
        const nodes = dialog?.querySelectorAll(
          'button:not(:disabled),input,select,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [config, detail]);
  const selected = config && widgets.find((w) => w.id === config);
  if (!ready)
    return <div className="bi-empty">Carregando seu espaço de análise…</div>;
  return (
    <div className="bi-workspace">
      {/* Controles da visão: no Faturamento vão para a barra de filtros de cima (props barra.inicio / barra.fim), senão ficam aqui. */}
      {(() => {
        const controles = <>

        <button
          className={editing ? "bi-button active" : "bi-button"}
          onClick={() => setEditing((v) => !v)}
        >
          <Settings2 size={16} />
          {editing ? "Concluir edição" : "Personalizar"}
        </button>
        <select
          aria-label={`Visualização: ${profile.name || "Visão geral"}`}
          title={`Visualização: ${profile.name || "Visão geral"}`}
          value={profile.id}
          onChange={(e) => {
            update((s) => ({ ...s, activeId: e.target.value }));
            setConfig(null);
          }}
        >
          {state.profiles.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
              {p.id === state.defaultId ? " ★" : ""}
            </option>
          ))}
        </select>
        <details className="bi-view-options">
          <summary
            aria-label="Mais opções de visualização"
            title="Opções de visualização"
          >
            <Ellipsis size={18} />
          </summary>
          <div className="bi-view-menu">
            {!personal && (
              <button className="bi-button" onClick={openRetail}>
                Visão varejo
              </button>
            )}
            {!personal &&
              ["admin", "coordenador", "supervisor"].includes(role) && (
                <a className="bi-button" href="/metas">
                  Ajustar metas
                </a>
              )}
            <button
              title="Definir como padrão"
              aria-label="Definir perfil padrão"
              onClick={() => update((s) => ({ ...s, defaultId: profile.id }))}
            >
              <Star
                size={16}
                fill={profile.id === state.defaultId ? "currentColor" : "none"}
              />
            </button>
            <div className="bi-segment">
              <button
                className={device === "desktop" ? "active" : ""}
                aria-label="Layout para computador"
                title="Layout para computador"
                onClick={() => setDevice("desktop")}
              >
                <Monitor size={15} />
              </button>
              <button
                className={device === "mobile" ? "active" : ""}
                aria-label="Layout para celular"
                title="Layout para celular"
                onClick={() => setDevice("mobile")}
              >
                <Smartphone size={15} />
              </button>
            </div>
          </div>
        </details>
        </>
        const salvar = <>
        <span className="bi-save-state" role="status" title={status}>
          {status.includes("não salvas")
            ? "Não salvo"
            : busy
              ? "Salvando…"
              : status.includes("Salvo") || status.includes("sincronizado")
                ? "Salvo"
                : ""}
        </span>
        <RainbowButton className="bi-button primary" disabled={busy} onClick={save}>
          <Save size={15} />
          {busy ? "Salvando…" : "Salvar"}
        </RainbowButton>
        </>
        if (barra?.inicio && barra?.fim) return <>{createPortal(controles, barra.inicio)}{createPortal(salvar, barra.fim)}</>
        return <div className="bi-toolbar">{controles}{salvar}</div>
      })()}
      {editing && (
        <div className="bi-editbar">
          <input
            aria-label="Nome do novo perfil"
            placeholder="Nome de uma nova visualização"
            value={profileName}
            maxLength={60}
            onChange={(e) => setProfileName(e.target.value)}
          />
          <button
            onClick={() => addProfile(true)}
            disabled={!profileName.trim()}
          >
            <Plus size={15} /> Criar perfil
          </button>
          <button onClick={() => addProfile()} disabled={!profileName.trim()}>
            <Copy size={15} />
            Duplicar perfil
          </button>
          <button
            disabled={!profileName.trim()}
            onClick={() => {
              updateProfile({ name: profileName.trim() });
              setProfileName("");
            }}
          >
            Renomear visualização
          </button>
          <button
            onClick={() => {
              if (
                state.profiles.length > 1 &&
                window.confirm("Excluir este perfil de visualização?")
              ) {
                update((s) => {
                  const ps = s.profiles.filter((p) => p.id !== profile.id);
                  return {
                    ...s,
                    profiles: ps,
                    activeId: ps[0].id,
                    defaultId:
                      s.defaultId === profile.id ? ps[0].id : s.defaultId,
                  };
                });
              }
            }}
            disabled={state.profiles.length === 1}
          >
            Excluir perfil
          </button>
          <button
            onClick={() =>
              changeWidgets((ws) => [
                ...ws,
                widget(crypto.randomUUID(), "Nova análise", "store"),
              ])
            }
          >
            <Plus size={16} />
            Adicionar widget
          </button>
          <small>Arraste um campo para o gráfico:</small>
          {Object.entries(dims).map(([k, v]) => (
            <button
              key={k}
              draggable
              onDragStart={(e) => {
                fieldDrag.current = k;
                e.dataTransfer.setData("text/plain", k);
              }}
              onDragEnd={() => (fieldDrag.current = null)}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      {notice && (
        <div role="status" className="bi-notice">
          {notice}
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      <div className="bi-kpis bi-kpis-grade" ref={refGrade}>
        {kpisVisiveis
          .map((channel) => {
            const { span, sub } = kpiSpans.get(channel) || { span: 1, sub: 15 };
            const corIndice = [...channel].reduce((s, c) => s + c.charCodeAt(0), 0);
            const metric = cards.kpiMetrics?.[channel] || "value";
            const w = widget(channel, channel, "date", "line", {
              channel,
              limit: 100000,
              metric,
            });
            const summary=kpis[channel]
            const data = summary ? [] : dataFor(w);
            const total = summary ? summary[metric] : data.reduce((sum, row) => sum + row.value, 0);
            const target =
              metric === "value"
                ? targets
                    .filter((t) => matchesChannel(t,channel))
                    .reduce((sum, t) => sum + (Number(t.meta) || 0), 0)
                : 0;
            const hasTarget = target > 0 && !region;
            const achievement = hasTarget ? total / target * 100 : 0;
            const achieved = hasTarget && total >= target;
            return (
              <Popover.Root key={channel} open={expanded===channel} onOpenChange={open=>setExpanded(open?channel:null)}><article
                style={{ gridColumn: `span ${sub}` }}
                data-kpi={channel}
                className={`bi-kpi ${expanded === channel ? "expanded" : ""}${achieved ? " bi-kpi-achieved" : ""}${span >= 2 && kpiColunas >= 2 ? " bi-kpi-duplo" : ""}${kpiOrdemTemp ? " bi-kpi-reorganizando" : ""}`}
                key={channel}
              >
                {editing && (
                  <div className="bi-kpi-edicao">
                    <button
                      type="button"
                      className="bi-kpi-alca"
                      aria-label={`Arrastar ${channel} para outra posição`}
                      title="Arraste para mudar a posição"
                      onPointerDown={(ev) => arrastarKpi(ev, channel)}
                      onKeyDown={(ev) => {
                        if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
                        ev.preventDefault();
                        const i = kpiChannels.indexOf(channel), j = i + (ev.key === "ArrowRight" ? 1 : -1);
                        if (j >= 0 && j < kpiChannels.length) updateCards({ kpiOrder: moverPara(kpiChannels, channel, kpiChannels[j]) });
                      }}
                    >
                      <GripVertical size={15} />
                    </button>
                    <select
                      aria-label={`Tamanho do card ${channel}`}
                      value={Math.min(TAMANHO_MAXIMO, cards.kpiSizes?.[channel] || 1)}
                      onChange={(e) =>
                        updateCards({
                          kpiSizes: {
                            ...cards.kpiSizes,
                            [channel]: Number(e.target.value),
                          },
                        })
                      }
                    >
                      <option value={1}>Compacto</option>
                      <option value={2}>Duplo</option>
                      <option value={3}>Triplo</option>
                    </select>
                    <select
                      aria-label={`Informação do card ${channel}`}
                      value={metric}
                      onChange={(e) =>
                        updateCards({
                          kpiMetrics: {
                            ...cards.kpiMetrics,
                            [channel]: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="value">Receita líquida</option>
                      <option value="records">Registros</option>
                      {!['SERVIÇOS','MÃO DE OBRA'].includes(channel) && (
                        <option value="quantity">Unidades</option>
                      )}
                    </select>
                    {personal&&<button
                      onClick={() =>
                        updateCards({
                          kpiHidden: cards.kpiHidden?.includes(channel)
                            ? cards.kpiHidden.filter((c) => c !== channel)
                            : [...(cards.kpiHidden || []), channel],
                        })
                      }
                    >
                      {cards.kpiHidden?.includes(channel)
                        ? "Mostrar card"
                        : "Ocultar card"}
                    </button>}
                  </div>
                )}
                <Popover.Trigger asChild><button
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setExpanded(null);
                  }}
                  aria-expanded={expanded === channel}
                >
                  <span className="bi-kpi-nome" title={channel}><KpiIcone index={[...channel].reduce((s,c)=>s+c.charCodeAt(0),0)}/><span className="bi-kpi-nome-texto">{channel}</span></span>
                  <strong>
                    {metric === "quantity" && !(summary?.hasQuantity||data.length)
                      ? "Não informada"
                      : metric === "value"
                        ? money(total)
                        : total.toLocaleString("pt-BR")}
                  </strong>
                  <KpiSpark data={dataFor(w)} index={corIndice}/>
                  {span >= 2 && kpiColunas >= 2 && <KpiArea data={dataFor(w)} cor={corKpi(corIndice)} formatar={metric === "value" ? (n) => "R$ " + new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n) : undefined} />}
                  {metric === "value" && (
                    <span className="bi-kpi-goal">
                      {hasTarget ? <>
                        <span className="bi-kpi-goal-label">
                          <span>{achievement.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da meta</span>
                          {achieved && <span>Meta atingida</span>}
                        </span>
                        <progress aria-label={`Atingimento da meta de ${channel}`} max={100} value={Math.max(0, Math.min(100, achievement))}/>
                        <span className="bi-kpi-goal-target">Meta {money(target)}</span>
                      </> : <span className="bi-kpi-goal-target">{region ? "Sem meta para este recorte" : "Meta não cadastrada"}</span>}
                    </span>
                  )}
                  <KpiInsight
                    rows={insightRows}
                    history={insightHistory}
                    channel={channel}
                    metric={metric}
                  />
                  {/* Só quando a métrica não é o padrão (receita) vale dizer o que o número mede. */}
                  {metric !== "value" && <small>{metric === "quantity" ? "Unidades informadas" : "Registros na base"}</small>}
                </button></Popover.Trigger>
                {editing && kpiColunas > 1 && (
                  <button
                    type="button"
                    className="bi-kpi-redim"
                    aria-label={`Largura do card ${channel}: ${span} coluna(s). Setas para ajustar.`}
                    title="Arraste para os lados para ocupar 1, 2 ou 3 colunas"
                    onPointerDown={(ev) => redimensionarKpi(ev, channel)}
                    onKeyDown={(ev) => {
                      if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
                      ev.preventDefault();
                      const atual = Math.min(TAMANHO_MAXIMO, Number(cards.kpiSizes?.[channel]) || 1);
                      const novo = Math.max(1, Math.min(TAMANHO_MAXIMO, atual + (ev.key === "ArrowRight" ? 1 : -1)));
                      if (novo !== atual) updateCards({ kpiSizes: { ...cards.kpiSizes, [channel]: novo } });
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 13L13 5M9 13L13 9" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </button>
                )}
                {expanded === channel && (
                  <Popover.Portal><Popover.Content className="bi-kpi-chart" data-bi-details="true" side="bottom" align="start" sideOffset={8} collisionPadding={16} aria-label={`Detalhes de ${channel}`}>
                    <div className="bi-kpi-detail-heading"><strong>{channel}</strong><button type="button" aria-label="Fechar detalhes do faturamento" onClick={()=>setExpanded(null)}><X size={15}/></button></div>
                    <ComparativoMes rows={regionalRows} historicalRows={regionalHistory} channel={channel} />
                    {/* Com uma origem só, o card repetia o faturamento que já está acima. */}
                    {expandedBreakdown.length > 1 && <div className="bi-kpi-breakdown">{expandedBreakdown.map((item,i)=><div key={item.name}><IconeCanal nome={item.name} indice={i}/><span><span>{item.name}</span><strong>{money(item.value)}</strong>{expandedBreakdown.length>1&&<small>{Math.round(item.value/Math.max(1,expandedBreakdown.reduce((s,x)=>s+x.value,0))*100)}% do total</small>}</span></div>)}</div>}
                    <KpiTrends
                      rows={regionalRows}
                      historicalRows={regionalHistory}
                      channel={channel}
                      metric={metric}
                      target={region ? null : target}
                      days={cardPeriods[channel] || 30}
                      onDaysChange={(days) =>
                        setCardPeriods((current) => ({
                          ...current,
                          [channel]: days,
                        }))
                      }
                      comparisonDays={cardComparisons[channel] || 7}
                      onComparisonChange={(days) =>
                        setCardComparisons((current) => ({
                          ...current,
                          [channel]: days,
                        }))
                      }
                      chartType={
                        ["line", "bar", "area"].includes(
                          cards.kpiTypes?.[channel],
                        )
                          ? cards.kpiTypes[channel]
                          : "line"
                      }
                      onChartTypeChange={(type) =>
                        updateCards({
                          kpiTypes: { ...cards.kpiTypes, [channel]: type },
                        })
                      }
                    />
                  </Popover.Content></Popover.Portal>
                )}
              </article></Popover.Root>
            );
          })}
      </div>
      {region && (
        <button className="bi-region-filter" onClick={() => setRegion("")}>
          {typeof region === "string"
            ? `Região: ${region}`
            : `${dims[region.level]}: ${region.name}`}{" "}
          · Limpar filtro ×
        </button>
      )}
      <DraggableWidgetGrid
        key={`${profile.id}:${device}`}
        className="bi-draggable-grid"
        items={gridItems}
        // A alça de arrastar aparece sempre, então reorganizar também funciona sempre;
        // só redimensionar exige "Personalizar". O arraste começa apenas pela alça.
        editable
        maxColumns={device === "mobile" ? 1 : 12}
        cellSize={85}
        resizable={editing}
        gap={18}
        radius={10}
        onChange={(items) =>
          changeWidgets((ws) =>
            items
              .map((item) => {
                const current = ws.find((w) => w.id === item.id);
                return (
                  current && {
                    ...current,
                    width: item.width,
                    height: item.height,
                    tileSize: null,
                  }
                );
              })
              .filter(Boolean),
          )
        }
        renderItem={(item) => {
          const w = widgets.find((w) => w.id === item.id);
          if (!w) return null;
          const i = widgets.indexOf(w);
          const chartData = dataFor(w);
          const monthDays =
            w.dimension === "date" && chartData.length
              ? new Date(
                  Number(chartData.at(-1).name.slice(0, 4)),
                  Number(chartData.at(-1).name.slice(5, 7)),
                  0,
                ).getDate()
              : 30;
          const chartTargetFull =
            w.metric === "value" &&
            ["date", "person"].includes(w.dimension) &&
            !region &&
            !w.store &&
            !w.source
              ? w.dimension === "person"
                ? chartData.reduce((sum, point) => sum + (point.meta || 0), 0)
                : targets
                    .filter((t) => matchesChannel(t,w.channel))
                    .reduce((sum, t) => sum + (Number(t.meta) || 0), 0)
              : 0;
          const chartTarget =
            w.dimension === "date" && w.periodDays
              ? (chartTargetFull * Math.min(monthDays, w.periodDays)) /
                monthDays
              : chartTargetFull;
          const chartTotal = chartData.reduce(
            (sum, point) => sum + point.value,
            0,
          );
          const trend=widgetTrends.get(w.id)||null;
          // Meta diária para a linha tracejada do gráfico por data: meta do mês ÷ dias de venda
          // (segunda a sábado) do mês do último ponto.
          let metaDiaria = 0;
          if (w.dimension === "date" && chartTargetFull > 0 && w.display?.meta !== false && /^\d{4}-\d{2}/.test(chartData.at(-1)?.name || "")) {
            const ano = Number(chartData.at(-1).name.slice(0, 4)), mes = Number(chartData.at(-1).name.slice(5, 7)) - 1;
            let diasVenda = 0;
            for (let d = 1; d <= monthDays; d++) if (new Date(ano, mes, d).getDay() !== 0) diasVenda++;
            metaDiaria = diasVenda ? chartTargetFull / diasVenda : 0;
          }
          return (
            <section
              key={w.id}
              className="bi-widget"
              style={{ height: "100%" }}
              onDragOver={(e) => {
                if (fieldDrag.current) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (fieldDrag.current)
                  patch(w.id, { dimension: fieldDrag.current });
                fieldDrag.current = null;
              }}
            >
              <header>
                <button
                  type="button"
                  data-widget-drag-handle
                  title="Arrastar para outro bloco"
                  aria-label={`Arrastar ${w.title}`}
                >
                  <GripVertical size={17} />
                </button>
                <div>
                  <h3>{w.title}</h3>
                  <small>
                    {dims[w.dimension]} · {w.channel || "Todos os canais"} ·{" "}
                    {w.metric === "value"
                      ? "Receita líquida"
                      : w.metric === "quantity"
                        ? "Unidades líquidas"
                        : "Registros"}
                    {w.dimension !== "date" ? ` · Top ${w.limit}` : ""}
                  </small>
                </div>
                <div className="bi-widget-tools">
                  {w.dimension === "date" && (
                    <select
                      aria-label={`Período de ${w.title}`}
                      value={w.periodDays || 0}
                      onChange={(e) =>
                        patch(w.id, { periodDays: Number(e.target.value) })
                      }
                    >
                      <option value={0}>Mês</option>
                      <option value={7}>7 dias</option>
                      <option value={30}>30 dias</option>
                    </select>
                  )}
                  {w.dimension === "date" && (
                    <select
                      aria-label={`Comparar ${w.title}`}
                      title="Comparar com período anterior"
                      value={w.comparisonDays || 30}
                      onChange={(e) =>
                        patch(w.id, { comparisonDays: Number(e.target.value) })
                      }
                    >
                      <option value={7}>vs. semana</option>
                      <option value={30}>vs. mês</option>
                      <option value={90}>vs. trimestre</option>
                    </select>
                  )}
                  {editing && (
                    <>
                      <button
                        disabled={i === 0}
                        aria-label="Mover para cima"
                        onClick={() => move(w.id, widgets[i - 1].id)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        disabled={i === widgets.length - 1}
                        aria-label="Mover para baixo"
                        onClick={() => move(w.id, widgets[i + 1].id)}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </>
                  )}
                  {w.type === "table" && w.dimension === "person" && (
                    <button
                      aria-label="Buscar colaborador"
                      aria-pressed={buscaEquipe === w.id}
                      onClick={() => setBuscaEquipe(buscaEquipe === w.id ? null : w.id)}
                    >
                      <Search size={16} />
                    </button>
                  )}
                  <button
                    aria-label={`Configurar ${w.title}`}
                    onClick={() => setConfig(w.id)}
                  >
                    <Settings2 size={16} />
                  </button>
                </div>
              </header>
              {/* O card agora tem a altura do conteúdo: o gráfico recebe
                  a altura escolhida no bloco, para continuar esticando. */}
              <div
                className="bi-chart"
                style={{
                  flex: 1,
                  minHeight: Math.max(160, ajustarAltura(w.height) - 110),
                }}
              >
                {w.type === "table" && w.dimension === "person" ? <EquipeTabela rows={chartData} fmt={money} onSelect={(name) => select(w, name)} buscaAberta={buscaEquipe === w.id} onFecharBusca={() => setBuscaEquipe(null)} /> : <Chart
                  data={chartData}
                  type={w.type}
                  metric={w.metric}
                  color={w.color}
                  options={w.display}
                  compare={
                    w.display?.meta !== false &&
                    w.dimension === "person" &&
                    w.metric === "value" &&
                    !region &&
                    !w.store &&
                    !w.source
                  }
                  onSelect={(name) => select(w, name)}
                  metaDiaria={metaDiaria}
                />}
              </div>
              <footer>
                {w.dimension === "product" && rows.some((r) => !r.product) && (
                  <span>Registros sem identificação de peça não entram neste gráfico.</span>
                )}
                {chartTarget > 0 && (
                  <strong className="bi-widget-goal">
                    {money(Math.max(0, chartTarget - chartTotal))} para a meta ·{" "}
                    {Math.max(
                      0,
                      Math.round((1 - chartTotal / chartTarget) * 100),
                    )}
                    % restante
                  </strong>
                )}
                {trend?.points.length > 0 && (
                  <span className="bi-widget-forecast">
                    Projeção do mês{" "}
                    {w.metric === "value"
                      ? money(trend.projected)
                      : Math.round(trend.projected).toLocaleString(
                          "pt-BR",
                        )}{" "}
                    ·{" "}
                    {trend.delta == null
                      ? "sem período anterior comparável"
                      : `${trend.delta >= 0 ? "+" : ""}${trend.delta.toFixed(1)}% vs. período anterior`}
                  </span>
                )}
                {w.dimension === "person" &&
                  ["admin", "coordenador", "supervisor"].includes(role) && (
                    <a href="/metas">
                      {role === "admin" ? "Editar metas" : "Consultar metas"} ↗
                    </a>
                  )}
              </footer>
            </section>
          );
        }}
      />
      {personal && (
        <button className="bi-button" onClick={() => copyLink(person)}>
          <Copy size={15} />
          Copiar meu link
        </button>
      )}
      {selected && createPortal(
        <div className="bi-overlay" onClick={() => setConfig(null)}>
          <aside
            className="bi-editor we-editor"
            role="dialog"
            aria-modal="true"
            aria-label="Editar widget"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setConfig(null);
            }}
          >
            <WidgetEditor
              widget={selected}
              patch={(values) => patch(selected.id, values)}
              dims={dims}
              types={types}
              canCompare={
                selected.dimension === "person" &&
                selected.metric === "value" &&
                !region &&
                !selected.store &&
                !selected.source
              }
              lojas={[...new Set(rows.map((r) => r.store))]}
              canais={channels}
              dados={dataFor(selected)}
              onDuplicar={() => {
                const id = crypto.randomUUID();
                changeWidgets((ws) => [...ws, { ...selected, id, title: `${selected.title} — cópia` }]);
                setConfig(id);
              }}
              onRemover={() => {
                changeWidgets((ws) => ws.filter((w) => w.id !== selected.id));
                setConfig(null);
              }}
              onFechar={() => setConfig(null)}
            />
          </aside>
        </div>
      , document.body)}
      {detail && createPortal(
        <div className="bi-overlay" onClick={() => setDetail(null)}>
          <section
            className="bi-drill"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhes da análise"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDetail(null);
            }}
          >
            <header>
              <div>
                <span className="bi-eyebrow">EXPLORAR DADOS</span>
                <h2>{detail.name}</h2>
              </div>
              <button
                autoFocus
                aria-label="Fechar detalhes"
                onClick={() => setDetail(null)}
              >
                <X />
              </button>
            </header>
            {detail.w.dimension === "person" ? <>
              {comRotas && !personal && <AtalhosPessoa nome={detail.name} onIr={() => setDetail(null)} />}
              <GraficoPessoa fmt={money} dias={rows.filter((r) => key(r.person) === key(detail.name) && matchesChannel(r, detail.w.channel)).filter((r) => matchesTerritory(r, region))} historico={regionalHistory.filter((r) => key(r.person) === key(detail.name) && matchesChannel(r, detail.w.channel))} />
              <ResumoPessoa fmt={money} rows={rows.filter((r) => key(r.person) === key(detail.name) && matchesChannel(r, detail.w.channel)).filter((r) => (!detail.w.source || r.source === detail.w.source) && (!detail.w.store || r.store === detail.w.store) && matchesTerritory(r, region))} />
            </> : (
              // Peça, loja, canal…: ranking de quem vendeu; clicar na pessoa abre as vendas dela.
              <RankingDoItem
                fmt={money}
                rows={rows.filter((r) =>
                  (detail.w.dimension === "channel" ? mainChannel(r) === detail.name : r[detail.w.dimension] === detail.name) &&
                  (!detail.w.source || r.source === detail.w.source) &&
                  (!detail.w.store || r.store === detail.w.store) &&
                  matchesChannel(r, detail.w.channel) &&
                  matchesTerritory(r, region),
                )}
              />
            )}
          </section>
        </div>
      , document.body)}
    </div>
  );
}
