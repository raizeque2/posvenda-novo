import { useState } from 'react'
import './analysis-pages.css'
import PageHeader from '../components/PageHeader.jsx'
import { BarraFiltros, EmptyState, LoadingInline, KpiStrip, FormDropdown } from '../components/AnalysisDS.jsx'
import { Wrench, Download } from '../icons/iconoir'
import { fmtBRL, fmtNum, fmtPct } from '../utils/formatacao.js'
import { baixarCSV } from '../utils/exportarCSV.js'
import { useMonitorOS } from './oficina/useMonitorOS.js'
import { CardsSituacao, CardsSupervisor, RankingCriticoPorLoja, ConcentracaoPorGrupo, PontosAtencao, PrioridadeAcao, tituloCaso } from './oficina/MonitorOSUI.jsx'
import { TabelaOS, ModalListaOS, ModalDetalheOS, CAMPO_META } from './oficina/ModaisOS.jsx'
import { AbaRegrasOS } from './oficina/AbaRegrasOS.jsx'
import { FILTROS_RAPIDOS, CRITICIDADE_META } from '../services/processamento/processarOS.js'

const ehCritica = o => o.criticidade === 'critico' || o.criticidade === 'extremo'
const porDias   = (a, b) => (b.dias ?? 0) - (a.dias ?? 0)
const dataHora  = ts => ts ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function MonitorOS({ demo = false }) {
  const m = useMonitorOS({ demo })
  const [lista, setLista]       = useState(null) // { titulo, info, rows, campo }
  const [osAberta, setOsAberta] = useState(null)
  const [porPagina, setPorPagina] = useState('50')
  const [tabelaMin, setTabelaMin] = useState(false)

  const r = m.resumo
  const ativos = r.ativos || []
  const mud = m.mudancas

  // Monta o drill-down de cada clique (mesmos recortes da ferramenta original).
  function abrir(spec) {
    if (spec.tipo === 'lista') {
      setLista({ titulo: spec.titulo, info: spec.info, rows: [...spec.rows].sort(porDias) })
    } else if (spec.tipo === 'situacao') {
      const rows = spec.situacao ? ativos.filter(o => o.situacao === spec.situacao) : ativos
      setLista({ titulo: spec.situacao ? `O.S. ${tituloCaso(spec.situacao)}` : 'Todas as situações', rows: [...rows].sort(porDias) })
    } else if (spec.tipo === 'composicao') {
      const rows = spec.situacao ? ativos.filter(o => o.situacao === spec.situacao) : ativos
      setLista({ titulo: `Composição de O.S. — ${CAMPO_META[spec.campo].label}`, info: spec.situacao ? tituloCaso(spec.situacao) : 'todas as situações', rows, campo: spec.campo })
    } else if (spec.tipo === 'loja') {
      const rows = ativos.filter(o => o.empresa === spec.loja && (!spec.supervisor || o.supervisor === spec.supervisor))
      setLista({ titulo: `O.S. da loja ${spec.loja}`, info: spec.supervisor ? tituloCaso(spec.supervisor) : null, rows: [...rows].sort(porDias) })
    } else if (spec.tipo === 'grupo') {
      setLista({ titulo: `Detalhamento do grupo — ${spec.label}`, rows: ativos.filter(o => o.grupoKey === spec.grupo).sort(porDias) })
    } else if (spec.tipo === 'kpi') {
      const def = {
        total:    { titulo: 'Detalhamento das O.S.',        info: 'resultado completo dos filtros atuais', rows: ativos },
        critico:  { titulo: 'O.S. críticas e extremas',     info: 'da maior para a menor quantidade de dias', rows: ativos.filter(ehCritica) },
        moderado: { titulo: 'O.S. moderadas',               info: 'faixa intermediária por dias', rows: ativos.filter(o => o.criticidade === 'moderado') },
        media:    { titulo: 'O.S. usadas na média de dias', info: 'lista completa usada no cálculo', rows: ativos },
        judicial: { titulo: 'Processos judiciais',          info: 'separados da criticidade', rows: ativos.filter(o => o.judicial) },
      }[spec.kpi]
      setLista({ ...def, rows: [...def.rows].sort(porDias) })
    }
  }
  const abrirLista = (titulo, info, rows) => () => abrir({ tipo: 'lista', titulo, info, rows })

  const kpis = [
    { label: 'O.S. filtradas',      valor: fmtNum(r.totalOS),          sub: `de ${fmtNum(m.totalArquivo)} no arquivo`, onClick: () => abrir({ tipo: 'kpi', kpi: 'total' }) },
    { label: 'Críticas + extremas', valor: fmtNum(r.criticasExtremas), cor: 'var(--red)', sub: `${fmtPct(r.pctCriticasExtremas, 0)} da base filtrada`, onClick: () => abrir({ tipo: 'kpi', kpi: 'critico' }) },
    { label: 'Moderado',            valor: fmtNum(r.moderadas),        cor: 'var(--amber)', sub: 'faixa intermediária por dias', onClick: () => abrir({ tipo: 'kpi', kpi: 'moderado' }) },
    { label: 'Média de dias',       valor: fmtNum(r.mediaDias),        sub: 'antiguidade média', onClick: () => abrir({ tipo: 'kpi', kpi: 'media' }) },
    { label: 'Processos judiciais', valor: fmtNum(r.judiciais),        sub: 'separados da criticidade', onClick: () => abrir({ tipo: 'kpi', kpi: 'judicial' }) },
    mud
      ? { label: 'Saíram do crítico', valor: fmtNum(mud.sairamCritico.length), cor: 'var(--green)', sub: 'comparado à última carga', onClick: abrirLista('O.S. que saíram do crítico', 'reduziram de faixa ou deixaram de aparecer no arquivo', mud.sairamCritico) }
      : { label: 'Saíram do crítico', valor: '—', sub: 'precisa de uma carga anterior' },
  ]

  // Pontos de atenção que dependem da carga anterior.
  const pontos = [...(r.pontosAtencao || [])]
  if (mud) {
    pontos.push({ tipo: 'danger', icon: '↗', titulo: `${mud.novasCriticas.length} novas O.S. críticas`, texto: 'Casos que não estavam na faixa crítica na carga anterior.', onClick: abrirLista('Novas O.S. críticas', 'não estavam na faixa crítica na carga anterior', mud.novasCriticas) })
    pontos.push({ tipo: 'success', icon: '↘', titulo: `${mud.sairamCritico.length} O.S. saíram do crítico`, texto: 'Ordens que reduziram de faixa ou deixaram de aparecer no arquivo atual.', chips: mud.sairamCritico.slice(0, 8) })
  }

  const fat = (r.porSituacao || []).find(g => g.situacao.toLowerCase().includes('faturamento'))

  function exportar() {
    const linhas = m.detalhe.map(o => [o.nOS, o.empresa, CRITICIDADE_META[o.criticidade]?.label || '', o.dias ?? '', o.grupoLabel, o.tipoOS, o.cliente, o.placa, o.consultor, o.situacao,
      String(o.servico.toFixed(2)).replace('.', ','), String(o.mercadoria.toFixed(2)).replace('.', ','), String(o.valorTotal.toFixed(2)).replace('.', ','), o.solicitacao])
    baixarCSV(`monitor_os_${new Date().toISOString().slice(0, 10)}.csv`,
      ['O.S.', 'Loja', 'Criticidade', 'Dias', 'Grupo', 'Tipo O.S.', 'Cliente', 'Placa', 'Consultor', 'Situação', 'Serviço', 'Peças', 'Total', 'Solicitação'], linhas)
  }

  const abas = [
    { key: 'visao',  label: 'Visão Geral' },
    { key: 'regras', label: 'Regras' },
  ]
  const situacoesConhecidas = [...new Set((r.porSituacao || []).map(g => g.situacao))]

  // Filtros rápidos por tipo = filtros comuns da BarraFiltros (multi), um por modo.
  const filtroRapido = (modo, label) => {
    const defs = FILTROS_RAPIDOS.filter(f => f.modo === modo)
    return {
      label, multi: true,
      options: defs.map(f => f.label),
      value: defs.filter(f => m.filtrosRapidos.includes(f.key)).map(f => f.label),
      onChange: labels => m.setFiltrosRapidos([
        ...m.filtrosRapidos.filter(k => !defs.some(f => f.key === k)),
        ...defs.filter(f => labels.includes(f.label)).map(f => f.key),
      ]),
    }
  }
  const OPCOES_DIAS = [7, 10, 15, 20, 30].map(d => `${d}+ dias`)
  const tituloSecao = (titulo, direita) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
      <div className="section-label" style={{ flex: 1 }}>{titulo}</div>
      {direita}
    </div>
  )

  return (
    <div className="page analysis-page">
      <PageHeader title="Monitor de O.S." sub="Acompanhamento das ordens em aberto" {...(demo ? { title: 'Monitor de O.S.', sub: 'Modo demonstração — dados fictícios (só no computador local)' } : {})} />
      <BarraFiltros
        estados={m.optsEstado.length > 1 ? m.optsEstado : undefined}
        estado={m.estadoSel}
        onEstado={m.optsEstado.length > 1 ? m.onEstado : undefined}
        busca={m.busca} onBusca={m.setBusca} placeholderBusca="Cliente, placa ou nº O.S…"
        filtros={[
          ...(m.optsLojas.length > 0 ? [{ label: 'Loja', options: m.optsLojas, value: m.lojasSel, onChange: m.onLojas, multi: true }] : []),
          ...(m.optsSupervisor.length > 0 ? [{ label: 'Supervisor', options: m.optsSupervisor, value: m.supervisorSel, onChange: m.onSupervisor }] : []),
          ...(m.temDados ? [
            filtroRapido('excluir', 'Desconsiderar'),
            filtroRapido('apenas', 'Mostrar apenas'),
            { label: 'Mín. dias', options: OPCOES_DIAS, value: m.minDias ? `${m.minDias}+ dias` : '', onChange: v => m.setMinDias(v ? parseInt(v, 10) : 0) },
          ] : []),
        ]}
        temFiltro={m.temFiltro} onLimpar={m.clearFiltros}
      />

      <div className="tab-nav" style={{ marginBottom: 'var(--space-lg)' }}>
        {abas.map(a => (
          <button key={a.key} className={`tab-btn${m.aba === a.key ? ' active' : ''}`} onClick={() => m.setAba(a.key)}>
            {a.label}
          </button>
        ))}
      </div>

      {m.erro ? <div className="card" role="alert" style={{padding:20}}><p>{m.erro}</p><button type="button" className="btn btn-ghost" onClick={m.recarregar}>Tentar novamente</button></div> : m.carregando ? (
        <LoadingInline msg="Carregando O.S..." />
      ) : m.aba === 'regras' ? (
        <AbaRegrasOS regras={m.regras} setRegras={m.setRegras} situacoesConhecidas={situacoesConhecidas} tiposConhecidos={m.tiposConhecidos} canEdit={m.canEdit} />
      ) : !m.temDados ? (
        <EmptyState icon={Wrench} title="Nenhuma O.S. carregada" sub="Importe o arquivo de O.S. na página Upload para começar." />
      ) : (
        <>
          {/* Mudanças desde a última carga */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap', padding: '8px 14px', marginBottom: 'var(--space-md)' }}>
            <div style={{ marginRight: 'var(--space-sm)' }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text)' }}>Mudanças desde a última atualização</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)' }}>
                {mud ? `Carga atual ${dataHora(m.infoFoto?.ts)} · anterior ${dataHora(m.infoAnterior?.ts)}` : `Carga atual ${dataHora(m.infoFoto?.ts)} · sem carga anterior para comparar`}
              </div>
            </div>
            {mud && [
              ['Nova O.S.', mud.novas, 'green', 'O.S. novas', 'não existiam na carga anterior'],
              ['Status alterado', mud.statusAlterado, 'amber', 'O.S. com status alterado', 'situação diferente da carga anterior'],
              ['Valor alterado', mud.valorAlterado, 'purple', 'O.S. com valor alterado', 'valor total diferente da carga anterior'],
            ].map(([rot, rows, cor, tit, info]) => (
              <button key={rot} className={`badge badge-${cor}`} style={{ border: 'none', cursor: rows.length ? 'pointer' : 'default' }}
                onClick={rows.length ? abrirLista(tit, info, rows) : undefined}>{rot} · {rows.length}</button>
            ))}
          </div>

          <KpiStrip kpis={kpis} style={{ marginBottom: 'var(--space-lg)' }} />

          {tituloSecao('Resumo por status da O.S.', (
            <span className="badge badge-gray" style={{ marginBottom: 'var(--space-sm)', whiteSpace: 'normal', textAlign: 'left' }}>
              {fat?.nOS ? `${fat.nOS} O.S. em faturamento · Serviço ${fmtBRL(fat.servico)} · Peças ${fmtBRL(fat.mercadoria)} · Total ${fmtBRL(fat.valorTotal)}` : 'Nenhuma O.S. em faturamento'}
            </span>
          ))}
          <CardsSituacao porSituacao={r.porSituacao} resumo={r} onAbrir={abrir} />

          <div className="section-label">O.S. por loja</div>
          <CardsSupervisor porResponsavel={r.porResponsavel} onAbrir={abrir} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 'var(--space-md)' }}>
            <RankingCriticoPorLoja rankingLoja={r.rankingLoja} onAbrir={abrir} />
            <ConcentracaoPorGrupo concentracaoGrupo={r.concentracaoGrupo} onAbrir={abrir} />
          </div>

          <div className="section-label">Pontos de atenção</div>
          <PontosAtencao pontos={pontos} onOpenOS={setOsAberta} />

          <PrioridadeAcao lista={r.prioridadeLista} onOpenOS={setOsAberta} />

          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
              <span className="card-title">Detalhamento das ordens</span>
              <span className="badge badge-gray" style={{ fontWeight: 'var(--weight-normal)' }}>{fmtNum(m.detalhe.length)} registros</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <span style={{ width: 120 }}><FormDropdown value={porPagina} onChange={setPorPagina} options={[{ value: '25', label: '25 por página' }, { value: '50', label: '50 por página' }, { value: '100', label: '100 por página' }]} /></span>
                <button className="btn btn-ghost btn-sm" onClick={exportar} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}><Download size={12} /> Exportar filtradas</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setTabelaMin(v => !v)}>{tabelaMin ? '▼ Expandir' : '▲ Minimizar'}</button>
              </span>
            </div>
            {!tabelaMin && <TabelaOS rows={m.detalhe} onOpenOS={setOsAberta} modo="detalhe" porPagina={Number(porPagina)} maxHeight={640} />}
          </div>

          {/* Histórico de apuração (uma linha por carga) */}
          <details className="card" style={{ padding: '10px 14px', marginBottom: 'var(--space-lg)' }}>
            <summary style={{ cursor: 'pointer', fontSize: 'var(--text-sm3)', fontWeight: 'var(--weight-bold)', color: 'var(--text)' }}>Histórico de apuração</summary>
            {m.historico.length === 0 ? (
              <p className="note">Ainda não há histórico — ele começa a ser registrado a partir do próximo upload de O.S.</p>
            ) : (
              <div className="table-wrap" style={{ marginTop: 'var(--space-sm)' }}>
                <table className="data-table">
                  <thead><tr><th>Data</th><th>Arquivo</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Críticas</th><th style={{ textAlign: 'right' }}>Extremas</th><th style={{ textAlign: 'right' }}>Moderadas</th><th style={{ textAlign: 'right' }}>Média dias</th><th style={{ textAlign: 'right' }}>Saíram do crítico</th></tr></thead>
                  <tbody>
                    {m.historico.map(h => (
                      <tr key={h.ts}>
                        <td>{dataHora(h.ts)}</td><td>{h.arquivo || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(h.total)}</td><td style={{ textAlign: 'right' }}>{fmtNum(h.criticas)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(h.extremas)}</td><td style={{ textAlign: 'right' }}>{fmtNum(h.moderadas)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtNum(h.mediaDias)}</td><td style={{ textAlign: 'right' }}>{fmtNum(h.sairamCritico)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        </>
      )}

      {lista && <ModalListaOS key={`${lista.titulo}|${lista.info || ''}|${lista.campo || ''}`} {...lista} onClose={() => setLista(null)} onOpenOS={setOsAberta} />}
      {osAberta && <ModalDetalheOS os={osAberta} onClose={() => setOsAberta(null)} />}
    </div>
  )
}


