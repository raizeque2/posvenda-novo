import test from 'node:test'
import assert from 'node:assert/strict'
import { resumoPeriodo, rankingSetor, progressoMetas } from '../src/analytics/meuDesempenho.js'

const out = '10/2026', nov = '11/2026'
const d = (y, m, day) => new Date(y, m - 1, day, 12)
const pessoas = { 'ANA COSTA': { colaborador: 'ANA COSTA', cargo_movimento: 'VAREJO', loja: 'ARA', ativo: true }, BIA: { colaborador: 'BIA', cargo_movimento: 'VAREJO', loja: 'ARA', ativo: true }, CAIO: { colaborador: 'CAIO', cargo_movimento: 'WEB', loja: 'ARA', ativo: true } }
const metas = { 'ANA COSTA': { colaborador: 'ANA COSTA', metas: { VAREJO: { mp: 1000 } } }, BIA: { colaborador: 'BIA', metas: { VAREJO: { mp: 200 } } }, CAIO: { colaborador: 'CAIO', metas: { WEB: { mp: 100 } } } }
const venda = (dt, responsavel, valor, cat = 'VAREJO') => ({ dt, responsavel, cat, empresa: 'ARA', valor })
const state = {
  pecasPorMes: {
    [out]: [venda(d(2026, 10, 2), 'ANA COSTA', 100), venda(d(2026, 10, 5), 'ANA COSTA', 50)],
    [nov]: [venda(d(2026, 11, 2), 'ANA COSTA', 120), venda(d(2026, 11, 4), 'ANA COSTA', 80), venda(d(2026, 11, 3), 'BIA', 150), venda(d(2026, 11, 3), 'CAIO', 999, 'WEB')],
  },
  oficinaPorMes: {}, colaboradoresPorMes: { [out]: pessoas, [nov]: pessoas }, metasPorMes: { [out]: metas, [nov]: metas },
  bonificacoes: {}, apelidoMap: {}, regras: {}, comissaoGestao: [], lojas: {},
}

test('Mês compara com o mesmo intervalo de dias do mês anterior', () => {
  const r = resumoPeriodo(state, 'ANA COSTA', 'mp', 'mes', d(2026, 11, 4))
  assert.equal(r.atual, 200)      // 02 e 04/11
  assert.equal(r.anterior, 100)   // só até o dia 4 de outubro (o dia 5 fica fora)
  assert.equal(r.variacao, 1)
  assert.ok(r.barras.every(b => /^S\d$/.test(b.rotulo)))
  assert.ok(r.barras.some(b => b.atual))
  assert.equal(r.barras.at(-1).real, null) // semanas futuras não têm realizado
})

test('Semana vai de segunda a sábado e compara com a semana anterior', () => {
  const r = resumoPeriodo(state, 'ANA COSTA', 'mp', 'semana', d(2026, 11, 4)) // quarta
  assert.deepEqual(r.barras.map(b => b.rotulo), ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'])
  assert.equal(r.atual, 200)
  assert.equal(r.barras[3].real, null)
  assert.ok(r.metaPeriodo > 0)
})

test('Ranking do setor usa % da meta, só do mesmo setor, e marca a própria pessoa', () => {
  const r = rankingSetor(state, 'ANA COSTA', nov, 'mp')
  assert.equal(r.setor, 'VAREJO')
  assert.deepEqual(r.lista.map(c => c.nome), ['BIA', 'ANA COSTA']) // 75% > 20%; CAIO (WEB) fica fora
  assert.equal(r.minhaPosicao, 2)
  assert.ok(r.lista.find(c => c.eu).nome === 'ANA COSTA')
})

test('Metas do mês trazem progresso real e não inventam meta ausente', () => {
  const [m] = progressoMetas(state, 'ANA COSTA', nov, ['mp'])
  assert.equal(m.real, 200)
  assert.equal(m.meta, 1000)
  assert.equal(m.pct, 0.2)
  assert.deepEqual(progressoMetas(state, 'ANA COSTA', nov, ['mo']), [])
})
