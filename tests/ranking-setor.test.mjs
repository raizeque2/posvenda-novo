import test from 'node:test'
import assert from 'node:assert/strict'
import { rankingDoSetor, rankingPublico } from '../functions/src/rankingSetor.js'
import { buildRanking } from '../src/services/ranking/buildRanking.js'
import { buildApelidoMap } from '../src/utils/normalizacao.js'

const mes = '11/2026'
const colaboradores = { [mes]: {
  'ANA COSTA': { colaborador: 'ANA COSTA', apelido: 'ANINHA', loja: 'PEI', cargo: 'VENDEDOR', cargo_movimento: 'VAREJO', mp: 20000 },
  'BRUNO LIMA': { colaborador: 'BRUNO LIMA', loja: 'PEI', cargo: 'VENDEDOR', cargo_movimento: 'VAREJO;WEB', metas: { VAREJO: { mp: 10000 }, WEB: { mp: 5000 } } },
  'CARLA SANTOS': { colaborador: 'CARLA SANTOS', loja: 'ARA', cargo: 'VENDEDOR', cargo_movimento: 'ATACADO', mp: 30000 },
  'DIEGO ALVES': { colaborador: 'DIEGO ALVES', loja: 'PEI', cargo: 'CONSULTOR', cargo_movimento: 'OS', mo: 8000, mpo: 4000 },
  'ELISA MELO': { colaborador: 'ELISA MELO', loja: 'PEI', cargo: 'VENDEDOR', cargo_movimento: 'VAREJO', mp: 9000, ativo: false },
} }
const pecas = [
  { responsavel: 'ANINHA', cat: 'VAREJO', valor: 5000, empresa: 'PEI' },
  { responsavel: 'ANA COSTA', cat: 'VAREJO', valor: 800, eDevolucao: true, empresa: 'PEI' },
  { responsavel: 'BRUNO LIMA', cat: 'WEB', valor: 6000, empresa: 'PEI' },
  { responsavel: 'BRUNO LIMA', cat: 'COMPRA', valor: 999, eDevolucao: true, empresa: 'PEI' },
  { responsavel: 'CARLA SANTOS', cat: 'ATACADO', valor: 9000, empresa: 'ARA' },
  { responsavel: 'DIEGO ALVES', cat: 'OFICINA', valor: 700, empresa: 'PEI' },
  { responsavel: 'ELISA MELO', cat: 'VAREJO', valor: 9000, empresa: 'PEI' },
]
const oficina = [{ consultor: 'DIEGO ALVES', mo: 3000, pocoficina: 300, empresa: 'PEI' }]

test('ranking do setor calcula realizado e meta como buildRanking', () => {
  const ranking = buildRanking(pecas, oficina, mes, colaboradores, {}, {}, 0, 0, buildApelidoMap(colaboradores))
  for (const [nome, metrica] of [['ANA COSTA', 'mp'], ['DIEGO ALVES', 'mo'], ['DIEGO ALVES', 'mpo']]) {
    const r = rankingDoSetor({ pecas, oficina, colaboradores, metas: {}, mes, meuNome: nome, metrica })
    for (const linha of r.lista) {
      const c = ranking.find(x => x.nome === linha.nome)
      const real = metrica === 'mp' ? c.tp : metrica === 'mo' ? (c.ehConsultor ? c.morealCons : c.morealTec) : c.pocoficina - c.devPocoficina
      assert.equal(linha.real, real, `${linha.nome} ${metrica}`)
      assert.equal(linha.meta, c[metrica], `${linha.nome} meta ${metrica}`)
    }
  }
})

test('ranking do setor: mesmo canal, sem inativos, e o servidor esconde R$ dos colegas', () => {
  const r = rankingDoSetor({ pecas, oficina, colaboradores, metas: {}, mes, meuNome: 'ana costa', metrica: 'mp' })
  assert.deepEqual(r.lista.map(l => l.nome), ['BRUNO LIMA', 'ANA COSTA'])
  assert.equal(r.minhaPosicao, 2)
  const publico = rankingPublico(r)
  assert.deepEqual(Object.keys(publico.lista[0]).sort(), ['eu', 'nome', 'pct', 'posicao'])
  assert.equal(publico.lista[1].real, 4200)
  assert.deepEqual(rankingDoSetor({ pecas, oficina, colaboradores, metas: {}, mes, meuNome: '', metrica: 'mp' }).lista, [])
  assert.deepEqual(rankingDoSetor({ pecas, oficina, colaboradores, metas: {}, mes, meuNome: 'ANA COSTA', metrica: 'x' }).lista, [])
})
