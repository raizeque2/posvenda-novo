import { norm } from '../../utils/normalizacao.js'
import { calcProjecao } from '../../utils/datas.js'

export function calcLiquido(fp, cat, diasDec, diasMes) {
  const vendas  = fp.filter(r => r.cat === cat && !r.eDevolucao).reduce((s, r) => s + r.valor, 0)
  const devol   = fp.filter(r => r.cat === cat &&  r.eDevolucao).reduce((s, r) => s + Math.abs(r.valor), 0)
  const liquido = vendas - devol
  const proj    = diasDec > 0 ? (liquido / diasDec) * diasMes : 0
  return { vendas, devol, liquido, proj }
}

export function calcCMV(fp, cat) {
  return fp.reduce((s, r) => r.cat === cat ? s + (r.custo || 0) : s, 0)
}

// Imposto agregado do canal: soma (valor líquido × alíquota da loja do registro).
// r.valor já vem com sinal (devolução negativa), então o resultado é líquido.
// Mesma base do imposto exibido na tabela (liquido × aliqImposto da loja).
export function calcImposto(fp, cat, regras, mesAtivo) {
  const lojasCfg = regras?.[mesAtivo]?.lojas || {}
  return fp.reduce((s, r) => {
    if (r.cat !== cat) return s
    const aliq = lojasCfg[r.empresa]?.aliqImposto || 0
    return s + r.valor * aliq
  }, 0)
}

export function calcMetaPorCanal(rkPecas, canal) {
  const fieldByCanal = { VAREJO: 'mpVarejo', ATACADO: 'mpAtacado', WEB: 'mpWeb', TELEVENDAS: 'mpTelevendas' }
  const field = fieldByCanal[canal]
  if (!field) return 0
  return rkPecas
    .filter(c => c.temMeta && (c[field] || 0) > 0)
    .reduce((s, c) => s + c[field], 0)
}

export function sortPorEficienciaPecas(rows) {
  return [...rows].sort((a, b) => {
    const efA = a.metaCanal > 0 ? a.projCanal / a.metaCanal : null
    const efB = b.metaCanal > 0 ? b.projCanal / b.metaCanal : null
    if (efA === null && efB === null) return b.liq - a.liq
    if (efA === null) return 1
    if (efB === null) return -1
    return efB - efA
  })
}

export function buildCanalRows(rkPecas, canal, liqFn, devFn, custoFn = () => 0, regras, mesAtivo, diasDec, diasMes) {
  const metaFieldByCanal = { VAREJO: 'mpVarejo', ATACADO: 'mpAtacado', WEB: 'mpWeb', TELEVENDAS: 'mpTelevendas' }
  const metaField = metaFieldByCanal[canal]
  const rows = rkPecas
    .filter(c => liqFn(c) + devFn(c) > 0 || devFn(c) > 0 || (c.temMeta && c.canalPrincipal === canal && !c.inativo))
    .map(c => {
      const liq    = liqFn(c)
      const dev    = devFn(c)
      const custo  = custoFn(c)
      const lojaColab  = c.lojas?.[0] || ''
      const aliqImp    = regras?.[mesAtivo]?.lojas?.[lojaColab]?.aliqImposto || 0
      const imposto    = liq * aliqImp
      const receitaLiq = liq - imposto
      const lucroBruto = receitaLiq - custo
      const margem     = receitaLiq !== 0 && (custo !== 0 || aliqImp !== 0) ? lucroBruto / receitaLiq : null
      const temMetaNesteCanal = c.temMeta && metaField && (c[metaField] || 0) > 0
      const metaCanal  = temMetaNesteCanal ? c[metaField] : 0
      const projCanal  = calcProjecao(liq, diasDec, diasMes)
      return { ...c, liq, dev, custo, imposto, lucroBruto, margem, metaCanal, projCanal, temMetaNesteCanal }
    })
  return sortPorEficienciaPecas(rows)
}

export function sortOficinaList(base, { col, dir }, moMap) {
  const fns = {
    proj:      c => c.mo > 0 ? c.projMO / c.mo : (c.moreal > 0 ? -0.001 : -Infinity),
    loja:      c => c.lojas?.[0] || '',
    nome:      c => (c.nome || '').trim(),
    metaMO:    c => c.mo || 0,
    realMO:    c => c.moreal || 0,
    projMO:    c => c.projMOCons ?? c.projMOTec ?? c.projMO ?? 0,
    metaPO:    c => c.mpo || 0,
    realPO:    c => (c.pocoficina || 0) - (c.devPocoficina || 0),
    projPO:    c => c.projPecasOSVend ?? c.projPecasOSTec ?? c.projPecasOS ?? 0,
    passagens: c => c.passagens ?? 0,
    hojeMO:    c => moMap[norm(c.nome)] || 0,
  }
  const fn = fns[col] || fns.proj
  return [...base].sort((a, b) => {
    const va = fn(a), vb = fn(b)
    if (typeof va === 'string') return dir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb)
    return dir === 'desc' ? (vb || 0) - (va || 0) : (va || 0) - (vb || 0)
  })
}

export function addPrintFields(rows, vendaHojeMap) {
  return rows.map(r => {
    const m    = vendaHojeMap[norm(r.nome)] || {}
    const hoje = Object.values(m).reduce((s, v) => s + v, 0)
    const tm   = r.nrReq > 0 ? Math.round(r.liq / r.nrReq) : 0
    return { ...r, hoje, tm }
  })
}

export function mapOficinaRow(r, isConsultor, moHojeMap, diasDec, diasMes) {
  const moreal = isConsultor
    ? (r.morealCons ?? r.moreal ?? 0)
    : (r.morealTec  ?? r.moreal ?? 0)
  const pocoficina = isConsultor
    ? (r.pocoficinaVend ?? r.pocoficina ?? 0) - (r.devPocoficinaVend ?? r.devPocoficina ?? 0)
    : (r.pocoficInaTec  ?? r.pocoficina ?? 0) - (r.devPocoficInaTec  ?? r.devPocoficina ?? 0)
  return {
    nome:      r.nome,
    lojas:     r.lojas || [],
    moreal,
    mo:        isConsultor ? (r.mo || 0) : (!r.ehConsultor && r.mo ? r.mo : 0),
    projMO:    calcProjecao(moreal, diasDec, diasMes),
    pocoficina,
    mpo:       isConsultor ? (r.mpo || 0) : (!r.ehConsultor && r.mpo ? r.mpo : 0),
    projPO:    calcProjecao(pocoficina, diasDec, diasMes),
    passagens: r.passagens ?? 0,
    hoje:      moHojeMap[norm(r.nome)] || 0,
  }
}
