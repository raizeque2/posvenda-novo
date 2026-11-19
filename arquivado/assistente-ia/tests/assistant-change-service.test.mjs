import test from 'node:test'
import assert from 'node:assert/strict'
import { executeReviewedChange } from '../functions/src/assistantChangeService.js'
const now = Date.parse('2026-10-20T15:00:00Z'), month = '10/2026'
const payload = value => ({ payload: JSON.stringify(value) })
function database() {
  const docs = {
    'usuarios/admin': { role: 'admin', ativo: true, estados: ['AL'] },
    'usuarios/other': { role: 'admin', ativo: true },
    'usuarios/viewer': { role: 'operacional', ativo: true },
    'config/colaboradores': payload({ [month]: { 'ANA COSTA': { colaborador: 'ANA COSTA', loja: 'ARA', cargo: 'VENDEDOR', cargo_movimento: 'VAREJO' } } }),
    'config/lojas': payload({ ARA: { uf: 'AL' } }),
    'config/metas': payload({ [month]: { 'ANA COSTA': { metas: { VAREJO: { mp: 1000 } } } } }),
    'config/regras': payload({ [month]: { comissao: [{ uf: 'AL', cargo: 'VENDEDOR', cp: .01 }] } }),
  }
  let sequence = 0
  return { docs, async call(data, uid = 'admin', time = now) {
    const writes = []
    const result = await executeReviewedChange(uid, data, {
      get: async path => { assert.equal(writes.length, 0, 'all reads precede transaction writes'); return structuredClone(docs[path]) },
      set: (path, value) => writes.push([path, structuredClone(value)]),
    }, time, () => (++sequence).toString(16).padStart(32, '0'))
    for (const [path, value] of writes) docs[path] = value
    return result
  } }
}
const request = { action: 'prepare', question: 'Adicione R$ 150 de bonificação para Ana Costa' }
test('proposta, cancelamento e confirmação são separados; repetir confirmação não duplica bônus', async () => {
  const db = database(), before = structuredClone(db.docs)
  const first = await db.call(request)
  assert.equal(first.proposal.next, 150)
  for (const [path, value] of Object.entries(before)) assert.deepEqual(db.docs[path], value)
  assert.equal(first.proposal.uid, undefined); assert.equal(first.proposal.intent, undefined)
  await db.call({ action: 'cancel', id: first.proposal.id })
  await assert.rejects(db.call({ action: 'confirm', id: first.proposal.id, confirmed: true }), /cancelada/)
  assert.equal(db.docs['bonificacoes/ANA COSTA__10-2026'], undefined)
  const second = await db.call(request), confirm = { action: 'confirm', id: second.proposal.id, confirmed: true }
  await db.call(confirm); const saved = structuredClone(db.docs)
  await db.call(confirm)
  assert.deepEqual(db.docs, saved)
  assert.equal(db.docs['bonificacoes/ANA COSTA__10-2026'].valor, 150)
  assert.equal(db.docs[`assistantAudit/${second.proposal.id}`].next, 150)
})
test('recusa alteração concorrente, usuário diferente, revogação, expiração e valores injetados', async () => {
  const db = database(), { proposal } = await db.call(request)
  const confirm = { action: 'confirm', id: proposal.id, confirmed: true }
  await assert.rejects(db.call({ ...confirm, next: 9999 }), /proposta exata/)
  await assert.rejects(db.call({ ...confirm, confirmed: false }), /Confirmar/)
  await assert.rejects(db.call(confirm, 'other'), /sua conta/)
  await assert.rejects(db.call(confirm, 'viewer'), /administradores/)
  await assert.rejects(db.call(confirm, 'admin', now + 600001), /expirou/)
  db.docs['bonificacoes/ANA COSTA__10-2026'] = { valor: 20 }
  await assert.rejects(db.call(confirm), /mudou/)
  db.docs['usuarios/admin'].estados = ['PE']
  await assert.rejects(db.call(confirm), /permissão/)
  assert.equal(db.docs[`assistantAudit/${proposal.id}`], undefined)
})
test('comissão individual e meta preservam o restante do cadastro e das regras', async () => {
  const db = database()
  for (const question of ['Altere a comissão de Ana Costa para 2%', 'Aumente a meta de Ana Costa em 10%']) {
    const { proposal } = await db.call({ action: 'prepare', question })
    await db.call({ action: 'confirm', id: proposal.id, confirmed: true })
  }
  const actual = JSON.parse(db.docs['config/metas'].payload)[month]['ANA COSTA']
  assert.equal(actual.comissaoOverrides.cp, .02)
  assert.equal(actual.metas.VAREJO.mp, 1100)
  assert.equal(JSON.parse(db.docs['config/regras'].payload)[month].comissao[0].cp, .01)
})
