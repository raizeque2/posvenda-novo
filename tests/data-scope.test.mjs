import test from 'node:test'
import assert from 'node:assert/strict'
import { dataScope } from '../functions/src/dataScope.js'
const stores = { ARA: { uf: 'AL' }, PEI: { uf: 'PE' } }
const collaborators = { '10/2026': { ANA: { loja: 'ARA', apelido: '[ANINHA]', supervisor: 'GESTOR' }, BIA: { loja: 'PEI', supervisor: 'OUTRO' } } }
test('escopo de dados impede acesso direto a outras pessoas, equipes e estados', () => {
  const own = dataScope({ role: 'operacional', nome: 'ANA' }, collaborators, stores)
  assert.equal(own.rowAllowed({ responsavel: 'ANINHA', empresa: 'ARA' }), true)
  assert.equal(own.rowAllowed({ responsavel: 'BIA', empresa: 'PEI' }), false)
  assert.equal(own.rowAllowed({ responsavel: 'ANINHA', empresa: 'PEI' }), false)
  const supervisor = dataScope({ role: 'supervisor', nome: 'GESTOR' }, collaborators, stores)
  assert.equal(supervisor.nameAllowed('ANA'), true); assert.equal(supervisor.nameAllowed('BIA'), false)
  const coordinator = dataScope({ role: 'coordenador', estados: ['AL'] }, collaborators, stores)
  assert.equal(coordinator.rowAllowed({ empresa: 'PEI' }), false)
  assert.equal(coordinator.rowAllowed({ empresa: 'ARA' }), true)
  assert.deepEqual(Object.keys(own.namedConfig(collaborators)['10/2026']), ['ANA'])
})

test('troca de equipe não dá acesso retroativo aos meses de outra equipe', () => {
 const configs = { '09/2026': { ANA: { loja: 'ARA', supervisor: 'OUTRO' } }, '10/2026': { ANA: { loja: 'ARA', supervisor: 'GESTOR' } } }
 const scope = dataScope({ role: 'supervisor', nome: 'GESTOR' }, configs, stores)
 assert.equal(scope.rowAllowed({ mes: '09/2026', empresa: 'ARA', responsavel: 'ANA' }), false)
 assert.equal(scope.rowAllowed({ mes: '10/2026', empresa: 'ARA', responsavel: 'ANA' }), true)
 assert.deepEqual(Object.keys(scope.namedConfig(configs)['09/2026']), [])
})
