import { parseDateBR, getMes, parseBR } from './utils.js'
import { REGRA_PECAS } from './regras.js'

const normKey = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()

// resolveRegra(normTipo, mes, empresa) => regra | null
// Aplica a regra do PRÓPRIO mês/UF do registro. Se não vier resolver, usa defaults estáticos.
export function processarPecas(rows, resolveRegra) {
  const registros = []
  const inconsistencias = []
  const vistos = new Set()

  const staticNorm = {}
  for (const [k, v] of Object.entries(REGRA_PECAS)) staticNorm[normKey(k)] = v
  const resolver = typeof resolveRegra === 'function' ? resolveRegra : (nt) => staticNorm[nt] || null

  const dateKey = Object.keys(rows[0] || {})[0]
  const _strip = k => k.replace(/﻿/g, '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const nrReqKey = Object.keys(rows[0] || {}).find(k => _strip(k) === 'numero')
    || Object.keys(rows[0] || {}).find(k => _strip(k).startsWith('numero'))
    || Object.keys(rows[0] || {}).find(k => _strip(k) === 'nr' || _strip(k) === 'nro')
    || ''
  const cmvKey = Object.keys(rows[0] || {}).find(k => _strip(k).includes('cmv')) || ''

  rows.forEach((row, idx) => {
    const tipoMovRaw     = (row['Tipo Movimento'] || '').trim()
    const tipoMov        = tipoMovRaw  // mantém original para display e gravação
    const tipoMercadoria = (row['Tipo Mercadoria'] || row['Tipo de Mercadoria'] || '').trim()
    const empresa        = (row['Empresa'] || '').trim()
    const vendedor  = (row['Vendedor'] || '').trim()
    const tecnico   = (row['Técnico'] || '').trim()
    const apelido   = (row['Apelido'] || row['APELIDO'] || row['apelido'] || '').trim()
    const valor     = parseBR(row['Valor Total'])
    const custo     = parseBR(cmvKey ? row[cmvKey] : '0')
    const dt        = parseDateBR(row[dateKey])
    const mes       = getMes(dt)
    const regra     = resolver(normKey(tipoMovRaw), mes, empresa)

    if (!regra) {
      const chave = tipoMov + '|' + empresa
      if (!vistos.has(chave)) {
        vistos.add(chave)
        inconsistencias.push({ tipo: 'TIPO_MOVIMENTO_NAO_CADASTRADO', valor: tipoMov || '(vazio)', linha: idx + 2, arquivo: 'PEÇAS', empresa })
      }
      return
    }

    const eDevolucao   = tipoMov.toUpperCase().includes('DEVOLUÇÃO')
    const valorFinal   = eDevolucao ? -Math.abs(valor) : valor
    const isOficina    = regra.cat === 'OFICINA' || regra.cat === 'OFICINA_INT' || regra.cat === 'OFICINA_GAR' || regra.cat === 'OFICINA_SEG'
    const responsavel  = isOficina ? vendedor : (apelido || vendedor || tecnico)

    registros.push({
      ...row,
      dt: dt ? dt.toISOString() : null,
      mes,
      empresa, tipoMov, tipoMercadoria, cat: regra.cat, comissao: regra.com,
      responsavel, tecnico,
      valor: valorFinal,
      custo: eDevolucao ? -Math.abs(custo) : custo,
      eDevolucao,
      nrReq: nrReqKey ? (row[nrReqKey] || '').trim() : '',
    })
  })

  return { registros, inconsistencias }
}
