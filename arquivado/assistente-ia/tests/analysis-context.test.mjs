import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as analysis from '../functions/src/assistantAnalysis.js'
import { allowedAssistantStore } from '../functions/src/assistantPolicy.js'

test('carregamento do Firebase reaplica UF, usa caminho alternativo e devolve somente agregados', async () => {
  const stores = { ARA: { uf: 'AL' }, PEI: { uf: 'PE' } }
  const docs = {
    mesesDisponiveis: { pecas: ['09/2026'], oficina: [] },
    colaboradores: { payload: JSON.stringify({ '09/2026': { ANA: { loja: 'ARA' }, BIA: { loja: 'PEI' } } }) },
    metas: { payload: '{}' }, regras: { payload: JSON.stringify({ '09/2026': { lojas: stores } }) },
  }
  const bonus = [{ nome: 'ANA', mes: '09/2026', valor: 7 }, { nome: 'BIA', mes: '09/2026', valor: 5 }]
  const db = { doc: path => ({ get: async () => ({ data: () => docs[path.split('/')[1]] }) }), collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ docs: bonus.map(row => ({ data: () => row })) }) }) }) }) }
  const accessed = []
  const bucket = { file: path => ({ getMetadata: async () => { accessed.push(path); if (path !== 'Dados/Pecas/2026-09.json') throw Object.assign(Error('missing'), { code: 404 }); return [{ size: 200, updated: '2026-10-01T12:00:00Z' }] }, download: async () => [Buffer.from(JSON.stringify([{ dt: '2026-09-05', empresa: 'ARA', responsavel: 'ANA', valor: 100, cliente: 'private' }, { dt: '2026-09-05', empresa: 'PEI', responsavel: 'BIA', valor: 900 }]))] }) }
  const context = { ...analysis, allowedAssistantStore, Buffer, Date }
  const code = readFileSync(new URL('../functions/src/analysisContext.js', import.meta.url), 'utf8').replace(/^import .*\r?\n/gm, '').replace('export async function', 'async function')
  vm.runInNewContext(`${code}\nglobalThis.load = loadAnalysisContext`, context)
  const result = await context.load({ estados: ['AL'] }, { question: 'Vendas de setembro', pageFilters: null }, { db, bucket, now: new Date('2026-10-15T15:00:00Z') })
  assert.equal(result.sales.total, 100)
  assert.equal(result.provenance.sources[0].records, 1)
  assert.ok(accessed.includes('Dados/Pecas/2026-09.json'))
  assert.deepEqual(result.commissions, [{ month: '09/2026', name: 'ANA', role: '', rates: {}, manualBonus: 7 }])
  assert.ok(!JSON.stringify(result).includes('private'))
  assert.ok(!JSON.stringify(result).includes('BIA'))
})
