import test from 'node:test'
import assert from 'node:assert/strict'
import { cpfValido, paraCsv, paraPainel, prepararAvaliacao, prepararComentario, situacaoComentario, NADA_A_MELHORAR } from '../functions/src/nps.js'
import { podeAcessar, abasPermitidas } from '../functions/src/tabPolicy.js'
import { analisar, filtrar } from '../src/nps/analytics.js'

const ID = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'
const base = { id: ID, nota: 9, notaSetor: 5, setorId: 1, motivos: ['Mais agilidade'], notaCaixa: 2, motivosCaixa: ['Demora no caixa'], cpf: '' }
const recusa = v => assert.throws(() => prepararAvaliacao({ ...base, ...v }), /inválid|fora/i)

test('Avaliação válida vira documento com setor e sem comentário', () => {
  const d = prepararAvaliacao(base, '2026-11-12T10:00:00.000Z')
  assert.equal(d.setor, 'Balcão de peças')
  assert.equal(d.comentario, '')
  assert.equal(d.criadoEm, '2026-11-12T10:00:00.000Z')
})

test('Validação recusa o que o totem não permitiria', () => {
  recusa({ id: 'abc' })
  recusa({ setorId: 99 })
  recusa({ nota: 11 })
  recusa({ motivos: ['Inventado'] })
  recusa({ motivos: [NADA_A_MELHORAR, 'Mais agilidade'] })
  recusa({ notaSetor: 9 }) // nota alta não tem motivos
  recusa({ motivosCaixa: [] }) // caixa ruim exige motivo
  recusa({ notaCaixa: 5 }) // caixa boa não tem motivo
  recusa({ cpf: '11111111111' })
  assert.ok(cpfValido('52998224725'))
})

test('Comentário: uma vez só e no máximo 24 h depois', () => {
  const d = prepararAvaliacao(base, '2026-11-12T10:00:00.000Z')
  const agora = new Date('2026-11-12T12:00:00.000Z')
  const c = prepararComentario(d, '  Muito bom  ', agora)
  assert.equal(c.comentario, 'Muito bom')
  assert.equal(situacaoComentario(c, agora.getTime()), 'comentado')
  assert.throws(() => prepararComentario(c, 'de novo', agora), /já recebeu/)
  assert.throws(() => prepararComentario(d, 'tarde', new Date('2026-11-13T10:00:01.000Z')), /prazo/)
  assert.throws(() => prepararComentario(d, 'x'.repeat(1201), agora), /1200/)
})

test('Painel nunca recebe CPF; planilha só traz o número para o administrador', () => {
  const d = prepararAvaliacao({ ...base, cpf: '52998224725' })
  const p = paraPainel(d)
  assert.equal(p.cpf, undefined)
  assert.equal(p.cpfInformado, true)
  assert.match(paraCsv([d], { comCpf: true }), /52998224725/)
  assert.doesNotMatch(paraCsv([d]), /52998224725/)
  assert.match(paraCsv([{ ...d, comentario: '=HYPERLINK("x")' }]), /"'=HYPERLINK/)
})

test('Aba NPS: só admin por padrão; coordenador e supervisor só se liberados; colaborador nunca', () => {
  assert.equal(podeAcessar('admin', '/nps'), true)
  for (const role of ['coordenador', 'supervisor', 'operacional']) assert.equal(podeAcessar(role, '/nps'), false)
  assert.ok(abasPermitidas('coordenador', { coordenador: ['/nps'] }).includes('/nps'))
  assert.ok(abasPermitidas('supervisor', { supervisor: ['/nps'] }).includes('/nps'))
  assert.ok(!abasPermitidas('operacional', { operacional: ['/nps'] }).includes('/nps'))
})

test('NPS = % promotores − % detratores, com filtros', () => {
  const agora = new Date('2026-11-12T15:00:00Z')
  const itens = [9, 10, 7, 3].map((nota, i) => ({ ...paraPainel(prepararAvaliacao({ ...base, id: ID.slice(0, -1) + i, nota }, '2026-11-12T12:00:00.000Z')) }))
  const st = analisar(filtrar(itens, {}, agora))
  assert.equal(st.nps, 25)
  assert.equal(st.total, 4)
  assert.equal(analisar(filtrar(itens, { perfil: 'low' }, agora)).total, 1)
  assert.deepEqual(st.motivosCaixa[0], { nome: 'Demora no caixa', n: 4 })
})
