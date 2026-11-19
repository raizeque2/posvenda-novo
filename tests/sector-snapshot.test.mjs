import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { sectorSnapshotData } from '../functions/src/sectorSnapshotPolicy.js'
import { snapshotAchievement, snapshotPeople } from '../src/analytics/snapshot.js'
const now = new Date('2026-10-15T15:00:00Z'), config = { chaveSecreta: 'test-secret-not-a-real-key', configs: {} }
const token = createHash('sha256').update(`${config.chaveSecreta}::AL::pecas::10/2026`).digest('hex')
const snapshot = { mes: '10/2026', estado: 'AL', tipo: 'pecas', token, kpis: [{ real: 40, meta: 100, proj: 150 }], secret: 'private' }
test('link de setor é validado no servidor, exige token longo e não revela token ou configuração', () => {
  for (const value of [token]) {
    const result = sectorSnapshotData(snapshot, config, { estado: 'al', tipo: 'pecas', token: value }, now)
    assert.equal(result.kpis[0].real, 40); assert.ok(!JSON.stringify(result).includes('private')); assert.equal(result.token, undefined)
  }
})
test('revogar, rotacionar segredo, mudar setor/UF ou expirar mês invalida o acesso', () => {
  const request = { estado: 'AL', tipo: 'pecas', token }
  assert.throws(() => sectorSnapshotData(snapshot, config, { ...request, token: token.slice(0, 8) }, now))
  assert.throws(() => sectorSnapshotData(snapshot, { ...config, configs: { 'AL-pecas': { ativo: false } } }, request, now))
  assert.throws(() => sectorSnapshotData(snapshot, { chaveSecreta: 'rotated-test-secret' }, request, now))
  assert.throws(() => sectorSnapshotData(snapshot, config, { ...request, estado: 'PE' }, now))
  assert.throws(() => sectorSnapshotData(snapshot, config, { ...request, tipo: 'oficina' }, now))
  assert.throws(() => sectorSnapshotData(snapshot, config, request, new Date('2026-11-01T15:00:00Z')))
})
test('meta realizada não é a projeção e a busca encontra nomes sem acentos', () => {
  assert.equal(snapshotAchievement(40, 100), .4)
  assert.equal(snapshotAchievement(150, 100), 1.5)
  assert.equal(snapshotAchievement(40, 0), null)
  assert.deepEqual(snapshotPeople([{ nome: 'MARIA ANTÔNIA' }, { nome: 'JOÃO' }], 'antonia'), [{ nome: 'MARIA ANTÔNIA' }])
})
