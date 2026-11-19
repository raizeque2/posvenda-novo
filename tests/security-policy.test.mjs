import test from 'node:test'
import assert from 'node:assert/strict'
import { canImport, isActiveProfile, validateImport, validateAccount } from '../functions/src/securityPolicy.js'

test('upload exige perfil ativo de administrador ou coordenador, não apenas autenticação', () => {
  for (const profile of [null, {}, { role: 'operacional' }, { role: 'supervisor' }, { role: 'admin', ativo: false }]) assert.equal(canImport(profile), false)
  assert.equal(canImport({ role: 'admin' }), true)
  assert.equal(canImport({ role: 'coordenador', ativo: true }), true)
  assert.equal(isActiveProfile({ role: 'fake' }), false)
})
test('fronteiras rejeitam CSVs grandes, tipos incorretos e perfis forjados', () => {
  const data = { tipo: 'pecas', csvText: 'coluna;valor\na;b' }
  assert.equal(validateImport(data).retroativo, false)
  for (const invalid of [null, { ...data, csvText: 'x'.repeat(8000001) }, { ...data, motivo: {} }, { ...data, retroativo: 'true' }, { ...data, retroativo: true }]) assert.throws(() => validateImport(invalid))
  for (const invalid of [{ acao: 'criar', role: 'owner' }, { acao: 'criar', estados: ['XX'] }, { acao: 'excluir', uid: '../admin' }, { acao: 'criar', senha: '123' }]) assert.throws(() => validateAccount(invalid))
})
