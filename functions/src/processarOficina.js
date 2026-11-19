import { parseDateBR, getMes, parseBR } from './utils.js'
import { REGRA_OFICINA } from './regras.js'

const normKey = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()

// resolveRegra(normTipo, mes, empresa) => regra | null. Aplica a regra do próprio mês/UF.
export function processarOficina(rows, resolveRegra) {
  const registros = []
  const inconsistencias = []
  const vistos = new Set()

  const staticNorm = {}
  for (const [k, v] of Object.entries(REGRA_OFICINA)) staticNorm[normKey(k)] = v
  const resolver = typeof resolveRegra === 'function' ? resolveRegra : (nt) => staticNorm[nt] || null

  rows.forEach((row, idx) => {
    const tipoOS    = (row['Tipo O.S.'] || '').trim()
    const empresa   = (row['Empresa'] || '').trim()
    const consultor = (row['Consultor'] || '').trim()
    const tecnico   = (row['Técnico Nome'] || '').trim()
    const dt        = parseDateBR(row['Data Conclusão'])
    const mes       = getMes(dt)
    const regra     = resolver(normKey(tipoOS), mes, empresa)

    if (!regra) {
      const chave = tipoOS + '|' + empresa
      if (!vistos.has(chave)) {
        vistos.add(chave)
        inconsistencias.push({ tipo: 'TIPO_OS_NAO_CADASTRADO', valor: tipoOS || '(vazio)', linha: idx + 2, arquivo: 'OFICINA', empresa })
      }
      return
    }

    const isInterno      = tipoOS.toUpperCase().includes('INTERNO')
    const totalServico   = parseBR(row['Total Serviço']) || 0
    const totalRevisao   = parseBR(row['Total Revisão']) || 0
    const totalCortesia  = (regra.meta && isInterno) ? (parseBR(row['Total Cortesia']) || 0) : 0
    const mo             = totalServico + totalRevisao + totalCortesia

    const osNum = row['Nº O.S.'] || row['N° O.S.'] || row['O.S.'] || row['Nro. O.S.'] || row['Numero O.S.'] || row['OS'] || row['Nº OS'] || row['N.O.S.'] || ''
    const osId  = empresa + '|' + String(osNum).trim()
    const qtdeOSEntry = Object.entries(row).find(([k]) => k.replace(/[\s.]/g, '').toUpperCase() === 'QTDEOS')
    const qtdeOSRaw   = qtdeOSEntry ? qtdeOSEntry[1] : null
    const qtdeOS      = qtdeOSRaw !== null ? (parseInt(String(qtdeOSRaw)) || 0) : null
    const contaPassagem = osNum.trim() !== '' && (qtdeOS === null ? true : qtdeOS > 0)

    registros.push({
      ...row,
      dt: dt ? dt.toISOString() : null,
      mes,
      empresa, tipoOS, cat: regra.cat, comissao: regra.com,
      consultor, tecnico, mo, totalServico, totalRevisao, totalCortesia,
      osId, contaPassagem,
    })
  })

  return { registros, inconsistencias }
}
