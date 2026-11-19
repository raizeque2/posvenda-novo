/**
 * chartPalette.js — paleta de cores para gráficos (Recharts)
 * ─────────────────────────────────────────────────────────────────────────────
 * Cor de gráfico/categoria é um problema DIFERENTE de cor de marca/status
 * (tokens.css): aqui o objetivo é ter tons DISTINGUÍVEIS entre si — não expressar
 * significado (verde = bom, vermelho = ruim). Por isso não vive em tokens.css.
 * Fonte única para não reinventar/duplicar em cada gráfico novo.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { resolveVar } from '../utils/theme.js'

// Semáforo de gráfico (Meu Desempenho) — tons próprios, deliberadamente distintos
// dos tokens de status (mais vivos, pensados para barra/linha, não para texto).
// HONDA aqui reaproveita o mesmo valor de --red-critical (coincidência real, não
// duplicação acidental) — por isso é resolvido a partir do token.
export const CHART_HONDA = resolveVar('var(--red-critical)')
export const CHART_GREEN = '#22c55e'
export const CHART_AMBER = '#f59e0b'
export const CHART_GRAY  = '#64748b'

// Cor por canal de venda (Varejo/Atacado/Web/Televendas)
export const CANAL_COLOR = {
  VAREJO: resolveVar('var(--blue)'), ATACADO: '#8b5cf6', WEB: '#06b6d4', TELEVENDAS: CHART_AMBER,
}

// Paleta categórica genérica — N séries distintas (curvas, lojas, tipos) em
// gráficos de pizza/barra que não têm cor semântica própria.
export const PALETA_CATEGORICA = [
  '#e11d48', '#f97316', '#eab308', '#16a34a', '#0284c7', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#9333ea', '#c2410c', '#0369a1',
]
