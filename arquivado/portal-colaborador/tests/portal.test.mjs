import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_TENTATIVAS,
  attemptState,
  buildRoster,
  hashPassword,
  nextAttempt,
  personId,
  syntheticEmail,
  validatePassword,
  validateProfileChange,
  verifyPassword,
} from '../functions/src/portalPolicy.js'

test('senha do portal: mínimo de 8 com letra e número, hash nunca em texto puro', async () => {
  assert.throws(() => validatePassword('curta1'), /pelo menos 8/)
  assert.throws(() => validatePassword('somenteletras'), /letra e um número/)
  assert.throws(() => validatePassword('12345678'), /letra e um número/)
  assert.throws(() => validatePassword('aaaa1111'), /3 caracteres diferentes/)
  assert.equal(validatePassword('senha12345'), 'senha12345')

  const guardado = await hashPassword('senha12345')
  assert.equal(guardado.algo, 'scrypt')
  assert.equal(typeof guardado.salt, 'string')
  assert.notEqual(guardado.hash, 'senha12345')
  assert.equal(JSON.stringify(guardado).includes('senha12345'), false)
  assert.equal(await verifyPassword('senha12345', guardado), true)
  assert.equal(await verifyPassword('senha12346', guardado), false)
  assert.equal(await verifyPassword('senha12345', { algo: 'plain', hash: 'x' }), false)
  assert.equal(await verifyPassword('senha12345', null), false)

  // Sal diferente gera hash diferente para a mesma senha.
  const outro = await hashPassword('senha12345')
  assert.notEqual(outro.hash, guardado.hash)
})

test('cinco erros bloqueiam e só a redefinição do administrador reabre', () => {
  let conta = { tentativas: 0 }
  for (let erro = 1; erro <= MAX_TENTATIVAS; erro++) {
    conta = { ...conta, ...nextAttempt(conta) }
    assert.equal(attemptState(conta).bloqueado, erro >= MAX_TENTATIVAS)
    assert.equal(attemptState(conta).restantes, MAX_TENTATIVAS - erro)
  }
  assert.equal(attemptState(conta).tentativas, MAX_TENTATIVAS)
  // Reabrir é o mesmo que o servidor faz em portalRedefinir.
  const reaberta = { tentativas: 0, bloqueado: false }
  assert.equal(attemptState(reaberta).bloqueado, false)
  assert.equal(attemptState({ bloqueado: true }).bloqueado, true)
  assert.equal(attemptState(undefined).tentativas, 0)
})

test('lista do portal mostra só nome e loja e separa colaborador de supervisor', () => {
  const colaboradores = {
    '09/2026': { VELHO: { colaborador: 'Velho', loja: 'ANTIGA', ativo: false } },
    '10/2026': {
      'Ana Souza': { colaborador: 'Ana Souza', loja: 'ARA', supervisor: 'Carlos Lima' },
      'Bia Nunes': { colaborador: 'Bia Nunes', loja: 'PEI' },
      'Outra Loja': { colaborador: 'Outra Loja', loja: 'PEI', supervisor: 'Bia Nunes;Carlos Lima' },
      'Carlos Lima': { colaborador: 'Carlos Lima', loja: 'ARA', cargo: 'Supervisor de Vendas' },
      'Inativa': { colaborador: 'Inativa', loja: 'ARA', ativo: false },
    },
  }
  const lojas = { ARA: { uf: 'AL', un: 'Arapiraca' }, PEI: { uf: 'PE', un: 'Petrolina' } }

  const todos = buildRoster(colaboradores, lojas, 'colaborador')
  assert.deepEqual(todos.map(pessoa => pessoa.nome), ['Ana Souza', 'Bia Nunes', 'Carlos Lima', 'Outra Loja'])
  assert.deepEqual(Object.keys(todos[0]).sort(), ['codigo', 'id', 'loja', 'nome', 'tipo', 'uf'])
  assert.equal(todos[0].loja, 'Arapiraca')
  assert.equal(todos[0].uf, 'AL')
  assert.ok(!JSON.stringify(todos).includes('meta'))
  assert.ok(!JSON.stringify(todos).includes('Velho'))

  const supervisores = buildRoster(colaboradores, lojas, 'supervisor')
  assert.deepEqual(supervisores.map(pessoa => pessoa.nome), ['Bia Nunes', 'Carlos Lima'])
  assert.ok(supervisores.every(pessoa => pessoa.tipo === 'supervisor'))

  // Identificador estável e diferente por tipo, sem expor o nome.
  assert.equal(personId('colaborador', 'Ana Souza', 'ARA'), personId('colaborador', 'ana  souza ', 'ara'))
  assert.notEqual(personId('colaborador', 'Ana Souza', 'ARA'), personId('supervisor', 'Ana Souza', 'ARA'))
  assert.match(personId('colaborador', 'Ana Souza', 'ARA'), /^[0-9a-f]{32}$/)
  assert.equal(syntheticEmail('abc').includes('@portal.posvenda.app'), true)
})

test('perfil do portal aceita apenas foto e nome de exibição', () => {
  assert.deepEqual(validateProfileChange({ nomeExibicao: '  Ana S.  ' }), { nomeExibicao: 'Ana S.' })
  assert.deepEqual(validateProfileChange({ foto: null }), { foto: null })
  const foto = `data:image/jpeg;base64,${Buffer.from('x'.repeat(40)).toString('base64')}`
  assert.deepEqual(validateProfileChange({ foto }), { foto })
  assert.throws(() => validateProfileChange({ nome: 'Outro' }), /foto e o nome/)
  assert.throws(() => validateProfileChange({ role: 'admin' }), /foto e o nome/)
  assert.throws(() => validateProfileChange({}), /Pedido inválido|Só a foto/)
  assert.throws(() => validateProfileChange({ nomeExibicao: 'A' }), /entre 2 e 60/)
  assert.throws(() => validateProfileChange({ foto: 'http://exemplo/foto.png' }), /JPEG/)
  assert.throws(() => validateProfileChange({ foto: `data:text/html;base64,${'A'.repeat(20)}` }), /JPEG/)
  assert.throws(() => validateProfileChange({ foto: `data:image/png;base64,${'A'.repeat(130000)}` }), /90 KB/)
})
