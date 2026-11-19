import { resolveAnalysisQuery, normalizeAnalysisRows, buildAnalysisContext, brazilMonth } from '../../functions/src/assistantAnalysis.js'
import { LOJAS } from '../data/regras.js'

export function previewAnalysisContext(state, question, { full, name, estados, pageFilters, previous, now = new Date() } = {}) {
  const months = [...new Set([...Object.keys(state.pecasPorMes), ...Object.keys(state.oficinaPorMes)])]
  const stores = { ...LOJAS, ...state.lojas }, people = [...new Set(Object.values(state.colaboradoresPorMes).flatMap(records => Object.keys(records || {})))]
  const query = resolveAnalysisQuery(question, { availableMonths: months, stores, people, pageFilters, previous, now })
  const aliases = state.apelidoMap || {}, rows = [], sources = []
  for (const month of query.months) {
    const pieces = state.pecasPorMes[month] || [], services = state.oficinaPorMes[month] || []
    rows.push(...normalizeAnalysisRows(pieces, services, stores, aliases))
    for (const [kind, data, key] of [['Peças', pieces, 'pecas'], ['Oficina', services, 'oficina']]) if (Object.hasOwn(key === 'pecas' ? state.pecasPorMes : state.oficinaPorMes, month)) {
      const updated = state.ultimasAtualizacoes?.[key]
      sources.push({ month, kind, records: data.length, updatedAt: typeof updated === 'string' ? month === brazilMonth(now) ? updated : null : updated?.[month] || null })
    }
  }
  const compensation = { rules: state.regras || {}, operational: state.comissaoOperacional || [], management: state.comissaoGestao || [], manual: state.gestaoManual || {}, bonuses: state.bonificacoes || {} }
  return buildAnalysisContext({ query, rows, configs: state.colaboradoresPorMes, targets: state.metasPorMes, allowedStates: estados, ownName: full ? '' : name, source: 'preview', sources, compensation, now })
}
