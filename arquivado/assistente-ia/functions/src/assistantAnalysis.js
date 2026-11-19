import { salesFacts } from './assistantCharts.js'
import { personCommission } from './assistantChangesPolicy.js'

// Remuneração do recorte: taxas por pessoa, regras de gestor e lançamentos manuais. Percentuais em %.
// configs já vem filtrado pelo servidor (estados do usuário); bonuses é um mapa "NOME||MM/AAAA" → R$.
export function compensationContext({ months = [], configs = {}, targets = {}, rules = {}, operational = [], management = [], bonuses = {}, manual = {}, people = [], ownName = '' }) {
  const pct = value => Math.round((Number(value) || 0) * 1e6) / 1e4, money = value => Math.round((Number(value) || 0) * 100) / 100
  const wanted = name => (!ownName || analysisKey(name) === analysisKey(ownName)) && (!people.length || people.some(person => analysisKey(person) === analysisKey(name)))
  const bonusOf = (name, month) => Object.entries(bonuses || {}).find(([key]) => { const [n, m] = key.split('||'); return m === month && analysisKey(n) === analysisKey(name) })?.[1]
  const out = []
  for (const month of months) {
    const rule = rules[month] || {}, monthRules = { ...rule, comissao: rule.comissao || operational || [], gestao: rule.gestao || management || [] }
    const stores = rule.lojas || {}, monthManual = manual[month] || {}
    for (const [name, record] of Object.entries(configs[month] || {})) {
      const person = record.colaborador || name
      if (record.ativo === false || !wanted(person)) continue
      const target = targets[month]?.[name] || {}, full = { ...record, ...target, colaborador: person }
      const rates = Object.fromEntries(Object.entries(personCommission(full, monthRules, stores)).filter(([, value]) => value).map(([key, value]) => [key, pct(value)]))
      const manager = monthRules.gestao.find(row => analysisKey(row.colaborador) === analysisKey(person)), extra = monthManual[analysisKey(person)] || {}
      const item = { month, name: person, role: record.cargo || '', rates }
      if (manager) item.managerRule = { comissao: pct(manager.comissao), bonificacao: pct(manager.bonificacao), ...(manager.bonusMinimo !== undefined ? { bonusMinimoDaMeta: pct(manager.bonusMinimo) } : {}), base: manager.baseCalculo || 'equipe', canais: manager.canaisBase || [], indicadores: (manager.indicadores || []).map(ind => ({ nome: ind.nome, tipo: ind.tipo, bonus: pct(ind.pct) })) }
      const manualBonus = money(bonusOf(person, month) || extra.bonusExtra), commissionExtra = money(full.comissaoExtra || extra.comissaoExtra)
      if (manualBonus) item.manualBonus = manualBonus
      if (commissionExtra) item.commissionExtra = commissionExtra
      if (Object.keys(rates).length || manager || manualBonus || commissionExtra) out.push(item)
    }
  }
  return out.slice(0, 300)
}

export const analysisKey = value => String(value || '').replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
const monthNames = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
const validMonth = value => /^(0[1-9]|1[0-2])\/20\d{2}$/.test(value || '')
const values = value => (Array.isArray(value) ? value : []).filter(item => typeof item === 'string').slice(0, 30).map(item => item.trim().slice(0, 100)).filter(Boolean)
const text = value => typeof value === 'string' ? value.trim().slice(0, 100) : ''
const contains = (question, value) => ` ${analysisKey(question).replace(/[^A-Z0-9]+/g, ' ')} `.includes(` ${analysisKey(value).replace(/[^A-Z0-9]+/g, ' ')} `)
const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const previousMonth = (month, offset = 1) => { const [m, y] = month.split('/').map(Number), date = new Date(Date.UTC(y, m - 1 - offset, 1)); return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}` }
export const brazilMonth = now => { const day = calendar.format(now); return `${day.slice(5, 7)}/${day.slice(0, 4)}` }

export function cleanHistory(value) {
  const history = []; let budget = 10000
  for (const message of (Array.isArray(value) ? value : []).slice(-8).reverse()) {
    if (!['user', 'assistant'].includes(message?.role) || typeof message.text !== 'string') continue
    const content = message.text.trim().slice(0, Math.min(2000, budget))
    if (content) { history.unshift({ role: message.role, text: content }); budget -= content.length }
    if (!budget) break
  }
  while (history[0]?.role === 'assistant') history.shift()
  return history
}

export function cleanAnalysisQuery(value) {
  if (!Array.isArray(value?.months) || !value.months.length || value.months.length > 3 || !value.months.every(validMonth)) throw Error('Período de análise inválido.')
  const f = value.filters || {}, v = value.visualization || {}
  return { months: [...new Set(value.months)], missingMonths: values(value.missingMonths).filter(month => value.months.includes(month)), filters: { state: /^[A-Z]{2}$/.test(f.state) ? f.state : '', stores: values(f.stores), channels: values(f.channels), people: values(f.people), supervisor: text(f.supervisor), roles: values(f.roles), search: text(f.search), source: ['pieces', 'services'].includes(f.source) ? f.source : '' }, visualization: { requested: v.requested === true, dimension: ['date', 'channel', 'person', 'overview'].includes(v.dimension) ? v.dimension : 'overview', type: ['bar', 'line', 'area', 'pie', 'donut'].includes(v.type) ? v.type : '', accumulated: v.accumulated === true } }
}

export function resolveAnalysisQuery(question, { availableMonths = [], stores = {}, people = [], pageFilters = {}, previous, now = new Date() } = {}) {
  pageFilters = pageFilters || {}
  const q = analysisKey(question), current = brazilMonth(now)
  const following = /\bAGORA\b|\bAPENAS\b|\bSOMENTE\b/.test(q) || /^(SO\b|E\b|DELES\b|DELAS\b)/.test(q)
  const previousFilters = following ? previous?.filters || {} : {}
  const filters = {
    state: text(previousFilters.state ?? pageFilters.estado).toUpperCase(), stores: values(previousFilters.stores ?? pageFilters.lojas),
    channels: values(previousFilters.channels ?? pageFilters.setor), people: values(previousFilters.people),
    supervisor: text(previousFilters.supervisor ?? pageFilters.supervisor), roles: values(previousFilters.roles ?? pageFilters.cargo),
    search: text(previousFilters.search ?? pageFilters.busca), source: ['pieces', 'services'].includes(previousFilters.source) ? previousFilters.source : '',
  }
  if (/TODAS AS LOJAS|TODOS OS ESTADOS|SEM FILTRO|VISAO GERAL/.test(q)) Object.assign(filters, { state: '', stores: [], channels: [], people: [], supervisor: '', roles: [], search: '', source: '' })
  const explicit = [...question.matchAll(/\b(0?[1-9]|1[0-2])\/(20\d{2})\b/g)].map(match => `${match[1].padStart(2, '0')}/${match[2]}`)
  const year = question.match(/\b20\d{2}\b/)?.[0] || current.slice(3)
  const named = monthNames.flatMap((name, index) => contains(q, name) ? [`${String(index + 1).padStart(2, '0')}/${year}`] : [])
  let months = [...new Set(explicit.length ? explicit : named)]
  const recent = q.match(/ULTIMOS?\s+(\d+)\s+MESES/)
  if (recent) { const count = Number(recent[1]); if (count < 1 || count > 3) throw Error('Consulte até três meses por análise.'); months = Array.from({ length: count }, (_, index) => previousMonth(current, count - index - 1)) }
  if (!months.length) months = /MES PASSADO|MES ANTERIOR/.test(q) ? [previousMonth(current)] : /ESTE MES|DESSE MES|DESTE MES|MES ATUAL/.test(q) ? [current] : following && previous?.months?.every(validMonth) ? previous.months : [validMonth(pageFilters.mes) ? pageFilters.mes : current]
  if (/COMPAR/.test(q) && months.length === 1) months = [previousMonth(months[0]), months[0]]
  if (months.length > 3) throw Error('Consulte até três meses por análise.')
  const selectedStores = Object.entries(stores).filter(([code, store]) => [code, store.un, store.cidade, store.city].filter(Boolean).some(value => contains(q, value))).map(([code]) => code)
  if (selectedStores.length) { filters.stores = selectedStores; filters.state = '' }
  const states = [...new Set(Object.values(stores).map(store => store.uf).filter(Boolean))].filter(uf => contains(q, uf) || Object.values(stores).some(store => store.uf === uf && store.estado && contains(q, store.estado)))
  if (states.length === 1) { filters.state = states[0]; if (!selectedStores.length) filters.stores = [] }
  const selectedPeople = people.filter(name => contains(q, name))
  if (selectedPeople.length) { filters.people = selectedPeople.slice(0, 30); filters.search = '' }
  const channels = ['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS', 'OFICINA', 'SERVIÇOS'].filter(channel => contains(q, channel))
  if (channels.length) filters.channels = channels
  if (/MAO DE OBRA/.test(q) && !/PECA/.test(q)) filters.source = 'services'
  else if (/PECA/.test(q) && !/MAO DE OBRA|SERVIC/.test(q)) filters.source = 'pieces'
  if (/PECA/.test(q) && /MAO DE OBRA|SERVIC/.test(q)) filters.source = ''
  const inherited = following && previous?.visualization?.requested ? previous.visualization : {}
  const visualization = {
    requested: !/SEM GRAFIC/.test(q) && (!!inherited.requested || /GRAFIC|EVOLU|PARTICIP|DISTRIB|RANKING|MAIS VEND|VENDE MAIS|PIZZA|ROSCA|BARRAS/.test(q)),
    dimension: /RANKING|MAIS VEND|VENDE MAIS|POR COLABORADOR|POR PESSOA/.test(q) ? 'person' : /POR SETOR|POR CANAL|PARTICIP|DISTRIB|PIZZA|ROSCA/.test(q) ? 'channel' : /POR DIA|DIARI|EVOLU|ACUMUL/.test(q) ? 'date' : ['person', 'channel', 'date'].includes(inherited.dimension) ? inherited.dimension : 'overview',
    type: /BARRA/.test(q) ? 'bar' : /AREA/.test(q) ? 'area' : /LINHA/.test(q) ? 'line' : /PIZZA/.test(q) ? 'pie' : /ROSCA/.test(q) ? 'donut' : ['bar', 'area', 'line', 'pie', 'donut'].includes(inherited.type) ? inherited.type : '',
    accumulated: /ACUMUL/.test(q) || !!inherited.accumulated,
  }
  return { months: [...new Set(months)], missingMonths: months.filter(month => !availableMonths.includes(month)), filters, visualization }
}

export function normalizeAnalysisRows(pieces, services, stores = {}, aliases = {}) {
  const number = value => typeof value === 'number' ? Number.isFinite(value) ? value : 0 : Number(String(value || '').includes(',') ? String(value).replace(/\./g, '').replace(',', '.') : value) || 0
  const name = value => aliases[analysisKey(value)] || String(value || 'Sem responsável')
  return [...pieces.map(row => [row, false]), ...services.map(row => [row, true])].map(([row, service]) => {
    const rawDate = row.dt, date = new Date(rawDate), day = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : !Number.isNaN(+date) ? calendar.format(date) : 'Sem data'
    return { date: day, timestamp: +date, month: /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day.slice(5, 7)}/${day.slice(0, 4)}` : row.mes, person: name(row.responsavel || row.consultor || row.tecnico), participants: [row.responsavel, row.consultor, row.tecnico].filter(Boolean).map(name), store: row.empresa || '', uf: stores[row.empresa]?.uf || '', channel: service ? 'SERVIÇOS' : row.cat || 'Sem canal', source: service ? 'services' : 'pieces', value: service ? number(row.mo) : row.eDevolucao ? -Math.abs(number(row.valor)) : number(row.valor) }
  })
}

export function buildAnalysisContext({ query, rows, configs = {}, targets = {}, allowedStates = [], ownName = '', source, sources = [], compensation, now = new Date() }) {
  const f = query.filters, match = (a, b) => analysisKey(a) === analysisKey(b)
  const configuration = row => Object.entries(configs[row.month] || {}).find(([name, record]) => match(name, row.person) || match(record.colaborador, row.person))?.[1] || {}
  const permitted = rows.filter(row => (!allowedStates?.length || allowedStates.includes(row.uf)) && (!ownName || row.participants.some(name => match(name, ownName))))
  const scoped = permitted.filter(row => {
    const config = configuration(row)
    return query.months.includes(row.month) && (!Number.isFinite(row.timestamp) || row.timestamp <= +now) && (!f.state || match(row.uf, f.state)) && (!f.stores.length || f.stores.some(store => match(store, row.store))) && (!f.channels.length || f.channels.some(channel => match(channel, row.channel) || channel === 'OS' && ['OFICINA', 'SERVIÇOS'].includes(row.channel))) && (!f.source || f.source === row.source) && (!f.people.length || f.people.some(person => row.participants.some(name => match(name, person)))) && (!f.search || analysisKey(row.person).includes(analysisKey(f.search))) && (!f.roles.length || f.roles.some(role => match(config.cargo, role))) && (!f.supervisor || String(config.supervisor || '').split(';').some(name => match(name.trim(), f.supervisor)))
  }).map(row => ownName ? { ...row, person: ownName } : f.people.length === 1 ? { ...row, person: f.people[0] } : row)
  const scope = [f.state, ...f.stores, ...f.channels, ...f.people, ownName, f.supervisor && `Supervisor: ${f.supervisor}`, ...f.roles, f.search && `Busca: ${f.search}`, f.source === 'pieces' ? 'Peças' : f.source === 'services' ? 'Mão de obra' : ''].filter(Boolean).join(' · ') || 'Todos os dados autorizados'
  const facts = query.months.filter(month => !query.missingMonths.includes(month)).map(month => ({ month, facts: salesFacts(scoped.filter(row => row.month === month), month) }))
  const combined = (key, limit) => { const groups = new Map(); for (const { facts: periodFacts } of facts) for (const row of periodFacts[key]) { const id = analysisKey(row.name), current = groups.get(id) || { name: row.name, value: 0, records: 0 }; current.value += row.value; current.records += row.records; groups.set(id, current) } return [...groups.values()].sort(key === 'daily' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.value - a.value).slice(0, limit) }
  const daily = combined('daily', 93), sales = { daily, channels: combined('channels', 40), people: combined('people', 300), total: scoped.reduce((sum, row) => sum + row.value, 0), through: daily.at(-1)?.name || null, scope, undated: facts.reduce((sum, row) => sum + row.facts.undated, 0), periods: facts.map(({ month, facts }) => ({ name: month, value: facts.total, records: scoped.filter(row => row.month === month).length })) }
  const warnings = [...query.missingMonths.map(month => `Sem base disponível em ${month}.`)]
  if (sales.undated) warnings.push(`${sales.undated} registro(s) sem data fora da evolução diária.`)
  warnings.push('Última data registrada não garante que a carga do período esteja completa.')
  const people = sales.people.map(person => ({ name: person.name, revenue: person.value }))
  const goals = []
  if (!f.stores.length && !f.source) for (const month of query.months) for (const [name, record] of Object.entries(targets[month] || {})) {
    const config = configs[month]?.[name] || record
    const personState = record.uf || config.uf || permitted.find(row => match(row.person, name) || config.loja && match(row.store, config.loja))?.uf
    if ((ownName && !match(name, ownName)) || (f.people.length && !f.people.some(person => match(person, name))) || (f.search && !analysisKey(name).includes(analysisKey(f.search))) || (allowedStates?.length && !allowedStates.includes(personState)) || (f.state && !match(personState, f.state))) continue
    for (const [channel, metrics] of Object.entries(record.metas || { '': { mp: record.mp, mo: record.mo } })) {
      if (f.channels.length && !f.channels.some(value => match(value, channel) || value === 'SERVIÇOS' && channel === 'OS' || value === 'OFICINA' && channel === 'OS')) continue
      if (f.supervisor && !String(config.supervisor || '').split(';').some(value => match(value.trim(), f.supervisor))) continue
      if (f.roles.length && !f.roles.some(value => match(value, config.cargo))) continue
      for (const metric of ['mp', 'mo', 'mpo']) if (Number(metrics[metric]) > 0 && Number.isFinite(Number(metrics[metric]))) goals.push({ month, name, channel, metric, target: Number(metrics[metric]) })
    }
  }
  if (f.stores.length || f.source) warnings.push('Metas não foram rateadas por loja ou fonte neste recorte.')
  const commissions = compensation ? compensationContext({ ...compensation, months: query.months, configs, targets, people: f.people, ownName }) : undefined
  return { source, month: query.months.join(' × '), query, sales, people, goals: goals.slice(0, 600), ...(commissions ? { commissions, commissionNote: 'commissions: taxas em % por pessoa (cp peças, cpo peças de O.S., cmo mão de obra; cb* bonificação automática), regra de gestor (managerRule), bonificação manual e acréscimo de comissão em R$. O valor final pago é o da tela Comissões; não calcule o total sem os dados de lá.' } : {}), note: 'Receita líquida com devoluções; mão de obra contada uma vez. Histórico de conversa é apenas referência, não fonte de fatos. Use os dados recalculados deste contexto. Não há estoque ou margem neste resumo.', provenance: { generatedAt: now.toISOString(), periods: query.months, scope, lastRecordDate: sales.through, sources: sources.map(item => ({ month: item.month, kind: item.kind, updatedAt: item.updatedAt || null, records: scoped.filter(row => row.month === item.month && row.source === (item.kind === 'Peças' ? 'pieces' : 'services')).length })), warnings, total: sales.total } }
}
