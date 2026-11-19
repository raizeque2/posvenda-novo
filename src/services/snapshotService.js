import { mesAtualStr, feriadosPorUF, diasUteisMes, diasUteisDecorridos } from '../utils/datas.js'
import { buildRanking } from './ranking/buildRanking.js'
import { gerarToken } from '../utils/snapshot.js'
import { salvarSnapshot } from './firestoreService.js'
import { norm, resolveNome } from '../utils/normalizacao.js'

const SLOTS = [
  { key: 'PE-pecas',   est: 'PE', tipo: 'pecas'   },
  { key: 'PE-oficina', est: 'PE', tipo: 'oficina'  },
  { key: 'AL-pecas',   est: 'AL', tipo: 'pecas'    },
  { key: 'AL-oficina', est: 'AL', tipo: 'oficina'  },
]

export async function publicarSnapshots({
  pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, bonificacoes,
  apelidoMap, lojas, comissaoOperacional, comissaoGestao, snapshotConfig, regras,
}) {
  const mesAtivo = mesAtualStr()
  const hoje = new Date()
  const [mesNum, anoNum] = mesAtivo.split('/').map(Number)

  for (const slot of SLOTS) {
    try {
      const slotCfg = snapshotConfig.configs?.[slot.key]
      if (slotCfg?.ativo === false) continue

      const pecasMes   = pecasPorMes[mesAtivo]   || []
      const oficinaMes = oficinaPorMes[mesAtivo] || []

      let tMaxP = -Infinity
      for (const r of pecasMes)   { if (lojas[r.empresa]?.uf === slot.est && r.dt instanceof Date) { const t = r.dt.getTime(); if (t > tMaxP) tMaxP = t } }
      let tMaxO = -Infinity
      for (const r of oficinaMes) { if (lojas[r.empresa]?.uf === slot.est && r.dt instanceof Date) { const t = r.dt.getTime(); if (t > tMaxO) tMaxO = t } }

      const dataMaxPecas   = tMaxP > -Infinity ? new Date(tMaxP) : null
      const dataMaxOficina = tMaxO > -Infinity ? new Date(tMaxO) : null
      const dataMax = dataMaxPecas && dataMaxOficina
        ? (tMaxP >= tMaxO ? dataMaxPecas : dataMaxOficina)
        : (dataMaxPecas || dataMaxOficina || hoje)

      const dataAtualizacao = (dataMaxPecas || dataMaxOficina)
        ? dataMax.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '–'

      const feriados = feriadosPorUF(slot.est, anoNum)
      const diasMes  = diasUteisMes(anoNum, mesNum, feriados)
      const diasDec  = diasUteisDecorridos(anoNum, mesNum, dataMax, feriados)
      const pr = v => diasDec > 0 ? (v / diasDec) * diasMes : 0

      const ranking = buildRanking(
        pecasMes, oficinaMes, mesAtivo, colaboradoresPorMes, metasPorMes, bonificacoes,
        diasDec, diasMes, apelidoMap,
        comissaoOperacional, regras[mesAtivo]?.gestao || comissaoGestao, [], slot.est
      )

      const chaveSlot = snapshotConfig.configs?.[slot.key]?.chaveOverride || snapshotConfig.chaveSecreta
      const token = await gerarToken(chaveSlot, slot.est, slot.tipo)

      let snapData

      if (slot.tipo === 'pecas') {
        const hojeStr = (dataMaxPecas || hoje).toDateString()
        const vendaHojeMap = {}
        const CATS = new Set(['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS'])
        const hojeRecs = pecasMes.filter(r => r.dt instanceof Date && r.dt.toDateString() === hojeStr
            && lojas[r.empresa]?.uf === slot.est && !r.eDevolucao && r.responsavel && CATS.has(r.cat))
        hojeRecs.forEach(r => {
            const k = norm(resolveNome(r.responsavel, apelidoMap) || r.responsavel)
            vendaHojeMap[k] = (vendaHojeMap[k] || 0) + (r.valor || 0)
          })

        const rkP = ranking.filter(c => (c.tpBruto || 0) > 0 || (c.mp || 0) > 0 || (c.devTotal || 0) > 0)

        const META_FIELD = { VAREJO: 'mpVarejo', ATACADO: 'mpAtacado', WEB: 'mpWeb', TELEVENDAS: 'mpTelevendas' }

        const calcKpiReal = cat => {
          const vendas = pecasMes.filter(r => lojas[r.empresa]?.uf === slot.est && r.cat === cat && !r.eDevolucao).reduce((s, r) => s + (r.valor || 0), 0)
          const devol  = pecasMes.filter(r => lojas[r.empresa]?.uf === slot.est && r.cat === cat &&  r.eDevolucao).reduce((s, r) => s + Math.abs(r.valor || 0), 0)
          return vendas - devol
        }

        const buildKpi = cat => {
          const metaField = META_FIELD[cat]
          const real = calcKpiReal(cat)
          const meta = rkP.filter(c => metaField && (c[metaField] || 0) > 0).reduce((s, c) => s + (c[metaField] || 0), 0)
          const hj   = rkP.filter(c => metaField && (c[metaField] || 0) > 0).reduce((s, c) => s + (vendaHojeMap[c.nomeNorm] || 0), 0)
          return { label: cat, real, meta, proj: pr(real), hoje: hj }
        }

        const kpiV = buildKpi('VAREJO')
        const kpiA = buildKpi('ATACADO')
        const kpiW = buildKpi('WEB')
        const kpiT = buildKpi('TELEVENDAS')
        const kpis = [
          kpiV, kpiW, kpiT, kpiA,
          {
            label: 'Total Peças',
            real:  kpiV.real  + kpiA.real  + kpiW.real  + kpiT.real,
            meta:  kpiV.meta  + kpiA.meta  + kpiW.meta  + kpiT.meta,
            proj:  pr(kpiV.real + kpiA.real + kpiW.real + kpiT.real),
            hoje:  kpiV.hoje  + kpiA.hoje  + kpiW.hoje  + kpiT.hoje,
          },
        ].filter(k => k.real > 0 || k.meta > 0)

        const buildCanal = (cat, realFn, grossFn, devFn) => {
          const metaField = META_FIELD[cat]
          return rkP
            .filter(c => grossFn(c) > 0 || devFn(c) > 0 || (metaField && (c[metaField] || 0) > 0 && !c.inativo))
            .sort((a, b) => pr(realFn(b)) - pr(realFn(a)))
            .map(c => ({
              nome: c.nome, lojas: c.lojas || [],
              real: realFn(c),
              meta: metaField ? (c[metaField] || 0) : 0,
              proj: pr(realFn(c)),
              hoje: vendaHojeMap[c.nomeNorm] || 0,
              tm:   c.nrReq > 0 ? Math.round(realFn(c) / c.nrReq) : 0,
            }))
        }

        // Margem por canal no padrão contábil (DRE), igual ao dashboard:
        // margem = (Receita Líquida − CMV) / Receita Líquida, com Receita Líquida = Venda − Imposto.
        const buildCanalComMargem = (cat, realFn, grossFn, devFn, custoFn) => {
          const metaField = META_FIELD[cat]
          return rkP
            .filter(c => grossFn(c) > 0 || devFn(c) > 0 || (metaField && (c[metaField] || 0) > 0 && !c.inativo))
            .sort((a, b) => {
              const metaA = metaField ? (a[metaField] || 0) : 0
              const metaB = metaField ? (b[metaField] || 0) : 0
              const efA = metaA > 0 ? pr(realFn(a)) / metaA : null
              const efB = metaB > 0 ? pr(realFn(b)) / metaB : null
              if (efA === null && efB === null) return realFn(b) - realFn(a)
              if (efA === null) return 1
              if (efB === null) return -1
              return efB - efA
            })
            .map(c => {
              const liq        = realFn(c)
              const aliq       = regras?.[mesAtivo]?.lojas?.[c.lojas?.[0]]?.aliqImposto || 0
              const receitaLiq = liq - liq * aliq
              const custo      = custoFn(c)
              const margem     = receitaLiq > 0 && (custo !== 0 || aliq !== 0) ? (receitaLiq - custo) / receitaLiq : null
              return {
                nome: c.nome, lojas: c.lojas || [],
                real: liq,
                meta: metaField ? (c[metaField] || 0) : 0,
                proj: pr(liq),
                hoje: vendaHojeMap[c.nomeNorm] || 0,
                tm:   c.nrReq > 0 ? Math.round(liq / c.nrReq) : 0,
                margem,
              }
            })
        }

        snapData = {
          tipo: 'pecas',
          kpis,
          canais: {
            VAREJO:     buildCanalComMargem('VAREJO',     c => (c.varejo     || 0) - (c.devVarejo     || 0), c => c.varejo     || 0, c => c.devVarejo     || 0, c => c.custoVarejo     || 0),
            ATACADO:    buildCanalComMargem('ATACADO',    c => (c.atacado    || 0) - (c.devAtacado    || 0), c => c.atacado    || 0, c => c.devAtacado    || 0, c => c.custoAtacado    || 0),
            WEB:        buildCanalComMargem('WEB',        c => (c.web        || 0) - (c.devWeb        || 0), c => c.web        || 0, c => c.devWeb        || 0, c => c.custoWeb        || 0),
            TELEVENDAS: buildCanalComMargem('TELEVENDAS', c => (c.televendas || 0) - (c.devTelevendas || 0), c => c.televendas || 0, c => c.devTelevendas || 0, c => c.custoTelevendas || 0),
          },
        }
      } else {
        const hojeStr = (dataMaxOficina || hoje).toDateString()
        const moHojeMap = {}
        oficinaMes
          .filter(r => r.dt instanceof Date && r.dt.toDateString() === hojeStr && lojas[r.empresa]?.uf === slot.est)
          .forEach(r => {
            if (r.consultor) { const k = norm(resolveNome(r.consultor, apelidoMap) || r.consultor); moHojeMap[k] = (moHojeMap[k] || 0) + (r.mo || 0) }
            if (r.tecnico)   { const k = norm(resolveNome(r.tecnico,   apelidoMap) || r.tecnico);   moHojeMap[k] = (moHojeMap[k] || 0) + (r.mo || 0) }
          })

        const consultores = ranking.filter(c => c.ehConsultor)
        const mecanicos   = ranking.filter(c => c.ehTecnico)
        const moReal  = consultores.reduce((s, c) => s + (c.morealCons ?? c.moreal ?? 0), 0)
        const moMeta  = consultores.reduce((s, c) => s + (c.mo || 0), 0)
        const pcoReal = consultores.reduce((s, c) => s + (c.pocoficina || 0) - (c.devPocoficina || 0), 0)
        const pcoMeta = consultores.reduce((s, c) => s + (c.mpo || 0), 0)
        const moHojeTot = consultores.reduce((s, c) => s + (moHojeMap[norm(c.nome)] || 0), 0)

        const mapOfi = c => ({
          nome: c.nome, lojas: c.lojas || [],
          moreal: c.moreal || 0, mo: c.mo || 0,
          pocoficina: (c.pocoficina || 0) - (c.devPocoficina || 0),
          mpo: c.mpo || 0,
          projMO: pr(c.moreal || 0),
          projPO: pr((c.pocoficina || 0) - (c.devPocoficina || 0)),
          passagens: c.passagens ?? 0,
          hoje: moHojeMap[norm(c.nome)] || 0,
        })

        snapData = {
          tipo: 'oficina',
          kpis: [
            { label: 'Peças OS',    real: pcoReal, meta: pcoMeta, proj: pr(pcoReal) },
            { label: 'Mão de Obra', real: moReal,  meta: moMeta,  proj: pr(moReal), hoje: moHojeTot },
          ],
          consultores: consultores.sort((a, b) => {
            const efA = a.eficienciaMOCons ?? a.eficienciaMO
            const efB = b.eficienciaMOCons ?? b.eficienciaMO
            if (efA === null && efB === null) return (b.morealCons ?? b.moreal ?? 0) - (a.morealCons ?? a.moreal ?? 0)
            if (efA === null) return 1
            if (efB === null) return -1
            return efB - efA
          }).map(mapOfi),
          mecanicos: mecanicos.sort((a, b) => {
            const efA = a.eficienciaMOTec ?? a.eficienciaMO
            const efB = b.eficienciaMOTec ?? b.eficienciaMO
            if (efA === null && efB === null) return (b.morealTec ?? b.moreal ?? 0) - (a.morealTec ?? a.moreal ?? 0)
            if (efA === null) return 1
            if (efB === null) return -1
            return efB - efA
          }).map(mapOfi),
        }
      }

      await salvarSnapshot(slot.key, {
        token, mes: mesAtivo, diasMes, diasDec,
        dataAtualizacao, dataRef: dataMax.toISOString(),
        ts: Date.now(),
        ...snapData,
      })
    } catch (e) {
      console.error('Erro ao publicar snapshot', slot.key, e)
      throw new Error(`Falha ao salvar ${slot.key}: ${e?.message || e}`)
    }
  }
}
