import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'
const firebaseConfig = {
  apiKey: "AIzaSyAudqwFBg1NvpMzKsHeM5EQVQ14cGfbGgk",
  authDomain: "posvenda-bi.firebaseapp.com",
  projectId: "posvenda-bi",
  storageBucket: "posvenda-bi.firebasestorage.app",
  messagingSenderId: "891072470100",
  appId: "1:891072470100:web:282f94dce1c7c3e01f61c1"
}

const app = initializeApp(firebaseConfig)

// App Check (reCAPTCHA Enterprise): só liga quando a chave pública do site
// estiver configurada em VITE_APPCHECK_SITE_KEY. Em `npm run dev`, use
// VITE_APPCHECK_DEBUG=true e cadastre o token de depuração impresso no console.
const APP_CHECK_KEY = import.meta.env.VITE_APPCHECK_SITE_KEY
function ativarAppCheck(instancia) {
  if (!APP_CHECK_KEY || typeof window === 'undefined') return
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG === 'true') self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  initializeAppCheck(instancia, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_KEY), isTokenAutoRefreshEnabled: true })
}
ativarAppCheck(app)

// Sem persistência offline: configs carregam direto da rede; CSV usa IndexedDB próprio (cloudLoader)
export const db        = getFirestore(app)
export const storage   = getStorage(app)
export const auth      = getAuth(app)
export const functions = getFunctions(app, 'southamerica-east1')

// App secundário — inicializado só quando necessário (criar usuário)
let _authSecundario = null
export function getAuthSecundario() {
  if (!_authSecundario) {
    const appSec = initializeApp(firebaseConfig, 'secundario')
    ativarAppCheck(appSec) // com App Check obrigatório no Auth, o app secundário também precisa do token
    _authSecundario = getAuth(appSec)
  }
  return _authSecundario
}
