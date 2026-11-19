import test from 'node:test'
import assert from 'node:assert/strict'
import { csvCell } from '../src/utils/csv.js'
import { exportarEstoqueCSV } from '../src/services/processamento/processarObsoleto.js'
test('CSV neutraliza fórmulas, espaços de bypass e quebra de coluna sem alterar números negativos', () => {
  for (const value of ['=HYPERLINK("https://example.test")', '+CMD()', '-1+2', '@SUM(A1:A2)', ' \t=1+1', '\r=1+1']) assert.ok(csvCell(value).startsWith('"\''))
  assert.equal(csvCell(-12.5), '"-12.5"')
  assert.equal(csvCell('-12,50'), '"-12,50"')
  assert.equal(csvCell('a";b'), '"a"";b"')
})
test('exportação real de estoque protege descrições e códigos vindos do arquivo importado', () => {
  const csv = exportarEstoqueCSV([{ loja: 'ARA', codigo: '=1+1', descricao: '@SUM(A1:A2)', tipo: 'Peça', saldo: 1, custoTotal: 10, custoUnitario: 10, pvTotal: 20, status: 'normal' }])
  assert.ok(csv.includes('"\'=1+1"'))
  assert.ok(csv.includes('"\'@SUM(A1:A2)"'))
})
