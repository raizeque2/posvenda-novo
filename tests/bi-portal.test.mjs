import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { randomBytes, createHash } from 'node:crypto'
function harness() {
  const docs = new Map([
    ['usuarios/admin', { role: 'admin' }],
    ['usuarios/op', { role: 'operacional' }],
    [
      'config/colaboradores',
      {
        payload: JSON.stringify({
          '09/2026': {
            Ana: { colaborador: 'Ana', apelido: 'ANINHA' },
            Bia: { colaborador: 'Bia' },
          },
        }),
      },
    ],
    ['config/mesesDisponiveis', { pecas: ['09/2026'], oficina: [] }],
    [
      'config/metas',
      {
        payload: JSON.stringify({
          '09/2026': { Ana: { metas: { VAREJO: { mp: 1000 } } } },
        }),
      },
    ],
  ])
  const db = {
    doc: (path) => ({
      path,
      get: async () => ({ data: () => docs.get(path) }),
      create: async (d) => {
        if (docs.has(path)) throw Error('duplicate')
        docs.set(path, d)
      },
      update: async (d) => docs.set(path, { ...docs.get(path), ...d }),
    }),
    collection: () => ({
      get: async () => ({
        docs: [...docs]
          .filter(([p]) => p.startsWith('biLinks/'))
          .map(([p, d]) => ({ id: p.split('/')[1], data: () => d })),
      }),
    }),
    runTransaction: async (fn) =>
      fn({ get: (ref) => ref.get(), update: (ref, d) => ref.update(d) }),
  }
  const all = [
    {
      responsavel: 'ANINHA',
      valor: 100,
      cat: 'VAREJO',
      dt: '2026-09-01',
      cliente: 'SEGREDO',
      empresa: 'Loja 1',
    },
    { responsavel: 'Bia', valor: 9000, cliente: 'OUTRO' },
  ]
  class HttpsError extends Error {
    constructor(code, message) {
      super(message)
      this.code = code
    }
  }
  const context = {
    publicRateLimit: async () => {},
    getFirestore: () => db,
    getStorage: () => ({
      bucket: () => ({
        file: (path) => ({
          getMetadata: async () => [{ size: 300 }],
          download: async () => [
            Buffer.from(JSON.stringify(path.includes('Pecas') ? all : [])),
          ],
        }),
      }),
    }),
    onCall: (_, fn) => fn,
    HttpsError,
    randomBytes,
    createHash,
    Buffer,
    console,
  }
  const source = readFileSync(
    new URL('../functions/src/biPortal.js', import.meta.url),
    'utf8',
  )
    .replace(/^import .*\n/gm, '')
    .replace(/export const /g, 'const ')
  vm.runInNewContext(
    source + '\nglobalThis.api={criarLinkBI,portalBI,gerenciarLinkBI}',
    context,
  )
  return { ...context.api, docs }
}
test('Apenas admin cria links; novos links não sobrescrevem os anteriores', async () => {
  const h = harness()
  await assert.rejects(
    h.criarLinkBI({ auth: { uid: 'op' }, data: { name: 'Ana' } }),
    (e) => e.code === 'permission-denied',
  )
  const a = await h.criarLinkBI({
      auth: { uid: 'admin' },
      data: { name: 'Ana' },
    }),
    b = await h.criarLinkBI({ auth: { uid: 'admin' }, data: { name: 'Ana' } })
  assert.notEqual(a.token, b.token)
  assert.equal(a.token.length, 64)
  assert(h.docs.has(`biLinks/${a.id}`))
  assert(h.docs.has(`biLinks/${b.id}`))
  assert.equal(h.docs.get(`biLinks/${a.id}`).token, undefined)
})
test('Portal resolve apelido e só retorna os dados e as metas do titular', async () => {
  const h = harness(),
    a = await h.criarLinkBI({ auth: { uid: 'admin' }, data: { name: 'Ana' } }),
    r = await h.portalBI({ data: { token: a.token } })
  assert.equal(r.pieces.length, 1)
  assert.equal(r.pieces[0].valor, 100)
  assert.equal(r.pieces[0].cliente, undefined)
  assert.equal(r.targets[0].meta, 1000)
})
test('Concorrência de perfis protege alterações e revogação bloqueia acesso', async () => {
  const h = harness(),
    a = await h.criarLinkBI({ auth: { uid: 'admin' }, data: { name: 'Ana' } })
  const save = {
    token: a.token,
    action: 'save',
    revision: 0,
    state: { profiles: [{ id: 'p' }] },
  }
  await h.portalBI({ data: save })
  await assert.rejects(h.portalBI({ data: save }), (e) => e.code === 'aborted')
  await h.gerenciarLinkBI({
    auth: { uid: 'admin' },
    data: { action: 'revoke', id: a.id },
  })
  await assert.rejects(
    h.portalBI({ data: { token: a.token } }),
    (e) => e.code === 'permission-denied',
  )
})
test('Nome e foto de exibição não alteram o vínculo e não aceitam URL arbitrária', async () => {
  const h = harness(),
    a = await h.criarLinkBI({ auth: { uid: 'admin' }, data: { name: 'Ana' } })
  await h.portalBI({
    data: {
      token: a.token,
      action: 'save',
      revision: 0,
      state: { profiles: [{ id: 'p' }] },
      profile: { name: 'Meu nome', photo: '' },
    },
  })
  const r = await h.portalBI({ data: { token: a.token } })
  assert.equal(r.name, 'Ana')
  assert.equal(r.profile.name, 'Meu nome')
  await assert.rejects(
    h.portalBI({
      data: {
        token: a.token,
        action: 'save',
        revision: 1,
        state: { profiles: [{ id: 'p' }] },
        profile: { name: 'A', photo: 'javascript:alert(1)' },
      },
    }),
    (e) => e.code === 'invalid-argument',
  )
})
