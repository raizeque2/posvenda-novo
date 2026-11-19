import { norm, listaSupervisores } from '../../utils/normalizacao.js'

export const CANAIS_PECAS = new Set(['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS'])

export function titleCase(nome) {
  const stop = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  return nome.toLowerCase().split(/\s+/).map((w, i) =>
    i > 0 && stop.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ')
}

export function pctColor(v) {
  if (v === null || v === undefined) return 'var(--text3)'
  if (v >= 1.0) return 'var(--green)'
  if (v >= 0.9) return 'var(--green)'
  if (v >= 0.7) return 'var(--amber)'
  return 'var(--honda)'
}

export function fazPecasFn(m) {
  const canais = (m.cargoMovimento || '').split(';').map(s => s.trim()).filter(Boolean)
  return canais.length === 0 || canais.some(ch => CANAIS_PECAS.has(ch))
}

export function fazOSFn(m) {
  const canais = (m.cargoMovimento || '').split(';').map(s => s.trim()).filter(Boolean)
  return canais.length === 0 || canais.includes('OS')
}

export function sortEquipes(equipes, criterio) {
  return [...equipes].sort((a, b) => {
    if (criterio === 'alpha') return a.supervisor.localeCompare(b.supervisor)
    const melhorPct = e => {
      const vals = [
        e.metaP   > 0 ? e.pctP   : null,
        e.metaMO  > 0 ? e.pctMO  : null,
        e.metaMPO > 0 ? e.pctMPO : null,
      ].filter(v => v !== null)
      return vals.length ? Math.max(...vals) : -1
    }
    return melhorPct(b) - melhorPct(a)
  })
}

export function buildEquipes(rankings, comissaoGestao, diasDec) {
  const map = {}

  rankings.filter(c => !c.inativo && (c.temMeta || (c.supervisor && (c.tp > 0 || c.to > 0)))).forEach(c => {
    if (!c.supervisor) return
    const fP    = fazPecasFn(c)
    const fO    = fazOSFn(c)
    const isMec = c.ehTecnico === true && /MECÂN|MECANI|BORRACHEIRO|AUXILIAR.MECA/i.test(c.cargo || '')

    listaSupervisores(c.supervisor).forEach(sup => {
      if (!map[sup]) {
        map[sup] = {
          supervisor: sup, membros: [],
          metaP: 0, tp: 0, projP: 0,
          metaMO: 0, realMO: 0, projMO: 0,
          metaMPO: 0, realMPO: 0, projMPO: 0,
          lojas: new Set(),
        }
      }
      const e = map[sup]
      e.membros.push(c)
      if (!isMec) {
        if (fP) { e.metaP += c.mp || 0; e.tp += c.tp || 0; e.projP += c.projP || 0 }
        if (fO) {
          e.metaMO  += c.mo     || 0; e.realMO  += c.moreal || 0; e.projMO  += c.projMO || 0
          e.metaMPO += c.mpo    || 0
          e.realMPO += (c.pocoficina - (c.devPocoficina || 0)) || 0
          e.projMPO += c.projPecasOS || 0
        }
      }
      c.lojas.forEach(l => e.lojas.add(l))
    })
  })

  return Object.values(map).map(e => {
    const gestao = comissaoGestao.find(g => norm(g.colaborador) === norm(e.supervisor))
    const cp = gestao?.cp || 0; const cpo = gestao?.cpo || 0; const cmo = gestao?.cmo || 0

    const lojaMap = {}
    e.membros.forEach(m => {
      const lojaKey = m.lojas[0] || '–'
      if (!lojaMap[lojaKey]) lojaMap[lojaKey] = { loja: lojaKey, membros: [], mecanicos: [], metaP: 0, tp: 0, metaMO: 0, realMO: 0, metaMPO: 0, realMPO: 0 }
      const lj = lojaMap[lojaKey]
      const isMecLoja = m.ehTecnico === true
      if (isMecLoja) {
        lj.mecanicos.push(m)
      } else {
        lj.membros.push(m)
        if (fazPecasFn(m)) { lj.metaP += m.mp || 0; lj.tp += m.tp || 0 }
        if (fazOSFn(m)) {
          lj.metaMO  += m.mo  || 0; lj.realMO  += m.moreal || 0
          lj.metaMPO += m.mpo || 0; lj.realMPO += (m.pocoficina - (m.devPocoficina || 0)) || 0
        }
      }
    })

    return {
      ...e,
      lojas: [...e.lojas].sort(),
      cp, cpo, cmo,
      comissao:   e.tp * cp + e.realMPO * cpo + e.realMO * cmo,
      pctP:       e.metaP   > 0 ? e.tp      / e.metaP   : null,
      pctMO:      e.metaMO  > 0 ? e.realMO  / e.metaMO  : null,
      pctMPO:     e.metaMPO > 0 ? e.realMPO / e.metaMPO : null,
      projPctP:   e.metaP   > 0 ? e.projP   / e.metaP   : null,
      projPctMO:  e.metaMO  > 0 ? e.projMO  / e.metaMO  : null,
      projPctMPO: e.metaMPO > 0 ? e.projMPO / e.metaMPO : null,
      porLoja: Object.values(lojaMap).sort((a, b) => a.loja.localeCompare(b.loja)),
    }
  })
}
