import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import useStore from '../store.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Modo desenvolvimento local: permite visualização sem login no localhost
  const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const [user, setUser]             = useState(() => isLocalhost ? { uid: 'local-dev-admin', email: 'dev@localhost', displayName: 'Administrador Local' } : null)
  const [role, setRole]             = useState(() => isLocalhost ? 'admin' : null)
  const [estado, setEstado]         = useState(null)   // string|null — compat. legado
  const [estados, setEstados]       = useState(null)   // string[]|null
  const [nome, setNome]             = useState(() => isLocalhost ? 'Administrador Local' : null)
  const [portal, setPortal]         = useState(false)  // conta criada pelo portal de colaboradores/supervisores
  const [foto, setFoto]             = useState(null)   // foto do perfil (data URL pequena) — só o portal edita
  const [nomeExibicao, setNomeExibicao] = useState(() => isLocalhost ? 'Administrador Local' : null)
  const [setor, setSetor] = useState(null)             // setor da pessoa (restringe as abas do cargo)
  const [carregando, setCarregando] = useState(() => !isLocalhost)
  const [erroLogin, setErroLogin]   = useState(null)   // mensagem de bloqueio pós-auth

  useEffect(() => {
    if (isLocalhost) {
      setCarregando(false);
      return;
    }
    let generation = 0
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const current = ++generation
      setCarregando(true)
      if (firebaseUser) {
        try {
          const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
          const snap = await Promise.race([getDoc(doc(db, 'usuarios', firebaseUser.uid)), timeout])
          if (current !== generation) return
          if (!snap.exists()) {
            setErroLogin('Acesso não cadastrado. Entre em contato com o administrador.')
            await firebaseSignOut(auth)
            return
          }
          const perfil = snap.data()
          // Contas do antigo portal do colaborador (desativado em 13/11/2026) não entram mais.
          if (perfil.portal === true) {
            setErroLogin('O portal do colaborador foi desativado. Peça ao administrador um login do Pós-Venda.')
            await firebaseSignOut(auth)
            return
          }
          if (perfil.ativo === false || !['admin', 'coordenador', 'supervisor', 'operacional'].includes(perfil.role)) {
            setErroLogin('Sua conta está desativada. Entre em contato com o administrador.')
            await firebaseSignOut(auth)
            return
          }
          setErroLogin(null)
          setRole(perfil.role ?? 'operacional')
          // Normaliza: docs novos têm estados:[]; docs antigos têm estado:string
          const arr = perfil.estados?.length ? perfil.estados
                    : perfil.estado          ? [perfil.estado]
                    : null
          setEstados(arr)
          // Compatibilidade: único estado → string; múltiplos → null (acesso amplo)
          setEstado(arr?.length === 1 ? arr[0] : null)
          setNome(perfil.nome ?? firebaseUser.displayName ?? null)
          setPortal(perfil.portal === true)
          setFoto(perfil.foto ?? null)
          setNomeExibicao(perfil.nomeExibicao ?? null)
          setSetor(typeof perfil.setor === 'string' ? perfil.setor : null)
        } catch (err) {
          if (current !== generation) return
          setErroLogin('Não foi possível validar seu acesso. Tente entrar novamente.')
          setUser(null)
          setRole(null)
          setEstado(null)
          setEstados(null)
          setNome(null)
          setPortal(false)
          setFoto(null)
          setNomeExibicao(null)
          setSetor(null)
          await firebaseSignOut(auth)
          return
        }
        setUser(firebaseUser)
      } else {
        useStore.setState(useStore.getInitialState(), true)
        try { indexedDB.deleteDatabase('posvenda_cache'); localStorage.removeItem('posvenda_regras_v2') } catch {}
        setUser(null)
        setRole(null)
        setEstado(null)
        setEstados(null)
        setNome(null)
        setPortal(false)
        setFoto(null)
        setNomeExibicao(null)
        setSetor(null)
      }
      setCarregando(false)
    })
    return () => { generation++; unsubscribe() }
  }, [])

  async function login(email, senha) {
    setErroLogin(null)
    await signInWithEmailAndPassword(auth, email, senha)
  }

  async function logout() {
    await firebaseSignOut(auth)
  }

  // Aplicado na hora quando a pessoa troca foto ou nome de exibição no portal,
  // sem esperar novo carregamento do perfil.
  function aplicarPerfilLocal({ foto: novaFoto, nomeExibicao: novoNome }) {
    if (novaFoto !== undefined) setFoto(novaFoto)
    if (novoNome !== undefined) setNomeExibicao(novoNome)
  }

  // Só o admin simula outra visão; a segurança real continua nas regras do Firestore
  let verComo = null
  try { if (role === 'admin') verComo = JSON.parse(sessionStorage.getItem('pv_ver_como')) } catch {}
  return (
    <AuthContext.Provider value={{ user, role: verComo?.role || role, estado, estados, setor: verComo ? (verComo.setor || null) : setor, nome: verComo?.nome || nome, portal, foto, nomeExibicao, carregando, erroLogin, login, logout, aplicarPerfilLocal }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
