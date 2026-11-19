import { createHash } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { validarCadastro } from './cadastroPolicy.js'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { publicRateLimit } from './publicRateLimit.js'
import { requireTurnstile, TURNSTILE_SECRET } from './turnstile.js'

const CORS = ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/]
const PUBLIC = { region: 'southamerica-east1', cors: CORS, maxInstances: 3, timeoutSeconds: 30, secrets: [TURNSTILE_SECRET] }

// Cadastro com senha: a conta do Auth nasce BLOQUEADA (disabled) e sem perfil em usuarios/.
// Só entra depois que o administrador aprova (gerenciarUsuario → aprovarCadastro), que também
// decide o cargo de verdade. A senha vai direto para o Firebase Auth; nunca é gravada no Firestore.
export const solicitarAcesso = onCall(PUBLIC, async request => {
  let pedido
  try { pedido = validarCadastro(request.data) } catch (error) { throw new HttpsError('invalid-argument', error.message) }
  await publicRateLimit(request, 'registration', 5, 900000)
  await requireTurnstile(request, 'cadastro')
  const { nome, email, setor, cargo, senha } = pedido
  const id = createHash('sha256').update(email).digest('hex'), ref = getFirestore().doc(`solicitacoes/${id}`)
  // Pedido repetido ou e-mail que já tem conta: a resposta é a mesma, para não revelar nada.
  if ((await ref.get()).exists) return { ok: true }
  let uid = null
  try { uid = (await getAuth().createUser({ email, password: senha, displayName: nome, disabled: true })).uid }
  catch (error) { if (error?.code !== 'auth/email-already-exists') throw new HttpsError('internal', 'Não foi possível enviar agora. Tente novamente.') }
  try {
    await ref.create({ nome, email, setor, cargoPedido: cargo, uid, comSenha: !!uid, status: 'pendente', solicitadoEm: new Date() })
  } catch (error) {
    if (uid) await getAuth().deleteUser(uid).catch(() => {})
    if (error?.code !== 6 && error?.code !== 'already-exists') throw error
  }
  return { ok: true }
})

// Pré-checagem do Turnstile para formulários cuja ação final é feita pelo
// SDK do Firebase Auth no navegador (entrar e pedir link de redefinição).
// Limitação: o endpoint do Firebase Auth continua acessível diretamente; esta
// etapa barra automação no formulário, não substitui o limite do próprio Auth.
export const verificarTurnstile = onCall(PUBLIC, async request => {
  const action = request.data?.action
  if (!['login', 'reset_senha'].includes(action) || Object.keys(request.data || {}).some(key => !['action', 'turnstileToken'].includes(key))) throw new HttpsError('invalid-argument', 'Verificação inválida.')
  await publicRateLimit(request, `turnstile-${action}`, 20, 60000)
  await requireTurnstile(request, action)
  return { ok: true }
})
