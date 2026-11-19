import test from 'node:test'
import assert from 'node:assert/strict'
import { initial, upgradeBiProfiles, limparLayoutV5, widget } from '../src/bi/model.js'

test('layout limpo: Evolução (2/3, colunas) + Participação (1/3); Equipe (1/3) + Peças (2/3)', () => {
  const p = initial().profiles[0]
  assert.deepEqual(p.desktop.map(w => [w.id, w.width]), [['trend', 8], ['sales', 4], ['team', 4], ['parts', 8]])
  assert.equal(p.desktop[0].type, 'colunas')
})

test('visões salvas antigas migram uma vez e preservam blocos próprios', () => {
  const antigo = { profiles: [{ id: 'x', name: 'Minha', defaultWidgetsVersion: 4, desktop: [
    widget('meu', 'Meu bloco', 'store', 'bar', { width: 6 }),
    widget('trend', 'Evolução', 'date', 'line', { width: 12 }),
    widget('team', 'Equipe', 'person', 'table', { width: 8 }),
    widget('sales', 'Participação', 'channel', 'donut', { width: 4 }),
    widget('parts', 'Peças', 'product', 'bar', { width: 6 }),
  ], mobile: null }] }
  const novo = upgradeBiProfiles(antigo).profiles[0]
  assert.deepEqual(novo.desktop.map(w => [w.id, w.width]), [['meu', 6], ['trend', 8], ['sales', 4], ['team', 4], ['parts', 8]])
  assert.equal(novo.desktop[1].type, 'colunas')
  assert.equal(novo.desktop[0].type, 'bar')
  assert.equal(novo.defaultWidgetsVersion, 6)
  assert.equal(upgradeBiProfiles({ profiles: [novo] }).profiles[0], novo)
  // Sem todos os blocos padrão, só ajusta o que existe e não reordena.
  assert.deepEqual(limparLayoutV5([widget('trend', 'E', 'date', 'bar')]).map(w => [w.type, w.width]), [['bar', 8]])
})

test('v5 → v6: só a Evolução em área vira colunas; tipo escolhido à mão (barras) fica', () => {
  const v5 = { profiles: [{ id: 'y', defaultWidgetsVersion: 5, desktop: [widget('trend', 'E', 'date', 'area')], mobile: null }] }
  assert.equal(upgradeBiProfiles(v5).profiles[0].desktop[0].type, 'colunas')
  const barras = { profiles: [{ id: 'z', defaultWidgetsVersion: 5, desktop: [widget('trend', 'E', 'date', 'bar')], mobile: null }] }
  assert.equal(upgradeBiProfiles(barras).profiles[0].desktop[0].type, 'bar')
})
