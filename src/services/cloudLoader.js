import { hasAdminDataAccess, authorizedConfigs } from './authorizedAccess.js'
import { carregarConfig, carregarConfiguracoes, carregarMesesDisponiveis, registrarMesesDisponiveis, carregarBonificacoes } from './firestoreService.js'
import { carregarDadosStorage, listarMesesStorage, pegarTsStorage } from './cloudStorage.js'
import { mesAtualStr, normalizarMes, sortMesAno, dtFromISO } from '../utils/datas.js'
import { auth } from '../firebase.js'

// ── IndexedDB cache ───────────────────────────────────────────────────────────
const DB_NAME    = import.meta.env?.MODE === 'preview' ? 'posvenda_preview_cache' : 'posvenda_cache'
const DB_VERSION = 1
const STORE_NAME = 'meses'

const FETCH_TIMEOUT_MS = 30000

let _dbPromise = null
function abrirDB() {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME)
      req.onsuccess  = e => {
        const db = e.target.result
        // Se a conexão fechar ou for invalidada (ex.: outra aba, limpar dados),
        // descarta o singleton para reabrir uma conexão limpa na próxima vez.
        db.onclose = () => { _dbPromise = null }
        db.onversionchange = () => { try { db.close() } catch {} _dbPromise = null }
        resolve(db)
      }
      req.onerror    = () => { _dbPromise = null; reject(req.error) }
    })
  }
  return _dbPromise
}

function dbKey(tipo, mes) {
  return `${auth.currentUser?.uid || 'guest'}_${tipo}_${mes.replace('/', '-')}`
}

// Protetor central de IndexedDB. O cache é só uma OTIMIZAÇÃO — qualquer falha
// (inclusive o erro SÍNCRONO "database connection is closing" que o db.transaction()
// lança quando a conexão está fechando) degrada para undefined em vez de derrubar
// o app. Reseta a conexão para reabrir limpa na próxima chamada.
function comDB(fn) {
  return abrirDB()
    .then(db => new Promise(resolve => {
      try {
        fn(db, resolve)
      } catch {
        _dbPromise = null
        resolve(undefined)
      }
    }))
    .catch(() => { _dbPromise = null; return undefined })
}

// storageTsAtual: timestamp (ms) do arquivo no Storage.
// Se fornecido e o cache foi gravado com um storageTs menor, o cache é rejeitado —
// significa que o Storage foi atualizado depois que cacheamos.
async function lerMesCache(tipo, mes, aceitarVencido = false, storageTsAtual = null, alteracaoTs = null) {
  if (!await hasAdminDataAccess()) return null
  const r = await comDB((db, resolve) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(dbKey(tipo, mes))
    req.onsuccess = () => {
      const val = req.result
      if (!val) return resolve(null)
      // Storage foi atualizado depois deste cache → descarta
      if (storageTsAtual && val.storageTs && storageTsAtual > val.storageTs) return resolve(null)
      // Firestore registrou alteração (ex.: upload retroativo) depois deste cache → descarta
      if (!aceitarVencido && alteracaoTs && (val.ts || 0) < alteracaoTs) return resolve(null)
      // Meses passados: cache PERMANENTE (não expira). Meses fechados nunca mudam.
      // A validade é controlada só pelo storageTs e pela alteração registrada acima.
      resolve(val.rows.map(r => ({ ...r, dt: dtFromISO(r.dt) })))
    }
    req.onerror = () => resolve(null)
  })
  return r === undefined ? null : r
}

async function salvarMesCache(tipo, mes, rows, passado, storageTs = null) {
  if (!await hasAdminDataAccess()) return
  const serialized = rows.map(r => ({
    ...r,
    dt: r.dt instanceof Date ? r.dt.toISOString() : r.dt,
  }))
  await comDB((db, resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ ts: Date.now(), passado, storageTs, rows: serialized }, dbKey(tipo, mes))
    tx.oncomplete = () => resolve()
    tx.onerror    = () => resolve()
  })
}

export async function invalidarCacheMeses() {
  await comDB((db, resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror    = () => resolve()
  })
}

// Invalida apenas UM mês (peças + oficina) — usado em uploads, preservando
// todo o resto do cache. Meses fechados continuam servidos do cache.
export async function invalidarCacheMes(mes) {
  await comDB((db, resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.delete(dbKey('pecas',   mes))
    store.delete(dbKey('oficina', mes))
    tx.oncomplete = () => resolve()
    tx.onerror    = () => resolve()
  })
}

function comTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
}

// ── Configurações ─────────────────────────────────────────────────────────────

export async function carregarTodasConfiguracoes() {
  // Conta não-admin: uma chamada só devolve toda a configuração já filtrada
  // pelo escopo do perfil (antes eram 11 chamadas, cada uma relendo as mesmas
  // coleções no servidor).
  let admin = true
  try { admin = await hasAdminDataAccess() } catch { admin = true }
  if (!admin) {
    const [configs, bonsCloud] = await Promise.all([
      authorizedConfigs(['regras', 'metas', 'colaboradores', 'gestaoManual', 'permissoes', 'ihs_mapeamento', 'regra_pecas', 'regra_oficina', 'lojas', 'comissao_operacional', 'comissao_gestao']),
      carregarBonificacoes(),
    ])
    return {
      regrasCloud: configs.regras ?? null,
      bonificacoesCloud: bonsCloud.bonificacoes,
      bonAuditCloud: bonsCloud.bonAudit,
      metasCloud: configs.metas ?? null,
      colaboradoresCloud: configs.colaboradores ?? null,
      inconsistenciasCloud: null,
      gestaoManualCloud: configs.gestaoManual ?? null,
      configuracoes: {
        regra_pecas: configs.regra_pecas ?? null,
        regra_oficina: configs.regra_oficina ?? null,
        lojas: configs.lojas ?? null,
        comissao_operacional: configs.comissao_operacional ?? null,
        comissao_gestao: configs.comissao_gestao ?? null,
      },
      snapshotConfigCloud: null,
      permissoesCloud: configs.permissoes ?? null,
      ihsMapeamentoCloud: configs.ihs_mapeamento ?? null,
      bonPropostaCloud: null,
    }
  }
  const [
    regrasCloud, bonsCloud, metasCloud, colaboradoresCloud,
    inconsistenciasCloud, gestaoManualCloud, configuracoes, snapshotConfigCloud,
    permissoesCloud, ihsMapeamentoCloud, bonPropostaCloud,
  ] = await Promise.all([
    carregarConfig('regras'),
    carregarBonificacoes(), // { bonificacoes, bonAudit } — coleção nova, 1 doc por pessoa+mês
    carregarConfig('metas'),
    carregarConfig('colaboradores'),
    carregarConfig('inconsistencias'),
    carregarConfig('gestaoManual'),
    carregarConfiguracoes(),
    carregarConfig('snapshotConfig'),
    carregarConfig('permissoes'),
    carregarConfig('ihs_mapeamento'),
    carregarConfig('bonProposta'),
  ])

  return {
    regrasCloud, bonificacoesCloud: bonsCloud.bonificacoes, bonAuditCloud: bonsCloud.bonAudit,
    metasCloud, colaboradoresCloud,
    inconsistenciasCloud, gestaoManualCloud, configuracoes, snapshotConfigCloud,
    permissoesCloud, ihsMapeamentoCloud, bonPropostaCloud,
  }
}

// ── Mês atual ─────────────────────────────────────────────────────────────────
// Verifica o timestamp do arquivo no Storage ANTES de usar o cache.
// Se o Storage foi atualizado (pelo robô ou por outro dispositivo), o cache é
// descartado e os dados são buscados frescos. 2 getMetadata paralelos — leve.

export async function carregarMesAtualCSV() {
  const mes = mesAtualStr()

  const [storageTsP, storageTsO] = await Promise.all([
    pegarTsStorage('pecas',   mes).catch(() => null),
    pegarTsStorage('oficina', mes).catch(() => null),
  ])

  let p = await lerMesCache('pecas',   mes, false, storageTsP)
  let o = await lerMesCache('oficina', mes, false, storageTsO)

  const [pFresh, oFresh] = await Promise.all([
    !p ? comTimeout(carregarDadosStorage('pecas',   mes), FETCH_TIMEOUT_MS).catch(() => null) : null,
    !o ? comTimeout(carregarDadosStorage('oficina', mes), FETCH_TIMEOUT_MS).catch(() => null) : null,
  ])

  if (!p && pFresh) { p = pFresh; salvarMesCache('pecas',   mes, pFresh, false, storageTsP) }
  if (!o && oFresh) { o = oFresh; salvarMesCache('oficina', mes, oFresh, false, storageTsO) }

  // Retry automático: se ambos voltaram vazios mas há timestamps no Storage,
  // aguarda 2s e tenta de novo (pode ocorrer logo após um upload)
  if ((!p || p.length === 0) && (!o || o.length === 0) && (storageTsP || storageTsO)) {
    await new Promise(r => setTimeout(r, 2000))
    const [pR, oR] = await Promise.all([
      comTimeout(carregarDadosStorage('pecas',   mes), FETCH_TIMEOUT_MS).catch(() => null),
      comTimeout(carregarDadosStorage('oficina', mes), FETCH_TIMEOUT_MS).catch(() => null),
    ])
    if (!p && pR) { p = pR; salvarMesCache('pecas',   mes, pR, false, storageTsP) }
    if (!o && oR) { o = oR; salvarMesCache('oficina', mes, oR, false, storageTsO) }
  }

  return { todasPecas: p || [], todaOficina: o || [] }
}

// ── Histórico completo (todos os meses) ───────────────────────────────────────
// Meses passados são imutáveis: uma vez no cache, servidos para sempre sem rede.
// Só voltam a ser baixados se o Firestore registrar uma alteração (upload retroativo)
// com timestamp mais novo que o cache local.

export async function carregarMesesCSV(onProgresso) {
  const mesAtual = mesAtualStr()

  let disponiveis = await carregarMesesDisponiveis()
  if (!disponiveis) {
    try {
      const [mesesPecas, mesesOficina] = await Promise.all([
        comTimeout(listarMesesStorage('pecas'),   FETCH_TIMEOUT_MS).catch(() => []),
        comTimeout(listarMesesStorage('oficina'), FETCH_TIMEOUT_MS).catch(() => []),
      ])
      if (mesesPecas.length > 0)   await registrarMesesDisponiveis('pecas',   mesesPecas)
      if (mesesOficina.length > 0) await registrarMesesDisponiveis('oficina', mesesOficina)
      disponiveis = await carregarMesesDisponiveis()
    } catch {}
    if (!disponiveis) return { todasPecas: [], todaOficina: [] }
  }

  // Normaliza toda chave de mês para o formato canônico "MM/YYYY" ANTES de deduplicar.
  // Sem isso, o mesmo mês em formatos diferentes ("06/2026" vs "2026/06") escapa do Set
  // e é carregado duas vezes, dobrando os valores. Blindagem definitiva.
  const todosMeses = [...new Set(
    [...(disponiveis.pecas || []), ...(disponiveis.oficina || [])].map(normalizarMes)
  )].sort(sortMesAno)
  const alteracoes = {}
  for (const [k, v] of Object.entries(disponiveis.alteracoes || {})) {
    const nk = normalizarMes(k)
    if (!(nk in alteracoes) || v > alteracoes[nk]) alteracoes[nk] = v
  }
  const total = todosMeses.length

  const LOTE = 12
  const todasPecas  = []
  const todaOficina = []
  let carregados = 0

  for (let i = 0; i < todosMeses.length; i += LOTE) {
    const lote = todosMeses.slice(i, i + LOTE)
    const resultados = await Promise.all(lote.map(async (mes) => {
      const passado = mes !== mesAtual

      // Mês atual: já foi carregado fresco por carregarMesAtualCSV — usa cache direto
      // Meses passados: cache permanente; só refaz se houver alteração registrada
      // no Firestore (upload retroativo) mais nova que o cache local.
      const altTs = alteracoes[mes] || null
      let p = await lerMesCache('pecas',   mes, false, null, altTs)
      let o = await lerMesCache('oficina', mes, false, null, altTs)

      const pStale = !p ? await lerMesCache('pecas',   mes, true, null) : null
      const oStale = !o ? await lerMesCache('oficina', mes, true, null) : null

      if (!p || !o) {
        const [pFresh, oFresh] = await Promise.all([
          (!p) ? comTimeout(carregarDadosStorage('pecas',   mes), FETCH_TIMEOUT_MS).catch(() => null) : null,
          (!o) ? comTimeout(carregarDadosStorage('oficina', mes), FETCH_TIMEOUT_MS).catch(() => null) : null,
        ])
        if (!p && pFresh) { p = pFresh; salvarMesCache('pecas',   mes, pFresh, passado, null) }
        if (!o && oFresh) { o = oFresh; salvarMesCache('oficina', mes, oFresh, passado, null) }
      }

      return { p: p || pStale, o: o || oStale }
    }))

    for (const { p, o } of resultados) {
      if (p) for (const r of p) todasPecas.push(r)
      if (o) for (const r of o) todaOficina.push(r)
    }
    carregados += lote.length
    if (onProgresso && total > 0) onProgresso(Math.round((carregados / total) * 100))
  }

  return { todasPecas, todaOficina }
}
