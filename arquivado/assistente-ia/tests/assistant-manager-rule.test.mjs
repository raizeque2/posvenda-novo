import test from 'node:test'
import assert from 'node:assert/strict'
import { executeReviewedChange } from '../functions/src/assistantChangeService.js'
import { compensationContext } from '../functions/src/assistantAnalysis.js'
import { reportSections, markdownLines } from '../src/assistant/chat/answerReport.js'

// Dados fictícios.
const now = Date.parse('2026-11-12T15:00:00Z'), month = '11/2026'
const payload = value => ({ payload: JSON.stringify(value) })
const rita = { colaborador: 'RITA SOUZA', canaisBase: ['tp'], comissao: 0.005, bonificacao: 0.01, indicadores: [{ chave: 'ind_tsi', nome: 'TSI', tipo: 'valor', operador: 'gte', threshold: 90, pct: 0.002 }] }
function database() {
  const docs = {
    'usuarios/admin': { role: 'admin', ativo: true, email: 'admin@exemplo.test' },
    'usuarios/sup': { role: 'supervisor', ativo: true, nome: 'RITA SOUZA' },
    'config/colaboradores': payload({ [month]: {
      'HUGO MARTINS': { colaborador: 'HUGO MARTINS', loja: 'L1', cargo: 'SUPERVISOR', cargo_movimento: 'VAREJO' },
      'RITA SOUZA': { colaborador: 'RITA SOUZA', loja: 'L1', cargo: 'SUPERVISOR', cargo_movimento: 'VAREJO' },
      'ANA COSTA': { colaborador: 'ANA COSTA', loja: 'L1', cargo: 'VENDEDOR', cargo_movimento: 'VAREJO', supervisor: 'HUGO MARTINS' },
    } }),
    'config/lojas': payload({ L1: { uf: 'AL' } }),
    'config/metas': payload({ [month]: {} }),
    'config/regras': payload({ [month]: { comissao: [{ uf: 'AL', cargo: 'VENDEDOR', cp: 0.01 }], gestao: [rita] }, '10/2026': { gestao: [{ colaborador: 'RITA SOUZA', canaisBase: ['tp'], comissao: 0.003, indicadores: [] }] } }),
  }
  let sequence = 0
  return { docs, async call(data, uid = 'admin', time = now) {
    const writes = []
    const result = await executeReviewedChange(uid, data, {
      get: async path => structuredClone(docs[path]),
      set: (path, value) => writes.push([path, structuredClone(value)]),
    }, time, () => (++sequence).toString(16).padStart(32, '0'))
    for (const [path, value] of writes) docs[path] = value
    return result
  } }
}
const rules = db => JSON.parse(db.docs['config/regras'].payload)
const audits = db => Object.keys(db.docs).filter(path => path.startsWith('assistantAudit/'))
const novaRegra = { action: 'prepare', question: 'Crie a regra de gestão do Hugo Martins', change: { kind: 'managementRule', person: 'Hugo Martins', rule: { comissao: 1.5, bonificacao: 2, bonusMinimo: 95, indicadores: [{ nome: 'Mão de obra', tipo: 'auto', autoKey: 'pctMO', threshold: 100, pct: 0.5 }] } } }

test('cria regra de gestor nova só depois de confirmar, com auditoria e sem mexer em outros gestores ou meses', async () => {
  const db = database(), antes = db.docs['config/regras'].payload
  const prepared = await db.call(novaRegra)
  assert.equal(prepared.proposal.label, 'Nova regra de gestor')
  assert.equal(prepared.proposal.old, null, 'sem regra anterior')
  assert.equal(db.docs['config/regras'].payload, antes, 'preparar não grava a regra')
  assert.equal(audits(db).length, 0)
  const confirmed = await db.call({ action: 'confirm', id: prepared.proposal.id, confirmed: true })
  assert.equal(confirmed.status, 'applied')
  const gestao = rules(db)[month].gestao
  assert.deepEqual(gestao[0], rita, 'regra da Rita preservada e na mesma posição')
  assert.deepEqual(gestao[1], { colaborador: 'HUGO MARTINS', canaisBase: ['tp'], comissao: 0.015, bonificacao: 0.02, bonusMinimo: 0.95, indicadores: [{ chave: 'ind_mao_de_obra', nome: 'Mão de obra', tipo: 'auto', pct: 0.005, operador: 'gte', threshold: 1, autoKey: 'pctMO' }] })
  assert.deepEqual(rules(db)['10/2026'], JSON.parse(antes)['10/2026'], 'outro mês intacto')
  assert.equal(audits(db).length, 1)
  assert.equal(db.docs[audits(db)[0]].field, 'regraGestao')
  const again = await db.call({ action: 'confirm', id: prepared.proposal.id, confirmed: true })
  assert.equal(again.status, 'applied')
  assert.equal(rules(db)[month].gestao.length, 2, 'confirmar de novo não duplica')
})

test('editar regra existente muda só o informado e mantém a identificação do indicador de mesmo nome', async () => {
  const db = database()
  const prepared = await db.call({ action: 'prepare', question: 'Ajuste a bonificação de gestão da Rita Souza', change: { kind: 'managementRule', person: 'Rita Souza', rule: { bonificacao: 1.2, indicadores: [{ nome: 'tsi', tipo: 'valor', threshold: 95, pct: 0.3 }] } } })
  assert.equal(prepared.proposal.label, 'Regra de gestor')
  await db.call({ action: 'confirm', id: prepared.proposal.id, confirmed: true })
  const row = rules(db)[month].gestao[0]
  assert.equal(row.comissao, 0.005)
  assert.equal(row.bonificacao, 0.012)
  assert.deepEqual(row.indicadores, [{ chave: 'ind_tsi', nome: 'tsi', tipo: 'valor', pct: 0.003, operador: 'gte', threshold: 95 }])
})

test('regra inválida, pessoa fora do cadastro ou perfil sem permissão não geram proposta', async () => {
  const db = database()
  const invalida = await db.call({ ...novaRegra, change: { ...novaRegra.change, rule: { canaisBase: ['tp', 'varejo'] } } })
  assert.equal(invalida.proposal, undefined)
  assert.match(invalida.text, /Peças total já inclui/)
  const campo = await db.call({ ...novaRegra, change: { ...novaRegra.change, rule: { salario: 10 } } })
  assert.equal(campo.proposal, undefined)
  const pessoa = await db.call({ ...novaRegra, question: 'Crie a regra de gestão do Fulano', change: { ...novaRegra.change, person: 'Fulano de Tal' } })
  assert.equal(pessoa.proposal, undefined)
  await assert.rejects(db.call(novaRegra, 'sup'), { code: 'permission-denied' })
  assert.equal(Object.keys(db.docs).some(path => path.startsWith('assistantProposals/')), false)
})

test('pedido em texto para gestor sem regra vai para o modelo em vez de virar comissão individual', async () => {
  const db = database()
  const result = await db.call({ action: 'prepare', question: 'Crie uma regra de gestão para Hugo Martins com 1% de comissão' })
  assert.equal(result.proposal, undefined)
  assert.equal(result.needsModel, true)
})

test('regra alterada entre a revisão e a confirmação é recusada', async () => {
  const db = database()
  const prepared = await db.call(novaRegra)
  const atual = rules(db); atual[month].gestao.push({ colaborador: 'HUGO MARTINS', canaisBase: ['mo'], comissao: 0.01, indicadores: [] })
  db.docs['config/regras'] = payload(atual)
  await assert.rejects(db.call({ action: 'confirm', id: prepared.proposal.id, confirmed: true }), { code: 'failed-precondition' })
})

test('proposta lida do Firestore com chaves em outra ordem ainda confirma', async () => {
  const db = database()
  const prepared = await db.call(novaRegra), path = `assistantProposals/${prepared.proposal.id}`
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reorder(v)])) : value
  db.docs[path] = reorder(db.docs[path])
  assert.equal((await db.call({ action: 'confirm', id: prepared.proposal.id, confirmed: true })).status, 'applied')
})

test('contexto de comissões traz taxas, regra de gestor e lançamentos manuais do recorte', () => {
  const configs = { [month]: {
    'ANA COSTA': { colaborador: 'ANA COSTA', loja: 'L1', cargo: 'VENDEDOR' },
    'RITA SOUZA': { colaborador: 'RITA SOUZA', loja: 'L1', cargo: 'SUPERVISOR' },
    'ZECA INATIVO': { colaborador: 'ZECA INATIVO', loja: 'L1', cargo: 'VENDEDOR', ativo: false },
  } }
  const base = { months: [month], configs, targets: { [month]: { 'ANA COSTA': { comissaoExtra: 40 } } }, rules: { [month]: { lojas: { L1: { uf: 'AL' } }, gestao: [rita] } }, operational: [{ uf: 'AL', cargo: 'VENDEDOR', cp: 0.01 }], bonuses: { 'ANA COSTA||11/2026': 150, 'ANA COSTA||10/2026': 999 }, manual: { [month]: { 'RITA SOUZA': { bonusExtra: 80 } } } }
  const all = compensationContext(base)
  assert.deepEqual(all.map(item => item.name), ['ANA COSTA', 'RITA SOUZA'])
  assert.deepEqual(all[0], { month, name: 'ANA COSTA', role: 'VENDEDOR', rates: { cp: 1 }, manualBonus: 150, commissionExtra: 40 })
  assert.deepEqual(all[1].managerRule, { comissao: 0.5, bonificacao: 1, base: 'equipe', canais: ['tp'], indicadores: [{ nome: 'TSI', tipo: 'valor', bonus: 0.2 }] })
  assert.equal(all[1].manualBonus, 80)
  assert.deepEqual(compensationContext({ ...base, people: ['Rita Souza'] }).map(item => item.name), ['RITA SOUZA'])
})

test('relatório da resposta: texto sem marcação, tabela dos gráficos e fontes', () => {
  assert.deepEqual(markdownLines('## Total\n**R$ 10**\n| Loja | Valor |\n|---|---|\n| L1 | 10 |').map(line => line.text), ['Total', 'R$ 10', 'Loja   |   Valor', 'L1   |   10'])
  const sections = reportSections('Faturamento de novembro', { text: 'Total de **R$ 1.000**.', charts: [{ title: 'Por canal', data: [{ name: 'VAREJO', value: 1000, records: 3 }] }], provenance: { periods: [month], scope: 'L1', sources: [{ kind: 'Peças', month, records: 3 }], warnings: ['Aviso de teste.'] } }, new Date(now))
  assert.deepEqual(sections.map(section => section.title), ['Pergunta', 'Resposta', 'Por canal', 'Fontes e recorte'])
  assert.equal(sections[2].table.rows[0][0], 'VAREJO')
  assert.match(sections[2].table.rows[0][1], /1\.000,00/)
  assert.ok(sections[3].lines.includes('Peças 11/2026: 3 registro(s)'))
  assert.ok(sections[3].lines.includes('Aviso de teste.'))
})
