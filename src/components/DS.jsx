import { Estado } from './Estados.jsx'
/**
 * DS.jsx — Design System Pós-Venda (Pernambuco Motos)
 * ─────────────────────────────────────────────────────────────────────────────
 * FONTE ÚNICA de todos os componentes visuais do app.
 * Toda página (nova ou existente) importa daqui. Nunca duplicar inline.
 *
 * Uso:
 *   import { Chip, FiltersBar, Card, CardHead, KpiStrip,
 *            SaveBar, Dot, Skeleton, PageTitle, SectionTitle,
 *            Divider, ActionBar } from '../components/DS'
 *
 * Princípios:
 *   • Data-first: filtro fino + KPIs compactos → tabela aparece sem rolar
 *   • Ícones Lucide (strokeWidth 1.75) — nunca emojis
 *   • Paleta: 95% neutros, 5% Honda Red; semáforo só verde/âmbar/vermelho
 *   • Tipografia, cor e raio vêm de src/theme/tokens.css — nunca hardcoded aqui
 *   • Save bar igual em toda página editável
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Save, X, CheckCircle2, ArrowUpRight, ArrowDownRight, Calendar, Building2, Users, Globe, Tag as TagIcon, LayoutGrid, Layers } from '../icons/iconoir'
import { fmtBRL, fmtPct } from '../utils/formatacao.js'
import logoSplash from '../assets/Ativo 5@72x.png'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOGRAFIA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Título de página — 16px 800, letter-spacing apertado.
 * Uso: <PageTitle>Estoque</PageTitle>
 */
export function PageTitle({ children, style }) {
  return (
    <h1 style={{
      fontSize: 'var(--text-lg)',
      fontWeight: 800,
      color: 'var(--text)',
      letterSpacing: '-0.4px',
      lineHeight: 1.2,
      margin: 0,
      ...style,
    }}>
      {children}
    </h1>
  )
}

/**
 * Título de seção — mesmo 16px, peso 600 (distingue de PageTitle).
 * Uso: <SectionTitle>Visão por loja</SectionTitle>
 */
export function SectionTitle({ children, style }) {
  return (
    <h2 style={{
      fontSize: 'var(--text-lg)',
      fontWeight: 600,
      color: 'var(--text)',
      letterSpacing: '-0.3px',
      lineHeight: 1.2,
      margin: 0,
      ...style,
    }}>
      {children}
    </h2>
  )
}

/**
 * Label de campo / cabeçalho de tabela — 10px 700 MAIÚSC.
 * Uso: <FieldLabel>Meta de Peças (R$)</FieldLabel>
 */
export function FieldLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.6px',
      color: 'var(--text3)',
      marginBottom: 5,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT DE PÁGINA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper padrão de página com padding correto.
 * Uso: <Page><FiltersBar>…</FiltersBar><KpiStrip … /><Card>…</Card></Page>
 */
export function Page({ children, style }) {
  return (
    <div className="page" style={style}>
      {children}
    </div>
  )
}

/**
 * PageLayout — estrutura completa de página (USAR EM TODA PÁGINA NOVA).
 *
 * Props:
 *   title    — título da página
 *   sub      — subtítulo opcional
 *   actions  — botões do lado direito do título
 *   filters  — conteúdo da barra de filtros (Chip, FiltroDropdown, etc.)
 *   kpis     — array de KPIs para o KpiStrip (opcional)
 *   loading  — mostra skeletons quando true
 *   empty    — config { icon, title, sub } para EmptyState (quando sem dados)
 *   children — conteúdo principal (tabelas, cards, etc.)
 *
 * Uso:
 *   <PageLayout
 *     title="Comissões" sub="Período atual"
 *     actions={<button>Exportar</button>}
 *     filters={<><FiltroAnoMes .../><FiltroDropdown .../></>}
 *     kpis={[{ label: 'Total', valor: 'R$ 12k' }]}
 *     loading={loading}
 *     empty={{ icon: DollarSign, title: 'Sem comissões', sub: 'Selecione outro período' }}
 *     isEmpty={dados.length === 0}
 *   >
 *     <Card>…tabela…</Card>
 *   </PageLayout>
 */
export function PageLayout({ title, sub, actions, filters, kpis, loading, empty, isEmpty, children, style }) {
  return (
    <div className="page" style={style}>
      {/* Título + ações */}
      <ActionBar title={title} sub={sub}>
        {actions}
      </ActionBar>

      {/* Barra de filtros */}
      {filters && (
        <div className="filters-bar">{filters}</div>
      )}

      {/* KPIs */}
      {kpis && kpis.length > 0 && (
        <KpiStrip kpis={kpis} style={{ marginBottom: 14 }} />
      )}

      {/* Skeletons de carregamento */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          <Skeleton h={36} radius={6} />
          <Skeleton h={36} radius={6} style={{ opacity: 0.6 }} />
          <Skeleton h={36} radius={6} style={{ opacity: 0.35 }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && isEmpty && empty && (
        <EmptyState icon={empty.icon} title={empty.title} sub={empty.sub} />
      )}

      {/* Conteúdo */}
      {!loading && !isEmpty && children}
    </div>
  )
}

/**
 * Linha de ações no topo da página (título à esquerda, botões à direita).
 * Uso: <ActionBar title="Estoque"><button>…</button></ActionBar>
 */
export function ActionBar({ title, sub, children, style }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
      flexWrap: 'wrap',
      ...style,
    }}>
      <div>
        {title && <PageTitle>{title}</PageTitle>}
        {sub && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginTop: 3 }}>{sub}</div>
        )}
      </div>
      {children && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BARRA DE FILTROS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Container da barra de filtros — linha horizontal com separador na base.
 * Uso: <FiltersBar><Chip>…</Chip><Divider /><Chip>…</Chip></FiltersBar>
 */
export function FiltersBar({ children, style }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
      marginBottom: 14,
      ...style,
    }}>
      {children}
    </div>
  )
}

/**
 * Separador vertical na barra de filtros.
 * Uso: <FiltersBar><Chip>…</Chip><Divider /><Chip>…</Chip></FiltersBar>
 */
export function Divider() {
  return (
    <span style={{
      display: 'inline-block',
      width: 1,
      height: 18,
      background: 'var(--border2)',
      margin: '0 2px',
      flexShrink: 0,
    }} />
  )
}

/**
 * Chip de filtro — padrão em TODA barra de filtros.
 * Mesma altura (30px), mesmo radius (6px), ícone Lucide + ChevronDown.
 *
 * Props:
 *   icon    — componente Lucide (ex: Calendar, Building2)
 *   ativo   — destaca com borda/cor Honda Red sutil
 *   onClick — handler
 *
 * Uso: <Chip icon={Calendar} ativo>06/2026</Chip>
 */
export function Chip({ children, icon: Icon, ativo, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 30,
        padding: '0 10px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontFamily: 'var(--font)',
        fontSize: 'var(--text-sm2)',
        fontWeight: 500,
        background: ativo ? 'rgba(204,0,0,0.06)' : 'var(--bg2)',
        border: `1px solid ${ativo ? 'rgba(204,0,0,0.3)' : 'var(--border2)'}`,
        color: ativo ? 'var(--honda)' : 'var(--text2)',
        transition: 'border-color 0.15s, color 0.15s, background 0.15s',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {Icon && <Icon size={13} strokeWidth={1.75} style={{ opacity: 0.7 }} />}
      {children}
      <ChevronDown size={11} strokeWidth={2} style={{ opacity: 0.4, marginLeft: 1 }} />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Faixa compacta de KPIs — data-first, número protagonista.
 *
 * kpis: Array de { label, valor, sub?, cor?, delta? }
 *   delta: número (positivo = verde ↑, negativo = vermelho ↓)
 *
 * Uso:
 *   <KpiStrip kpis={[
 *     { label: 'Estoque', valor: 'R$ 817k', sub: '2.450 itens' },
 *     { label: 'Cobertura', valor: '102 d', cor: 'var(--green)', delta: 8 },
 *   ]} />
 */
export function KpiStrip({ kpis, style }) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      border: '1px solid rgba(15,23,42,0.09)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      background: 'var(--bg2)',
      boxShadow: '0 1px 4px rgba(15,23,42,0.04)',
      ...style,
    }}>
      {kpis.map((k, i) => {
        const pos = k.delta > 0
        const neg = k.delta < 0
        return (
          <div key={k.label} style={{
            flex: '1 1 110px',
            padding: '10px 16px',
            borderLeft: i > 0 ? '1px solid rgba(15,23,42,0.07)' : 'none',
          }}>
            <div style={{
              fontSize: 'var(--text-2xs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.7px',
              color: 'var(--text3)',
              marginBottom: 4,
            }}>
              {k.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 800,
                color: k.cor || 'var(--text)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}>
                {k.valor}
              </span>
              {k.delta != null && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: pos ? 'var(--green)' : neg ? 'var(--honda)' : 'var(--text3)',
                }}>
                  {pos ? <ArrowUpRight size={11} /> : neg ? <ArrowDownRight size={11} /> : null}
                  {Math.abs(k.delta)}%
                </span>
              )}
            </div>
            {k.sub && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginTop: 3 }}>{k.sub}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CARDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Card flat 2026 — borda fina, sombra quase invisível.
 * Uso: <Card pad="16px">conteúdo</Card>
 *      <Card><CardHead title="Estoque" badge={4} /><div>…</div></Card>
 */
export function Card({ children, style, pad }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--bg2)',
        border: '1px solid rgba(15,23,42,0.09)',
        borderRadius: 'var(--radius-md)',
        boxShadow: hover ? '0 4px 16px rgba(15,23,42,0.08)' : '0 1px 4px rgba(15,23,42,0.04)',
        transition: 'box-shadow 0.15s',
        overflow: 'hidden',
        ...style,
      }}
    >
      {pad ? <div style={{ padding: pad }}>{children}</div> : children}
    </div>
  )
}

/**
 * Cabeçalho de card com título, badge opcional e ação opcional.
 * Uso: <CardHead title="Estoque" badge={4} action={<button>…</button>} />
 */
export function CardHead({ title, badge, action, style }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 16px',
      borderBottom: '1px solid rgba(15,23,42,0.07)',
      ...style,
    }}>
      <span style={{ fontSize: 'var(--text-sm3)', fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      {badge != null && (
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
          letterSpacing: '0.3px',
          background: 'rgba(15,23,42,0.05)',
          color: 'var(--text3)',
          borderRadius: 'var(--radius)',
          padding: '1px 6px',
        }}>
          {badge}
        </span>
      )}
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────────────────────────────

/** Mapa de cores dos status */
const DOT_CORES = {
  green:  'var(--green)',
  amber:  'var(--amber)',
  red:    'var(--honda)',
  blue:   'var(--blue)',
  purple: 'var(--purple)',
  gray:   'var(--text3)',
}

/**
 * Ponto de status colorido — substitui as pills pesadas.
 * cor: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray' | hex
 *
 * Uso: <Dot cor="green" label="Ativo" />
 */
export function Dot({ cor, label, style }) {
  const bg = DOT_CORES[cor] || cor
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...style }}>
      <span style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: bg,
        flexShrink: 0,
      }} />
      {label && (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text2)' }}>{label}</span>
      )}
    </span>
  )
}

/**
 * Tag compacta com fundo semitransparente (curvas, tipos, estados).
 * cor: 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray'
 *
 * Uso: <Tag cor="red">Curva E</Tag>
 *      <Tag cor="green">Curva A</Tag>
 */
export function Tag({ children, cor = 'gray', style }) {
  const cores = {
    green:  { bg: 'rgba(22,163,74,0.10)',   color: 'var(--green)' },
    amber:  { bg: 'rgba(217,119,6,0.10)',   color: 'var(--amber)' },
    red:    { bg: 'rgba(204,0,0,0.08)',     color: 'var(--honda)' },
    blue:   { bg: 'rgba(59,130,246,0.08)',  color: 'var(--blue)' },
    purple: { bg: 'rgba(124,58,237,0.08)',  color: 'var(--purple)' },
    gray:   { bg: 'rgba(15,23,42,0.05)',    color: '#64748b' },
  }
  const s = cores[cor] || cores.gray
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      background: s.bg,
      color: s.color,
      borderRadius: 'var(--radius)',
      padding: '2px 7px',
      ...style,
    }}>
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CARREGAMENTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bloco esqueleto pulsante — substitui spinners em carregamento.
 * Uso: <Skeleton w={200} h={16} radius={4} />
 */
export function Skeleton({ w = '100%', h = 16, radius = 'var(--radius)', style }) {
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: radius,
      background: 'linear-gradient(90deg,#f1f5f9 25%,#e9eef5 50%,#f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'ds-skeleton 1.5s infinite ease-in-out',
      ...style,
    }} />
  )
}

/** CSS de animação do skeleton — injetar uma vez no root (App.jsx ou index.css) */
export const SKELETON_CSS = `
@keyframes ds-skeleton {
  0%   { background-position: 200% 0 }
  100% { background-position: -200% 0 }
}
`

// ─────────────────────────────────────────────────────────────────────────────
// SAVE BAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Barra de salvar — vidro fosco, fixa no rodapé, aparece SÓ com alterações.
 * Igual em todas as páginas editáveis (Metas, Regras, Colaboradores, etc.).
 *
 * Props:
 *   visivel    — mostra a barra
 *   salvo      — mostra confirmação "Salvo" por instantes
 *   onSalvar   — callback ao clicar Salvar
 *   onDescartar — callback ao clicar Descartar
 *   loading    — desabilita botões durante o save
 *
 * Uso:
 *   const [alterou, setAlterou] = useState(false)
 *   const [salvo, setSalvo] = useState(false)
 *   <SaveBar
 *     visivel={alterou} salvo={salvo}
 *     onSalvar={handleSalvar} onDescartar={handleDescartar}
 *   />
 */
// Barra de salvar — sticky no TOPO (não flutua sobre o conteúdo, aparece no
// fluxo natural de leitura). Renderizar logo após a filters-bar / barra de
// abas da página, antes do conteúdo editável. Ver [[design-system-posvenda]].
export function SaveBar({ visivel, salvo, onSalvar, onDescartar, loading, style }) {
  if (!visivel && !salvo) return null
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      backdropFilter: 'blur(10px)',
      background: 'rgba(255,255,255,0.92)',
      borderBottom: '1px solid rgba(15,23,42,0.10)',
      boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: '10px 20px',
      marginBottom: 12,
      ...style,
    }}>
      {salvo ? (
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--text-sm3)', color: 'var(--green)',
        }}>
          <CheckCircle2 size={14} /> Alterações salvas
        </span>
      ) : (
        <>
          <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>
            Você tem alterações não salvas
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onDescartar}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <X size={13} /> Descartar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={onSalvar}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            {loading
              ? <span style={{ display:'inline-block',width:11,height:11,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'var(--bg2)',animation:'spin 0.7s linear infinite'}} />
              : <Save size={13} />
            }
            Salvar
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Botão de alternar edição — "Editar" ↔ "Concluir edição". Único em todo o
 * app (antes duplicado em RegrasTables.jsx e TabelaIHS.jsx, um deles com uma
 * classe `btn-secondary` que nem existe no CSS — por isso o botão "Concluir
 * edição" não tinha estilo nenhum). Usar sempre este componente em vez de
 * reimplementar o toggle.
 * Uso: <EditToggleButton editando={editando} onToggle={() => setEditando(v => !v)} />
 */
export function EditToggleButton({ editando, onToggle, style }) {
  return (
    <button
      className={editando ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
      onClick={onToggle}
      style={{ marginLeft: 'auto', flexShrink: 0, ...style }}
    >
      {editando ? 'Concluir edição' : 'Editar'}
    </button>
  )
}

/**
 * Modal genérico — overlay centralizado, único em todo o app (nunca duplicar
 * um `position: fixed, inset: 0` na mão numa página). Fecha ao clicar fora ou
 * Esc. Uso:
 *   <Modal title="Novo Colaborador" onClose={fechar} footer={<>
 *     <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
 *     <button className="btn btn-primary" onClick={salvar}>Salvar</button>
 *   </>}>
 *     ...conteúdo...
 *   </Modal>
 * `className` opcional vai no overlay externo (ex.: "no-print" em modais que
 * não devem aparecer na impressão/PDF).
 */
export function Modal({ title, onClose, children, footer, maxWidth = 640, className }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Portal no body: centralizado na tela mesmo quando a página está rolada.
  return createPortal(
    <div
      className={`ui-modal-fundo${className ? ` ${className}` : ''}`}
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ overscrollBehavior: 'contain', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-xl)', padding: 24, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontWeight: 'var(--weight-bold, 700)', fontSize: 'var(--text-md2)', color: 'var(--text)' }}>{title}</div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        )}
        {children}
        {footer && (
          <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border2)', paddingTop: 16 }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TABELA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook de ordenação de tabela.
 * Uso:
 *   const { sortCol, sortDir, onSort, sortFn } = useSort('data', 'desc')
 *   const linhas = [...dados].sort(sortFn)
 *   <Th col="nome" onSort={onSort} sortCol={sortCol} sortDir={sortDir}>Nome</Th>
 */
export function useSort(colInicial = '', dirInicial = 'asc') {
  const [sortCol, setSortCol] = useState(colInicial)
  const [sortDir, setSortDir] = useState(dirInicial)

  function onSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function sortFn(a, b) {
    if (!sortCol) return 0
    const va = a[sortCol], vb = b[sortCol]
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb, 'pt-BR') : vb.localeCompare(va, 'pt-BR')
    return sortDir === 'asc' ? va - vb : vb - va
  }

  return { sortCol, sortDir, onSort, sortFn }
}

/**
 * Th ordenável padrão.
 * align: 'left' (padrão) | 'right' | 'center'
 * num: atalho para align='right' + tabular-nums no Td correspondente
 * Uso: <ThSort col="nome" sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Nome</ThSort>
 *      <ThSort col="curva" center sortCol={sortCol} sortDir={sortDir} onSort={onSort}>Curva</ThSort>
 */
export function ThSort({ col, children, num, center, align, sortCol, sortDir, onSort, style }) {
  const ativo = sortCol === col
  const textAlign = align || (num ? 'right' : center ? 'center' : 'left')
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        padding: '8px 10px',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: ativo ? 'var(--honda)' : 'var(--text3)',
        textAlign,
        whiteSpace: 'nowrap',
        borderBottom: '1px solid rgba(15,23,42,0.08)',
        transition: 'color 0.15s',
        ...style,
      }}
    >
      {children}
      <span style={{ marginLeft: 3, opacity: ativo ? 1 : 0.35, fontSize: 'var(--text-2xs)' }}>
        {ativo ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </th>
  )
}

/**
 * Th estático (sem sort).
 * align: 'left' (padrão) | 'right' | 'center'
 * num: atalho para align='right'
 */
export function Th({ children, num, center, align, style }) {
  const textAlign = align || (num ? 'right' : center ? 'center' : 'left')
  return (
    <th style={{
      padding: '8px 10px',
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: 'var(--text3)',
      textAlign,
      whiteSpace: 'nowrap',
      borderBottom: '1px solid rgba(15,23,42,0.08)',
      ...style,
    }}>
      {children}
    </th>
  )
}

/**
 * Td padrão de tabela.
 * align: 'left' (padrão) | 'right' | 'center'
 * num: atalho para align='right' + tabular-nums
 * center: atalho para align='center'
 * mono: fonte monoespaçada
 *
 * Uso: <Td num>R$ 1.234,56</Td>
 *      <Td center><Tag>Curva A</Tag></Td>
 */
export function Td({ children, num, center, align, mono, style, ...rest }) {
  const textAlign = align || (num ? 'right' : center ? 'center' : 'left')
  return (
    <td style={{
      padding: '8px 10px',
      fontSize: 'var(--text-sm)',
      color: 'var(--text2)',
      textAlign,
      fontVariantNumeric: num || mono ? 'tabular-nums' : undefined,
      fontFamily: mono ? 'var(--font-mono)' : undefined,
      ...style,
    }} {...rest}>
      {children}
    </td>
  )
}

/**
 * Linha de tabela com hover sutil.
 * Uso: <TrHover onClick={…}><Td>…</Td></TrHover>
 */
export function TrHover({ children, onClick, style }) {
  const [hover, setHover] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        background: hover ? 'rgba(15,23,42,0.025)' : 'transparent',
        transition: 'background 0.1s',
        borderBottom: '1px solid rgba(15,23,42,0.05)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </tr>
  )
}

/**
 * Linha de total de tabela — fundo levemente destacado, sem rótulo "Total".
 */
export function TrTotal({ children, style }) {
  return (
    <tr style={{
      background: 'rgba(15,23,42,0.02)',
      borderBottom: '2px solid rgba(15,23,42,0.08)',
      ...style,
    }}>
      {children}
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SELETOR DE COLUNAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Botão + dropdown para ligar/desligar colunas de tabela.
 *
 * cols: { [chave]: boolean }
 * defs: [{ k: 'chave', l: 'Rótulo' }]
 * onChange: (novoCols) => void
 *
 * Uso:
 *   const [cols, setCols] = useState({ pv: true, margem: true })
 *   <ColSelector cols={cols} defs={[{k:'pv',l:'PV total'},{k:'margem',l:'Margem'}]} onChange={setCols} />
 */
export function ColSelector({ cols, defs, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        Colunas
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 6px)',
          zIndex: 50,
          background: 'var(--bg2)',
          border: '1px solid rgba(15,23,42,0.10)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
          minWidth: 150,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          {defs.map(({ k, l }) => (
            <label key={k} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', fontSize: 'var(--text-sm2)', color: 'var(--text2)',
            }}>
              <input
                type="checkbox"
                checked={!!cols[k]}
                onChange={() => onChange({ ...cols, [k]: !cols[k] })}
                style={{ accentColor: 'var(--honda)' }}
              />
              {l}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado vazio — quando não há dados para exibir.
 * Uso: <EmptyState icon={Package} title="Sem itens" sub="Nenhum produto encontrado" />
 */
export function EmptyState({ icon: Icon, title, sub, children, style, tipo = 'vazio' }) {
  // Visual padronizado (components/Estados.jsx): fundo hachurado, ícone e ações.
  const icone = Icon && typeof Icon !== 'string' ? () => <Icon size={22} strokeWidth={1.5} /> : undefined
  return (
    <div style={style}>
      <Estado tipo={tipo} titulo={title} texto={sub} compacto icone={icone}>{children}</Estado>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────
// BADGE LOJA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Badge compacto de loja (3 letras).
 * Uso: <LojaBadge>ARA</LojaBadge>
 */
export function LojaBadge({ children, style }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      background: 'rgba(15,23,42,0.05)',
      color: 'var(--text2)',
      borderRadius: 'var(--radius)',
      padding: '1px 6px',
      ...style,
    }}>
      {children}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGES E STATUS
// ─────────────────────────────────────────────────────────────────────────────

export function Badge({ label, variant = 'gray' }) {
  return <span className={`badge badge-${variant}`}>{label}</span>
}

export function StatusBadge({ pct }) {
  if (pct === null || pct === undefined) return null
  if (pct >= 1)  return <Badge label={fmtPct(pct)} variant="green" />
  if (pct >= .8) return <Badge label={fmtPct(pct)} variant="amber" />
  return <Badge label={fmtPct(pct)} variant="red" />
}

export function getStatus(realizado, meta) {
  if (!meta || meta <= 0) return null
  const pct = realizado / meta
  if (pct >= 1)  return 'green'
  if (pct >= .8) return 'amber'
  return 'red'
}

export function ProgressBar({ pct, height = 5 }) {
  const clamp = Math.min((pct || 0) * 100, 100)
  const color = (pct || 0) >= 1 ? 'var(--green)' : (pct || 0) >= .8 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="pbar-wrap" style={{ height }}>
      <div className="pbar" style={{ width: `${clamp}%`, background: color, height: '100%' }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI CARD (rico — Dashboard e Snapshot)
// ─────────────────────────────────────────────────────────────────────────────

export function KpiCard({ label, value, sub, variant, status, children, pct, meta, proj, pctReal, hoje, liq, devol = 0, cmv = 0, imposto = 0, usoFirma = 0, cliente = 0, garantia = 0, seguradora = 0 }) {
  const [popPos, setPopPos] = useState(null)
  const btnRef = useRef(null)
  const popRef = useRef(null)

  useEffect(() => {
    if (!popPos) return
    const h = e => {
      if (btnRef.current && btnRef.current.contains(e.target)) return
      if (popRef.current && !popRef.current.contains(e.target)) setPopPos(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [popPos])

  function togglePop() {
    if (popPos) { setPopPos(null); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPopPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
  }

  const cls     = ['kpi-card', variant, status ? `status-${status}` : ''].filter(Boolean).join(' ')
  const cor     = pct     == null ? null : pct     >= 1 ? 'var(--green)' : pct     >= .8 ? 'var(--amber)' : 'var(--red)'
  const corReal = pctReal == null ? null : pctReal >= 1 ? 'var(--green)' : pctReal >= .8 ? 'var(--amber)' : 'var(--red)'
  const displayValue = liq != null ? fmtBRL(liq) : value
  const temPopover   = hoje != null || liq != null
  const lbl = { color: 'var(--text3)', fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const row = (rowLabel, val, valStyle = {}) => (
    <div className="kpi-info-row">
      <span style={lbl}>{rowLabel}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', ...valStyle }}>{val}</span>
    </div>
  )

  return (
    <div className={cls}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div className="kpi-label" style={{ marginBottom: 0 }}>{label}</div>
        {temPopover && (
          <>
            <button ref={btnRef} type="button" onClick={togglePop} className="kpi-info-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </button>
            {popPos && (
              <div ref={popRef} className="kpi-info-pop" style={{ position: 'fixed', top: popPos.top, right: popPos.right, left: 'auto' }}>
                {hoje > 0  && row('Hoje', fmtBRL(hoje))}
                {hoje === 0 && <div style={{ color: 'var(--text3)', fontStyle: 'italic', fontSize: 'var(--text-sm2)' }}>Sem vendas hoje</div>}
                {devol > 0 && row('Bruto', fmtBRL((liq ?? 0) + devol), { color: 'var(--text)' })}
                {devol > 0 && row('Dev.', `− ${fmtBRL(devol)}`, { color: 'var(--red)' })}
                {imposto > 0 && row('Imposto', `− ${fmtBRL(imposto)}`, { color: 'var(--text2)' })}
                {cmv     > 0 && row('CMV', fmtBRL(cmv), { color: 'var(--text2)' })}
                {cmv   > 0 && (liq - imposto) > 0 && row('Margem', fmtPct((liq - cmv - imposto) / (liq - imposto)), { color: 'var(--text2)' })}
                {usoFirma > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 3 }}>
                    {row('Uso firma OS', fmtBRL(usoFirma))}
                  </div>
                )}
                {(garantia > 0 || seguradora > 0) && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 3 }}>
                    {cliente    > 0 && row('Cliente',    fmtBRL(cliente))}
                    {garantia   > 0 && row('Garantia',   fmtBRL(garantia))}
                    {seguradora > 0 && row('Seguradora', fmtBRL(seguradora))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div className="kpi-value">{displayValue}</div>
      {proj > 0 && (
        <div style={{ marginTop: 3, fontSize: 'var(--text-xs)', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>↗ <span style={{ color: 'var(--text2)', fontWeight: 'var(--weight-semibold)' }}>{fmtBRL(proj)}</span></span>
          {pct != null && <span style={{ color: cor, fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-xs)' }}>{fmtPct(pct)}</span>}
        </div>
      )}
      {pctReal != null && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            {meta > 0 && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>Meta {fmtBRL(meta)}</span>}
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: corReal, marginLeft: 'auto' }}>{fmtPct(pctReal)}</span>
          </div>
          <ProgressBar pct={pctReal} height={3} />
        </div>
      )}
      {sub && !proj && <div className="kpi-sub">{sub}</div>}
      {children && <div className="kpi-children">{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LOJA TAGS
// ─────────────────────────────────────────────────────────────────────────────

export function LojaTags({ lojas, max = 2 }) {
  const arr     = lojas || []
  if (arr.length === 0) return null
  const visible = arr.slice(0, max)
  const hidden  = arr.slice(max)
  const [tipPos, setTipPos] = useState(null)
  const btnRef  = useRef(null)
  const tipRef  = useRef(null)

  useEffect(() => {
    if (!tipPos) return
    const h = e => {
      if (btnRef.current?.contains(e.target)) return
      if (tipRef.current && !tipRef.current.contains(e.target)) setTipPos(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [tipPos])

  function toggleTip() {
    if (tipPos) { setTipPos(null); return }
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setTipPos({ top: r.bottom + 4, left: r.left })
  }

  return (
    <div className="loja-tags">
      {visible.map(l => <span key={l} className="badge badge-blue badge-loja">{l}</span>)}
      {hidden.length > 0 && (
        <>
          <span ref={btnRef} style={{ cursor: 'pointer' }}
            onClick={toggleTip}
            onMouseEnter={() => { const r = btnRef.current?.getBoundingClientRect(); if (r) setTipPos({ top: r.bottom + 4, left: r.left }) }}
            onMouseLeave={() => setTipPos(null)}
          >
            <Badge label={`+${hidden.length}`} variant="gray" />
          </span>
          {tipPos && (
            <div ref={tipRef} style={{
              position: 'fixed', top: tipPos.top, left: tipPos.left, zIndex: 9999,
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 'var(--text-sm)',
              whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              lineHeight: 1.8, color: 'var(--text2)',
            }}>
              {arr.map(l => <div key={l}><span className="badge badge-blue badge-loja" style={{ marginRight: 4 }}>{l}</span></div>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING
// ─────────────────────────────────────────────────────────────────────────────

export function LoadingPage({ msg = 'Carregando...', inline = false }) {
  const [prog, setProg] = useState(15)
  useEffect(() => {
    const id = setInterval(() => setProg(p => p < 85 ? p + 2 : p), 300)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{
      position: inline ? 'absolute' : 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(244,246,249,0.82)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <div style={{ position: 'relative', width: 88, height: 88 }}>
        <svg width="88" height="88" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
          <circle cx="44" cy="44" r="38" fill="none" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 38}
            strokeDashoffset={2 * Math.PI * 38 * (1 - prog / 100)}
            style={{ stroke: 'var(--honda)', transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <img src={logoSplash} alt="logo" style={{ width: '100%', objectFit: 'contain', opacity: 0.85 }} />
        </div>
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.3px' }}>{msg}</div>
    </div>
  )
}

export function LoadingInline({ msg = 'Carregando...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', gap: 12 }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg width="64" height="64" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
          <circle cx="32" cy="32" r="28" fill="none" strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 28 * 0.25} ${2 * Math.PI * 28 * 0.75}`}
            style={{ stroke: 'var(--honda)', animation: 'spin 1s linear infinite', transformOrigin: '32px 32px' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
          <img src={logoSplash} alt="logo" style={{ width: '100%', objectFit: 'contain' }} />
        </div>
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>{msg}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS (DROPDOWN + ANO/MÊS)
// ─────────────────────────────────────────────────────────────────────────────

const LABEL_ICON = {
  'Mês': Calendar, 'Ano': Calendar,
  'Estado': Globe, 'Loja': Building2, 'Lojas': Building2,
  'Supervisor': Users, 'Supervisores': Users,
  'Cargo': TagIcon, 'Cargos': TagIcon,
  'Setor': LayoutGrid, 'Setores': LayoutGrid,
  'Tipo': Layers, 'Tipos': Layers,
  'Canal': LayoutGrid, 'Canais': LayoutGrid,
  'Curva': TagIcon,
}

export function FiltroDropdown({ label, options, value, onChange, multi = false, icon, disabled = false, className, compact = false }) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const [dropUp, setDropUp] = useState(false)
  const ref      = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (open && options.length > 5 && searchRef.current) searchRef.current.focus()
  }, [open, options.length])

  function handleToggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setDropUp(rect.bottom + 320 > window.innerHeight)
    }
    setOpen(v => !v)
    setSearch('')
  }

  const showSearch = options.length > 5
  const visivel = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options
  const selected = multi ? (value || []) : (value ? [value] : [])
  const isActive  = selected.length > 0
  const btnLabel  = multi
    ? isActive ? `${label} · ${selected.length}` : label
    : isActive ? (options.find(o => o.value === value)?.label || label) : label

  function toggle(v) {
    if (multi) {
      onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
    } else {
      onChange(selected[0] === v ? '' : v)
      setOpen(false)
      setSearch('')
    }
  }

  const BtnIcon = icon || LABEL_ICON[label] || null

  return (
    <div ref={ref} className={compact ? 'filter-icon-wrap' : undefined} style={{ position: 'relative' }} onMouseEnter={compact ? () => !disabled && setOpen(true) : undefined} onMouseLeave={compact ? () => { if (!ref.current?.contains(document.activeElement)) setOpen(false) } : undefined} onKeyDown={e => { if(e.key === 'Escape') {setOpen(false);setSearch('');ref.current?.querySelector('button')?.focus()} }} onBlur={compact ? e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) } : undefined}>
      <button
        className={className || `filter-select filter-dropdown-btn${isActive ? ' filter-active' : ''}${compact ? ' filter-icon-button' : ''}`}
        aria-label={`${label}: ${btnLabel}`}
        aria-expanded={open}
        title={compact ? `${label}: ${btnLabel}` : undefined}
        disabled={disabled}
        onClick={() => !disabled && (compact ? setOpen(true) : handleToggle())}
        style={disabled ? { cursor: 'default', opacity: 0.55 } : undefined}
      >
        {BtnIcon && <BtnIcon size={13} strokeWidth={1.75} style={{ opacity: 0.65, flexShrink: 0 }} />}
        {!compact && btnLabel}
        {compact && isActive && <span className="filter-selection-dot"/>}
        {!disabled && !compact && <ChevronDown size={11} strokeWidth={2} style={{ opacity: 0.4, marginLeft: 2, flexShrink: 0 }} />}
      </button>
      {open && !disabled && (
        <div className={`filter-dropdown-panel${compact ? ' filter-panel-side' : ''}`}
          style={dropUp && !compact ? { top: 'auto', bottom: 'calc(100% + 5px)' } : {}}
        >
          {compact && <div className="filter-panel-title">{label}</div>}
          {showSearch && (
            <div style={{ padding: '6px 10px 4px', borderBottom: '1px solid var(--border)' }}>
              <input ref={searchRef} type="text" value={search}
                onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
                onKeyDown={e => {
                  if (e.key === 'Escape') { setOpen(false); setSearch('') }
                  if (e.key === 'Tab' && !compact) { setOpen(false); setSearch('') }
                  if (e.key === 'Enter' && visivel.length === 1) toggle(visivel[0].value)
                }}
                style={{
                  width: '100%', border: '1px solid var(--border2)', borderRadius: 5,
                  padding: '4px 8px', fontSize: 'var(--text-sm)', background: 'var(--bg3)',
                  color: 'var(--text)', outline: 'none', fontFamily: 'var(--font)',
                }}
              />
            </div>
          )}
          {multi && visivel.length > 0 && (
            <div className="filter-dropdown-actions">
              <button onClick={() => {
                const visivelValues = visivel.map(o => o.value)
                const todosSelecionados = visivelValues.every(v => selected.includes(v))
                if (todosSelecionados) onChange(selected.filter(v => !visivelValues.includes(v)))
                else onChange([...new Set([...selected, ...visivelValues])])
              }}>
                {visivel.every(o => selected.includes(o.value)) ? 'Desmarcar visíveis' : 'Todos visíveis'}
              </button>
              <span>·</span>
              <button onClick={() => onChange([])}>Limpar</button>
            </div>
          )}
          {!multi && isActive && !search && (
            <div className="filter-dropdown-actions">
              <button onClick={() => { onChange(''); setOpen(false) }}>Limpar</button>
            </div>
          )}
          {visivel.map(opt => {
            const active = selected.includes(opt.value)
            return (
              <button type="button" key={opt.value} className={`filter-dropdown-item${active ? ' active' : ''}`} aria-pressed={active} onClick={() => toggle(opt.value)}>
                {multi && <span className="filter-dropdown-check" style={{ opacity: active ? 1 : 0 }}>✓</span>}
                <span><TextoDestacado texto={opt.label} busca={search} /></span>
              </button>
            )
          })}
          {visivel.length === 0 && (
            <div style={{ padding: '10px 14px', fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>Nenhum resultado</div>
          )}
        </div>
      )}
    </div>
  )
}

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export function FiltroAnoMes({ label = 'Mês', meses = [], value = '', onChange, perpetuo = false }) {
  const [open, setOpen] = useState(false)
  const [anoSel, setAnoSel] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const porAno = useMemo(() => {
    const m = {}
    meses.forEach(mes => {
      const [mm, aa] = mes.split('/')
      if (!m[aa]) m[aa] = []
      if (!m[aa].includes(mm)) m[aa].push(mm)
    })
    return m
  }, [meses])

  const anos = useMemo(() => {
    const anoHoje = String(new Date().getFullYear())
    const set = new Set([...Object.keys(porAno), anoHoje])
    if (perpetuo) {
      set.add(String(Number(anoHoje) + 1))
      set.add(String(Number(anoHoje) + 2))
      set.add(String(Number(anoHoje) + 3))
    }
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [porAno, perpetuo])

  const anoAtual   = value ? value.split('/')[1] : null
  const anoEfetivo = anoSel || anoAtual || anos[0]
  const mesesDoAno = porAno[anoEfetivo] || []
  const isActive   = !!value
  const btnLabel   = isActive ? value : label

  function select(mes) { onChange(mes === value ? '' : mes); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`filter-select filter-dropdown-btn${isActive ? ' filter-active' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <Calendar size={13} strokeWidth={1.75} style={{ opacity: 0.65, flexShrink: 0 }} />
        {btnLabel}
        <ChevronDown size={11} strokeWidth={2} style={{ opacity: 0.4, marginLeft: 2, flexShrink: 0 }} />
      </button>
      {open && (
        <div className="filter-dropdown-panel" style={{ minWidth: 230, padding: '8px 0 4px' }}>
          {anos.length > 1 && (
            <div style={{ padding: '0 12px 8px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Ano</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {anos.map(ano => (
                  <button key={ano} onClick={() => setAnoSel(ano)} style={{
                    padding: '3px 12px', borderRadius: 5, fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-bold)',
                    fontFamily: 'var(--font)', cursor: 'pointer', border: '1px solid',
                    background: anoEfetivo === ano ? 'var(--honda-bg)' : 'var(--bg3)',
                    borderColor: anoEfetivo === ano ? 'var(--honda)' : 'var(--border2)',
                    color: anoEfetivo === ano ? 'var(--honda)' : 'var(--text2)',
                  }}>{ano}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ padding: '8px 12px' }}>
            {anos.length <= 1 && (
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                {anoEfetivo || 'Mês'}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {Array.from({ length: 12 }, (_, i) => {
                const mm = String(i + 1).padStart(2, '0')
                const mes = `${mm}/${anoEfetivo}`
                const disponivel = mesesDoAno.includes(mm)
                const ativo = value === mes
                return (
                  // Mês sem dados: legível (antes opacidade 0.28 sumia no tema claro), mas vazado e tracejado.
                  <button key={mm} type="button" disabled={!(disponivel || perpetuo)} title={(disponivel || perpetuo) ? undefined : 'Sem dados neste mês'} onClick={() => (disponivel || perpetuo) && select(mes)} style={{
                    padding: '6px 4px', borderRadius: 5, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
                    fontFamily: 'var(--font)', cursor: (disponivel || perpetuo) ? 'pointer' : 'default',
                    border: '1px solid', borderStyle: (disponivel || perpetuo) ? 'solid' : 'dashed',
                    background: ativo ? 'var(--honda-bg)' : (disponivel || perpetuo) ? 'var(--bg3)' : 'transparent',
                    borderColor: ativo ? 'var(--honda)' : 'var(--border2)',
                    color: ativo ? 'var(--honda)' : (disponivel || perpetuo) ? 'var(--text)' : 'var(--text3)',
                  }}>{MESES_ABREV[i]}</button>
                )
              })}
            </div>
          </div>
          {value && (
            <div style={{ padding: '2px 12px 6px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { onChange(''); setOpen(false) }}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                Limpar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Destaca o trecho de `texto` que bate com `busca` (case-insensitive) — usado
 * nas listas de autocomplete (FormDropdown) pra achar o item certo mais rápido.
 */
function TextoDestacado({ texto, busca }) {
  if (!busca) return texto
  const i = texto.toLowerCase().indexOf(busca.toLowerCase())
  if (i === -1) return texto
  return (
    <>
      {texto.slice(0, i)}
      <strong style={{ color: 'var(--honda)', fontWeight: 700 }}>{texto.slice(i, i + busca.length)}</strong>
      {texto.slice(i + busca.length)}
    </>
  )
}

export function FormDropdown({ options, value, onChange, placeholder = 'Selecione...', disabled = false, className = 'form-input', showArrow = true, style, triggerStyle, labelStyle, panelStyle }) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setBusca('') } }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  const selected  = options.find(o => o.value === value)
  const filtradas = busca ? options.filter(o => o.label.toLowerCase().includes(busca.toLowerCase())) : options

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button type="button" className={className} disabled={disabled}
        style={{
          width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
          ...triggerStyle,
        }}
        onClick={() => !disabled && setOpen(v => !v)}
      >
        <span style={{ color: value ? 'var(--text)' : 'var(--text3)', fontSize: 'var(--text-base)', ...labelStyle }}>
          {selected ? selected.label : placeholder}
        </span>
        {showArrow && <span style={{ fontSize: 'var(--text-2xs)', opacity: 0.45, marginLeft: 6 }}>{open ? '▲' : '▼'}</span>}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
          maxHeight: 260, display: 'flex', flexDirection: 'column', marginTop: 2,
          ...panelStyle,
        }}>
          {options.length > 5 && (
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <input ref={inputRef} className="form-input" placeholder="Buscar..."
                value={busca} onChange={e => setBusca(e.target.value)}
                style={{ padding: '4px 8px', fontSize: 'var(--text-sm2)' }} />
            </div>
          )}
          <div style={{ overflowY: 'auto' }}>
            {filtradas.map(opt => (
              <div key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); setBusca('') }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 'var(--text-base)',
                  background: value === opt.value ? 'var(--honda-bg)' : undefined,
                  color: value === opt.value ? 'var(--honda)' : undefined,
                  fontWeight: value === opt.value ? 700 : undefined,
                }}
                onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'var(--bg3)' }}
                onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = '' }}
              >
                <TextoDestacado texto={opt.label} busca={busca} />
              </div>
            ))}
            {filtradas.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>Nenhuma opção</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function MultiSelectLojas({ lojas, selecionadas, onChange }) {
  const toggle = (loja) => {
    if (selecionadas.includes(loja)) onChange(selecionadas.filter(l => l !== loja))
    else onChange([...selecionadas, loja])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {lojas.map(l => (
        <button key={l} onClick={() => toggle(l)} style={{
          padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid', cursor: 'pointer',
          fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font)',
          background: selecionadas.includes(l) ? 'rgba(204,0,0,0.08)' : 'var(--bg3)',
          borderColor: selecionadas.includes(l) ? 'var(--honda)' : 'var(--border2)',
          color: selecionadas.includes(l) ? 'var(--honda)' : 'var(--text3)',
          transition: 'all 0.15s',
        }}>
          {l}
        </button>
      ))}
    </div>
  )
}

// Re-exports from tabela.jsx so DS.jsx is the single import entry point.
// ThMulti = sortable Th com suporte a shift+clique para ordenação multi-coluna
export { useSorter, EstadoBtns } from './tabela.jsx'
export { Th as ThMulti } from './tabela.jsx'
