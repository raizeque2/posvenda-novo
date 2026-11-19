import { fmtBRL } from '../../utils/formatacao.js'
import { ThMulti as Th } from '../../components/DS.jsx'
import { getMetaCanal } from './metas.logic.js'
import { MetasResumo } from '../../pv/MetasResumo.js'
import { Foto } from '../../pv/org.js'

// Visual plano (tabela de pessoas): só a divisória fina entre canais.
const BORDER_CANAL = '1px solid var(--border)'
const BG_NOVA      = 'transparent'
const BG_ANO_ANT   = 'transparent'

export function SecaoCard({ m, canais, secao, todosVisiveis }) {
  const collapsed  = m.colapsadas.has(secao.key)
  const multiCanal = canais.length > 1
  const nCols      = 2 + canais.length * (m.mesesHist.length + 2)
  const canalMeta  = secao.canalMeta || secao.key

  const sorts  = m.sortsMap[secao.key] || [{ col: 'loja', dir: 'asc' }]
  const toggle = (col, shiftKey) => m.handleSortSecao(secao.key, col, shiftKey)

  const colFns = { loja: c => c.loja || '', nome: c => c.colaborador || '' }
  const membrosOrdenados = [...secao.membros].sort((a, b) => {
    for (const s of sorts) {
      const fn  = colFns[s.col] || colFns.loja
      const cmp = fn(a).localeCompare(fn(b), 'pt-BR', { sensitivity: 'base' })
      if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp
    }
    return 0
  })

  const totalNova = canais.reduce((acc, canal) => ({
    ...acc,
    [canal.key]: secao.membros.reduce((s, c) => {
      const draftCanal = m.rascunho[c.colaborador]?.[canalMeta]
      const val = draftCanal?.[canal.key] ?? getMetaCanal(c, canalMeta, canal.key)
      return s + (Number(val) || 0)
    }, 0),
  }), {})
  const totalNovaGeral = canais.reduce((s, canal) => s + (totalNova[canal.key] || 0), 0)

  const totaisMes = m.mesesHist.map(mes =>
    Object.fromEntries(canais.map(canal => [canal.key, secao.membros.reduce((s, c) => s + m.getRealizado(c, canal.key, mes), 0)]))
  )
  const totaisAnoAnt = Object.fromEntries(canais.map(canal => [
    canal.key, secao.membros.reduce((s, c) => s + m.getRealizado(c, canal.key, m.mesAnoAnterior), 0),
  ]))

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div onClick={() => m.toggleSecao(secao.key)} style={{ cursor: 'pointer', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: collapsed ? 'none' : '1px solid var(--border)', userSelect: 'none' }}>
        <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-md)' }}>{secao.label}</span>
        <span className="badge badge-gray" style={{ fontSize: 'var(--text-sm)' }}>{secao.membros.length}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          {canais.map(canal => (
            <span key={canal.key} style={{ fontSize: 'var(--text-sm2)' }}>
              <span style={{ color: 'var(--text3)', marginRight: 4 }}>{canal.label}</span>
              <span style={{ fontWeight: 'var(--weight-bold)', color: totalNova[canal.key] > 0 ? 'var(--accent)' : 'var(--text3)' }}>
                {totalNova[canal.key] > 0 ? fmtBRL(totalNova[canal.key]) : '–'}
              </span>
            </span>
          ))}
          {multiCanal && totalNovaGeral > 0 && (
            <span style={{ fontSize: 'var(--text-sm2)', borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
              <span style={{ color: 'var(--text3)', marginRight: 4 }}>Total</span>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--accent)' }}>{fmtBRL(totalNovaGeral)}</span>
            </span>
          )}
          <span style={{ color: 'var(--text3)', fontSize: 'var(--text-sm)', marginLeft: 4 }}>{collapsed ? '▶' : '▼'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="table-wrap">
          <table className="tabela-pessoas">
            <thead>
              {multiCanal && (
                <tr>
                  <th rowSpan={2} onClick={e => toggle('loja', e.shiftKey)} style={{ cursor: 'pointer', userSelect: 'none', position: 'sticky', left: 0, zIndex: 3, background: 'var(--surface)', minWidth: 60, verticalAlign: 'bottom' }}>
                    Loja{sorts.find(s => s.col === 'loja') && <span style={{ fontSize: 'var(--text-xs)', marginLeft: 3 }}>{sorts.find(s => s.col === 'loja').dir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  <th rowSpan={2} onClick={e => toggle('nome', e.shiftKey)} style={{ cursor: 'pointer', userSelect: 'none', position: 'sticky', left: 60, zIndex: 3, background: 'var(--surface)', minWidth: 160, verticalAlign: 'bottom' }}>
                    Colaborador{sorts.find(s => s.col === 'nome') && <span style={{ fontSize: 'var(--text-xs)', marginLeft: 3 }}>{sorts.find(s => s.col === 'nome').dir === 'asc' ? '↑' : '↓'}</span>}
                  </th>
                  {canais.map(canal => (
                    <th key={canal.key} colSpan={m.mesesHist.length + 2} style={{ textAlign: 'center', borderLeft: BORDER_CANAL, fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text2)', paddingBottom: 6 }}>
                      {canal.label}
                    </th>
                  ))}
                </tr>
              )}
              <tr>
                {!multiCanal && (
                  <>
                    <Th col="loja" label="Loja" sort={sorts} toggle={toggle} style={{ position: 'sticky', left: 0, zIndex: 3, background: 'var(--surface)', minWidth: 60 }} />
                    <Th col="nome" label="Colaborador" sort={sorts} toggle={toggle} style={{ position: 'sticky', left: 60, zIndex: 3, background: 'var(--surface)', minWidth: 160 }} />
                  </>
                )}
                {canais.flatMap(canal => [
                  <th key={`${canal.key}-anoant`} style={{ textAlign: 'right', fontSize: 'var(--text-sm)', minWidth: 90, borderLeft: BORDER_CANAL, background: BG_ANO_ANT, color: 'var(--text3)', fontStyle: 'italic' }}>
                    {m.mesAnoAnterior}
                  </th>,
                  ...m.mesesHist.map(mes => (
                    <th key={`${canal.key}-h-${mes}`} style={{ textAlign: 'right', fontSize: 'var(--text-sm)', minWidth: 90, color: 'var(--text2)' }}>{mes}</th>
                  )),
                  <th key={`${canal.key}-nova`} style={{ textAlign: 'right', fontSize: 'var(--text-sm)', minWidth: 110, background: BG_NOVA, borderLeft: '1px solid var(--border)', color: 'var(--text2)' }}>
                    Nova meta
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {membrosOrdenados.length === 0 ? (
                <tr><td colSpan={nCols} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>Nenhum colaborador para {m.mesAtivo}</td></tr>
              ) : membrosOrdenados.map(c => {
                const colabIdx = todosVisiveis.indexOf(c)
                const cur      = m.rascunho[c.colaborador]?.[canalMeta]
                const draft    = {
                  mp:  cur?.mp  ?? getMetaCanal(c, canalMeta, 'mp'),
                  mo:  cur?.mo  ?? getMetaCanal(c, canalMeta, 'mo'),
                  mpo: cur?.mpo ?? getMetaCanal(c, canalMeta, 'mpo'),
                }
                return (
                  <tr key={c.colaborador}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', padding: '6px 8px' }}>
                      {c.loja ? <span className="badge badge-blue badge-loja">{c.loja}</span> : <span style={{ color: 'var(--text3)' }}>–</span>}
                    </td>
                    <td style={{ position: 'sticky', left: 60, zIndex: 1, background: 'var(--surface)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)', padding: '6px 12px' }}>
                      <div className="tp-pessoa">
                        <Foto nome={c.colaborador} tamanho={34} />
                        <div><div className="tp-nome">{c.colaborador}</div>{c.cargo && <div className="tp-sub">{c.cargo}</div>}</div>
                      </div>
                    </td>
                    {canais.flatMap((canal, cIdx) => {
                      const realAnoAnt  = m.getRealizado(c, canal.key, m.mesAnoAnterior)
                      const cHistAnoAnt = m.metasPorMes[m.mesAnoAnterior]?.[c.colaborador]
                      const metaAnoAnt  = cHistAnoAnt ? getMetaCanal(cHistAnoAnt, canalMeta, canal.key) : 0
                      const pctAnoAnt   = metaAnoAnt > 0 ? realAnoAnt / metaAnoAnt : null
                      return [
                        <td key={`${canal.key}-anoant`}
                          title={pctAnoAnt !== null ? `${Math.round(pctAnoAnt * 100)}% da meta` : undefined}
                          style={{ textAlign: 'right', padding: '5px 8px', fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums', background: BG_ANO_ANT, borderLeft: BORDER_CANAL }}>
                          {realAnoAnt === 0 && metaAnoAnt === 0 ? <span style={{ color: 'var(--text3)' }}>–</span> : (
                            <>
                              <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--text3)' }}>{realAnoAnt > 0 ? fmtBRL(realAnoAnt) : '–'}</div>
                              {metaAnoAnt > 0 && <div style={{ color: 'var(--text3)', fontSize: 'var(--text-xs)' }}>{fmtBRL(metaAnoAnt)}</div>}
                            </>
                          )}
                        </td>,
                        ...m.mesesHist.map(mes => {
                          const real = m.getRealizado(c, canal.key, mes)
                          const cMes = m.metasPorMes[mes]?.[c.colaborador]
                          const meta = cMes ? getMetaCanal(cMes, canalMeta, canal.key) : 0
                          const pct  = meta > 0 ? real / meta : null
                          const vazio = real === 0 && meta === 0
                          return (
                            <td key={`${canal.key}-${mes}`}
                              title={pct !== null ? `${Math.round(pct * 100)}% da meta` : undefined}
                              style={{ textAlign: 'right', padding: '5px 8px', fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' }}>
                              {vazio ? <span style={{ color: 'var(--text3)' }}>–</span> : (
                                <>
                                  <div style={{ fontWeight: 'var(--weight-semibold)' }}>{real > 0 ? fmtBRL(real) : '–'}</div>
                                  {meta > 0 && <div style={{ color: 'var(--text3)', fontSize: 'var(--text-xs)' }}>{fmtBRL(meta)}</div>}
                                </>
                              )}
                            </td>
                          )
                        }),
                        <td key={`${canal.key}-nova`} style={{ padding: '4px 6px', textAlign: 'right', background: BG_NOVA, borderLeft: '1px solid var(--border)' }}>
                          {m.soLeitura || !m.podeEditar(c) ? (
                            <span style={{ fontSize: 'var(--text-sm2)', fontVariantNumeric: 'tabular-nums' }}>
                              {draft[canal.key] ? fmtBRL(Number(draft[canal.key])) : '–'}
                            </span>
                          ) : (
                            <>
                              <input
                                ref={el => { m.inputRefs.current[`${c.colaborador}||${canalMeta}||${canal.key}`] = el }}
                                type="text" inputMode="numeric" className="form-input"
                                value={draft[canal.key] > 0 ? Number(draft[canal.key]).toLocaleString('pt-BR') : ''}
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '')
                                  m.setRascunho(r => ({
                                    ...r,
                                    [c.colaborador]: {
                                      ...r[c.colaborador],
                                      [canalMeta]: { ...draft, [canal.key]: val === '' ? 0 : Number(val) },
                                    },
                                  }))
                                }}
                                onFocus={e => e.target.select()}
                                onKeyDown={e => m.handleKeyDown(e, colabIdx, cIdx, todosVisiveis, canais, canalMeta)}
                                style={{ textAlign: 'right', width: 96, fontSize: 'var(--text-sm2)' }}
                              />
                              {!(draft[canal.key] > 0) && (() => {
                                const sug = m.getSugestao(c, canal)
                                return sug > 0 ? (
                                  <div
                                    onClick={() => m.setRascunho(r => ({
                                      ...r,
                                      [c.colaborador]: {
                                        ...r[c.colaborador],
                                        [canalMeta]: { ...draft, [canal.key]: sug },
                                      },
                                    }))}
                                    title="Clique para aplicar"
                                    style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', marginTop: 2, cursor: 'pointer', textDecorationLine: 'underline', textDecorationStyle: 'dotted' }}
                                  >
                                    ↗ {fmtBRL(sug)}
                                  </div>
                                ) : null
                              })()}
                            </>
                          )}
                        </td>,
                      ]
                    })}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td colSpan={2} style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface)', padding: '5px 12px', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text2)' }}>
                  Total
                </td>
                {canais.flatMap(canal => [
                  <td key={`ft-${canal.key}-anoant`} style={{ textAlign: 'right', padding: '5px 8px', fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--weight-bold)', background: BG_ANO_ANT, borderLeft: BORDER_CANAL }}>
                    {totaisAnoAnt[canal.key] > 0 ? fmtBRL(totaisAnoAnt[canal.key]) : '–'}
                  </td>,
                  ...totaisMes.map((t, i) => (
                    <td key={`ft-${canal.key}-${i}`} style={{ textAlign: 'right', padding: '5px 8px', fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--weight-bold)' }}>
                      {t[canal.key] > 0 ? fmtBRL(t[canal.key]) : '–'}
                    </td>
                  )),
                  <td key={`ft-${canal.key}-nova`} style={{ textAlign: 'right', padding: '5px 8px', fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--weight-bold)', background: BG_NOVA, borderLeft: '1px solid var(--border)', color: 'var(--accent)' }}>
                    {totalNova[canal.key] > 0 ? fmtBRL(totalNova[canal.key]) : '–'}
                  </td>,
                ])}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export function MetasTabela({ m, canais, secoes }) {
  const todosVisiveis = secoes.flatMap(s => s.membros)
  if (secoes.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
        Nenhum colaborador para {m.mesAtivo}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MetasResumo m={m} canais={canais} secoes={secoes} />
      {secoes.map(secao => (
        <SecaoCard key={secao.key} m={m} canais={canais} secao={secao} todosVisiveis={todosVisiveis} />
      ))}
    </div>
  )
}
