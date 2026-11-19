// Portal de colaboradores e supervisores.
//
// Tudo que decide acesso acontece aqui: o navegador nunca vê hash de senha
// nem escolhe o próprio cargo. A pessoa escolhe nome+loja, cria a senha no
// primeiro acesso e entra por token personalizado do Firebase Auth.
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { isActiveProfile } from './securityPolicy.js'
import { publicRateLimit } from './publicRateLimit.js'
import { requireTurnstile, TURNSTILE_SECRET } from './turnstile.js'
import {
  attemptState,
  buildRoster,
  hashPassword,
  MAX_TENTATIVAS,
  nextAttempt,
  PORTAL_ROLES,
  syntheticEmail,
  validatePassword,
  validateProfileChange,
  verifyPassword,
} from './portalPolicy.js'

const CORS = ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]
const COLLECTION = 'portalContas'

async function readConfig(db, name) {
  const snap = await db.doc(`config/${name}`).get()
  if (!snap.exists) return {}
  const data = snap.data()
  return typeof data.payload === 'string' ? JSON.parse(data.payload) : data
}

async function rosterOf(db, tipo) {
  const [colaboradores, lojas] = await Promise.all([readConfig(db, 'colaboradores'), readConfig(db, 'lojas')])
  return buildRoster(colaboradores, lojas, tipo)
}

async function personOf(db, tipo, id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) throw new HttpsError('invalid-argument', 'Pessoa inválida.')
  const roster = await rosterOf(db, tipo)
  const person = roster.find(item => item.id === id)
  if (!person) throw new HttpsError('not-found', 'Cadastro não encontrado. Procure o administrador.')
  return person
}

async function callerProfile(db, request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre no sistema.')
  const profile = (await db.doc(`usuarios/${request.auth.uid}`).get()).data()
  if (!isActiveProfile(profile)) throw new HttpsError('permission-denied', 'Acesso indisponível.')
  return profile
}

/**
 * Pessoas disponíveis para escolher na entrada. Devolve SOMENTE nome, loja e
 * se já existe senha — nenhum número de desempenho antes do login.
 */
export const portalPessoas = onCall({ region: 'southamerica-east1', cors: CORS, maxInstances: 5, timeoutSeconds: 30 }, async request => {
  const { tipo } = request.data || {}
  if (!PORTAL_ROLES.includes(tipo)) throw new HttpsError('invalid-argument', 'Tipo de acesso inválido.')
  await publicRateLimit(request, 'portal-pessoas', 40, 60000)
  const db = getFirestore()
  const roster = await rosterOf(db, tipo)
  const accounts = new Map()
  for (let index = 0; index < roster.length; index += 250) {
    const chunk = roster.slice(index, index + 250)
    const snaps = await db.getAll(...chunk.map(person => db.doc(`${COLLECTION}/${person.id}`)))
    for (const snap of snaps) if (snap.exists) accounts.set(snap.id, snap.data())
  }
  return {
    pessoas: roster.map(person => {
      const conta = accounts.get(person.id)
      return {
        id: person.id,
        nome: person.nome,
        loja: person.loja,
        primeiroAcesso: !conta?.senha,
        bloqueado: attemptState(conta).bloqueado,
      }
    }),
  }
})

/**
 * Entrada no portal. `primeiro: true` cria a senha única da pessoa; sem ele,
 * confere a senha já existente. Cinco erros bloqueiam a conta até o
 * administrador redefinir.
 */
export const portalEntrar = onCall({ region: 'southamerica-east1', cors: CORS, maxInstances: 5, timeoutSeconds: 30, secrets: [TURNSTILE_SECRET] }, async request => {
  const { tipo, id, senha, primeiro } = request.data || {}
  if (!PORTAL_ROLES.includes(tipo)) throw new HttpsError('invalid-argument', 'Tipo de acesso inválido.')
  await publicRateLimit(request, 'portal-entrar', 30, 60000)
  await requireTurnstile(request, 'portal_login')
  const db = getFirestore()
  const person = await personOf(db, tipo, id)
  const ref = db.doc(`${COLLECTION}/${person.id}`)
  const bloqueadoErro = () => new HttpsError('permission-denied', 'Acesso bloqueado após tentativas incorretas. Peça ao administrador para redefinir sua senha.', { bloqueado: true })
  let conta, next

  if (primeiro === true) {
    const snap = await ref.get()
    conta = snap.exists ? snap.data() : null
    if (attemptState(conta).bloqueado) throw bloqueadoErro()
    if (conta?.senha) throw new HttpsError('failed-precondition', 'Esta pessoa já tem senha. Entre com ela.', { senhaExistente: true })
    try { validatePassword(senha) } catch (error) { throw new HttpsError('invalid-argument', error.message) }
  } else {
    // A tentativa é "reservada" numa transação ANTES de conferir a senha: antes,
    // ler → conferir → gravar sem transação deixava palpites em paralelo
    // passarem do limite de 5. Em caso de acerto, a gravação final zera o contador.
    conta = await db.runTransaction(async tx => {
      const atual = await tx.get(ref)
      const dados = atual.exists ? atual.data() : null
      if (attemptState(dados).bloqueado) throw bloqueadoErro()
      if (!dados?.senha) throw new HttpsError('failed-precondition', 'Primeiro acesso: defina sua senha.', { primeiroAcesso: true })
      next = nextAttempt(dados)
      tx.set(ref, { ...dados, ...next, atualizadoEm: new Date() })
      return dados
    })
    const ok = await verifyPassword(senha, conta.senha)
    if (!ok) {
      const restantes = Math.max(0, MAX_TENTATIVAS - next.tentativas)
      throw new HttpsError(
        'permission-denied',
        next.bloqueado
          ? 'Senha incorreta. Acesso bloqueado — peça ao administrador para redefinir.'
          : `Senha incorreta. ${restantes} tentativa${restantes === 1 ? '' : 's'} antes do bloqueio.`,
        { restantes, bloqueado: next.bloqueado },
      )
    }
  }

  const auth = getAuth()
  const email = syntheticEmail(person.id)
  let uid = conta?.uid
  if (!uid) {
    try {
      uid = (await auth.getUserByEmail(email)).uid
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Não foi possível preparar o acesso.')
      try {
        uid = (await auth.createUser({ email, displayName: person.nome })).uid
      } catch (createError) {
        throw new HttpsError('internal', 'Não foi possível preparar o acesso. Tente novamente.')
      }
    }
  }

  const role = tipo === 'supervisor' ? 'supervisor' : 'operacional'
  // Sem recorte por UF: o escopo do servidor (dataScope) já limita a pessoa ao
  // próprio cadastro e, no caso do supervisor, a quem tem o nome dele no campo
  // Supervisor — inclusive quando o time atende lojas de outro estado.
  await db.doc(`usuarios/${uid}`).set({
    nome: person.nome,
    nomeExibicao: conta?.nomeExibicao || person.nome,
    foto: conta?.foto || null,
    loja: person.loja,
    role,
    estados: null,
    estado: null,
    ativo: true,
    portal: true,
    email,
  }, { merge: true })

  await ref.set({
    ...(conta || {}),
    tipo,
    nome: person.nome,
    loja: person.loja,
    uf: person.uf,
    uid,
    senha: primeiro === true ? await hashPassword(senha) : conta.senha,
    tentativas: 0,
    bloqueado: false,
    criadoEm: conta?.criadoEm || new Date(),
    atualizadoEm: new Date(),
    ultimoAcesso: new Date(),
  })

  return { token: await auth.createCustomToken(uid), nome: person.nome, role }
})

/** Lista das contas do portal para o administrador (aba Acessos). */
export const portalListar = onCall({ region: 'southamerica-east1', cors: CORS, maxInstances: 3, timeoutSeconds: 30 }, async request => {
  const db = getFirestore()
  const profile = await callerProfile(db, request)
  if (profile.role !== 'admin') throw new HttpsError('permission-denied', 'Apenas administradores.')
  const snap = await db.collection(COLLECTION).limit(2000).get()
  return {
    contas: snap.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        nome: data.nome,
        loja: data.loja,
        tipo: data.tipo,
        temSenha: !!data.senha,
        bloqueado: attemptState(data).bloqueado,
        tentativas: attemptState(data).tentativas,
        ultimoAcesso: data.ultimoAcesso?.toMillis?.() || null,
      }
    }).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')),
  }
})

/** Única forma de reabrir uma conta bloqueada ou esquecida. */
export const portalRedefinir = onCall({ region: 'southamerica-east1', cors: CORS, maxInstances: 3, timeoutSeconds: 30 }, async request => {
  const db = getFirestore()
  const profile = await callerProfile(db, request)
  if (profile.role !== 'admin') throw new HttpsError('permission-denied', 'Apenas administradores.')
  const id = request.data?.id
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) throw new HttpsError('invalid-argument', 'Conta inválida.')
  const ref = db.doc(`${COLLECTION}/${id}`)
  const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Conta do portal não encontrada.')
  const conta = snap.data()
  await ref.set({ ...conta, senha: null, tentativas: 0, bloqueado: false, redefinidoEm: new Date() })
  if (conta.uid) {
    try { await getAuth().revokeRefreshTokens(conta.uid) } catch { /* conta pode já ter sido removida */ }
    await db.doc(`usuarios/${conta.uid}`).set({ senhaDefinida: false }, { merge: true })
  }
  return { ok: true }
})

/** A pessoa troca apenas a própria foto e o nome de exibição. */
export const portalPerfil = onCall({ region: 'southamerica-east1', cors: CORS, maxInstances: 3, timeoutSeconds: 30 }, async request => {
  const db = getFirestore()
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre no sistema.')
  const ref = db.doc(`usuarios/${request.auth.uid}`)
  const snap = await ref.get()
  const profile = snap.data()
  if (!isActiveProfile(profile) || profile.portal !== true) throw new HttpsError('permission-denied', 'Disponível apenas para o portal.')
  let update
  try { update = validateProfileChange(request.data) } catch (error) { throw new HttpsError('invalid-argument', error.message) }
  if (!Object.keys(update).length) throw new HttpsError('invalid-argument', 'Nada para alterar.')
  await ref.set({ ...update, atualizadoEm: new Date() }, { merge: true })
  return { ok: true, ...update }
})
