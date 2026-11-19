import { IHS_LINHAS_OFICINA, IHS_CANAIS_PECAS, IHS_CARGOS } from '../../store/configSlice.js'
import { LOJAS } from '../../data/regras.js'

// Linhas e canais exibíveis (excluindo 'ignorar')
export const LINHAS_OFICINA_EXIB  = Object.entries(IHS_LINHAS_OFICINA).filter(([k]) => k !== 'ignorar')
export const CANAIS_PECAS_EXIB    = Object.entries(IHS_CANAIS_PECAS).filter(([k]) => k !== 'ignorar')
export const FUNCOES_EXIB         = Object.entries(IHS_CARGOS).filter(([k]) => k !== 'ignorar')

// Filtro comum: uma loja (código de empresa) passa se estiver na seleção e no estado.
function lojaPassa(empresa, lojasSel, estadoSel) {
  if (lojasSel.length && !lojasSel.includes(empresa)) return false
  if (estadoSel && LOJAS[empresa]?.uf !== estadoSel) return false
  return true
}

// Mapeia o campo "Empresa" do CSV de motos para o código de loja (ARA, CAM…).
// Aceita tanto o código direto quanto o nome completo (casa pela unidade em LOJAS).
export function inferirLojaMotos(nomeCompleto) {
  const n = (nomeCompleto || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  if (LOJAS[n]) return n
  for (const [cod, info] of Object.entries(LOJAS)) {
    const un = info.un.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (n.includes(un)) return cod
  }
  return n
}

export function calcularOficina(oficinaPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento) {
  const rows = (oficinaPorMes[mesAtivo] || [])
    .filter(r => lojaPassa(r.empresa, lojasSel, estadoSel))

  const por_linha = {}
  const osSetPorLinha = {}

  for (const row of rows) {
    const linha = ihsMapeamento?.oficina?.[row.tipoOS]
    if (!linha || linha === 'ignorar') continue
    if (!por_linha[linha]) {
      por_linha[linha] = { passagens: 0, mo: 0 }
      osSetPorLinha[linha] = new Set()
    }
    if (row.contaPassagem && row.osId) osSetPorLinha[linha].add(row.osId)
    por_linha[linha].mo += row.mo || 0
  }

  for (const linha of Object.keys(por_linha)) {
    por_linha[linha].passagens   = osSetPorLinha[linha]?.size || 0
    por_linha[linha].contabiliza = ihsMapeamento?.contabiliza_linhas_ihs?.[linha] !== false
  }

  return por_linha
}

function parsarQtd(v) {
  return parseInt(String(v || '').replace(/\./g, '').replace(',', '.'), 10) || 0
}

export function calcularPecas(pecasPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento) {
  const rows = (pecasPorMes[mesAtivo] || [])
    .filter(r => lojaPassa(r.empresa, lojasSel, estadoSel))

  const por_canal = {}
  let rmp_total = 0
  let itensAtendidos = 0
  let qtdePecas = 0
  const osSet = new Set()

  const filtro = ihsMapeamento?.pecas_filtro || {}
  const filtroAtivo = Object.keys(filtro).length > 0

  // Tipos de movimento que contam para Itens Solicitados/Atendidos, Qtde. OS e
  // Nº de Peças no Resumo Mensal — apenas vendas de peças por O.S. (oficina/garantia/
  // seguradora). TODO: tornar configurável em Regras (hoje fixo, risco de um tipo de
  // movimento novo raro não entrar na contagem sem essa lista ser revisada).
  const TIPOS_MOV_OS = new Set([
    'VENDA POR O.S.', 'VENDA GARANTIA POR O.S.', 'VENDA SEGURADORA POR O.S.', 'SAÍDA SEGURADORA PAD',
  ])

  for (const row of rows) {
    let canal = ihsMapeamento?.pecas_canal?.[row.tipoMov]
    if (!canal || canal === 'ignorar') continue

    const isCompra = canal === 'compra_honda' || canal === 'compra_outra'
    const tipoMerc = row.tipoMercadoria || row['Tipo Mercadoria'] || row['Tipo de Mercadoria'] || ''

    if (canal === 'oficina') {
      const tipoOS  = (row['Tipo OS'] || '').trim()
      const linhaOS = ihsMapeamento?.oficina?.[tipoOS]
      if (linhaOS && linhaOS.startsWith('serv_exp')) canal = 'serv_expresso'
    }

    // Contagens de itens: só os 4 tipos de movimento de O.S., e só peças cujo tipo
    // de mercadoria esteja marcado para contabilizar (mesmo filtro do faturamento).
    if (!isCompra && TIPOS_MOV_OS.has(row.tipoMov) && (!filtroAtivo || filtro[tipoMerc] === true)) {
      itensAtendidos++
      qtdePecas += parsarQtd(row['Quantidade'])
      if (row.nrReq) osSet.add(row.nrReq)
    }

    // Faturamento: aplica filtro de tipoMercadoria quando configurado
    if (!isCompra && filtroAtivo && filtro[tipoMerc] !== true) continue

    if (!por_canal[canal]) por_canal[canal] = { faturamento: 0, custo: 0 }

    if (isCompra) {
      por_canal[canal].custo += Math.abs(row.valor || 0)
    } else {
      por_canal[canal].faturamento += row.valor || 0
      por_canal[canal].custo       += row.custo  || 0
    }

    if (!isCompra && filtro[tipoMerc] === true) {
      rmp_total += row.valor || 0
    }
  }

  for (const canal of Object.keys(por_canal)) {
    por_canal[canal].contabiliza = ihsMapeamento?.contabiliza_canais_pecas?.[canal] !== false
  }

  return { por_canal, rmp_total, itensAtendidos, qtdePecas, qtdeOS: osSet.size }
}

export function calcularFuncionarios(metasPorMes, mesAtivo, lojasSel, estadoSel, ihsMapeamento) {
  const mesData = metasPorMes[mesAtivo] || {}
  const por_funcao = {}

  for (const colab of Object.values(mesData)) {
    const loja = colab.loja || colab.empresa || ''
    if ((lojasSel.length > 0 || estadoSel) && loja && !lojaPassa(loja, lojasSel, estadoSel)) continue
    const cargo  = (colab.cargo || '').toUpperCase()
    const funcao = ihsMapeamento?.cargos?.[cargo]
    if (!funcao || funcao === 'ignorar') continue
    por_funcao[funcao] = (por_funcao[funcao] || 0) + 1
  }

  return por_funcao
}

export function processarMotocicletas(rows, lojasSel = [], estadoSel = '') {
  let novos = 0, usadosHonda = 0, usadosOutras = 0
  for (const row of rows) {
    const cod = inferirLojaMotos(row['Empresa'])
    if (!lojaPassa(cod, lojasSel, estadoSel)) continue
    const qtd    = parseInt(row['Quantidade'] || '0', 10) || 0
    const marca  = (row['Marca']          || '').trim().toUpperCase()
    const estado = (row['Estado Veículo'] || '').trim().toUpperCase()
    if (estado === 'NOVO')        novos += qtd
    else if (estado === 'USADO') { if (marca === 'HONDA') usadosHonda += qtd; else usadosOutras += qtd }
  }
  return { novos, usadosHonda, usadosOutras }
}

// Histórico mensal de passagens por linha (Oficina) para mini BI
export function historicoOficina(oficinaPorMes, lojasSel, estadoSel, ihsMapeamento) {
  return Object.entries(oficinaPorMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, rows]) => {
      const r = calcularOficina({ [mes]: rows }, mes, lojasSel, estadoSel, ihsMapeamento)
      const totalPassagens = Object.values(r).reduce((s, v) => s + v.passagens, 0)
      const totalMO        = Object.values(r).reduce((s, v) => s + v.mo, 0)
      return { mes, por_linha: r, totalPassagens, totalMO }
    })
}

const CANAL_COMPRA = new Set(['compra_honda', 'compra_outra'])

// Histórico mensal de faturamento por canal (Peças) para mini BI
export function historicoPecas(pecasPorMes, lojasSel, estadoSel, ihsMapeamento) {
  return Object.entries(pecasPorMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, rows]) => {
      const { por_canal, rmp_total } = calcularPecas({ [mes]: rows }, mes, lojasSel, estadoSel, ihsMapeamento)
      const totalVendas = Object.entries(por_canal)
        .filter(([k]) => !CANAL_COMPRA.has(k))
        .reduce((s, [, v]) => s + v.faturamento, 0)
      const totalCompras = Object.entries(por_canal)
        .filter(([k]) => CANAL_COMPRA.has(k))
        .reduce((s, [, v]) => s + v.custo, 0)
      return { mes, por_canal, rmp_total, totalVendas, totalCompras }
    })
}
