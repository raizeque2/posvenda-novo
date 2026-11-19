import { normalize } from '../bi/model.js'
import { salesFacts } from '../../functions/src/assistantCharts.js'

export async function previewGemini(action, data = {}) {
  let response
  try { response = await fetch(`/__assistant/gemini/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(data) }) }
  catch { throw Object.assign(Error('O servidor local não respondeu. Confira a conexão e tente novamente.'), { code: 'network' }) }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(Error(result.error || 'O servidor local do Gemini não está disponível. Abra a prévia com o Vite em execução.'), { code: result.errorCode, retryAfterSeconds: result.retryAfterSeconds, status: response.status })
  return result
}

// Deliberately omit raw records, email, credentials and the entire application store.
export function previewGeminiContext(summary, question = '') {
  const rows = [...normalize(summary.chartRows?.pieces || []), ...normalize(summary.chartRows?.services || [], true)].map(row => summary.chartPerson ? { ...row, person: summary.chartPerson } : row)
  return { source: 'preview', month: summary.month, lastRecordDate: summary.cutoff?.toISOString?.() || null, latestRevenue: summary.revenue, peopleWithMovement: summary.people, sales: salesFacts(rows, summary.month, question), people: summary.ranking.slice(0, 300).map(person => ({ name: person.nome, parts: person.tp || 0, partsOS: (person.pocoficina || 0) - (person.devPocoficina || 0), serviceAdvisor: person.morealCons || 0, serviceTechnician: person.morealTec || 0, targetParts: person.mp || 0, targetPartsOS: person.mpo || 0, targetService: person.mo || 0 })), attention: summary.attention.slice(0, 300).map(person => ({ name: person.name, metric: person.metric, realized: person.real, projection: person.projection, target: person.target })) }
}
