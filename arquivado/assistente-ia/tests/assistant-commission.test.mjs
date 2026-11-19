import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRanking } from '../src/services/ranking/buildRanking.js'
import { prepareChange, applyChange } from '../functions/src/assistantChangesPolicy.js'

test('comissão confirmada entra no cálculo real e afeta somente a pessoa escolhida', () => {
  const month = '10/2026', people = Object.fromEntries(['ANA', 'BIA'].map(name => [name, { colaborador: name, loja: 'ARA', cargo: 'VENDEDOR', cargo_movimento: 'VAREJO' }]))
  const rates = [{ uf: 'AL', cargo: 'VENDEDOR', cp: .01 }]
  const state = { people, stores: { ARA: { uf: 'AL' } }, metas: {}, rules: { comissao: rates }, bonuses: {}, manual: {} }
  const proposal = prepareChange('Altere a comissão da Ana para 2%', state, month)
  const changed = applyChange(state, proposal)
  const extra = prepareChange('Adicione R$ 30 de comissão extra para Ana', changed, month)
  const final = applyChange(changed, extra)
  const rows = buildRanking(['ANA', 'BIA'].map(responsavel => ({ responsavel, empresa: 'ARA', cat: 'VAREJO', valor: 1000 })), [], month, { [month]: people }, { [month]: final.metas }, {}, 1, 20, {}, rates, [])
  assert.equal(rows.find(row => row.nome === 'ANA').comTotal, 50)
  assert.equal(rows.find(row => row.nome === 'BIA').comTotal, 10)
  assert.equal(rates[0].cp, .01)
})
