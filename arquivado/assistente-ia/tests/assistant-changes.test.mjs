import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareChange, applyChange, isChangeQuestion, decodeChangeReply } from '../functions/src/assistantChangesPolicy.js'
const month = '10/2026'
const state = { people: { 'ANA COSTA': { colaborador: 'ANA COSTA', loja: 'ARA', cargo: 'VENDEDOR', cargo_movimento: 'VAREJO', ativo: true }, 'ELISA MELO': { colaborador: 'ELISA MELO', loja: 'ARA', cargo: 'CONSULTOR', cargo_movimento: 'OS' } }, metas: { 'ANA COSTA': { metas: { VAREJO: { mp: 1000 }, WEB: { mp: 300 } } } }, rules: { lojas: { ARA: { uf: 'AL' } }, comissao: [{ uf: 'AL', cargo: 'VENDEDOR', cp: .01 }] }, bonuses: {}, manual: {} }
test('pedido natural prepara bônus, meta e comissão sem gravar ou mudar regras de colegas', () => {
  const before = structuredClone(state)
  const bonus = prepareChange('Ponha uma bonificação de R$ 150,00 para Ana Costa', state, month)
  assert.equal(bonus.kind, 'bonus'); assert.equal(bonus.old, 0); assert.equal(bonus.next, 150)
  assert.deepEqual(state, before)
  const target = prepareChange('Aumente a meta de Ana Costa em 10%', state, month)
  assert.equal(target.next, 1100)
  const rate = prepareChange('Altere a comissão da Ana Costa para 2%', state, month)
  assert.equal(rate.old, .01); assert.equal(rate.next, .02)
  const changed = applyChange(state, rate)
  assert.equal(changed.metas['ANA COSTA'].comissaoOverrides.cp, .02)
  assert.equal(changed.rules.comissao[0].cp, .01)
  assert.equal(changed.metas['ANA COSTA'].metas.WEB.mp, 300)
})
test('revisão distingue definir e acrescentar; valida ambiguidade, período e alteração concorrente', () => {
  const current = { ...state, bonuses: { 'ANA COSTA': { valor: 100 } } }
  assert.equal(prepareChange('Adicione R$ 50 de bonificação para Ana Costa', current, month).next, 150)
  assert.equal(prepareChange('Defina a bonificação de Ana Costa para R$ 50', current, month).next, 50)
  const proposal = prepareChange('Zere a bonificação da Ana Costa', current, month)
  assert.equal(proposal.next, 0)
  assert.throws(() => applyChange({ ...current, bonuses: { 'ANA COSTA': { valor: 120 } } }, proposal), /mudou/)
  assert.throws(() => prepareChange('Ponha R$ 50 de bonificação para Ana Costa em 09/2026', current, month), /mês atual/)
  assert.throws(() => prepareChange('Mude a meta da Elisa para R$ 300', current, month), /métrica|obra|O.S/)
  assert.throws(() => prepareChange('Altere a comissão da Ana para 101%', current, month), /100%|válid/)
  assert.throws(() => prepareChange('Coloque R$ 50 de bônus para Maria', current, month), /colaborador|pessoa/)
  assert.equal(isChangeQuestion('Qual é a bonificação da Ana?'), false)
  assert.equal(isChangeQuestion('Explique como alterar uma meta'), false)
  assert.throws(() => prepareChange('Defina bônus de R$ -10 para Ana Costa', current, month), /positivo/)
  assert.throws(() => prepareChange('Defina bônus de R$ 50 para Ana Costa em setembro', current, month), /mês atual/)
})
test('modelo só pode propor dados, nunca confirmar ou indicar código executável', () => {
  const parsed = decodeChangeReply('Revise abaixo.\n```posvenda-action\n{"kind":"bonus","person":"Ana Costa","operation":"set","value":200,"unit":"money"}\n```')
  assert.equal(parsed.change.value, 200); assert.equal(parsed.text, 'Revise abaixo.')
  assert.throws(() => prepareChange('Dê bônus à Ana', state, month, { ...parsed.change, confirmed: true }), /campo|inválid/)
  assert.throws(() => prepareChange('Dê bônus à Ana', state, month, { ...parsed.change, value: Infinity }), /válid/)
  assert.equal(decodeChangeReply('```posvenda-action\ninvalid\n```').change, undefined)
})
