import { LOJAS, COMISSAO_OPERACIONAL, COMISSAO_GESTAO } from '../../data/regras.js'
import { norm, resolveNome } from '../../utils/normalizacao.js'
import { calcProjecao } from '../../utils/datas.js'
import { getMetaCanal } from '../../pages/metas/metas.logic.js'

/**
 * Retorna regra de comissão para um colaborador
 */
export function getComissao(nome, uf, cargo, comissaoOp = COMISSAO_OPERACIONAL, comissaoGestao = COMISSAO_GESTAO) {
  const nNorm = norm(nome)
  const gestao = comissaoGestao.find(g => norm(g.colaborador) === nNorm)
  if (gestao) return { cp: gestao.cp || 0, cpo: gestao.cpo || 0, cmo: gestao.cmo || 0, cbp: 0, cbpo: 0, cbmo: 0 }
  const op = comissaoOp.find(o => o.uf === uf && norm(o.cargo) === norm(cargo))
  if (op) return { cp: op.cp || 0, cpo: op.cpo || 0, cmo: op.cmo || 0, cbp: op.cbp || 0, cbpo: op.cbpo || 0, cbmo: op.cbmo || 0 }
  return { cp: 0, cpo: 0, cmo: 0, cbp: 0, cbpo: 0, cbmo: 0 }
}

/**
 * Retorna todos os canais de um colaborador como array.
 */
export function getCanais(cargoMovimento) {
  if (!cargoMovimento) return []
  return cargoMovimento.split(';').map(c => c.trim()).filter(Boolean)
}

/**
 * Retorna o canal principal de um colaborador com base no cargoMovimento.
 * Canais peças: VAREJO, ATACADO, WEB, TELEVENDAS | Canal oficina: OS
 */
export function getCanalPrincipal(cargoMovimento) {
  if (!cargoMovimento) return null
  const canais = cargoMovimento.split(';').map(c => c.trim()).filter(Boolean)
  const canalPecas = canais.find(c => ['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS'].includes(c))
  if (canalPecas) return canalPecas
  if (canais.includes('OS')) return 'OS'
  return canais[0] || null
}

/**
 * Consolida peças + oficina por colaborador para um período
 */
export function buildRanking(
  pecas, oficina, mes, colaboradoresPorMes, metasPorMes, bonificacoes = {},
  diasDecorridos = 0, diasUteisMes = 0, apelidoMap = {},
  comissaoOp = COMISSAO_OPERACIONAL, comissaoGestao = COMISSAO_GESTAO,
  filtroLojas = [], filtroUF = ''
) {
  const colabs = mes ? (colaboradoresPorMes[mes] || {}) : {}
  const metas  = mes ? (metasPorMes[mes] || {}) : {}
  // Merge cadastral + meta por nome normalizado, elimina divergências de espaço/acento
  const metasNorm = {}
  Object.entries(colabs).forEach(([nome, c]) => {
    const mt = metas[nome] || {}
    metasNorm[norm(nome)] = { ...c, ...mt }
  })
  Object.entries(metas).forEach(([nome, mt]) => {
    const nNorm = norm(nome)
    if (!metasNorm[nNorm]) metasNorm[nNorm] = { ...mt }
  })
  const cm = {}

  function getColab(nome, empresa) {
    if (!nome) return null
    const nomeNorm = norm(nome)
    if (!cm[nomeNorm]) {
      const mt = metasNorm[nomeNorm] || null
      // UF sempre pela loja de cadastro do colaborador — nunca pela loja da transação
      const uf = LOJAS[mt?.loja || empresa]?.uf || ''
      const cargo = mt?.cargo || ''
      const com = { ...getComissao(nome, uf, cargo, comissaoOp, comissaoGestao) }
      for (const key of ['cp','cpo','cmo','cbp','cbpo','cbmo']) {
        const rate = mt?.comissaoOverrides?.[key]
        if (typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1) com[key] = rate
      }
      const canalPrincipal = getCanalPrincipal(mt?.cargo_movimento || '')
      const canaisList = getCanais(mt?.cargo_movimento || '')
      const temOS    = canaisList.includes('OS')
      const temPecas = canaisList.some(c => ['VAREJO','ATACADO','WEB','TELEVENDAS'].includes(c))
      const inativo = mt?.ativo === false
      // A meta é da loja MATRIZ da pessoa (mt.loja) — só deve contar pra um
      // recorte de loja/estado se essa for de fato a loja matriz dela. Sem
      // isso, uma pessoa da loja X que faz UMA venda em Oficina na loja Y
      // (ex.: cobriu um plantão) traz a meta INTEIRA dela (de X) grudada na
      // visão da loja Y, inflando o alvo de uma loja que não é dela. O
      // realizado (o que ela vendeu de fato ali) nunca é afetado por isso —
      // só a meta/alvo que aparece atrelado a essa visão.
      const contaMeta = (!filtroLojas.length || filtroLojas.includes(mt?.loja || '')) && (!filtroUF || uf === filtroUF)
      const semMeta = inativo || !contaMeta
      // Loja de cadastro sempre primeiro — transações de outras lojas (ex: PLT) entram depois
      const lojasCadastro = new Set()
      if (mt?.loja) lojasCadastro.add(mt.loja)
      cm[nomeNorm] = {
        nome, nomeNorm,
        lojas: lojasCadastro,
        canalPrincipal,
        temOS,
        temPecas,
        canal: null,
        inativo,
        mp: semMeta ? 0 : (() => {
          if (mt?.metas) {
            const pecasSet = canaisList.filter(c => ['VAREJO','ATACADO','WEB','TELEVENDAS'].includes(c))
            return pecasSet.reduce((s, canal) => s + (mt.metas[canal]?.mp || 0), 0)
          }
          return mt?.mp || 0
        })(),
        mo:           semMeta ? 0 : (mt ? getMetaCanal(mt, 'OS', 'mo')  : 0),
        mpo:          semMeta ? 0 : (mt ? getMetaCanal(mt, 'OS', 'mpo') : 0),
        mpVarejo:     semMeta || !canaisList.includes('VAREJO')     ? 0 : (mt ? getMetaCanal(mt, 'VAREJO',     'mp') : 0),
        mpAtacado:    semMeta || !canaisList.includes('ATACADO')    ? 0 : (mt ? getMetaCanal(mt, 'ATACADO',    'mp') : 0),
        mpWeb:        semMeta || !canaisList.includes('WEB')        ? 0 : (mt ? getMetaCanal(mt, 'WEB',        'mp') : 0),
        mpTelevendas: semMeta || !canaisList.includes('TELEVENDAS') ? 0 : (mt ? getMetaCanal(mt, 'TELEVENDAS', 'mp') : 0),
        mpPecOS:      semMeta ? 0 : (mt?.mpPecOS || 0),
        cargo,
        cargoMovimento: mt?.cargo_movimento || '',
        supervisor: mt?.supervisor || '',
        uf,
        comissaoExtra: inativo || !contaMeta ? 0 : Math.max(0, Number(mt?.comissaoExtra) || 0),
        comCp:  inativo ? 0 : com.cp,  comCpo:  inativo ? 0 : com.cpo,  comCmo:  inativo ? 0 : com.cmo,
        comCbp: inativo ? 0 : com.cbp, comCbpo: inativo ? 0 : com.cbpo, comCbmo: inativo ? 0 : com.cbmo,
        temMeta: !semMeta && !!(mt?.mp || mt?.mo || mt?.mpo || mt?.metas),
        varejo: 0, atacado: 0, web: 0, televendas: 0, pocoficina: 0, pocoficinaVend: 0, pocoficInaTec: 0,
        moreal: 0, morealCons: 0, morealTec: 0, passagensTec: 0,
        devVarejo: 0, devAtacado: 0, devWeb: 0, devTelevendas: 0, devPocoficina: 0, devPocoficinaVend: 0, devPocoficInaTec: 0,
        custoVarejo: 0, custoAtacado: 0, custoWeb: 0, custoTelevendas: 0, custoPocoficina: 0,
        reqSet: new Set(),
      }
    }
    if (empresa) cm[nomeNorm].lojas.add(empresa)
    return cm[nomeNorm]
  }

  // Acumula peças — dois caminhos independentes
  pecas.forEach(r => {
    if (filtroLojas.length && !filtroLojas.includes(r.empresa)) return
    if (filtroUF && (LOJAS[r.empresa]?.uf || '') !== filtroUF) return
    const val = r.valor

    // Caminho consultor/vendedor (todos os canais)
    if (r.responsavel) {
      const c = getColab(resolveNome(r.responsavel, apelidoMap) || r.responsavel, r.empresa)
      if (c) {
        if (r.eDevolucao) {
          if (r.cat === 'OFICINA' || r.cat === 'OFICINA_INT' || r.cat === 'OFICINA_GAR' || r.cat === 'OFICINA_SEG') {
            c.devPocoficina += Math.abs(val)
            c.devPocoficinaVend += Math.abs(val)
          } else {
            switch (r.cat) {
              case 'ATACADO':    c.devAtacado    += Math.abs(val); break
              case 'WEB':        c.devWeb        += Math.abs(val); break
              case 'TELEVENDAS': c.devTelevendas += Math.abs(val); break
              // COMPRA/DEV.COMPRA são movimentação de estoque com fornecedor
              // (regras.js já marca meta:false, com:false pra essa categoria)
              // — nunca contam como devolução de venda de ninguém.
              case 'COMPRA':
              case 'DEV.COMPRA':                                     break
              default:           c.devVarejo     += Math.abs(val); break
            }
          }
        } else {
          switch (r.cat) {
            case 'VAREJO':      c.varejo     += val; break
            case 'ATACADO':     c.atacado    += val; break
            case 'WEB':         c.web        += val; break
            case 'TELEVENDAS':  c.televendas += val; break
            case 'OFICINA':
            case 'OFICINA_INT':
            case 'OFICINA_GAR':
            case 'OFICINA_SEG': c.pocoficina += val; c.pocoficinaVend += val; break
          }
          if (r.nrReq && r.cat !== 'COMPRA' && r.cat !== 'DEV.COMPRA') c.reqSet.add(r.nrReq)
        }
        // CMV: sempre pelo canal real da transação (r.custo já é negativo para devoluções)
        if (r.custo) {
          switch (r.cat) {
            case 'VAREJO':      c.custoVarejo     += r.custo; break
            case 'ATACADO':     c.custoAtacado    += r.custo; break
            case 'WEB':         c.custoWeb        += r.custo; break
            case 'TELEVENDAS':  c.custoTelevendas += r.custo; break
            case 'OFICINA':
            case 'OFICINA_INT':
            case 'OFICINA_GAR':
            case 'OFICINA_SEG': c.custoPocoficina += r.custo; break
          }
        }
      }
    }

    // Caminho técnico (O.S. apenas) — independente, qualquer técnico aparece
    if ((r.cat === 'OFICINA' || r.cat === 'OFICINA_INT' || r.cat === 'OFICINA_GAR' || r.cat === 'OFICINA_SEG') && r.tecnico) {
      const ct = getColab(resolveNome(r.tecnico, apelidoMap) || r.tecnico, r.empresa)
      if (ct) {
        if (r.eDevolucao) { ct.devPocoficina += Math.abs(val); ct.devPocoficInaTec += Math.abs(val) }
        else { ct.pocoficina += val; ct.pocoficInaTec += val }
        ct.ehTecnico = true
      }
    }
  })

  // Define canal pelo volume (compatibilidade)
  Object.values(cm).forEach(c => {
    const vendas = {
      VAREJO:     c.varejo     - c.devVarejo,
      ATACADO:    c.atacado    - c.devAtacado,
      WEB:        c.web        - c.devWeb,
      TELEVENDAS: c.televendas - c.devTelevendas,
      OFICINA:    c.pocoficina - c.devPocoficina,
    }
    const maior = Object.entries(vendas).reduce((a, b) => b[1] > a[1] ? b : a, ['VAREJO', 0])
    c.canal = maior[0]
  })

  // Acumula oficina
  const consultoresMap = {}
  const tecnicosMap = {}

  const EXCLUIR_PASSAGEM = new Set(['INTERNO - PEÇAS', 'INTERNO - OFICINA'])

  oficina.forEach(r => {
    if (filtroLojas.length && !filtroLojas.includes(r.empresa)) return
    if (filtroUF && (LOJAS[r.empresa]?.uf || '') !== filtroUF) return
    const contaPassagem = r.osId && r.contaPassagem && !EXCLUIR_PASSAGEM.has(r.tipoOS)
    if (r.consultor) {
      const nomeResolvido = resolveNome(r.consultor, apelidoMap) || r.consultor
      const nomeNorm = norm(nomeResolvido)
      if (!consultoresMap[nomeNorm]) {
        consultoresMap[nomeNorm] = { nome: nomeResolvido, empresa: r.empresa, moreal: 0, mpo: 0, passagens: new Set(), totalServico: 0, totalRevisao: 0, totalCortesia: 0 }
      }
      consultoresMap[nomeNorm].moreal        += r.mo
      consultoresMap[nomeNorm].mpo           += r.pocoficina || 0
      consultoresMap[nomeNorm].totalServico  += r.totalServico  || 0
      consultoresMap[nomeNorm].totalRevisao  += r.totalRevisao  || 0
      consultoresMap[nomeNorm].totalCortesia += r.totalCortesia || 0
      if (contaPassagem) consultoresMap[nomeNorm].passagens.add(r.osId)
    }
    if (r.tecnico) {
      const nomeResolvido = resolveNome(r.tecnico, apelidoMap) || r.tecnico
      const nomeNorm = norm(nomeResolvido)
      if (!tecnicosMap[nomeNorm]) {
        tecnicosMap[nomeNorm] = { nome: nomeResolvido, empresa: r.empresa, moreal: 0, pecas: 0, passagens: new Set(), totalServico: 0, totalRevisao: 0, totalCortesia: 0 }
      }
      tecnicosMap[nomeNorm].moreal        += r.mo
      tecnicosMap[nomeNorm].totalServico  += r.totalServico  || 0
      tecnicosMap[nomeNorm].totalRevisao  += r.totalRevisao  || 0
      tecnicosMap[nomeNorm].totalCortesia += r.totalCortesia || 0
      if (contaPassagem) tecnicosMap[nomeNorm].passagens.add(r.osId)
    }
  })

  Object.entries(consultoresMap).forEach(([, dados]) => {
    const c = getColab(dados.nome, dados.empresa)
    if (c) {
      c.morealCons += dados.moreal
      c.moreal = c.morealCons + c.morealTec
      c.pocoficina += dados.mpo
      c.passagens = dados.passagens.size
      c.totalServico = dados.totalServico; c.totalRevisao = dados.totalRevisao; c.totalCortesia = dados.totalCortesia
      c.ehConsultor = true
    }
  })

  Object.entries(tecnicosMap).forEach(([, dados]) => {
    const c = getColab(dados.nome, dados.empresa)
    if (c) {
      c.morealTec += dados.moreal
      c.moreal = c.morealCons + c.morealTec
      c.passagensTec = dados.passagens.size
      if (!c.ehConsultor) c.passagens = dados.passagens.size
      c.totalServico = dados.totalServico; c.totalRevisao = dados.totalRevisao; c.totalCortesia = dados.totalCortesia
      c.ehTecnico = true
    }
  })

  // Garante TODO colaborador ativo cadastrado no mês, mesmo sem venda e sem
  // meta — quem já apareceu via pecas/oficina acima não duplica (getColab
  // é idempotente por nome). Cada tela que consome buildRanking aplica seu
  // próprio filtro de exibição (ex.: só quem vendeu, ou todo ativo).
  Object.entries(metasNorm).forEach(([nomeNorm, mt]) => {
    if (mt?.ativo === false) return
    const loja = mt.loja || ''
    const uf   = LOJAS[loja]?.uf || ''
    if (filtroLojas.length && !filtroLojas.includes(loja)) return
    if (filtroUF && uf !== filtroUF) return
    getColab(mt.colaborador || nomeNorm, loja)
  })

  return Object.values(cm).map(c => {
    const tp = (c.varejo - c.devVarejo) + (c.atacado - c.devAtacado) + (c.web - c.devWeb) + (c.televendas - c.devTelevendas)
    const to = c.moreal + (c.pocoficina - c.devPocoficina)
    const bon = bonificacoes[`${c.nome}||${mes || ''}`] || 0

    const comValP  = tp * c.comCp
    const comValPO = (c.pocoficina - c.devPocoficina) * c.comCpo
    const comValMO = c.moreal * c.comCmo
    const comTotal = comValP + comValPO + comValMO + c.comissaoExtra

    const bonValP  = tp * c.comCbp
    const bonValPO = (c.pocoficina - c.devPocoficina) * c.comCbpo
    const bonValMO = c.moreal * c.comCbmo
    const bonCalc  = bonValP + bonValPO + bonValMO

    const projMO         = calcProjecao(c.moreal, diasDecorridos, diasUteisMes)
    const projMOCons     = calcProjecao(c.morealCons, diasDecorridos, diasUteisMes)
    const projMOTec      = calcProjecao(c.morealTec, diasDecorridos, diasUteisMes)
    const projPecasOS    = calcProjecao(c.pocoficina - c.devPocoficina, diasDecorridos, diasUteisMes)
    const projPecasOSVend = calcProjecao(c.pocoficinaVend - c.devPocoficinaVend, diasDecorridos, diasUteisMes)
    const projPecasOSTec  = calcProjecao(c.pocoficInaTec - c.devPocoficInaTec, diasDecorridos, diasUteisMes)

    // Eficiência MO para consultores e mecânicos (projeção vs meta)
    const eficienciaMO     = c.mo > 0 ? projMO / c.mo : null
    const eficienciaMOCons = c.mo > 0 ? projMOCons / c.mo : null
    const eficienciaMOTec  = c.mo > 0 ? projMOTec  / c.mo : null

    // Canal principal e meta/liq correspondente
    const metaCanalPrincipal = (() => {
      switch (c.canalPrincipal) {
        case 'VAREJO':     return c.mpVarejo     || c.mp
        case 'ATACADO':    return c.mpAtacado    || c.mp
        case 'WEB':        return c.mpWeb        || c.mp
        case 'TELEVENDAS': return c.mpTelevendas || c.mp
        default:           return c.mp
      }
    })()

    const liqCanalPrincipal = (() => {
      switch (c.canalPrincipal) {
        case 'VAREJO':     return c.varejo     - c.devVarejo
        case 'ATACADO':    return c.atacado    - c.devAtacado
        case 'WEB':        return c.web        - c.devWeb
        case 'TELEVENDAS': return c.televendas - c.devTelevendas
        default:           return tp
      }
    })()

    const projCanalPrincipal = calcProjecao(liqCanalPrincipal, diasDecorridos, diasUteisMes)
    const eficienciaPecas    = metaCanalPrincipal > 0 ? projCanalPrincipal / metaCanalPrincipal : null

    // Para colaboradores OS sem dados de venda ainda, classificar pelo cargo
    const isOSMetaOnly = c.canalPrincipal === 'OS' && !c.ehConsultor && !c.ehTecnico && (c.mo > 0 || c.mpo > 0)
    const ehTecnicoFromMeta = isOSMetaOnly && /MECÂN|MECANI|BORRACHEIRO|AUXILIAR.MECA/i.test(c.cargo)
    // Quem aparece como técnico é mecânico — mesmo que também seja consultor (duplo papel permitido)
    const ehTecnico   = c.ehTecnico || ehTecnicoFromMeta
    // ehConsultor: quem aparece na coluna Consultor, ou fallbacks para peças OS / meta OS
    const ehConsultor = c.ehConsultor
      || (!c.ehTecnico && (c.pocoficina - c.devPocoficina) > 0)
      || (isOSMetaOnly && !ehTecnicoFromMeta)
      || (c.temOS && !ehTecnico && (c.mo > 0 || c.mpo > 0))

    return {
      ...c,
      lojas: [...c.lojas],
      reqSet: undefined,
      nrReq: c.reqSet.size,
      tp, to,
      ehConsultor,
      ehTecnico,
      temOS: c.temOS,
      temPecas: c.temPecas,
      projMO, projMOCons, projMOTec, projPecasOS, projPecasOSVend, projPecasOSTec,
      pocoficinaVend: c.pocoficinaVend, devPocoficinaVend: c.devPocoficinaVend,
      pocoficInaTec: c.pocoficInaTec, devPocoficInaTec: c.devPocoficInaTec,
      eficienciaMO, eficienciaMOCons, eficienciaMOTec, eficienciaPecas,
      metaCanalPrincipal, liqCanalPrincipal, projCanalPrincipal,
      tpBruto:  c.varejo + c.atacado + c.web + c.televendas,
      devTotal: c.devVarejo + c.devAtacado + c.devWeb + c.devTelevendas + c.devPocoficina,
      custoVarejo: c.custoVarejo, custoAtacado: c.custoAtacado,
      custoWeb: c.custoWeb, custoTelevendas: c.custoTelevendas, custoPocoficina: c.custoPocoficina,
      custoTotal: c.custoVarejo + c.custoAtacado + c.custoWeb + c.custoTelevendas + c.custoPocoficina,
      margem: (() => { const v = (c.varejo - c.devVarejo) + (c.atacado - c.devAtacado) + (c.web - c.devWeb) + (c.televendas - c.devTelevendas); const ct = c.custoVarejo + c.custoAtacado + c.custoWeb + c.custoTelevendas; return v > 0 && ct > 0 ? (v - ct) / v : null })(),
      metaVarejo:     c.mpVarejo,
      metaAtacado:    c.mpAtacado,
      metaWeb:        c.mpWeb,
      metaTelevendas: c.mpTelevendas,
      metaPecOS:      c.mpPecOS,
      pctP: c.mp > 0 ? tp / c.mp : null,
      pctO: (c.mo + c.mpo) > 0 ? to / (c.mo + c.mpo) : null,
      projP: calcProjecao(tp, diasDecorridos, diasUteisMes),
      projO: calcProjecao(to, diasDecorridos, diasUteisMes),
      comValP, comValPO, comValMO, comTotal,
      bonValP, bonValPO, bonValMO, bonCalc,
      bon, totalComBon: comTotal + bonCalc + bon,
    }
  })
}
