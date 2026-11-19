import { useState } from 'react'
import { Eye } from '../../icons/iconoir'
import { Tag, IconButton } from '../../components/AnalysisDS.jsx'
import { fmtBRL, fmtNum, fmtPct } from '../../utils/formatacao.js'

const CONECT = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E'])
export function tituloCaso(s) {
  if (!s) return ''
  return s.toLowerCase().split(/\s+/).map(p => CONECT.has(p.toUpperCase()) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

function corSituacao(situacao) {
  const n = (situacao || '').toLowerCase()
  if (n.includes('faturamento')) return 'var(--honda)'
  if (n.includes('aberta'))      return 'var(--orange)'
  if (n.includes('fechada'))     return 'var(--blue)'
  if (n.includes('pronta'))      return 'var(--purple)'
  if (n.includes('parad'))       return 'var(--amber)'
  if (n.includes('pendente'))    return 'var(--amber)'
  return 'var(--text3)'
}

const caixa = { background: 'var(--bg3)', borderRadius: 'var(--radius-md)', padding: '5px 8px', cursor: 'pointer' }
const rotuloCaixa = { fontSize: 'var(--text-2xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4 }

/** Resumo por status: "Todas" + um card por situação (ordem fixa). Clique no card
 *  abre as O.S. da situação; clique em Serviço/Peças/Valor total abre a composição. */
export function CardsSituacao({ porSituacao, resumo, onAbrir }) {
  const consolidado = {
    situacao: 'Todas as situações', todas: true,
    nOS: resumo.totalOS,
    servico: porSituacao.reduce((s, g) => s + g.servico, 0),
    mercadoria: porSituacao.reduce((s, g) => s + g.mercadoria, 0),
    valorTotal: porSituacao.reduce((s, g) => s + g.valorTotal, 0),
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
      {[consolidado, ...porSituacao].map(g => {
        const cor = g.todas ? 'var(--text)' : corSituacao(g.situacao)
        const situacao = g.todas ? null : g.situacao
        const faturamento = !g.todas && g.situacao.toLowerCase().includes('faturamento')
        const valor = (campo, rotulo, v) => (
          <div onClick={e => { e.stopPropagation(); onAbrir?.({ tipo: 'composicao', situacao, campo }) }} title={`Ver composição — ${rotulo}`} style={caixa}>
            <div style={rotuloCaixa}>{rotulo}</div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text)' }}>{fmtBRL(v)}</div>
          </div>
        )
        return (
          <div key={g.situacao} className="card" onClick={() => onAbrir?.({ tipo: 'situacao', situacao })} title="Ver as O.S. desta situação"
            style={{ padding: '10px 12px', borderTop: `3px solid ${cor}`, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: g.todas ? 'var(--text2)' : cor, textTransform: 'uppercase' }}>{g.situacao}</span>
              {faturamento && <Tag cor={g.nOS > 0 ? 'green' : 'gray'}>{g.nOS > 0 ? 'SIM' : 'NÃO'}</Tag>}
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: cor, lineHeight: 1.1, marginTop: 2 }}>{fmtNum(g.nOS)}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginBottom: 6 }}>ordens de serviço</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 4 }}>
              {valor('servico', 'Serviço', g.servico)}
              {valor('mercadoria', 'Total peças', g.mercadoria)}
            </div>
            {valor('valorTotal', 'Valor total', g.valorTotal)}
          </div>
        )
      })}
    </div>
  )
}

/** O.S. por loja, agrupadas por supervisor: um card por supervisor com as lojas
 *  em mini-cards (O.S. + críticas). Clique na loja abre as O.S. dela. */
export function CardsSupervisor({ porResponsavel, onAbrir }) {
  if (!porResponsavel.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
      {porResponsavel.map(r => (
        <div key={r.responsavel} className="card" style={{ alignSelf: 'start', padding: '8px 10px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', background: 'var(--text)', color: 'var(--bg2)', borderRadius: 'var(--radius-md)', padding: '5px 10px', marginBottom: 8 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', flex: 1, textAlign: 'center' }}>{r.responsavel}</span>
            <span style={{ fontSize: 'var(--text-xs)', opacity: 0.75 }}>{fmtNum(r.nOS)} O.S.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 6 }}>
            {r.lojas.map(l => (
              <div key={l.loja} onClick={() => onAbrir?.({ tipo: 'loja', loja: l.loja, supervisor: r.responsavel })} title="Ver as O.S. desta loja"
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '6px 8px', cursor: 'pointer' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text2)' }}>{l.loja}</div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{fmtNum(l.nOS)}</div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: l.criticas > 0 ? 'var(--red)' : 'var(--text3)' }}>{fmtNum(l.criticas)} crítica{l.criticas !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const COR_ATENCAO = { danger: 'var(--red-critical)', warning: 'var(--amber)', info: 'var(--blue)', success: 'var(--green)' }

/** Pontos de atenção — alertas automáticos. `os` abre o detalhe; `chips` lista O.S. clicáveis. */
export function PontosAtencao({ pontos, onOpenOS }) {
  if (!pontos || !pontos.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
      {pontos.map((p, i) => {
        const cor = COR_ATENCAO[p.tipo] || 'var(--text3)'
        const clique = p.onClick || (p.os && !p.acao ? () => onOpenOS?.(p.os) : undefined)
        return (
          <div key={i} className="card" onClick={clique}
            style={{ padding: '10px 12px', borderLeft: `3px solid ${cor}`, display: 'flex', gap: 'var(--space-sm)', cursor: clique ? 'pointer' : 'default', background: p.tipo === 'success' ? 'var(--green-bg)' : undefined }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-black)', color: cor, lineHeight: 1.2, minWidth: 16 }}>{p.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text)' }}>{p.titulo}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', marginTop: 2 }}>{p.texto}</div>
              {p.acao && <button className="btn btn-ghost btn-xs" style={{ marginTop: 6, color: 'var(--blue)' }} onClick={() => onOpenOS?.(p.os)}>{p.acao}</button>}
              {p.chips?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {p.chips.map(o => (
                    <button key={o.osId} className="badge badge-gray" style={{ border: 'none', cursor: 'pointer' }} onClick={() => onOpenOS?.(o)}>{o.nOS} · {o.empresa}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Prioridades de ação — top N por score (0–100), em duas colunas, com a conta do score. */
export function PrioridadeAcao({ lista, limite = 10, onOpenOS }) {
  const [minimizado, setMinimizado] = useState(false)
  if (!lista || !lista.length) return null
  const top = lista.slice(0, limite)
  const conta = n => lista.filter(o => o.prioridade.nivel === n).length
  return (
    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="card-header">
        <div>
          <span className="card-title">Prioridades de ação</span>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>Índice de 0 a 100 baseado em dias, criticidade, valor, status e tipo de O.S.</div>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-xs)', alignItems: 'center' }}>
          <span className="badge badge-gray">{conta('urgente')} urgentes · {conta('alta')} altas · {conta('media')} médias</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setMinimizado(v => !v)}>{minimizado ? '▼ Expandir' : '▲ Minimizar'}</button>
        </span>
      </div>
      {!minimizado && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 480px), 1fr))', gap: 'var(--space-sm)', padding: '4px 14px 14px' }}>
          {top.map((o, i) => {
            const c = o.prioridade.componentes
            return (
              <div key={o.osId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', border: '1px solid var(--border)', borderLeft: '3px solid var(--red-critical)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', width: 14 }}>{i + 1}</span>
                <div style={{ background: 'var(--text)', color: 'var(--bg2)', borderRadius: 'var(--radius-md)', padding: '4px 8px', textAlign: 'center', minWidth: 46 }}>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, lineHeight: 1 }}>{o.prioridade.score}</div>
                  <div style={{ fontSize: 'var(--text-2xs)', opacity: 0.7 }}>PONTOS</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => onOpenOS?.(o)} style={{ padding: 0, color: 'var(--blue)', fontWeight: 'var(--weight-bold)', textDecoration: 'underline' }}>O.S. {o.nOS}</button>
                    <Tag cor={o.prioridade.nivelTag}>{o.prioridade.nivelLabel.toUpperCase()}</Tag>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text2)' }}>{o.empresa} · {o.dias ?? '—'} dias · {tituloCaso(o.consultor)}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.prioridade.motivos.join(' · ')}</div>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text3)' }}>Dias {c.dias} · Criticidade {c.criticidade} · Valor {c.valor} · Status {c.status} · Tipo {c.tipo}</div>
                </div>
                <IconButton icon={Eye} title="Ver detalhes da O.S." onClick={() => onOpenOS?.(o)} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Barra({ frac, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
      <div style={{ flex: 1, height: 10, borderRadius: 6, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(2, Math.round((frac || 0) * 100))}%`, borderRadius: 6, background: 'linear-gradient(90deg, var(--blue), var(--red-critical))' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', minWidth: 190, justifyContent: 'flex-end' }}>{children}</div>
    </div>
  )
}

/** Ranking crítico por loja — alterna Percentual / Quantidade / Valor parado. Clicável. */
export function RankingCriticoPorLoja({ rankingLoja, onAbrir }) {
  const [modo, setModo] = useState('pct')
  if (!rankingLoja.length) return null

  const bse = [...rankingLoja]
  if (modo === 'qtd')   bse.sort((a, b) => b.criticas - a.criticas)
  if (modo === 'valor') bse.sort((a, b) => b.valorParado - a.valorParado)
  const maxQtd   = Math.max(1, ...bse.map(l => l.criticas))
  const maxValor = Math.max(1, ...bse.map(l => l.valorParado))
  const abas = [{ k: 'pct', l: 'Percentual crítico' }, { k: 'qtd', l: 'Quantidade crítica' }, { k: 'valor', l: 'Valor parado' }]
  const sub = { pct: 'Percentual crítico sobre a carteira de cada loja.', qtd: 'Quantidade de O.S. críticas e extremas por loja.', valor: 'Valor total parado e quantidade de O.S. abertas em cada loja.' }[modo]

  return (
    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="card-header">
        <div>
          <span className="card-title">Ranking crítico por loja</span>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>{sub}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-xs)' }}>
          {abas.map(a => (
            <button key={a.k} className="btn btn-ghost btn-sm" onClick={() => setModo(a.k)}
              style={modo === a.k ? { background: 'var(--text)', color: 'var(--bg2)', fontWeight: 'var(--weight-bold)' } : undefined}>{a.l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {bse.map(l => {
          const frac = modo === 'pct' ? l.pctCritico : modo === 'qtd' ? l.criticas / maxQtd : l.valorParado / maxValor
          return (
            <div key={l.loja} onClick={() => onAbrir?.({ tipo: 'loja', loja: l.loja })} title="Ver as O.S. desta loja"
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }}>
              <span style={{ width: 44, fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-sm)' }}>{l.loja}</span>
              <div style={{ flex: 1 }}>
                <Barra frac={frac}>
                  {modo === 'pct'   && <><strong>{fmtPct(l.pctCritico, 1)}</strong><span className="badge badge-gray">{l.criticas} de {l.total} O.S.</span></>}
                  {modo === 'qtd'   && <><strong>{fmtNum(l.criticas)}</strong><span className="badge badge-gray">de {l.total} O.S.</span></>}
                  {modo === 'valor' && <><strong>{fmtBRL(l.valorParado)}</strong><span className="badge badge-gray">{l.abertas} O.S. abertas</span></>}
                  <IconButton icon={Eye} title="Ver as O.S. desta loja" onClick={e => { e.stopPropagation(); onAbrir?.({ tipo: 'loja', loja: l.loja }) }} />
                </Barra>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Concentração por grupo — quantidade, média de dias e valor parado. Clicável. */
export function ConcentracaoPorGrupo({ concentracaoGrupo, onAbrir }) {
  if (!concentracaoGrupo.length) return null
  const maxQtd = Math.max(1, ...concentracaoGrupo.map(g => g.quantidade))

  return (
    <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="card-header">
        <div>
          <span className="card-title">Concentração por grupo</span>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>Quantidade, média de dias e valor parado por grupo.</div>
        </div>
      </div>
      <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {concentracaoGrupo.map(g => (
          <div key={g.key} onClick={() => onAbrir?.({ tipo: 'grupo', grupo: g.key, label: g.label })} title="Ver as O.S. deste grupo"
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }}>
            <span style={{ width: 170, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
            <div style={{ flex: 1 }}>
              <Barra frac={g.quantidade / maxQtd}>
                <strong>{fmtNum(g.quantidade)}</strong>
                <span className="badge badge-gray">{g.mediaDias}/d</span>
                <Tag cor={g.valorParado > 0 ? 'red' : 'gray'}>{fmtBRL(g.valorParado)}</Tag>
              </Barra>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

