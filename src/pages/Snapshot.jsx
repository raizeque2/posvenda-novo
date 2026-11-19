import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { fmtBRL, nomeAbrev } from '../utils/formatacao.js'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'
import { KpiCard, StatusBadge, LojaTags, getStatus, LoadingPage } from '../components/DS.jsx'
import { diasUteisMes, diasUteisDecorridos, feriadosPorUF } from '../utils/datas.js'
import { Inbox, KeyRound, TriangleAlert } from '../icons/iconoir'
import { snapshotAchievement, snapshotPeople } from '../analytics/snapshot.js'

const ESTADO_NOME = { PE: 'Pernambuco', AL: 'Alagoas' }
const TIPO_NOME   = { pecas: 'Peças', oficina: 'Oficina' }

export default function Snapshot() {
  const { estado, tipo, token } = useParams()
  const EST  = estado?.toUpperCase()
  const TIPO = tipo?.toLowerCase()

  const [fase, setFase]   = useState('validando')
  const [dados, setDados] = useState(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setFase('validando')
    async function checar() {
      try {
        const { data: snap } = await httpsCallable(functions, 'portalSnapshot')({ estado: EST, tipo: TIPO, token })
        if (!active) return
        if (!snap) { setFase('vazio'); return }
        setDados(snap)
        setFase('ok')
      } catch (e) {
        if (!active) return
        setFase(e.code === 'functions/permission-denied' ? 'token' : 'erro')
      }
    }
    checar()
    return () => { active = false }
  }, [EST, TIPO, token, retry])

  if (fase === 'validando') return <LoadingPage msg="Verificando acesso…" />

  if (fase === 'vazio') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg)' }}>
      <Inbox size={40} strokeWidth={1.5} style={{ color: 'var(--text3)' }} />
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text)' }}>Snapshot não encontrado</div>
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text3)' }}>O administrador precisa clicar em "Publicar snapshots agora".</div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontFamily: 'monospace', marginTop: 4 }}>doc: {EST}-{TIPO}</div>
    </div>
  )

  if (fase === 'token') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg)' }}>
      <KeyRound size={40} strokeWidth={1.5} style={{ color: 'var(--text3)' }} />
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text)' }}>Token inválido</div>
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text3)' }}>Este link está inválido, revogado ou expirado. Peça um endereço atualizado ao responsável.</div>
    </div>
  )

  if (fase === 'erro') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--bg)' }}>
      <TriangleAlert size={40} strokeWidth={1.5} style={{ color: 'var(--red)' }} />
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--text)' }}>Erro ao carregar</div>
      <div style={{ fontSize: 'var(--text-base)', color: 'var(--text3)' }}>Confira sua conexão e tente novamente. Se continuar, avise o responsável pelo sistema.</div>
      <button className="btn btn-primary" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button>
    </div>
  )

  return <SnapshotView dados={dados} estado={EST} tipo={TIPO}/>
}

export function SnapshotView({ dados, estado, tipo }) {
  const EST = estado?.toUpperCase(), TIPO = tipo?.toLowerCase()
  const [search, setSearch] = useState('')
  const { mes, dataAtualizacao, dataRef, tipo: snapTipo } = dados
  const displayed = { ...dados, canais: Object.fromEntries(Object.entries(dados.canais || {}).map(([channel, rows]) => [channel, snapshotPeople(rows, search)])), consultores: snapshotPeople(dados.consultores || [], search), mecanicos: snapshotPeople(dados.mecanicos || [], search) }

  // Recalcula dias com feriados da UF — usa dataRef (última data dos dados) como referência,
  // idêntico ao Dashboard (que usa dataMaxima). Assim o cabeçalho bate exatamente.
  const { diasMes, diasDec } = (() => {
    if (!mes) return { diasMes: null, diasDec: null }
    const parts = mes.split('/').map(Number)
    const mesNum = parts[0], anoNum = parts[1]
    if (!mesNum || !anoNum) return { diasMes: null, diasDec: null }
    const feriados = feriadosPorUF(EST, anoNum)
    const refDate = dataRef ? new Date(dataRef) : new Date()
    return {
      diasMes: diasUteisMes(anoNum, mesNum, feriados),
      diasDec: diasUteisDecorridos(anoNum, mesNum, refDate, feriados),
    }
  })()

  const diasRest = typeof diasMes === 'number' && typeof diasDec === 'number'
    ? Math.max(0, Math.round((diasMes - diasDec) * 10) / 10) : null

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{
        background: '#111827', padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font)', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg2)', color: '#f9fafb', letterSpacing: '-0.4px' }}>
            Pós-Venda
          </div>
          <div style={{ fontSize: 'var(--text-sm2)', color: '#9ca3af', marginTop: 2 }}>
            {ESTADO_NOME[EST] || EST} · {TIPO_NOME[TIPO] || TIPO} · {mes}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {diasDec != null && (
            <div style={{ padding: '2px 12px', borderLeft: '1px solid rgba(255,255,255,0.12)', textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Dias úteis</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: '#f9fafb', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(diasDec * 10) / 10}
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', color: '#6b7280' }}> / {diasMes}</span>
              </div>
            </div>
          )}
          {diasRest != null && (
            <div style={{ padding: '2px 12px', borderLeft: '1px solid rgba(255,255,255,0.12)', textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Restantes</div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: diasRest <= 3 ? '#fca5a5' : '#f9fafb', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(diasRest * 10) / 10}
              </div>
            </div>
          )}
          {dataAtualizacao && (
            <div style={{ padding: '2px 12px', borderLeft: '1px solid rgba(255,255,255,0.12)', textAlign: 'right' }}>
              <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-semibold)', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Dados até</div>
              <div style={{ fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-semibold)', color: '#f9fafb' }}>{dataAtualizacao}</div>
            </div>
          )}
        </div>
      </div>

      <div className="page" style={{ maxWidth: 1440, margin: '0 auto' }}>
        <section className="snapshot-context"><div><strong>Visão do setor · somente consulta</strong><p>Este link mostra a equipe do setor. Os percentuais indicam a meta já realizada; projeção é uma estimativa pelo ritmo do mês.</p>{dados.ts && <small>Visão publicada em {new Date(dados.ts).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</small>}</div><label>Encontrar colaborador<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite um nome"/></label></section>
        {search && <p role="status">Busca: {search}. Os cards de visão geral continuam mostrando o total do setor.</p>}
        {snapTipo === 'pecas'
          ? <SnapPecas dados={displayed} />
          : <SnapOficina dados={displayed} />
        }
      </div>
    </div>
  )
}

// ── helpers ────────────────────────────────────────────────────────────────

function kpiSub(proj, meta, hoje) {
  if (!proj && !meta && !hoje) return null
  return (
    <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {proj > 0 && <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-normal)', color: 'var(--text3)' }}>↗ {fmtBRL(proj)}</span>}
      {meta > 0 && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text3)' }}>Meta {fmtBRL(meta)}</div>}
      {hoje > 0 && <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text3)' }}>Hoje {fmtBRL(hoje)}</div>}
    </div>
  )
}

function RankCell({ pos }) {
  const style = {
    color: pos <= 3 ? 'var(--honda)' : 'var(--text3)',
    fontWeight: pos <= 3 ? 700 : 600,
    width: 28, textAlign: 'center',
  }
  return <td style={style}>{pos}°</td>
}

function rowCls(pos) {
  return pos === 1 ? 'row-top1' : pos === 2 ? 'row-top2' : ''
}

// ── Peças ──────────────────────────────────────────────────────────────────

function SnapPecas({ dados }) {
  const { kpis = [], canais = {} } = dados
  const ORDEM = ['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS']

  return (
    <>
      <div className="section-label">Visão Geral</div>
      <div className="kpi-grid">
        {kpis.map(k => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={fmtBRL(k.real ?? 0)}
            pctReal={snapshotAchievement(k.real, k.meta)}
            meta={k.meta}
            status={getStatus(k.real, k.meta)}
            sub={kpiSub(k.proj, null, k.hoje)}
          />
        ))}
      </div>

      <div className="section-label">Peças</div>
      <div className="canal-section">
        {ORDEM.map(cat => {
          const rows = canais[cat]
          if (!rows || rows.length === 0) return null
          return <CanalCardPecas key={cat} titulo={cat} rows={rows} />
        })}
      </div>
    </>
  )
}

function fmtPct(v) { return v != null && isFinite(v) ? `${(v * 100).toFixed(0)}%` : '–' }

function CanalCardPecas({ titulo, rows }) {
  const totReal = rows.reduce((s, r) => s + r.real, 0)
  const totMeta = rows.reduce((s, r) => s + r.meta, 0)
  const totProj = rows.reduce((s, r) => s + r.proj, 0)
  const thC = { textAlign: 'center' }
  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div className="card-header">
        <span className="card-title">{titulo}</span>
        <span className="badge badge-gray">{rows.length} vendedor{rows.length !== 1 ? 'es' : ''}</span>
      </div>
      <div className="table-wrap table-mobile-sticky snap-compact">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Loja</th>
              <th>Colaborador</th>
              <th style={thC}>Realizado</th>
              <th style={thC}>% Margem</th>
              <th style={thC}>Meta</th>
              <th style={thC}>% Meta realizada</th>
              <th style={thC}>Projeção</th>
              <th style={thC}>Hoje</th>
              <th style={thC}>TM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const lojas   = r.lojas?.length ? r.lojas : (r.loja ? [r.loja] : [])
              const pctMeta = snapshotAchievement(r.real, r.meta)
              return (
                <tr key={i} className={rowCls(i + 1)}>
                  <RankCell pos={i + 1} />
                  <td><LojaTags lojas={lojas} /></td>
                  <td className="name-cell">
                    <span title={r.nome}>{nomeAbrev(r.nome)}</span>
                    <div className="name-loja-mobile"><LojaTags lojas={lojas} /></div>
                  </td>
                  <td className="text-bold" style={{ textAlign: 'center' }}>{fmtBRL(r.real)}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>
                    {r.margem != null ? fmtPct(r.margem) : '–'}
                  </td>
                  <td className="text-muted" style={{ textAlign: 'center' }}>{r.meta > 0 ? fmtBRL(r.meta) : '–'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {pctMeta != null ? <StatusBadge pct={pctMeta} /> : '–'}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {r.proj > 0 ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(r.proj)}</span> : '–'}
                  </td>
                  <td className="text-muted" style={{ textAlign: 'center' }}>{r.hoje > 0 ? fmtBRL(r.hoje) : '–'}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>{r.tm > 0 ? fmtBRL(r.tm) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Oficina ────────────────────────────────────────────────────────────────

function SnapOficina({ dados }) {
  const { kpis = [], consultores = [], mecanicos = [] } = dados

  const totConsMO   = consultores.reduce((s, c) => s + c.moreal, 0)
  const totConsPO   = consultores.reduce((s, c) => s + c.pocoficina, 0)
  const totConsPass = consultores.reduce((s, c) => s + (c.passagens ?? 0), 0)
  const totMecMO    = mecanicos.reduce((s, c) => s + c.moreal, 0)
  const totMecPO    = mecanicos.reduce((s, c) => s + c.pocoficina, 0)
  const totMecPass  = mecanicos.reduce((s, c) => s + (c.passagens ?? 0), 0)

  return (
    <>
      <div className="section-label">Visão Geral</div>
      <div className="kpi-grid">
        {kpis.map(k => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={fmtBRL(k.real ?? 0)}
            pctReal={snapshotAchievement(k.real, k.meta)}
            meta={k.meta}
            status={getStatus(k.real, k.meta)}
            sub={kpiSub(k.proj, null, k.hoje ?? null)}
          />
        ))}
      </div>

      {consultores.length > 0 && (
        <>
          <div className="section-label">Oficina</div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Consultores</span>
              <span className="badge badge-gray">{consultores.length} consultores</span>
            </div>
            <TabelaOficina rows={consultores} label="Consultor" />
          </div>
        </>
      )}

      {mecanicos.length > 0 && (
        <>
          <div className="section-label">Mecânicos</div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Mecânicos</span>
              <span className="badge badge-gray">{mecanicos.length} mecânicos</span>
            </div>
            <TabelaOficina rows={mecanicos} label="Mecânico" />
          </div>
        </>
      )}
    </>
  )
}

function TabelaOficina({ rows, label }) {
  const thC = { textAlign: 'center' }
  const totMO   = rows.reduce((s, r) => s + (r.moreal || 0), 0)
  const totMeta = rows.reduce((s, r) => s + (r.mo || 0), 0)
  const totProj = rows.reduce((s, r) => s + (r.projMO || 0), 0)
  const totPO   = rows.reduce((s, r) => s + (r.pocoficina || 0), 0)
  const totPass = rows.reduce((s, r) => s + (r.passagens || 0), 0)

  return (
    <div className="table-wrap table-mobile-sticky snap-compact">
      <table>
        <thead>
          <tr style={{ background: 'var(--bg3)', fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>
            <td colSpan={3} style={{ padding: '5px 12px' }} />
            <td colSpan={3} style={{ padding: '5px 12px', textAlign: 'center', fontWeight: 'var(--weight-bold)', borderLeft: '1px solid var(--border)' }}>Mão de Obra</td>
            <td colSpan={3} style={{ padding: '5px 12px', textAlign: 'center', fontWeight: 'var(--weight-bold)', borderLeft: '1px solid var(--border)' }}>Peças OS</td>
            <td colSpan={2} style={{ padding: '5px 12px', textAlign: 'center', borderLeft: '1px solid var(--border)' }}>–</td>
          </tr>
          <tr>
            <th>#</th>
            <th>Lojas</th>
            <th>{label}</th>
            <th style={{ ...thC, borderLeft: '1px solid var(--border)' }}>Realizado</th>
            <th style={thC}>Meta</th>
            <th style={thC}>% Meta realizada</th>
            <th style={{ ...thC, borderLeft: '1px solid var(--border)' }}>Realizado</th>
            <th style={thC}>Meta</th>
            <th style={thC}>% Meta realizada</th>
            <th style={{ ...thC, borderLeft: '1px solid var(--border)' }}>Passagens</th>
            <th style={thC}>Hoje MO</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const lojas   = r.lojas?.length ? r.lojas : (r.loja ? [r.loja] : [])
            const pctMO   = snapshotAchievement(r.moreal, r.mo)
            const pctPO   = snapshotAchievement(r.pocoficina, r.mpo)
            return (
              <tr key={i} className={rowCls(i + 1)}>
                <RankCell pos={i + 1} />
                <td><LojaTags lojas={lojas} /></td>
                <td className="name-cell">
                  <span title={r.nome}>{nomeAbrev(r.nome)}</span>
                  <div className="name-loja-mobile"><LojaTags lojas={lojas} /></div>
                </td>
                <td className="text-bold" style={{ textAlign: 'center' }}>{fmtBRL(r.moreal)}</td>
                <td className="text-muted" style={{ textAlign: 'center' }}>{r.mo > 0 ? fmtBRL(r.mo) : '–'}</td>
                <td style={{ textAlign: 'center' }}>{pctMO != null ? <StatusBadge pct={pctMO} /> : '–'}</td>
                <td className="text-bold" style={{ textAlign: 'center' }}>{fmtBRL(r.pocoficina)}</td>
                <td className="text-muted" style={{ textAlign: 'center' }}>{r.mpo > 0 ? fmtBRL(r.mpo) : '–'}</td>
                <td style={{ textAlign: 'center' }}>{pctPO != null ? <StatusBadge pct={pctPO} /> : '–'}</td>
                <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{r.passagens ?? 0}</td>
                <td className="text-muted" style={{ textAlign: 'center' }}>{r.hoje > 0 ? fmtBRL(r.hoje) : '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
