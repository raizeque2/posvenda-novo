import { podeAcessar } from '../functions/src/tabPolicy.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { dataScope } from '../functions/src/dataScope.js'
import { isActiveProfile } from '../functions/src/securityPolicy.js'
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code } }
test('gateway valida identidade/caminhos, filtra pessoa e mês e remove dados de cliente do CSV', async () => {
  const records = { '10/2026': { ANA: { loja: 'ARA', supervisor: 'GESTOR' }, BIA: { loja: 'PEI' } } }
  const docs = {
    'usuarios/op': { role: 'operacional', nome: 'ANA' }, 'usuarios/inactive': { role: 'admin', ativo: false },
    'config/colaboradores': { payload: JSON.stringify(records) },
    'config/regras': { payload: JSON.stringify({ '10/2026': { lojas: { ARA: { uf: 'AL' }, PEI: { uf: 'PE' } } } }) },
  }
  let downloads = 0
  const rows = [{ mes: '10/2026', empresa: 'ARA', responsavel: 'ANA', valor: 100, cliente: 'PRIVATE-CUSTOMER', CPF: 'PRIVATE-CPF' }, { mes: '10/2026', empresa: 'PEI', responsavel: 'BIA', valor: 900 }]
  const db = { doc: path => ({ get: async () => ({ exists: !!docs[path], data: () => docs[path] }) }) }
  const bucket = { file: () => ({ getMetadata: async () => [{ size: 300 }], download: async () => { downloads++; return [Buffer.from(JSON.stringify(rows))] } }) }
  const context = vm.createContext({ podeAcessar, dataScope, isActiveProfile, HttpsError, Buffer, getFirestore: () => db, getStorage: () => ({ bucket: () => bucket }), onCall: (_, fn) => fn })
  const source = readFileSync(new URL('../functions/src/dataAccess.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '').replaceAll('export ', '')
  vm.runInContext(source + ';globalThis.read=lerDadosAutorizados', context)
  const read = (data, uid = 'op') => context.read({ auth: uid ? { uid } : null, data })
  await assert.rejects(read({ kind: 'file', path: 'Dados/Pecas/10-2026.json' }, null), { code: 'unauthenticated' })
  await assert.rejects(read({ kind: 'file', path: 'Dados/Pecas/10-2026.json' }, 'inactive'), { code: 'permission-denied' })
  for (const path of ['../credentials.json', 'Dados/Pecas/../secret.json', 'Dados/Pecas/historico/10-2026.json']) await assert.rejects(read({ kind: 'file', path }), { code: 'invalid-argument' })
  await assert.rejects(read({ kind: 'config', key: 'snapshotConfig' }), { code: 'invalid-argument' })
  assert.equal(downloads, 0)
  const result = await read({ kind: 'file', path: 'Dados/Pecas/10-2026.json' })
  assert.equal(result.length, 1)
  assert.equal(result[0].valor, 100)
  assert.ok(!JSON.stringify(result).includes('PRIVATE'))
  const people = await read({ kind: 'config', key: 'colaboradores' })
  assert.deepEqual(Object.keys(people['10/2026']), ['ANA'])
  // Uma chamada devolve todas as chaves, com o mesmo recorte de escopo.
  await assert.rejects(read({ kind: 'configs', keys: ['snapshotConfig'] }), { code: 'invalid-argument' })
  await assert.rejects(read({ kind: 'configs', keys: [] }), { code: 'invalid-argument' })
  const bundle = await read({ kind: 'configs', keys: ['colaboradores', 'metas'] })
  assert.deepEqual(Object.keys(bundle.colaboradores['10/2026']), ['ANA'])
  assert.deepEqual(bundle.metas, {})
  // Visão geral do portal: só totais agregados, sem nomes nem linhas de venda.
  await assert.rejects(read({ kind: 'overview', mes: '2026-10' }), { code: 'invalid-argument' })
  const overview = await read({ kind: 'overview', mes: '10/2026' })
  assert.equal(overview.pecas.total, 1000)
  assert.equal(overview.pecas.registros, 2)
  assert.equal(overview.pessoas, 2)
  assert.equal(JSON.stringify(overview).includes('ANA'), false)
  assert.equal(JSON.stringify(overview).includes('PRIVATE'), false)
})
