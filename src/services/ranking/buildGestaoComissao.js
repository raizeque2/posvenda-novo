import { norm, listaSupervisores } from '../../utils/normalizacao.js'
import { meetsThreshold } from './gestaoPolicy.js'

const CANAL_REAL = {
  tp:         r => r.tp || 0,
  mo:         r => r.moreal || 0,
  pocoficina: r => (r.pocoficina || 0) - (r.devPocoficina || 0),
  web:        r => (r.web || 0) - (r.devWeb || 0),
  televendas: r => (r.televendas || 0) - (r.devTelevendas || 0),
  varejo: r => (r.varejo || 0) - (r.devVarejo || 0),
  atacado: r => (r.atacado || 0) - (r.devAtacado || 0),
}

const CANAL_META = {
  tp:         r => r.mp || 0,
  mo:         r => r.mo || 0,
  pocoficina: r => r.mpo || 0,
  web:        r => r.metaWeb ?? r.mpWeb ?? 0,
  televendas: r => r.metaTelevendas ?? r.mpTelevendas ?? 0,
  varejo:     r => r.metaVarejo ?? r.mpVarejo ?? 0,
  atacado:    r => r.metaAtacado ?? r.mpAtacado ?? 0,
}

/**
 * Calcula comissão de cada gestor a partir do ranking (buildRanking output),
 * da config COMISSAO_GESTAO do mês e dos toggles manuais gravados no Firestore.
 *
 * @param {object[]} ranking        - Output de buildRanking (todos os colaboradores do mês)
 * @param {object[]} gestaoConfig   - regras[mes].gestao ou COMISSAO_GESTAO
 * @param {object}   gestaoManualMes - gestaoManual[mes] = { [nomeNorm]: { [chave]: bool, bonusExtra: number } }
 * @returns {object[]} Um objeto por gestor com breakdown completo
 */
export function buildGestaoComissao(ranking, gestaoConfig, gestaoManualMes = {}) {
  const byNorm = {}
  ranking.forEach(r => { byNorm[norm(r.nome)] = r })

  return gestaoConfig.map(cfg => {
    const nomeNorm = norm(cfg.colaborador)
    const proprio  = byNorm[nomeNorm] || null

    // Mecânicos de cargo nunca entram na equipe do gestor — mas consultores que
    // eventualmente aparecem na coluna técnico do CSV (dupla função) devem entrar.
    const isMecanicoPuro = r => r.ehTecnico && /MECÂN|MECANI|BORRACHEIRO|AUXILIAR.MECA/i.test(r.cargo || '')
    const equipe = ranking.filter(r => {
      if (!r.supervisor || isMecanicoPuro(r)) return false
      return listaSupervisores(r.supervisor).some(s => norm(s) === nomeNorm)
    })

    // baseCalculo 'equipe_mais_propria' inclui o próprio gestor na base de faturamento
    const membros = cfg.baseCalculo === 'equipe_mais_propria'
      ? [...equipe, ...(proprio && !equipe.some(m => norm(m.nome) === nomeNorm) ? [proprio] : [])]
      : equipe

    const canaisBase = cfg.canaisBase || ['tp']

    // Agrega real e meta por canal
    const realPorCanal = {}
    const metaPorCanal = {}
    Object.keys(CANAL_REAL).forEach(c => {
      realPorCanal[c] = membros.reduce((s, r) => s + (CANAL_REAL[c]?.(r) || 0), 0)
      metaPorCanal[c] = cfg.metasCanais?.[c] ?? membros.reduce((s, r) => s + (CANAL_META[c]?.(r) || 0), 0)
    })

    const fatBase     = canaisBase.reduce((s,c)=>s+(realPorCanal[c]||0),0)
    const metaBase = canaisBase.reduce((s,c)=>s+(metaPorCanal[c]||0),0)
    const pctFaturamento = metaBase>0?fatBase/metaBase:null
    const bonusLiberado = cfg.bonusMinimo===undefined || meetsThreshold(pctFaturamento,cfg.bonusMinimo)
    const comissao    = fatBase * (cfg.comissao    || 0) + Math.max(0, Number(gestaoManualMes[nomeNorm]?.comissaoExtra) || 0)
    const bonificacao = bonusLiberado ? fatBase * (cfg.bonificacao || 0) : 0

    // Bônus individuais (somente chefes de oficina têm estes campos)
    const bonusMoPropria     = bonusLiberado && cfg.bonusMoPropria     && proprio ? (proprio.moreal || 0) * cfg.bonusMoPropria     : 0
    const bonusPecasProprias = bonusLiberado && cfg.bonusPecasProprias && proprio ? (proprio.tp     || 0) * cfg.bonusPecasProprias : 0

    // Pcts para indicadores auto
    const totRealMO = membros.reduce((s, r) => s + (r.moreal || 0), 0)
    const totRealP  = membros.reduce((s, r) => s + (r.tp  || 0), 0)

    const pctMO        = metaPorCanal.mo > 0 ? totRealMO / metaPorCanal.mo : null
    const pctP         = metaPorCanal.tp > 0 ? totRealP / metaPorCanal.tp : null
    const pctMOProprio = proprio && (proprio.mo || 0) > 0 ? (proprio.moreal || 0) / proprio.mo : null

    const canalPct=c=>metaPorCanal[c]>0?realPorCanal[c]/metaPorCanal[c]:null
    const pcts   = { pctMO, pctP, pctMOProprio,pctFaturamento,pctVarejo:canalPct('varejo'),pctAtacado:canalPct('atacado'),pctWeb:canalPct('web'),pctTelevendas:canalPct('televendas'),pctPecasOS:canalPct('pocoficina') }
    const manual = gestaoManualMes[nomeNorm] || {}

    let bonusIndicadores = 0
    const indicadores = (cfg.indicadores || []).map(ind => {
      let atingido = false
      if (ind.tipo === 'auto') {
        const pct = pcts[ind.autoKey]
        atingido = meetsThreshold(pct,ind.threshold ?? 1,ind.operador ?? 'gte')
      } else if(ind.tipo==='valor') {
        atingido = meetsThreshold(manual[ind.chave],ind.threshold ?? 0,ind.operador ?? 'gte')
      } else {
        atingido = !!manual[ind.chave]
      }
      const bonus = atingido && bonusLiberado ? fatBase * (ind.pct || 0) : 0
      bonusIndicadores += bonus
      return { ...ind, atingido, bonus,valor:ind.tipo==='auto'?pcts[ind.autoKey]:manual[ind.chave] }
    })

    const bonusExtra = bonusLiberado ? Number(manual.bonusExtra) || 0 : 0
    const total      = comissao + bonificacao + bonusMoPropria + bonusPecasProprias + bonusIndicadores + bonusExtra

    return {
      colaborador: cfg.colaborador,
      nomeNorm,
      cargo:  cfg.cargo  || (proprio?.cargo  || ''),
      lojas:  proprio?.lojas || [],
      equipe,
      equipeSize: equipe.length,
      fatBase,
      metaBase,pctFaturamento,bonusLiberado,bonusMinimo:cfg.bonusMinimo,
      config:cfg,canaisBase,
      realPorCanal:Object.fromEntries(canaisBase.map(c=>[c,realPorCanal[c]])),
      metaPorCanal:Object.fromEntries(canaisBase.map(c=>[c,metaPorCanal[c]])),
      comissaoPct:          cfg.comissao          || 0,
      bonificacaoPct:       cfg.bonificacao        || 0,
      bonusMoPropriaPct:    cfg.bonusMoPropria     || 0,
      bonusPecasPropriaPct: cfg.bonusPecasProprias || 0,
      comissao,
      bonificacao,
      bonusMoPropria,
      bonusPecasProprias,
      ...pcts,
      bonusExtraInformado:Number(manual.bonusExtra)||0,
      indicadores,
      bonusIndicadores,
      bonusExtra,
      total,
    }
  })
}
