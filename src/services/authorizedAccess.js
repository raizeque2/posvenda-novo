import { getDoc, doc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '../firebase.js'
let cached
export async function hasAdminDataAccess() {
  if (import.meta.env?.MODE === 'preview') return true
  const uid = auth.currentUser?.uid
  if (!uid) return false
  if (cached?.uid === uid && Date.now() - cached.at < 10000) return cached.promise
  const promise = getDoc(doc(db, 'usuarios', uid)).then(snap => snap.data()?.role === 'admin' && snap.data()?.ativo !== false)
  cached = { uid, at: Date.now(), promise }
  return promise
}
export async function authorizedData(data) {
  return (await httpsCallable(functions, 'lerDadosAutorizados', { timeout: 90000 })(data)).data
}

// Uma chave por chamada custava 11 invocações (e 33 leituras) no boot de cada
// conta não-admin — inclusive no portal. Esta versão pede todas de uma vez.
export async function authorizedConfigs(keys) {
  return (await httpsCallable(functions, 'lerDadosAutorizados', { timeout: 90000 })({ kind: 'configs', keys })).data
}
