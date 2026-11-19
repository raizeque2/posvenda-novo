import test from 'node:test'
import assert from 'node:assert/strict'
import { arrumarKpis, colunasDaGrade, moverPara, SUBCOLUNAS } from '../src/bi/kpiGrid.js'

const subs = m => [...m.values()].map(v => v.sub)

test('toda linha fecha a largura, com qualquer combinação de tamanhos', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  for (const colunas of [1, 2, 3, 4, 5, 6, 7]) for (const tamanhos of [{}, { A: 2 }, { B: 2, E: 3 }, { A: 3, B: 3, C: 2 }]) {
    const m = arrumarKpis(ids, tamanhos, colunas)
    const total = subs(m).reduce((s, v) => s + v, 0)
    assert.equal(total % SUBCOLUNAS, 0, `colunas ${colunas} ${JSON.stringify(tamanhos)}`)
    for (const v of m.values()) assert.ok(v.sub >= 1 && v.sub <= SUBCOLUNAS && v.span <= Math.min(3, colunas))
  }
})

test('7 cards em 4 colunas: a última linha divide a sobra igualmente (3 terços)', () => {
  const m = arrumarKpis(['A', 'B', 'C', 'D', 'E', 'F', 'G'], {}, 4)
  assert.deepEqual(subs(m), [105, 105, 105, 105, 140, 140, 140])
  assert.ok([...m.values()].every(v => v.span === 1), 'compacto continua compacto')
})

test('duplo que não cabe desce e a linha anterior se reparte', () => {
  const m = arrumarKpis(['A', 'B', 'C', 'D'], { D: 2 }, 4)
  assert.deepEqual(subs(m), [140, 140, 140, 420])
  assert.equal(m.get('D').span, 2)
})

test('colunas pela largura e reordenação', () => {
  assert.equal(colunasDaGrade(1000), 7)
  assert.equal(colunasDaGrade(820), 6)
  assert.equal(colunasDaGrade(1180), 7)
  assert.equal(colunasDaGrade(375), 2)
  assert.deepEqual(moverPara(['A', 'B', 'C'], 'A', 'C'), ['B', 'C', 'A'])
})

test('no computador os 7 cards cabem numa linha só', () => {
  const m = arrumarKpis(['A', 'B', 'C', 'D', 'E', 'F', 'G'], {}, 7)
  assert.deepEqual(subs(m), [60, 60, 60, 60, 60, 60, 60])
})
