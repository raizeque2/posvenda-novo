import { auth } from '../firebase.js'
import { hasAdminDataAccess } from '../services/authorizedAccess.js'
import { mesAtualStr } from '../utils/datas.js'
import { buildApelidoMap } from '../utils/normalizacao.js'
import { publicarSnapshots as publicarSnapshotsImpl } from '../services/snapshotService.js'
import { carregarTodasConfiguracoes, carregarMesAtualCSV, carregarMesesCSV } from '../services/cloudLoader.js'
import { obterUltimasAtualizacoes } from '../services/cloudStorage.js'
import { inicializarMesesAutomaticos, inicializarColaboradoresAutomatico, limparMesesFuturos, salvarLS, salvarConfigSeguro } from './configSlice.js'

function indexarPorMes(rows) {
  const map = {}
  for (const r of rows) {
    if (!r.mes) continue
    if (!map[r.mes]) map[r.mes] = []
    map[r.mes].push(r)
  }
  return map
}

export function createDadosSlice(set, get) {
  return {
    pecasPorMes:       {},
    oficinaPorMes:     {},
    inconsistencias:   [],
    uploadLog:         [],
    loading:           false,
    loadingHistorico:  false,
    progressoHistorico: 0,
    erroCloud:         null,
    erroCloudDetalhe:  null,
    ultimaImportacao:  null,
    permissoes:        null,
    permissoesCarregadas: false, // evita redirecionar antes de a config de abas chegar
    ultimasAtualizacoes: { pecas: null, oficina: null, estoque: null },
    estoqueCache:      null,

    setEstoqueCache:      (cache) => set({ estoqueCache: cache }),
    setLoading:           (v)     => set({ loading: v }),
    setUltimaImportacao:  (ts)    => set({ ultimaImportacao: ts }),

    addInconsistencias(novas, arquivo) {
      set(s => {
        const atualizadas = [
          ...s.inconsistencias.filter(i => i.arquivo !== arquivo),
          ...novas,
        ]
        hasAdminDataAccess().then(admin => admin && salvarConfigSeguro('inconsistencias', atualizadas)).catch(() => {})
        return { inconsistencias: atualizadas }
      })
    },

    addUploadLog(entry) { set(s => ({ uploadLog: [...s.uploadLog, entry].slice(-20) })) },

    resetDados() {
      set({ pecasPorMes: {}, oficinaPorMes: {}, inconsistencias: [], uploadLog: [] })
    },

    async refreshMesAtual() {
      const sessionUid = auth.currentUser?.uid
      const mes = mesAtualStr()
      try {
        const [{ todasPecas, todaOficina }, atualizacoes] = await Promise.all([
          carregarMesAtualCSV(),
          obterUltimasAtualizacoes().catch(() => null),
        ])
        if (auth.currentUser?.uid !== sessionUid) return
        set(s => ({
          pecasPorMes:   { ...s.pecasPorMes,   [mes]: todasPecas },
          oficinaPorMes: { ...s.oficinaPorMes, [mes]: todaOficina },
          ...(atualizacoes ? { ultimasAtualizacoes: atualizacoes } : {}),
        }))
      } catch {}
    },

    async ressincronizarMeses() {
      const sessionUid = auth.currentUser?.uid
      const mes = mesAtualStr()
      try {
        await get().refreshMesAtual()
        const { todasPecas, todaOficina } = await carregarMesesCSV(() => {})
        if (auth.currentUser?.uid !== sessionUid) return
        if (todasPecas.length > 0 || todaOficina.length > 0) {
          set(s => {
            const novoPM = indexarPorMes(todasPecas.filter(r => r.mes !== mes))
            novoPM[mes]  = s.pecasPorMes[mes]   || []
            const novoOM = indexarPorMes(todaOficina.filter(r => r.mes !== mes))
            novoOM[mes]  = s.oficinaPorMes[mes] || []
            return { pecasPorMes: novoPM, oficinaPorMes: novoOM }
          })
        }
      } catch {}
    },

    async publicarSnapshots() {
      await publicarSnapshotsImpl(get())
    },

    async carregarDadosCloud({ silent = false, _tentativa = 0 } = {}) {
      const sessionUid = auth.currentUser?.uid
      if (!silent) set({ loading: true, erroCloud: null })
      try {
        const [configResult, mesAtualResult, atualizacoes] = await Promise.all([
          carregarTodasConfiguracoes(),
          carregarMesAtualCSV(),
          obterUltimasAtualizacoes().catch(() => ({ pecas: null, oficina: null, estoque: null })),
        ])

        const {
          regrasCloud, bonificacoesCloud, bonAuditCloud, metasCloud, colaboradoresCloud,
          inconsistenciasCloud, gestaoManualCloud, configuracoes, snapshotConfigCloud,
          permissoesCloud, ihsMapeamentoCloud, bonPropostaCloud,
        } = configResult

        if (auth.currentUser?.uid !== sessionUid) return
        const admin = await hasAdminDataAccess()
        const updates = { loading: false, permissoesCarregadas: true }

        if (regrasCloud) {
          const { regras: regrasInit, mudou: mudouInit } = inicializarMesesAutomaticos(regrasCloud)
          const { obj: regrasFinal, mudou: mudouLimp }  = limparMesesFuturos(regrasInit)
          updates.regras = regrasFinal
          salvarLS(regrasFinal)
          if (admin && (mudouInit || mudouLimp)) salvarConfigSeguro('regras', regrasFinal)
        }
        if (permissoesCloud)      updates.permissoes      = permissoesCloud
        if (bonificacoesCloud)    updates.bonificacoes    = bonificacoesCloud
        if (bonAuditCloud)        updates.bonAudit        = bonAuditCloud
        if (bonPropostaCloud)     updates.bonProposta     = bonPropostaCloud
        if (gestaoManualCloud)    updates.gestaoManual    = gestaoManualCloud
        if (inconsistenciasCloud) updates.inconsistencias = inconsistenciasCloud
        if (colaboradoresCloud || metasCloud) {
          const { obj: colabsLimpo, mudou: mudouLimpColabs } = limparMesesFuturos(colaboradoresCloud || {})
          const { obj: metasLimpo,  mudou: mudouLimpMetas  } = limparMesesFuturos(metasCloud || {})

          // Cria o mês atual/seguinte automaticamente se ainda não existir —
          // copia o quadro completo do mês anterior, sem depender de ninguém
          // visitar a tela Colaboradores e salvar manualmente (mesma lógica já
          // usada para regras, ver inicializarMesesAutomaticos).
          const { colaboradores: colaboradoresFinal, metas: metasFinal, mudou: mudouAuto } =
            inicializarColaboradoresAutomatico(colabsLimpo, metasLimpo)

          updates.colaboradoresPorMes = colaboradoresFinal
          updates.metasPorMes         = metasFinal
          updates.apelidoMap          = buildApelidoMap(colaboradoresFinal)

          if (admin && (mudouLimpColabs || mudouAuto)) salvarConfigSeguro('colaboradores', colaboradoresFinal)
          if (admin && (mudouLimpMetas || mudouAuto)) salvarConfigSeguro('metas', metasFinal)
        }
        if (snapshotConfigCloud) {
          updates.snapshotConfig = snapshotConfigCloud
        } else if (!get().snapshotConfig.chaveSecreta && await hasAdminDataAccess()) {
          const chave = crypto.randomUUID().replace(/-/g, '')
          const cfg = { ...get().snapshotConfig, chaveSecreta: chave }
          updates.snapshotConfig = cfg
          salvarConfigSeguro('snapshotConfig', cfg)
        }
        if (configuracoes.regra_pecas)         updates.regraPecas          = configuracoes.regra_pecas
        if (configuracoes.regra_oficina)        updates.regraOficina        = configuracoes.regra_oficina
        if (configuracoes.lojas)               updates.lojas                = configuracoes.lojas
        if (configuracoes.comissao_operacional) updates.comissaoOperacional  = configuracoes.comissao_operacional
        if (configuracoes.comissao_gestao)      updates.comissaoGestao       = configuracoes.comissao_gestao
        if (ihsMapeamentoCloud) {
          const base = get().ihsMapeamento
          const merged = { ...base, ...ihsMapeamentoCloud }
          for (const key of Object.keys(base)) {
            if (merged[key] && typeof merged[key] === 'object' && Object.keys(merged[key]).length === 0) {
              merged[key] = base[key]
            }
          }
          updates.ihsMapeamento = merged
        }

        updates.pecasPorMes         = indexarPorMes(mesAtualResult.todasPecas)
        updates.oficinaPorMes       = indexarPorMes(mesAtualResult.todaOficina)
        updates.ultimasAtualizacoes = atualizacoes
        set(updates)

        set({ loadingHistorico: true, progressoHistorico: 0 })
        carregarMesesCSV((progresso) => {
          set({ progressoHistorico: progresso })
        }).then(({ todasPecas, todaOficina }) => {
          if (auth.currentUser?.uid !== sessionUid) return
          if (todasPecas.length > 0 || todaOficina.length > 0) {
            const mes = mesAtualStr()
            set(s => {
              const novoPM = indexarPorMes(todasPecas.filter(r => r.mes !== mes))
              novoPM[mes]  = s.pecasPorMes[mes]   || []
              const novoOM = indexarPorMes(todaOficina.filter(r => r.mes !== mes))
              novoOM[mes]  = s.oficinaPorMes[mes] || []
              return { pecasPorMes: novoPM, oficinaPorMes: novoOM }
            })
            get().publicarSnapshots().catch(() => {})
          }
        }).catch(() => {}).finally(() => {
          set({ loadingHistorico: false, progressoHistorico: 100 })
        })

      } catch (e) {
        if (auth.currentUser?.uid !== sessionUid) return
        console.error('Erro ao carregar dados da nuvem:', e)
        // No localhost/desenvolvimento sem Firebase Cloud, não interrompe a tela com erro bloqueante
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (isLocal) {
          set({ loading: false, erroCloud: null, erroCloudDetalhe: null });
          return;
        }
        if (_tentativa < 2) {
          await new Promise(r => setTimeout(r, 1500))
          return get().carregarDadosCloud({ silent, _tentativa: _tentativa + 1 })
        }
        set({
          loading: false,
          erroCloud: 'Não foi possível conectar ao servidor. Verifique sua internet e recarregue a página.',
          erroCloudDetalhe: String(e?.message || e || 'erro desconhecido'),
        })
      }
    },
  }
}
