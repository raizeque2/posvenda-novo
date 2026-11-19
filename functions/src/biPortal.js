import { randomBytes, createHash } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { publicRateLimit } from './publicRateLimit.js'
const BUCKET = 'posvenda-bi.firebasestorage.app'
const normKey = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
const cmpMes = (a, b) => {
  const [ma, aa] = a.split('/').map(Number),
    [mb, ab] = b.split('/').map(Number)
  return aa !== ab ? aa - ab : ma - mb
}
const mesCalendarioAtual = () => {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: '2-digit', year: 'numeric' }).format(new Date())
}
// BI pessoal: links de posse, permanentes e revogáveis. Nenhum documento público.
// O token tem 256 bits; apenas seu hash é armazenado.
const biOptions = {
  maxInstances: 3, concurrency: 2,
  region: 'southamerica-east1', cors: ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/],
  timeoutSeconds: 120,
  memory: '512MiB',
}
const tokenHash = (t) => createHash('sha256').update(t).digest('hex')
async function requireBIAdmin(request) {
  if (!request.auth)
    throw new HttpsError('unauthenticated', 'Entre como administrador.')
  const u = await getFirestore().doc(`usuarios/${request.auth.uid}`).get()
  if (u.data()?.role !== 'admin' || u.data()?.ativo === false)
    throw new HttpsError(
      'permission-denied',
      'Somente administradores podem gerenciar links.',
    )
}
export const criarLinkBI = onCall(biOptions, async (request) => {
  await requireBIAdmin(request)
  const name = String(request.data?.name || '').trim(),
    db = getFirestore()
  const c = await db.doc('config/colaboradores').get(),
    all = JSON.parse(c.data()?.payload || '{}')
  const matches = Object.values(all)
    .flatMap((m) => Object.values(m || {}))
    .filter((c) => normKey(c.colaborador || '') === normKey(name))
  if (!name || !matches.length)
    throw new HttpsError(
      'invalid-argument',
      'Selecione um colaborador cadastrado.',
    )
  const token = randomBytes(32).toString('hex'),
    id = tokenHash(token)
  await db
    .doc(`biLinks/${id}`)
    .create({
      name,
      active: true,
      createdBy: request.auth.uid,
      createdAt: Date.now(),
      revision: 0,
      profile: { name, photo: '' },
    })
  return { token, id, name }
})
export const gerenciarLinkBI = onCall(biOptions, async (request) => {
  await requireBIAdmin(request)
  const db = getFirestore()
  if (request.data?.action === 'list')
    return {
      links: (await db.collection('biLinks').get()).docs.map((d) => ({
        id: d.id,
        name: d.data().name,
        active: d.data().active,
        createdAt: d.data().createdAt,
      })),
    }
  if (
    request.data?.action === 'revoke' &&
    /^[a-f0-9]{64}$/.test(request.data.id)
  ) {
    await db.doc(`biLinks/${request.data.id}`).update({ active: false })
    return { ok: true }
  }
  throw new HttpsError('invalid-argument', 'Ação inválida.')
})
export const portalBI = onCall(biOptions, async (request) => {
  const { token, action = 'load', month } = request.data || {}
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
    throw new HttpsError('permission-denied', 'Link inválido.')
  await publicRateLimit(request, 'personal-link')
  const db = getFirestore(),
    ref = db.doc(`biLinks/${tokenHash(token)}`),
    snap = await ref.get(),
    link = snap.data()
  if (!link?.active)
    throw new HttpsError('permission-denied', 'Este link não está disponível.')
  if (action === 'save') {
    const { state, revision, profile } = request.data
    if (
      !Number.isInteger(revision) ||
      !state?.profiles?.length ||
      state.profiles.length > 30 ||
      JSON.stringify(state).length > 600000
    )
      throw new HttpsError(
        'invalid-argument',
        'Perfil inválido ou muito grande.',
      )
    if (
      profile &&
      (typeof profile.name !== 'string' ||
        profile.name.length > 80 ||
        typeof profile.photo !== 'string' ||
        profile.photo.length > 180000 ||
        (profile.photo &&
          !/^data:image\/(jpeg|png|webp);base64,/.test(profile.photo)))
    )
      throw new HttpsError('invalid-argument', 'Nome ou foto inválidos.')
    await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data()
      if (!current?.active)
        throw new HttpsError('permission-denied', 'Link revogado.')
      if (current.revision !== revision)
        throw new HttpsError(
          'aborted',
          'Este perfil mudou em outro dispositivo. Recarregue antes de salvar.',
        )
      tx.update(ref, {
        payload: JSON.stringify(state),
        revision: revision + 1,
        ...(profile ? { profile } : {}),
        updatedAt: Date.now(),
      })
    })
    return { revision: revision + 1 }
  }
  if (action === 'profile')
    return {
      state: link.payload ? JSON.parse(link.payload) : link.state || null,
      revision: link.revision,
      profile: link.profile,
      name: link.name,
    }
  if (action !== 'load')
    throw new HttpsError('invalid-argument', 'Ação inválida.')
  const monthsSnap = await db.doc('config/mesesDisponiveis').get(),
    months = [
      ...new Set([
        ...(monthsSnap.data()?.pecas || []),
        ...(monthsSnap.data()?.oficina || []),
      ]),
    ].sort((a, b) => cmpMes(b, a))
  const selected = month || months[0] || mesCalendarioAtual()
  if (!/^\d{2}\/\d{4}$/.test(selected) || (month && !months.includes(month)))
    throw new HttpsError('invalid-argument', 'Mês inválido.')
  const colabSnap = await db.doc('config/colaboradores').get()
  let aliases = {}
  try {
    const all = JSON.parse(colabSnap.data()?.payload || '{}')
    Object.keys(all)
      .sort(cmpMes)
      .forEach((month) =>
        Object.values(all[month]).forEach((c) => {
          if (c.apelido && c.colaborador)
            aliases[normKey(c.apelido).replace(/[\[\]]/g, '')] = c.colaborador
        }),
      )
  } catch {}
  const match = (n) =>
    normKey(
      String(aliases[normKey(n || '').replace(/[\[\]]/g, '')] || n || ''),
    ) === normKey(link.name)
  const load = async (type) => {
    const [mm, yyyy] = selected.split('/')
    for (const path of [
      `Dados/${type}/${mm}-${yyyy}.json`,
      `Dados/${type}/${yyyy}-${mm}.json`,
      `dados/${type === 'Pecas' ? 'pecas' : 'oficina'}/${mm}-${yyyy}.json`,
    ]) {
      try {
        const file = getStorage().bucket(BUCKET).file(path)
        const [metadata] = await file.getMetadata()
        if (Number(metadata.size) > 15000000) throw new HttpsError('resource-exhausted', 'Base muito grande para consultar.')
        return JSON.parse((await file.download())[0].toString())
      } catch (e) {
        if (e.code !== 404) throw e
      }
    }
    return []
  }

  const [p, o] = await Promise.all([load('Pecas'), load('Oficina')])
  // Whitelist: nunca retorna linha bruta, cliente, telefone ou resultados de outras pessoas.
  const pieces = p
    .filter((r) => match(r.responsavel))
    .map((r) => ({
      dt: r.dt,
      mes: r.mes,
      empresa: r.empresa,
      cat: r.cat,
      responsavel: link.name,
      valor: r.valor,
      eDevolucao: !!r.eDevolucao,
      quantidade: r.quantidade ?? r['Quantidade'] ?? null,
      produto:
        r.produto ||
        r['Descrição Produto'] ||
        r['Descrição'] ||
        r['Produto'] ||
        '',
    }))
  const services = o
    .filter((r) => match(r.consultor) || match(r.tecnico))
    .map((r) => ({
      dt: r.dt,
      mes: r.mes,
      empresa: r.empresa,
      consultor: link.name,
      mo: r.mo,
    }))
  const metasSnap = await db.doc('config/metas').get()
  let metas = {}
  try {
    metas = JSON.parse(metasSnap.data()?.payload || '{}')
  } catch {}
  const own = Object.entries(metas[selected] || {}).find(([n, m]) =>
    match(m.colaborador || m.nome || n),
  )?.[1]
  const targets = own?.metas
    ? Object.entries(own.metas).flatMap(([channel, m]) =>
        channel === 'OS'
          ? [
              { name: link.name, channel: 'SERVIÇOS', meta: Number(m.mo) || 0 },
              { name: link.name, channel: 'OFICINA', meta: Number(m.mpo) || 0 },
            ]
          : [{ name: link.name, channel, meta: Number(m.mp) || 0 }],
      )
    : own
      ? [{ name: link.name, channel: '', meta: Number(own.mp) || 0 }]
      : []
  return {
    name: link.name,
    months,
    month: selected,
    pieces,
    services,
    targets,
    profile: link.profile,
  }
})
