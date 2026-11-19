import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, normalize, reorder, validateGeo } from '../src/bi/model.js'
import { calcLiquido } from '../src/pages/dashboard/dashboard.logic.js'
test('Receita BI concilia com o cálculo clássico e desconta devoluções', () => {
  const source = [
    { responsavel: 'Ana', cat: 'VAREJO', valor: 1000 },
    { responsavel: 'Ana', cat: 'VAREJO', valor: -120, eDevolucao: true },
    { responsavel: 'Bia', cat: 'WEB', valor: 600 },
  ]
  const total = aggregate(normalize(source), {
    dimension: 'channel',
    metric: 'value',
    channel: 'VAREJO',
  })[0].value
  assert.equal(total, calcLiquido(source, 'VAREJO', 10, 20).liquido)
  assert.equal(total, 880)
})
test('Filtro cruza região e canal sem misturar vendedores', () => {
  const rows = normalize([
    { responsavel: 'Ana', cat: 'TELEVENDAS', regiao: 'Maceió', valor: 10 },
    { responsavel: 'Bia', cat: 'WEB', regiao: 'Maceió', valor: 20 },
    { responsavel: 'Ana', cat: 'TELEVENDAS', regiao: 'Centro', valor: 50 },
  ])
  assert.deepEqual(
    aggregate(
      rows,
      { dimension: 'person', metric: 'value', channel: 'TELEVENDAS' },
      'Maceio',
    ),
    [{ name: 'Ana', value: 10, records: 1 }],
  )
})
test('Quantidade ausente não vira quantidade de peças inventada', () => {
  const rows = normalize([
    { produto: 'Filtro', valor: 100 },
    { produto: 'Filtro', valor: 50, quantidade: '2' },
    { produto: 'Filtro', valor: -25, quantidade: '1', eDevolucao: true },
  ])
  assert.equal(
    aggregate(rows, { dimension: 'product', metric: 'quantity' })[0].value,
    1,
  )
  assert.equal(
    aggregate(rows, { dimension: 'product', metric: 'value' })[0].value,
    125,
  )
})
test('Ordem temporal e reordenação estável', () => {
  assert.deepEqual(
    reorder([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'a', 'c').map((x) => x.id),
    ['b', 'c', 'a'],
  )
  assert.deepEqual(reorder([{ id: 'a' }], 'missing', 'a'), [{ id: 'a' }])
  const rows = normalize([
    { dt: new Date(2026, 8, 2), valor: 1 },
    { dt: new Date(2026, 8, 1), valor: 3 },
  ])
  assert.deepEqual(
    aggregate(rows, { dimension: 'date', metric: 'value' }).map((r) => r.name),
    ['2026-09-01', '2026-09-02'],
  )
})
test('Mapa rejeita coordenadas e potencial inválidos', () => {
  const geo = {
    type: 'FeatureCollection',
    features: [
      {
        properties: { name: 'Centro', population: 100 },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
    ],
  }
  assert.equal(validateGeo(geo), geo)
  assert.throws(() =>
    validateGeo({
      ...geo,
      features: [
        {
          ...geo.features[0],
          properties: { name: 'Centro', potentialParts: -1 },
        },
      ],
    }),
  )
  assert.throws(() => validateGeo({ type: 'FeatureCollection', features: [] }))
})
