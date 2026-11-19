// Regras puras do portal de colaboradores/supervisores.
// Sem dependência de Firebase: dá para testar com `node --test`.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb)

export const MAX_TENTATIVAS = 5
export const MIN_SENHA = 8
export const MAX_SENHA = 128
export const HASH_BYTES = 32
export const PORTAL_ROLES = ['colaborador', 'supervisor']

/** Normaliza nomes do mesmo jeito que o resto do sistema (sem acento/caixa). */
export const key = value => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ[\]]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase()

/** Identificador estável de uma pessoa no portal (nunca expõe o nome no link). */
export function personId(tipo, nome, loja) {
  return createHash('sha256').update(`${tipo}|${key(nome)}|${key(loja)}`).digest('hex').slice(0, 32)
}

/** E-mail sintético do Auth — o portal nunca usa e-mail real. */
export const syntheticEmail = id => `${id}@portal.posvenda.app`

export function validatePassword(senha) {
  if (typeof senha !== 'string') throw Error('Senha inválida.')
  if (senha.length < MIN_SENHA) throw Error(`A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`)
  if (senha.length > MAX_SENHA) throw Error(`A senha pode ter no máximo ${MAX_SENHA} caracteres.`)
  if (!/[^\d]/.test(senha) || !/\d/.test(senha)) throw Error('Use pelo menos uma letra e um número.')
  if (new Set(senha).size < 3) throw Error('Use uma senha com pelo menos 3 caracteres diferentes.')
  return senha
}

export async function hashPassword(senha) {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scrypt(senha, salt, HASH_BYTES)).toString('hex')
  return { algo: 'scrypt', salt, hash }
}

export async function verifyPassword(senha, stored) {
  if (!stored?.salt || !stored?.hash || stored.algo !== 'scrypt') return false
  if (typeof senha !== 'string' || senha.length > MAX_SENHA) return false
  const expected = Buffer.from(stored.hash, 'hex')
  const actual = await scrypt(senha, stored.salt, expected.length || HASH_BYTES)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/**
 * Estado do bloqueio. Cinco erros bloqueiam a conta — e só o administrador
 * reabre (ver portalRedefinir no servidor).
 */
export function attemptState(conta) {
  const tentativas = Number(conta?.tentativas) || 0
  return { tentativas, bloqueado: conta?.bloqueado === true || tentativas >= MAX_TENTATIVAS, restantes: Math.max(0, MAX_TENTATIVAS - tentativas) }
}

export function nextAttempt(conta) {
  const tentativas = (Number(conta?.tentativas) || 0) + 1
  return { tentativas, bloqueado: tentativas >= MAX_TENTATIVAS }
}

const SUPERVISOR_CARGO = /SUPERVISOR/i

/**
 * Lista de pessoas que podem entrar no portal, montada a partir do cadastro
 * de colaboradores (`config/colaboradores`). Devolve só nome e loja — nenhum
 * dado de desempenho sai daqui.
 */
export function buildRoster(colaboradores, lojas, tipo) {
  const meses = Object.keys(colaboradores || {}).sort((a, b) => {
    const [ma, aa] = a.split('/').map(Number)
    const [mb, ab] = b.split('/').map(Number)
    return aa !== ab ? aa - ab : ma - mb
  })
  const registro = colaboradores?.[meses.at(-1)] || {}
  const storeName = code => {
    const loja = lojas?.[code]
    return loja?.un || loja?.nome || code || 'Sem loja'
  }
  const pessoas = new Map()
  const supervisores = new Set()

  for (const [nome, pessoa] of Object.entries(registro)) {
    const oficial = pessoa?.colaborador || nome
    if (pessoa?.ativo === false) continue
    if (SUPERVISOR_CARGO.test(pessoa?.cargo || '')) supervisores.add(oficial)
    for (const alvo of String(pessoa?.supervisor || '').split(';')) {
      if (alvo.trim()) supervisores.add(alvo.trim())
    }
  }

  for (const [nome, pessoa] of Object.entries(registro)) {
    const oficial = pessoa?.colaborador || nome
    if (pessoa?.ativo === false) continue
    if (tipo === 'supervisor' && !supervisores.has(oficial)) continue
    // Supervisor que aparece só como referência (sem registro próprio) entra com a loja do time.
    const codigo = pessoa?.loja || ''
    pessoas.set(key(oficial), {
      tipo,
      nome: oficial,
      loja: storeName(codigo),
      codigo,
      uf: lojas?.[codigo]?.uf || '',
    })
  }

  if (tipo === 'supervisor') {
    for (const nome of supervisores) {
      if (pessoas.has(key(nome))) continue
      const time = Object.values(registro).filter(pessoa => String(pessoa?.supervisor || '').split(';').some(alvo => key(alvo) === key(nome)))
      const referencia = time.find(pessoa => pessoa?.loja)?.loja || ''
      pessoas.set(key(nome), { tipo, nome, loja: storeName(referencia), codigo: referencia, uf: lojas?.[referencia]?.uf || '' })
    }
  }

  return [...pessoas.values()]
    .map(pessoa => ({ ...pessoa, id: personId(tipo, pessoa.nome, pessoa.codigo) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** Valida a troca do próprio perfil: só foto e nome de exibição. */
export function validateProfileChange(data) {
  if (!data || typeof data !== 'object') throw Error('Pedido inválido.')
  const chaves = Object.keys(data)
  if (!chaves.length || chaves.some(chave => !['foto', 'nomeExibicao'].includes(chave))) throw Error('Só a foto e o nome de exibição podem ser alterados.')
  const update = {}
  if (data.nomeExibicao !== undefined) {
    if (typeof data.nomeExibicao !== 'string') throw Error('Nome de exibição inválido.')
    const nome = data.nomeExibicao.trim()
    if (nome.length < 2 || nome.length > 60) throw Error('O nome de exibição precisa ter entre 2 e 60 caracteres.')
    update.nomeExibicao = nome
  }
  if (data.foto !== undefined) {
    if (data.foto === null) update.foto = null
    else {
      if (typeof data.foto !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.foto)) throw Error('Envie uma imagem JPEG, PNG ou WebP.')
      if (data.foto.length > 120000) throw Error('A foto precisa ter menos de 90 KB.')
      update.foto = data.foto
    }
  }
  return update
}
