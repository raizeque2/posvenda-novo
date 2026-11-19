import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, getBytes, uploadBytes } from 'firebase/storage'

test('Firestore e Storage: anônimo, inativo, operacional, coordenador e administrador', async () => {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-posvenda-security', 'Execute apenas pelo comando de emuladores com projeto demo.')
  const env = await initializeTestEnvironment({ projectId: 'demo-posvenda-security', firestore: { rules: readFileSync('firestore.rules', 'utf8') }, storage: { rules: readFileSync('storage.rules', 'utf8') } })
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore()
      for (const [uid, profile] of Object.entries({ admin: { role: 'admin' }, coord: { role: 'coordenador' }, op: { role: 'operacional' }, inactive: { role: 'admin', ativo: false } })) await setDoc(doc(db, 'usuarios', uid), profile)
      for (const name of ['colaboradores', 'metas', 'snapshotConfig', 'mesesDisponiveis', 'appVersion', 'estoqueControle']) await setDoc(doc(db, 'config', name), { payload: '{}' })
      await setDoc(doc(db, 'bonificacoes', 'private'), { nome: 'Ana', valor: 20 })
      await uploadBytes(ref(context.storage(), 'Dados/Pecas/10-2026.json'), new TextEncoder().encode('[]'), { contentType: 'application/json' })
    })
    for (const uid of [null, 'inactive', 'op', 'coord']) {
      const context = uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()
      const db = context.firestore()
      for (const name of ['colaboradores', 'metas', 'snapshotConfig', 'estoqueControle']) await assertFails(getDoc(doc(db, 'config', name)))
      await assertFails(getDoc(doc(db, 'bonificacoes', 'private')))
      await assertFails(setDoc(doc(db, 'usuarios', 'op'), { role: 'admin' }))
      await assertFails(setDoc(doc(db, 'solicitacoes', 'direct'), { nome: 'Ana', senha: 'never-save-passwords' }))
      // Contas do portal: hash de senha e bloqueio vivem só no servidor.
      await assertFails(getDoc(doc(db, 'portalContas', 'abc')))
      await assertFails(setDoc(doc(db, 'portalContas', 'abc'), { nome: 'Ana', senha: 'plain' }))
      await assertFails(getBytes(ref(context.storage(), 'Dados/Pecas/10-2026.json')))
      await assertFails(uploadBytes(ref(context.storage(), 'Dados/Pecas/10-2026.json'), new TextEncoder().encode('[]'), { contentType: 'application/json' }))
      if (uid === 'op' || uid === 'coord') {
        await assertSucceeds(getDoc(doc(db, 'config', 'mesesDisponiveis')))
        await assertSucceeds(getDoc(doc(db, 'usuarios', uid)))
        await assertSucceeds(setDoc(doc(db, 'usuarios', uid, 'bi', 'mine'), { payload: '{}' }))
        await assertFails(getDoc(doc(db, 'usuarios', 'admin', 'bi', 'mine')))
      } else await assertFails(getDoc(doc(db, 'config', 'mesesDisponiveis')))
    }
    const admin = env.authenticatedContext('admin')
    await assertSucceeds(getDoc(doc(admin.firestore(), 'config', 'colaboradores')))
    await assertSucceeds(getBytes(ref(admin.storage(), 'Dados/Pecas/10-2026.json')))
    await assertSucceeds(uploadBytes(ref(admin.storage(), 'Dados/Pecas/new.json'), new TextEncoder().encode('[]'), { contentType: 'application/json' }))
    await assertFails(uploadBytes(ref(admin.storage(), 'Dados/Pecas/new.html'), new TextEncoder().encode('<script></script>'), { contentType: 'text/html' }))
    for (const collection of ['assistantConnections', 'assistantLimits', 'publicRequestLimits', 'biLinks', 'portalContas']) await assertFails(getDoc(doc(admin.firestore(), collection, 'secret')))
  } finally { await env.cleanup() }
})
