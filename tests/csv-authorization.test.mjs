import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import * as policy from '../functions/src/securityPolicy.js'
class HttpsError extends Error { constructor(code, message) { super(message); this.code = code } }
test('CSV: bloqueia perfis sem acesso e preserva outra UF com condição de geração', async () => {
  const month = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: '2-digit', year: 'numeric' }).format(new Date())
  let profile = { role: 'operacional' }, writes = []
  const rules = { [month]: { lojas: { ARA: { uf: 'AL' }, PEI: { uf: 'PE' } } } }
  const config = { regras: { payload: JSON.stringify(rules) } }
  const db = { doc: () => ({ get: async () => ({ data: () => profile }) }), collection: () => ({ doc: name => ({ get: async () => ({ exists: !!config[name], data: () => config[name] }), set: async value => { config[name] = value } }) }), runTransaction: async fn => fn({ get: ref => ref.get(), set: (ref, value) => ref.set(value) }) }
  const old = [{ empresa: 'PEI', mes: month, valor: 900 }, { empresa: 'ARA', mes: month, valor: 50 }]
  const bucket = { file: () => ({ exists: async () => [true], getMetadata: async () => [{ generation: '7' }], download: async () => [Buffer.from(JSON.stringify(old))], save: async (value, options) => writes.push({ rows: JSON.parse(value), options }) }) }
  const context = vm.createContext({ ...policy, Buffer, Date, Intl, HttpsError, initializeApp: () => {}, getStorage: () => ({ bucket: () => bucket }), getFirestore: () => db, onCall: (_, callback) => callback, REGRA_PECAS: {}, REGRA_OFICINA: {}, parseCSV: () => ({ rows: [{}] }), processarPecas: () => ({ registros: [{ empresa: 'ARA', mes: month, valor: 100 }], inconsistencias: [] }) })
  const source = readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n').split('/**\n * gerenciarUsuario')[0].replace(/^import .*$/gm, '').replaceAll('export ', '')
  vm.runInContext(source + ';globalThis.upload=processarCSV', context)
  const request = { auth: { uid: 'account' }, data: { tipo: 'pecas', csvText: 'a;b\nvalue;value' } }
  await assert.rejects(context.upload(request), { code: 'permission-denied' })
  profile = { role: 'admin', ativo: false }
  await assert.rejects(context.upload(request), { code: 'permission-denied' })
  assert.equal(writes.length, 0)
  profile = { role: 'coordenador', estados: ['AL'] }
  await context.upload(request)
  assert.deepEqual(writes[0].rows.map(row => row.valor), [900, 100])
  assert.equal(writes[0].options.preconditionOpts.ifGenerationMatch, 7)
})
