import './src/appCheck.js' // primeiro: define enforceAppCheck antes de qualquer onCall
import { initializeApp } from 'firebase-admin/app'
import { getStorage }    from 'firebase-admin/storage'
import { getFirestore }  from 'firebase-admin/firestore'
import { getAuth }       from 'firebase-admin/auth'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { parseCSV }        from './src/parseCSV.js'
import { processarPecas }  from './src/processarPecas.js'
import { processarOficina } from './src/processarOficina.js'
import { REGRA_PECAS, REGRA_OFICINA } from './src/regras.js'
import { canImport, isActiveProfile, validateImport, validateAccount } from './src/securityPolicy.js'

initializeApp()

const BUCKET = 'posvenda-bi.firebasestorage.app'
const PASTA  = { pecas: 'Pecas', oficina: 'Oficina' }

// ── Fechamento por calendário (Fase 2 — espelha o mecanismo do Estoque) ──────
// Peças/Oficina não têm "mês corrente" guardado (cada linha já é datada, um
// arquivo por mês, sobrescrito a cada envio) — mas hoje qualquer upload,
// mesmo de um mês já fechado, sobrescreve sem aviso, sem trava, sem backup.
// Aqui a trava é simples: mês fechado = já passou pelo calendário. Upload
// normal só grava meses correntes/futuros; mês fechado exige retroativo +
// motivo, com backup de auditoria do que existia antes de sobrescrever.
function cmpMes(a, b) {
  const [ma, aa] = a.split('/').map(Number)
  const [mb, ab] = b.split('/').map(Number)
  return aa !== ab ? aa - ab : ma - mb
}
function mesCalendarioAtual() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: '2-digit', year: 'numeric' }).format(new Date())
}

// Normaliza chave de tipo de movimento para lookup robusto:
// remove acentos, espaços duplos, converte para maiúsculas.
// Isso garante match mesmo que CSV e regra usem formas Unicode distintas (NFC vs NFD).
function normKey(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
}

function normalizarMapa(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) out[normKey(k)] = v
  return out
}

// Lê o documento estruturado de regras do Firestore (por mês/UF). Null se ausente/erro.
async function carregarRegrasData(db) {
  try {
    const snap = await db.collection('config').doc('regras').get()
    if (!snap.exists) return null
    return JSON.parse(snap.data().payload || '{}')
  } catch {
    return null
  }
}

// Constrói um resolver que aplica a regra do PRÓPRIO mês + UF de cada registro.
// Fallback: se o mês/UF não tiver a regra, usa os defaults estáticos.
// Isso faz uma edição de regra (por mês/UF) valer de verdade ao reprocessar,
// sem que o mês/UF errado sobrescreva (bug antigo do merge achatado).
function buildResolver(regrasData, tipo) {
  const base = tipo === 'pecas' ? REGRA_PECAS : REGRA_OFICINA
  const staticNorm = normalizarMapa(base)

  const lojaUf = {}
  const byMesUf = {}
  for (const [mes, md] of Object.entries(regrasData || {})) {
    for (const [code, l] of Object.entries(md?.lojas || {})) { if (l?.uf) lojaUf[code] = l.uf }
    byMesUf[mes] = {}
    for (const [uf, rules] of Object.entries(md?.[tipo] || {})) {
      byMesUf[mes][uf] = normalizarMapa(rules)
    }
  }

  return (normTipo, mes, empresa) => {
    const uf = lojaUf[empresa]
    return byMesUf[mes]?.[uf]?.[normTipo] ?? staticNorm[normTipo] ?? null
  }
}

/**
 * processarCSV — Callable Function
 *
 * Recebe o texto bruto do CSV, processa no servidor e salva o resultado no Storage.
 * O browser nunca precisa fazer parsing de 30k+ linhas.
 *
 * Input:  { tipo: 'pecas'|'oficina', csvText: string }
 * Output: { mesesNovos: string[], totalRegistros: number, inconsistencias: object[] }
 */
export const processarCSV = onCall({
  region: 'southamerica-east1', cors: ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/],
  timeoutSeconds: 300,
  memory: '512MiB',
  maxInstances: 3, concurrency: 1,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autenticação necessária')
  }

  const profile = (await getFirestore().doc(`usuarios/${request.auth.uid}`).get()).data()
  if (!canImport(profile)) throw new HttpsError('permission-denied', 'Somente administradores ou coordenadores ativos podem importar dados.')
  let input
  try { input = validateImport(request.data) } catch (error) { throw new HttpsError('invalid-argument', error.message) }
  const { tipo, csvText, retroativo, motivo } = input

  if (!['pecas', 'oficina'].includes(tipo)) {
    throw new HttpsError('invalid-argument', `Tipo inválido: ${tipo}`)
  }
  if (!csvText || typeof csvText !== 'string' || csvText.length < 10) {
    throw new HttpsError('invalid-argument', 'CSV inválido ou vazio')
  }
  if (retroativo && !motivo.trim()) {
    throw new HttpsError('invalid-argument', 'Upload retroativo exige um motivo da correção.')
  }

  const db      = getFirestore()
  const storage = getStorage()
  const bucket  = storage.bucket(BUCKET)

  // 1. Parse do CSV
  const { rows } = parseCSV(csvText)
  if (!rows.length || rows.length > 100000) throw new HttpsError('invalid-argument', 'CSV precisa ter entre 1 e 100.000 linhas.')

  // 2. Carrega regras estruturadas do Firestore e monta o resolver por mês/UF
  const regrasData = await carregarRegrasData(db)
  const regras = buildResolver(regrasData || {}, tipo)

  // 3. Processa
  const { registros, inconsistencias } =
    tipo === 'pecas'
      ? processarPecas(rows, regras)
      : processarOficina(rows, regras)
  const allowedStates = profile.estados?.length ? profile.estados : profile.estado ? [profile.estado] : null
  if (allowedStates && registros.some(row => !allowedStates.includes(regrasData?.[row.mes]?.lojas?.[row.empresa]?.uf))) throw new HttpsError('permission-denied', 'O arquivo contém lojas fora dos estados autorizados ou sem cadastro de UF.')

  // 4. Agrupa por mês para salvar arquivos separados (igual ao comportamento do browser)
  const porMes = {}
  for (const r of registros) {
    if (!r.mes) continue
    if (!porMes[r.mes]) porMes[r.mes] = []
    porMes[r.mes].push(r)
  }
  const mesesNovos = Object.keys(porMes).sort()

  // 4.5. Trava de mês fechado — mesmo mecanismo do Estoque (Fase 1), calendário
  // decide, não o nome do arquivo nem a boa vontade de quem sobe.
  const mesCal = mesCalendarioAtual()
  const mesesFechados = mesesNovos.filter(m => cmpMes(m, mesCal) < 0)
  if (mesesFechados.length && !retroativo) {
    throw new HttpsError(
      'failed-precondition',
      `Este arquivo contém dados de mês(es) já fechado(s): ${mesesFechados.join(', ')}. Se isso é uma correção proposital, marque "Upload retroativo" e informe o motivo.`,
    )
  }

  const pasta = PASTA[tipo]

  // 5. Backup de auditoria dos meses fechados que serão sobrescritos (só quando
  // retroativo) — preserva o que existia antes, igual ao Estoque.
  if (mesesFechados.length && retroativo) {
    await Promise.all(mesesFechados.map(async mes => {
      const chave = mes.replace('/', '-')
      const path  = `Dados/${pasta}/${chave}.json`
      const file  = bucket.file(path)
      const [existe] = await file.exists()
      if (!existe) return
      const [conteudo] = await file.download()
      const pathBackup = `Dados/${pasta}/historico/${chave}__corrigido_em_${Date.now()}.json`
      await bucket.file(pathBackup).save(conteudo, { contentType: 'application/json' })
    }))
  }

  // Prepare all payloads before any replacement. Never discard another UF.
  const plans = await Promise.all(mesesNovos.map(async mes => {
    const file = bucket.file(`Dados/${pasta}/${mes.replace('/', '-')}.json`)
    const [exists] = await file.exists()
    const [metadata] = exists ? await file.getMetadata() : [{ generation: 0 }]
    let rows = porMes[mes]
    if (allowedStates && exists) {
      const [bytes] = await file.download()
      const previous = JSON.parse(bytes.toString())
      rows = [...previous.filter(row => !allowedStates.includes(regrasData?.[mes]?.lojas?.[row.empresa]?.uf)), ...rows]
    }
    const payload = JSON.stringify(rows)
    if (Buffer.byteLength(payload, 'utf8') > 15000000) throw new HttpsError('resource-exhausted', 'O arquivo mensal excede 15 MB. Solicite a revisão da base antes de importar.')
    return { file, payload, generation: Number(metadata.generation || 0) }
  }))
  await Promise.all(plans.map(({ file, payload, generation }) => file.save(payload, {
    contentType: 'application/json', metadata: { cacheControl: 'no-cache' },
    preconditionOpts: { ifGenerationMatch: generation },
  })))

  // 6.5. Registra o motivo da correção retroativa (auditoria consultável).
  // Ler-modificar-gravar em transação: duas importações simultâneas (peças e
  // oficina em instâncias diferentes) não apagam mais a lista uma da outra.
  if (mesesFechados.length && retroativo) {
    const corrRef = db.collection('config').doc('correcoesRetroativas')
    const agora   = Date.now()
    const autor   = request.auth.token?.email || request.auth.uid
    await db.runTransaction(async tx => {
      const corrSnap = await tx.get(corrRef)
      const lista    = corrSnap.exists ? JSON.parse(corrSnap.data().payload || '[]') : []
      mesesFechados.forEach(mes => lista.push({ tipo, mes, motivo: motivo.trim(), corrigidoEm: agora, corrigidoPor: autor }))
      tx.set(corrRef, { payload: JSON.stringify(lista), ts: agora })
    })
  }

  // 7. Registra meses no Firestore (config/mesesDisponiveis) + timestamp de alteração
  const configRef = db.collection('config').doc('mesesDisponiveis')
  await db.runTransaction(async tx => {
    const configSnap = await tx.get(configRef)
    const configData = configSnap.exists ? configSnap.data() : { pecas: [], oficina: [] }
    const arr        = [...new Set([...(configData[tipo] || []), ...mesesNovos])].sort()
    const alteracoes = { ...(configData.alteracoes || {}) }
    const agora      = Date.now()
    mesesNovos.forEach(m => { alteracoes[m] = agora })
    tx.set(configRef, { ...configData, [tipo]: arr, alteracoes })
  })

  // 8. Retorna apenas metadados — nunca os rows completos (podem ser 100k+ itens)
  return {
    mesesNovos,
    mesesFechadosCorrigidos: retroativo ? mesesFechados : [],
    totalRegistros: registros.length,
    inconsistencias: inconsistencias.slice(0, 50),
  }
})

/**
 * gerenciarUsuario — Callable Function (Admin SDK)
 *
 * Centraliza criação, desativação, reativação, exclusão e reset de senha
 * usando o Admin SDK (acesso total ao Firebase Auth, sem limitações do cliente).
 *
 * Ações: criar | aprovarCadastro | rejeitarCadastro | desativar | reativar | excluir | resetSenha | atualizarPerfil
 */
export const gerenciarUsuario = onCall({
  region: 'southamerica-east1', cors: ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado.')

  const db   = getFirestore()
  const auth = getAuth()

  // Verifica se o chamador é admin
  const callerSnap = await db.collection('usuarios').doc(request.auth.uid).get()
  if (!isActiveProfile(callerSnap.data()) || callerSnap.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas administradores podem executar esta ação.')
  }

  let input
  try { input = validateAccount(request.data) } catch (error) { throw new HttpsError('invalid-argument', error.message) }
  const { acao, uid, email, nome, role, estados, senha, setor, solicitacao } = input
  if (uid === request.auth.uid && ['desativar', 'excluir'].includes(acao)) throw new HttpsError('failed-precondition', 'Você não pode remover seu próprio acesso nesta tela.')

  switch (acao) {

    case 'criar': {
      if (!email || !nome || !role) throw new HttpsError('invalid-argument', 'Campos obrigatórios ausentes.')
      let userRecord
      try {
        userRecord = await auth.createUser({ email, password: senha, displayName: nome })
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') throw new HttpsError('already-exists', 'E-mail já cadastrado.')
        if (e.code === 'auth/weak-password')        throw new HttpsError('invalid-argument', 'Senha muito fraca (mínimo 8 caracteres).')
        if (e.code === 'auth/invalid-email')        throw new HttpsError('invalid-argument', 'E-mail inválido.')
        throw new HttpsError('internal', 'Não foi possível criar a conta.')
      }
      const estadosNorm = role === 'admin' ? null : (estados?.length ? estados : ['PE'])
      await db.collection('usuarios').doc(userRecord.uid).set({
        email, nome, role,
        estados: estadosNorm,
        estado:  estadosNorm?.length === 1 ? estadosNorm[0] : null,
        ativo: true,
      })
      return { uid: userRecord.uid, ...(!senha ? { link: await auth.generatePasswordResetLink(email) } : {}) }
    }

    // Cadastro feito pela tela pública: o cargo/setor finais são os escolhidos aqui pelo admin.
    case 'aprovarCadastro': {
      if (!solicitacao || !role) throw new HttpsError('invalid-argument', 'Solicitação e cargo são obrigatórios.')
      const ref = db.collection('solicitacoes').doc(solicitacao), snap = await ref.get()
      if (!snap.exists) throw new HttpsError('not-found', 'Solicitação não encontrada.')
      const s = snap.data()
      const estadosNorm = role === 'admin' ? null : (estados?.length ? estados : ['PE'])
      const perfil = { email: s.email, nome: s.nome, role, estados: estadosNorm, estado: estadosNorm?.length === 1 ? estadosNorm[0] : null, ativo: true, ...(setor ? { setor } : {}) }
      // Pedido antigo (sem senha) ou e-mail que já tinha conta: cria como antes, com link de senha.
      if (!s.uid) {
        let userRecord
        try { userRecord = await auth.createUser({ email: s.email, displayName: s.nome }) }
        catch (e) { if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'E-mail já cadastrado.'); throw new HttpsError('internal', 'Não foi possível criar a conta.') }
        await db.collection('usuarios').doc(userRecord.uid).set(perfil)
        await ref.delete()
        return { uid: userRecord.uid, link: await auth.generatePasswordResetLink(s.email) }
      }
      if ((await db.collection('usuarios').doc(s.uid).get()).exists) throw new HttpsError('already-exists', 'Esta conta já está ativa. Veja na aba Usuários.')
      await db.collection('usuarios').doc(s.uid).set(perfil)
      await auth.updateUser(s.uid, { disabled: false })
      await ref.delete()
      return { uid: s.uid }
    }

    case 'rejeitarCadastro': {
      if (!solicitacao) throw new HttpsError('invalid-argument', 'Solicitação ausente.')
      const ref = db.collection('solicitacoes').doc(solicitacao), snap = await ref.get()
      if (!snap.exists) return { ok: true }
      const s = snap.data()
      // Apaga a conta bloqueada criada no cadastro, se ela nunca chegou a ser aprovada.
      if (s.uid && !(await db.collection('usuarios').doc(s.uid).get()).exists) {
        try { await auth.deleteUser(s.uid) } catch (e) { if (e.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Não foi possível remover o cadastro.') }
      }
      await ref.delete()
      return { ok: true }
    }

    case 'desativar': {
      if (!uid) throw new HttpsError('invalid-argument', 'UID ausente.')
      await db.collection('usuarios').doc(uid).update({ ativo: false })
      await auth.updateUser(uid, { disabled: true })
      await auth.revokeRefreshTokens(uid)
      return { ok: true }
    }

    case 'reativar': {
      if (!uid) throw new HttpsError('invalid-argument', 'UID ausente.')
      await auth.updateUser(uid, { disabled: false })
      await db.collection('usuarios').doc(uid).update({ ativo: true })
      return { ok: true }
    }

    case 'excluir': {
      if (!uid) throw new HttpsError('invalid-argument', 'UID ausente.')
      await db.collection('usuarios').doc(uid).set({ ativo: false }, { merge: true })
      try { await auth.deleteUser(uid) } catch (error) { if (error.code !== 'auth/user-not-found') throw new HttpsError('internal', 'Não foi possível excluir a conta.') }
      await db.recursiveDelete(db.collection('usuarios').doc(uid))
      const cleanup = db.batch()
      for (const collection of ['assistantConnections', 'assistantLimits', 'assistantPersonalLimits']) cleanup.delete(db.collection(collection).doc(uid))
      await cleanup.commit()
      return { ok: true }
    }

    case 'resetSenha': {
      if (!email) throw new HttpsError('invalid-argument', 'E-mail ausente.')
      try {
        const link = await auth.generatePasswordResetLink(email)
        return { link }
      } catch (e) {
        if (e.code === 'auth/user-not-found') throw new HttpsError('not-found', 'Usuário não encontrado no Auth.')
        throw new HttpsError('internal', 'Não foi possível gerar o link de redefinição.')
      }
    }

    case 'atualizarPerfil': {
      if (uid === request.auth.uid && role !== undefined && role !== 'admin') throw new HttpsError('failed-precondition', 'Outro administrador precisa alterar seu perfil.');
      if (!uid) throw new HttpsError('invalid-argument', 'UID ausente.')
      const update = {}
      if (role !== undefined) update.role = role
      if (setor !== undefined) update.setor = setor
      if (estados !== undefined) {
        const estadosNorm = role === 'admin' ? null : (estados?.length ? estados : null)
        update.estados = estadosNorm
        update.estado  = estadosNorm?.length === 1 ? estadosNorm[0] : null
      }
      if (nome !== undefined) {
        if (!nome.trim()) throw new HttpsError('invalid-argument', 'Nome não pode ficar vazio.')
        update.nome = nome.trim()
        // Mantém o displayName do Auth em sincronia — evita o mesmo tipo de
        // divergência que motivou este campo existir (nome de login curto/
        // diferente do nome completo usado no cadastro de colaborador e no
        // campo Supervisor de outros, quebrando o filtro "meu time" em Comissões).
        try { await auth.updateUser(uid, { displayName: nome.trim() }) } catch {}
      }
      await db.collection('usuarios').doc(uid).update(update)
      return { ok: true }
    }

    default:
      throw new HttpsError('invalid-argument', `Ação desconhecida: ${acao}`)
  }
})

export { criarLinkBI, gerenciarLinkBI, portalBI } from './src/biPortal.js'
export { portalSnapshot } from './src/sectorSnapshot.js'
export { solicitarAcesso, verificarTurnstile } from './src/registration.js'
export { lerDadosAutorizados } from './src/dataAccess.js'
export { gestaoEquipe } from './src/gestaoEquipeCallable.js'
export { npsPesquisa, npsPainel } from './src/npsCallable.js'
// Assistente de IA removido em 13/11/2026 (código guardado em arquivado/assistente-ia).
// Portal do colaborador desativado em 13/11/2026 (código em arquivado/portal-colaborador).
