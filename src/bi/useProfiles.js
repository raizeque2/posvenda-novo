import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'
import { useEffect, useRef, useState } from 'react'
import { doc, getDoc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase.js'
import { initial,upgradeBiProfiles } from './model.js'
export function useProfiles(uid, scope, token) {
  const [state, setState] = useState(initial),
    [status, setStatus] = useState('Carregando perfis…'),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false)
  const revision = useRef(0)
  const editVersion = useRef(0)
  const [dirty, setDirty] = useState(false)
  const preview = import.meta.env.MODE === 'preview'
  const path = `${preview ? 'bi-preview' : 'bi'}:${token || uid}:${scope}`
  useEffect(() => {
    let active = true
    setReady(false)
    revision.current = 0
    if (preview) {
      try {
        const cache = JSON.parse(localStorage.getItem(path))
        revision.current = cache?.revision || 0
        setState(cache?.state ? { ...upgradeBiProfiles(cache.state), activeId: cache.state.defaultId || cache.state.activeId } : initial())
        setStatus('Prévia • salvo somente neste navegador')
      } catch { setState(initial()); setStatus('Armazenamento local indisponível') }
      setReady(true)
      return () => { active = false }
    }
    const fetchProfile = token
      ? httpsCallable(
          functions,
          'portalBI',
        )({ token, action: 'profile' }).then((r) => ({ data: () => r.data }))
      : getDoc(doc(db, 'usuarios', uid, 'bi', scope))
    fetchProfile
      .then((s) => {
        if (!active) return
        const raw = s.data()
        const data = raw?.payload
          ? { ...raw, state: JSON.parse(raw.payload) }
          : raw
        revision.current = data?.revision || 0
        setState(
          data?.state
            ? {
                ...upgradeBiProfiles(data.state),
                activeId: data.state.defaultId || data.state.activeId,
              }
            : initial(),
        )
        setStatus(
          data
            ? 'Perfil sincronizado'
            : 'Personalize sua primeira visualização',
        )
        setReady(true)
      })
      .catch(() => {
        if (!active) return
        try {
          const cache = JSON.parse(localStorage.getItem(path))
          setState(
            cache?.state
              ? {
                  ...upgradeBiProfiles(cache.state),
                  activeId: cache.state.defaultId || cache.state.activeId,
                }
              : initial(),
          )
          revision.current = cache?.revision || 0
        } catch {
          setState(initial())
        }
        setStatus('Sem conexão: carregado neste computador')
        setReady(true)
      })
    return () => {
      active = false
    }
  }, [uid, scope, token])
  useEffect(() => {
    if (!dirty) return
    const guard = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  function update(fn) {
    editVersion.current++
    setDirty(true)
    setState((s) => (typeof fn === 'function' ? fn(s) : fn))
    setStatus('Alterações não salvas')
  }
  async function save() {
    if (!ready || busy) return
    setBusy(true)
    setStatus('Salvando…')
    const savedVersion = editVersion.current
    try {
      const ref = doc(db, 'usuarios', uid, 'bi', scope),
        next = revision.current + 1
      if (preview) {
        const current = JSON.parse(localStorage.getItem(path))
        if ((current?.revision || 0) !== revision.current) throw Error('Este perfil mudou em outra aba. Recarregue antes de salvar.')
        localStorage.setItem(path, JSON.stringify({ state, revision: next }))
      } else if (token) {
        await httpsCallable(
          functions,
          'portalBI',
        )({ token, action: 'save', state, revision: revision.current })
      } else
        await runTransaction(db, async (tx) => {
          const s = await tx.get(ref)
          if ((s.data()?.revision || 0) !== revision.current)
            throw Error(
              'Este perfil mudou em outro dispositivo. Recarregue antes de salvar.',
            )
          tx.set(ref, { payload: JSON.stringify(state), revision: next })
        })
      revision.current = next
      try {
        localStorage.setItem(path, JSON.stringify({ state, revision: next }))
      } catch {}
      const changedWhileSaving = editVersion.current !== savedVersion
      setDirty(changedWhileSaving)
      setStatus(changedWhileSaving ? 'Alterações não salvas' : preview ? 'Salvo neste navegador • prévia demonstrativa' : 'Salvo • disponível nos seus dispositivos')
    } catch (e) {
      if (preview) { setStatus(e.message.includes('outra aba') ? e.message : 'Não foi possível salvar neste navegador. Suas alterações continuam abertas.'); return }
      try {
        localStorage.setItem(
          path,
          JSON.stringify({ state, revision: revision.current }),
        )
      } catch {}
      setStatus(
        e.message?.includes('outro dispositivo')
          ? e.message
          : 'Não sincronizado. Rascunho salvo neste computador; tente salvar novamente.',
      )
    } finally {
      setBusy(false)
    }
  }
  return { state, update, save, status, ready, busy }
}
