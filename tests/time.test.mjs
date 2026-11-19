import test from 'node:test'
import assert from 'node:assert/strict'
import { saudacaoBrasil } from '../src/utils/time.js'

test('Saudação usa o horário de São Paulo',()=>{
  assert.equal(saudacaoBrasil(new Date('2026-10-14T06:30:00Z')),'Boa madrugada')
  assert.equal(saudacaoBrasil(new Date('2026-10-14T12:30:00Z')),'Bom dia')
  assert.equal(saudacaoBrasil(new Date('2026-10-14T20:30:00Z')),'Boa tarde')
  assert.equal(saudacaoBrasil(new Date('2026-10-14T23:30:00Z')),'Boa noite')
})
