const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const BRL2 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const fmtBRL  = v => BRL.format(v || 0)
export const fmtBRL2 = v => BRL2.format(v || 0)

export const fmtPct = (v, decimals = 0) => {
  if (v === null || v === undefined || !isFinite(v)) return '–'
  return (v * 100).toFixed(decimals) + '%'
}

export const fmtNum = v => Number(v || 0).toLocaleString('pt-BR')
export const fmtCompacto = v => new Intl.NumberFormat('pt-BR', {notation:'compact',maximumFractionDigits:1}).format(Number(v)||0)

export const parseBR = v => {
  if (!v) return 0
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0
}

const CONECT_NOMES = new Set(['DE','DA','DO','DOS','DAS','DI','DU','E'])

export function nomeAbrev(nome) {
  if (!nome) return ''
  const partes = nome.trim().split(/\s+/)
  const resultado = []
  let reais = 0
  let pendente = []
  for (const p of partes) {
    if (CONECT_NOMES.has(p)) {
      pendente.push(p)
    } else {
      resultado.push(...pendente, p)
      pendente = []
      reais++
      if (reais === 2) break
    }
  }
  return resultado.join(' ')
}

export function genUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '')
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
