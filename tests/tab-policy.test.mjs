import test from 'node:test'
import assert from 'node:assert/strict'
import { abasPermitidas, podeAcessar, normalizePermissions, rotaInicial, PERMISSOES_PADRAO } from '../functions/src/tabPolicy.js'

test('Acessos é exclusivo do admin; Início é de admin, coordenador e supervisor, nunca de colaborador', () => {
  for (const role of ['coordenador', 'supervisor', 'operacional']) {
    assert.equal(podeAcessar(role, '/acesso'), false)
    assert.ok(!abasPermitidas(role).includes('/'))
  }
  for (const role of ['coordenador', 'supervisor']) assert.equal(podeAcessar(role, '/'), true)
  assert.equal(podeAcessar('operacional', '/'), false)
  assert.equal(podeAcessar('operacional', '/', { operacional: ['/'] }), false)
  assert.equal(podeAcessar('admin', '/'), true)
  assert.equal(rotaInicial('admin'), '/')
  assert.equal(rotaInicial('operacional'), '/desempenho')
})

test('Sem config, cada cargo vê exatamente o padrão anterior; papel desconhecido não vê nada', () => {
  assert.deepEqual(abasPermitidas('supervisor'), PERMISSOES_PADRAO.supervisor)
  assert.deepEqual(abasPermitidas('operacional'), ['/desempenho', '/painel'])
  assert.deepEqual(abasPermitidas('varejo'), [])
  assert.equal(podeAcessar(null, '/desempenho'), false)
  assert.equal(podeAcessar('operacional', '/upload'), false)
})

test('Teto do cargo ignora config salva mais ampla', () => {
  const cfg = { operacional: ['/desempenho', '/upload', '/regras', '/estoque'], supervisor: ['/resumo-mensal', '/metas'] }
  assert.deepEqual(abasPermitidas('operacional', cfg), ['/desempenho'])
  assert.deepEqual(abasPermitidas('supervisor', cfg), ['/metas'])
})

test('Setor restringe (interseção) e nunca concede; ordem configurada é preservada', () => {
  const cfg = { supervisor: ['/comissoes', '/dashboard', '/estoque'], setores: { 'Oficina': ['/dashboard', '/monitor-os', '/comissoes'] } }
  assert.deepEqual(abasPermitidas('supervisor', cfg), ['/comissoes', '/dashboard', '/estoque'])
  assert.deepEqual(abasPermitidas('supervisor', cfg, 'Oficina'), ['/comissoes', '/dashboard'])
  assert.equal(podeAcessar('supervisor', '/estoque', cfg, 'Oficina'), false)
  assert.equal(podeAcessar('supervisor', '/monitor-os', cfg, 'Oficina'), false)
  assert.deepEqual(abasPermitidas('supervisor', cfg, 'Setor inexistente'), ['/comissoes', '/dashboard', '/estoque'])
})

test('Normalização migra aliases e descarta chaves e rotas desconhecidas', () => {
  const n = normalizePermissions({ coordenador: ['/obsoleto', '/', '/xyz', '/acesso'], setores: { 'Peças': ['/estoque'], Hacker: ['/upload'] }, admin: ['/'] })
  assert.deepEqual(n.coordenador, ['/estoque', '/dashboard'])
  assert.deepEqual(Object.keys(n.setores), ['Peças'])
  assert.equal(n.admin, undefined)
})
