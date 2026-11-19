import { prepareChange, applyChange, resolveChangePerson, changeMonth } from './assistantChangesPolicy.js'
import { isAssistantAdmin, allowedAssistantStore } from './assistantPolicy.js'

const configNames = ['colaboradores', 'metas', 'regras', 'lojas', 'comissao_operacional', 'comissao_gestao', 'gestaoManual']
const parse = doc => JSON.parse(doc?.payload || '{}')
const publicProposal = proposal => Object.fromEntries(['id', 'person', 'month', 'loja', 'channel', 'field', 'old', 'next', 'unit', 'label', 'expiresAt', 'status', 'appliedAt'].filter(key => proposal[key] !== undefined).map(key => [key, proposal[key]]))
const failure = (code, message) => Object.assign(Error(message), { code })
const bonusPath = (person, month) => `bonificacoes/${`${person}||${month}`.replace(/\|\|/g, '__').replace(/\//g, '-')}`

// The adapter is a Firestore transaction or an atomic preview-repository commit.
// The same checks and writes run in both environments; no model output is executed.
export async function executeReviewedChange(uid, data, transaction, now = Date.now(), createId = () => crypto.randomUUID().replaceAll('-', '')) {
  if (!uid) throw failure('unauthenticated', 'Entre no sistema.')
  const profile = await transaction.get(`usuarios/${uid}`)
  if (!isAssistantAdmin(profile)) throw failure('permission-denied', 'Somente administradores ativos podem confirmar alterações pelo assistente.')
  if (!['prepare', 'confirm', 'cancel'].includes(data?.action)) throw failure('invalid-argument', 'Operação inválida.')
  let saved
  if (data.action !== 'prepare') {
    if (typeof data.id !== 'string' || !/^[a-f0-9]{32}$/.test(data.id)) throw failure('invalid-argument', 'Proposta inválida.')
    saved = await transaction.get(`assistantProposals/${data.id}`)
    if (!saved || saved.uid !== uid) throw failure('permission-denied', 'Esta proposta não está disponível para sua conta.')
    if (data.action === 'confirm' && (data.confirmed !== true || Object.keys(data).some(key => !['action', 'id', 'confirmed'].includes(key)))) throw failure('failed-precondition', 'Clique em Confirmar alteração para autorizar esta proposta exata.')
    if (saved.status === 'applied') return { status: 'applied', proposal: publicProposal(saved) }
    if (saved.status !== 'pending') throw failure('failed-precondition', 'Esta proposta foi cancelada. Solicite outra alteração.')
    if (data.action === 'cancel') {
      const cancelled = { ...saved, status: 'cancelled', cancelledAt: now }
      transaction.set(`assistantProposals/${saved.id}`, cancelled)
      return { status: 'cancelled', proposal: publicProposal(cancelled) }
    }
    if (saved.expiresAt <= now || saved.month !== changeMonth(new Date(now))) throw failure('failed-precondition', 'A proposta expirou. Peça uma nova revisão.')
  }
  const month = changeMonth(new Date(now)), docs = await Promise.all(configNames.map(name => transaction.get(`config/${name}`)))
  const configs = Object.fromEntries(configNames.map((name, index) => [name, parse(docs[index])]))
  const rules = structuredClone(configs.regras[month] || {})
  rules.comissao ||= Array.isArray(configs.comissao_operacional) ? configs.comissao_operacional : []
  rules.gestao ||= Array.isArray(configs.comissao_gestao) ? configs.comissao_gestao : []
  const stores = { ...configs.lojas, ...rules.lojas }, people = Object.fromEntries(Object.entries(configs.colaboradores[month] || {}).filter(([, person]) => allowedAssistantStore(profile, person.loja, stores)))
  const state = { people, metas: configs.metas[month] || {}, rules, stores, bonuses: {}, manual: configs.gestaoManual[month] || {} }
  const question = saved?.question || data.question
  let person
  try { person = resolveChangePerson(question, state, saved?.person || data.change?.person) }
  catch (error) { if (saved) throw failure('failed-precondition', 'Cadastro ou permissão mudou. Solicite uma nova proposta.'); return { text: error.message, needsModel: !data.change } }
  const bonusRef = bonusPath(person, month), bonus = await transaction.get(bonusRef)
  if (bonus) state.bonuses[person] = bonus
  if (data.action === 'prepare') {
    let prepared
    try { prepared = prepareChange(question, state, month, data.change) }
    catch (error) { return { text: error.message, needsModel: !data.change } }
    const proposal = { ...prepared, id: createId(), uid, status: 'pending', createdAt: now, expiresAt: now + 600000, deleteAt: new Date(now + 86400000) }
    transaction.set(`assistantProposals/${proposal.id}`, proposal)
    return { text: 'Preparei a alteração abaixo. Confira os valores e confirme para salvar. Nada foi alterado ainda.', proposal: publicProposal(proposal) }
  }
  let next
  try { next = applyChange(state, saved) }
  catch (error) { throw failure('failed-precondition', error.message) }
  const actor = profile.email || uid
  if (saved.destination === 'bonus') {
    const historico = bonus ? [...(bonus.historico || []), { valor: bonus.valor || 0, por: bonus.por || '', em: bonus.em || 0, obs: bonus.obs || '' }] : []
    transaction.set(bonusRef, { nome: person, mes: month, valor: saved.next, por: actor, em: now, obs: 'Alteração confirmada no assistente', historico })
  } else {
    const name = saved.destination.startsWith('manual') ? 'gestaoManual' : ['management', 'managementRule'].includes(saved.destination) ? 'regras' : 'metas'
    const value = name === 'gestaoManual' ? next.manual : name === 'regras' ? next.rules : next.metas
    transaction.set(`config/${name}`, { ...(docs[configNames.indexOf(name)] || {}), payload: JSON.stringify({ ...configs[name], [month]: value }), ts: now })
  }
  const applied = { ...saved, status: 'applied', appliedAt: now }
  transaction.set(`assistantProposals/${saved.id}`, applied)
  transaction.set(`assistantAudit/${saved.id}`, { uid, person, month, field: saved.field, label: saved.label, old: saved.old, next: saved.next, at: now, source: 'assistant-reviewed', proposalId: saved.id })
  return { status: 'applied', proposal: publicProposal(applied) }
}
