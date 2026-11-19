import test from 'node:test'
import assert from 'node:assert/strict'
import { executarGestaoEquipe } from '../functions/src/gestaoEquipe.js'

// Dados fictícios.
const mes = '11/2026'
function base() {
  const docs = {
    'config/colaboradores': { payload: JSON.stringify({ [mes]: {
      'HUGO MARTINS': { colaborador: 'HUGO MARTINS', cargo: 'SUPERVISOR', loja: 'L1' },
      'RITA SOUZA': { colaborador: 'RITA SOUZA', cargo: 'SUPERVISOR', loja: 'L1' },
      'BRUNO LIMA': { colaborador: 'BRUNO LIMA', supervisor: 'HUGO MARTINS', loja: 'L1', cargo_movimento: 'VAREJO' },
      'CARLA DIAS': { colaborador: 'CARLA DIAS', supervisor: 'RITA SOUZA', loja: 'L1', cargo_movimento: 'VAREJO' },
      'DIEGO REIS': { colaborador: 'DIEGO REIS', supervisor: '', loja: 'L1' },
      'ELLEN PE': { colaborador: 'ELLEN PE', supervisor: 'HUGO MARTINS', loja: 'L2' },
    } }), ts: 1 },
    'config/metas': { payload: JSON.stringify({ [mes]: { 'BRUNO LIMA': { colaborador: 'BRUNO LIMA', metas: { VAREJO: { mp: 1000 } }, obs: 'mantém' } } }), ts: 1 },
    'config/lojas': { payload: JSON.stringify({ L1: { uf: 'AL' }, L2: { uf: 'PE' } }) },
    'equipe/org': { payload: JSON.stringify({ coordenadores: ['LUIZA COORD'], coordenadorDe: { 'HUGO MARTINS': 'LUIZA COORD' }, lotacoes: {} }) },
  }
  return { docs, get: async p => structuredClone(docs[p]), set: async (p, v) => { docs[p] = structuredClone(v) } }
}
const json = (store, p) => JSON.parse(store.docs[p].payload)
const hugo = { role: 'supervisor', nome: 'HUGO MARTINS', estados: ['AL'] }
const rita = { role: 'supervisor', nome: 'RITA SOUZA', estados: ['AL'] }
const luiza = { role: 'coordenador', nome: 'LUIZA COORD', estados: ['AL'] }
const bruno = { role: 'operacional', nome: 'BRUNO LIMA', estados: ['AL'] }
const meta = (colaborador, mp) => ({ colaborador, metas: { VAREJO: { mp } } })
const ids = () => { let n = 0; return () => `id${++n}` }

test('supervisor grava meta da própria equipe e preserva os outros campos', async () => {
  const s = base()
  const r = await executarGestaoEquipe(hugo, { acao: 'metas', mes, lista: [meta('BRUNO LIMA', 5000)] }, s, { agora: 99 })
  assert.equal(json(s, 'config/metas')[mes]['BRUNO LIMA'].metas.VAREJO.mp, 5000)
  assert.equal(json(s, 'config/metas')[mes]['BRUNO LIMA'].obs, 'mantém')
  assert.equal(s.docs['config/metas'].ts, 99)
  assert.deepEqual(r.versoes, { metas: 99 })
  assert.equal(json(s, 'equipe/auditoria').at(-1).por, 'HUGO MARTINS')
})

test('supervisor não grava meta de outra equipe, a própria, nem fora do estado', async () => {
  for (const alvo of ['CARLA DIAS', 'HUGO MARTINS', 'ELLEN PE']) {
    const s = base()
    await assert.rejects(executarGestaoEquipe(hugo, { acao: 'metas', mes, lista: [meta(alvo, 1)] }, s), { code: 'permission-denied' })
    assert.equal(json(s, 'config/metas')[mes]['BRUNO LIMA'].metas.VAREJO.mp, 1000)
  }
})

test('colaborador não grava metas e valores inválidos são recusados', async () => {
  await assert.rejects(executarGestaoEquipe(bruno, { acao: 'metas', mes, lista: [meta('BRUNO LIMA', 1)] }, base()), { code: 'permission-denied' })
  await assert.rejects(executarGestaoEquipe(hugo, { acao: 'metas', mes, lista: [meta('BRUNO LIMA', -5)] }, base()), { code: 'invalid-argument' })
  await assert.rejects(executarGestaoEquipe(hugo, { acao: 'metas', mes, lista: [meta('BRUNO LIMA', 'x')] }, base()), { code: 'invalid-argument' })
})

test('coordenador grava meta das equipes dos seus supervisores, não das outras', async () => {
  const s = base()
  await executarGestaoEquipe(luiza, { acao: 'metas', mes, lista: [meta('BRUNO LIMA', 7), meta('HUGO MARTINS', 8)] }, s)
  assert.equal(json(s, 'config/metas')[mes]['HUGO MARTINS'].metas.VAREJO.mp, 8)
  await assert.rejects(executarGestaoEquipe(luiza, { acao: 'metas', mes, lista: [meta('CARLA DIAS', 1)] }, base()), { code: 'permission-denied' })
})

test('pedir alguém de outra equipe vira pedido; o supervisor atual aprova', async () => {
  const s = base(), novoId = ids()
  const r = await executarGestaoEquipe(hugo, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'CARLA DIAS', para: 'HUGO MARTINS', mes }, s, { novoId })
  assert.equal(r.aplicada, false)
  assert.equal(json(s, 'config/colaboradores')[mes]['CARLA DIAS'].supervisor, 'RITA SOUZA')
  const repetido = await executarGestaoEquipe(hugo, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'CARLA DIAS', para: 'HUGO MARTINS', mes }, s, { novoId })
  assert.equal(repetido.repetida, true)

  const vistoPorRita = await executarGestaoEquipe(rita, { acao: 'ler' }, s)
  assert.equal(vistoPorRita.solicitacoes[0].podeDecidir, true)
  const vistoPorBruno = await executarGestaoEquipe(bruno, { acao: 'ler' }, s)
  assert.equal(vistoPorBruno.solicitacoes.length, 0)

  await assert.rejects(executarGestaoEquipe(hugo, { acao: 'decidir', id: 'id1', status: 'aprovada' }, s), { code: 'permission-denied' })
  const d = await executarGestaoEquipe(rita, { acao: 'decidir', id: 'id1', status: 'aprovada' }, s)
  assert.equal(d.status, 'aprovada')
  assert.equal(json(s, 'config/colaboradores')[mes]['CARLA DIAS'].supervisor, 'HUGO MARTINS')
})

test('pedido fica sem efeito se a equipe mudou antes da decisão', async () => {
  const s = base(), novoId = ids()
  await executarGestaoEquipe(hugo, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'CARLA DIAS', para: 'HUGO MARTINS', mes }, s, { novoId })
  await executarGestaoEquipe(rita, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'CARLA DIAS', para: '', mes }, s, { novoId })
  const d = await executarGestaoEquipe(rita, { acao: 'decidir', id: 'id1', status: 'aprovada' }, s)
  assert.equal(d.status, 'expirada')
  assert.equal(json(s, 'config/colaboradores')[mes]['CARLA DIAS'].supervisor, '')
})

test('supervisor libera alguém da própria equipe na hora; coordenador move entre os seus direto', async () => {
  const s = base()
  const r = await executarGestaoEquipe(hugo, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'BRUNO LIMA', para: '', mes }, s, { novoId: ids() })
  assert.equal(r.aplicada, true)
  assert.equal(r.alterados[0].registro.supervisor, '')
  const c = await executarGestaoEquipe(luiza, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'DIEGO REIS', para: 'HUGO MARTINS', mes }, s, { novoId: ids() })
  assert.equal(c.aplicada, true)
})

test('pessoa sem responsável indo para supervisor sem coordenador precisa do admin', async () => {
  const s = base()
  const r = await executarGestaoEquipe(rita, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'DIEGO REIS', para: 'RITA SOUZA', mes }, s, { novoId: ids() })
  assert.equal(r.aplicada, false)
  assert.deepEqual(r.aprovadores, [])
})

test('ninguém pede mudança que não o envolve', async () => {
  await assert.rejects(executarGestaoEquipe(rita, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'BRUNO LIMA', para: '', mes }, base()), { code: 'permission-denied' })
  await assert.rejects(executarGestaoEquipe(bruno, { acao: 'solicitar', tipo: 'pessoa', pessoa: 'BRUNO LIMA', para: 'RITA SOUZA', mes }, base()), { code: 'permission-denied' })
})

test('períodos: coordenador sim (só com supervisores dele), supervisor não', async () => {
  const periodos = [{ supervisor: 'HUGO MARTINS', de: '2026-11-01', ate: '2026-11-15' }]
  await assert.rejects(executarGestaoEquipe(hugo, { acao: 'periodos', mes, pessoa: 'BRUNO LIMA', periodos }, base()), { code: 'permission-denied' })
  const s = base()
  await executarGestaoEquipe(luiza, { acao: 'periodos', mes, pessoa: 'BRUNO LIMA', periodos }, s)
  assert.deepEqual(json(s, 'equipe/org').lotacoes['BRUNO LIMA'], periodos)
  await assert.rejects(executarGestaoEquipe(luiza, { acao: 'periodos', mes, pessoa: 'BRUNO LIMA', periodos: [{ supervisor: 'RITA SOUZA', de: '2026-11-01', ate: '2026-11-02' }] }, base()), { code: 'permission-denied' })
})

test('estrutura de coordenadores só o admin; supervisor vê só o próprio vínculo', async () => {
  await assert.rejects(executarGestaoEquipe(luiza, { acao: 'estrutura', coordenadores: [] }, base()), { code: 'permission-denied' })
  const visto = await executarGestaoEquipe(rita, { acao: 'ler' }, base())
  assert.deepEqual(visto.org.coordenadorDe, {})
})

test('foto: a própria ou da equipe, só imagem pequena', async () => {
  const foto = 'data:image/jpeg;base64,AAAA'
  const s = base()
  await executarGestaoEquipe(bruno, { acao: 'foto', nome: 'BRUNO LIMA', foto }, s)
  assert.equal(s.docs['equipeFotos/BRUNO_LIMA'].foto, foto)
  await executarGestaoEquipe(hugo, { acao: 'foto', nome: 'BRUNO LIMA', foto: null }, s)
  await assert.rejects(executarGestaoEquipe(bruno, { acao: 'foto', nome: 'CARLA DIAS', foto }, base()), { code: 'permission-denied' })
  await assert.rejects(executarGestaoEquipe(bruno, { acao: 'foto', nome: 'BRUNO LIMA', foto: 'javascript:alert(1)' }, base()), { code: 'invalid-argument' })
})
