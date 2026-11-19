import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { resolveAnalysisQuery, normalizeAnalysisRows, buildAnalysisContext, analysisKey } from './assistantAnalysis.js'
import { allowedAssistantStore } from './assistantPolicy.js'

export async function loadAnalysisContext(user, request, { db = getFirestore(), bucket = getStorage().bucket('posvenda-bi.firebasestorage.app'), now = new Date() } = {}) {
  const [indexSnap, peopleSnap, targetsSnap, rulesSnap] = await Promise.all(['mesesDisponiveis', 'colaboradores', 'metas', 'regras'].map(key => db.doc(`config/${key}`).get()))
  const parse = snap => { try { return JSON.parse(snap.data()?.payload || '{}') } catch { throw Error('A configuração dos dados precisa ser revisada pelo administrador.') } }
  const index = indexSnap.data() || {}, configs = parse(peopleSnap), targets = parse(targetsSnap), rules = parse(rulesSnap)
  const stores = Object.assign({}, ...Object.values(rules).map(rule => rule.lojas || {}))
  const months = [...new Set([...(index.pecas || []), ...(index.oficina || [])])]
  const permittedConfigs = Object.fromEntries(Object.entries(configs).map(([month, records]) => [month, Object.fromEntries(Object.entries(records || {}).filter(([, person]) => allowedAssistantStore(user, person.loja, rules[month]?.lojas || stores)))]))
  const people = [...new Set(Object.values(permittedConfigs).flatMap(records => Object.keys(records)))]
  const previous = request.previousQuery ? request.previousQuery : undefined
  const query = resolveAnalysisQuery(request.question, { availableMonths: months, stores, people, previous, pageFilters: request.pageFilters, now })
  const aliases = {}
  for (const records of Object.values(permittedConfigs)) for (const [name, person] of Object.entries(records)) { aliases[analysisKey(name)] = name; if (person.apelido) aliases[analysisKey(person.apelido)] = name }
  const rows = [], sources = [], permittedTargets = {}
  for (const month of query.months.filter(value => !query.missingMonths.includes(value))) {
    const monthStores = rules[month]?.lojas || stores
    const allowed = row => allowedAssistantStore(user, row.empresa, monthStores)
    const load = async (kind, folder) => {
      for (const path of [`Dados/${folder}/${month.replace('/', '-')}.json`, `Dados/${folder}/${month.slice(3)}-${month.slice(0, 2)}.json`, `dados/${kind}/${month.replace('/', '-')}.json`]) {
        try {
          const file = bucket.file(path), [metadata] = await file.getMetadata()
          if (Number(metadata.size) > 15000000) throw Error('Base muito grande para uma consulta do assistente.')
          const [bytes] = await file.download(), parsed = JSON.parse(bytes.toString())
          if (!Array.isArray(parsed)) throw Error('Arquivo de vendas inválido.')
          const scoped = parsed.filter(allowed)
          sources.push({ month, kind: kind === 'pecas' ? 'Peças' : 'Oficina', updatedAt: metadata.updated, records: scoped.length })
          return scoped
        } catch (error) { if (error.code !== 404) throw error }
      }
      return []
    }
    const [pieces, services] = await Promise.all([load('pecas', 'Pecas'), load('oficina', 'Oficina')])
    rows.push(...normalizeAnalysisRows(pieces, services, monthStores, aliases))
    permittedTargets[month] = Object.fromEntries(Object.entries(targets[month] || {}).filter(([name]) => permittedConfigs[month]?.[name]))
  }
  // Remuneração (só o assistente do administrador chega aqui): taxas, regras de gestor e lançamentos manuais do período.
  const months2 = query.months.filter(value => !query.missingMonths.includes(value))
  const [operationalSnap, managementSnap, manualSnap, bonusSnap] = await Promise.all([
    ...['comissao_operacional', 'comissao_gestao', 'gestaoManual'].map(key => db.doc(`config/${key}`).get()),
    months2.length ? db.collection('bonificacoes').where('mes', 'in', months2).limit(3000).get() : { docs: [] },
  ])
  const parseList = snap => { const value = parse(snap); return Array.isArray(value) ? value : [] }
  const bonuses = Object.fromEntries(bonusSnap.docs.map(doc => doc.data()).filter(row => row?.nome && row.mes).map(row => [`${row.nome}||${row.mes}`, Number(row.valor) || 0]))
  const compensation = { rules, operational: parseList(operationalSnap), management: parseList(managementSnap), manual: parse(manualSnap), bonuses }
  return buildAnalysisContext({ query, rows, configs: permittedConfigs, targets: permittedTargets, source: 'firebase', sources, compensation, allowedStates: user.estados?.length ? user.estados : user.estado ? [user.estado] : [], now })
}
