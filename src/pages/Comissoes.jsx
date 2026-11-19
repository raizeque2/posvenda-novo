import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { OperacionalLista } from '../pv/OperacionalLista.js'
import { fmtBRL, fmtBRL2, fmtPct } from '../utils/formatacao.js'
import { CardHead, ColSelector, EmptyState, FiltroDropdown, FiltroAnoMes, StatusBadge } from '../components/DS.jsx'
import { AlertTriangle } from '../icons/iconoir'
import { useComissoes } from './comissoes/useComissoes.js'
import { ComissaoTabela, COLS_DEFS, COLS_PADRAO } from './comissoes/BonInput.jsx'
import { GestorCard } from './comissoes/GestorCard.jsx'
import { useToast } from '../hooks/useToast.jsx'
import { escutarBonificacoesMes } from '../services/firestoreService.js'
import { MIN_MOTIVO } from './comissoes/comissoes.logic.js'
import { ComissoesInsights } from './comissoes/ComissoesInsights.jsx'

export default function Comissoes() {
  const c = useComissoes()
  const toast = useToast()

  // ── Visibilidade de colunas (persiste por usuário) ─────────────────────────
  const [cols, _setCols] = useState(COLS_PADRAO)
  useEffect(() => {
    if (!c.user?.uid) return
    try {
      const s = localStorage.getItem(`pv_com_cols_${c.user.uid}`)
      if (s) _setCols({ ...COLS_PADRAO, ...JSON.parse(s) })
    } catch {}
  }, [c.user?.uid])

  function setCols(nc) {
    _setCols(nc)
    if (c.user?.uid) {
      try { localStorage.setItem(`pv_com_cols_${c.user.uid}`, JSON.stringify(nc)) } catch {}
    }
  }

  // ── Rascunho de bônus — { nome: { valor, motivo } } ────────────────────────
  const [rascunhoBon,   setRascunhoBon]   = useState({})
  const [errosMotivo,   setErrosMotivo]   = useState(new Set())
  const [salvoConfirm,  setSalvoConfirm]  = useState(false)
  const [salvandoBon,   setSalvandoBon]   = useState(false)

  // Limpa rascunho ao trocar de mês
  useEffect(() => { setRascunhoBon({}); setErrosMotivo(new Set()) }, [c.mesAtivo])

  // ── Tempo real, só o mês aberto, só enquanto esta tela está montada ────────
  // Assina ao entrar/trocar de mês, cancela ao sair — nunca fica escutando
  // parado numa tela fechada (sem vazamento de listener, sem leitura à toa em
  // meses que não estão sendo editados ao vivo). Se alguém mais salvar uma
  // pessoa que você tem em rascunho (ainda não salvo), avisa antes que você
  // sobrescreva o valor dela sem saber.
  const rascunhoRef = useRef(rascunhoBon)
  useEffect(() => { rascunhoRef.current = rascunhoBon }, [rascunhoBon])

  useEffect(() => {
    if (!c.mesAtivo) return
    let primeiraCarga = true
    const unsub = escutarBonificacoesMes(c.mesAtivo, ({ bonificacoes, bonAudit, alteracoes }) => {
      c.mesclarBonificacoesMes(bonificacoes, bonAudit)
      if (primeiraCarga) { primeiraCarga = false; return }
      // Só de OUTRA pessoa — sem isso, o próprio salvamento (que também passa
      // por aqui, já que o onSnapshot escuta a própria escrita de volta)
      // disparava o aviso "alterado por outra pessoa" contra o próprio autor.
      const deOutrem = alteracoes.filter(a => a.por && a.por !== c.user?.email)
      const nomesAfetados = Object.keys(rascunhoRef.current)
        .filter(nome => deOutrem.some(a => a.chave === `${nome}||${c.mesAtivo}`))
      if (nomesAfetados.length > 0) {
        toast(
          `${nomesAfetados.length === 1 ? nomesAfetados[0] : nomesAfetados.length + ' pessoas'} — o bônus foi alterado por outra pessoa agora. Confira o valor antes de salvar seu rascunho.`,
          'error', 9000
        )
      }
    })
    return unsub
  }, [c.mesAtivo])

  const nAlteracoesBon = Object.keys(rascunhoBon).length

  // Todo mundo que gerencia gente edita bônus direto — não faz sentido
  // coordenador (escopo maior, estado inteiro) ter menos poder que supervisor
  // (escopo do próprio time). Só operacional fica de fora.
  const podeEditarBonus = ['admin', 'coordenador', 'supervisor'].includes(c.role)

  function onBonDraft(nome, campo, val) {
    setRascunhoBon(p => ({
      ...p,
      [nome]: {
        valor:  p[nome]?.valor  ?? 0,
        motivo: p[nome]?.motivo ?? '',
        [campo]: campo === 'valor' ? (Number(val) || 0) : val,
      },
    }))
    if (campo === 'motivo' && val.trim().length >= MIN_MOTIVO) {
      setErrosMotivo(prev => {
        if (!prev.has(nome)) return prev
        const n = new Set(prev); n.delete(nome); return n
      })
    }
  }

  function descartarBon() {
    setRascunhoBon({})
    setErrosMotivo(new Set())
  }

  async function salvarBon() {
    const faltando = Object.entries(rascunhoBon).filter(([, v]) => (v.motivo || '').trim().length < MIN_MOTIVO).map(([n]) => n)
    if (faltando.length > 0) { setErrosMotivo(new Set(faltando)); return }
    setSalvandoBon(true)
    try {
      // Lote inteiro numa transação só (lê o servidor na hora, muda todo
      // mundo do rascunho, grava uma vez) — mesmo salvando o time inteiro de
      // uma vez, ou várias pessoas salvando ao mesmo tempo em telas
      // diferentes, ninguém apaga o bônus de outra nem esbarra em contenção
      // de disparar uma transação por pessoa.
      const alteracoes = Object.entries(rascunhoBon).map(([nome, v]) => ({
        nome, mes: c.mesAtivo, valor: v.valor, obs: v.motivo.trim(),
      }))
      await c.salvarBonificacoesLote(alteracoes, c.user?.email)
      setRascunhoBon({})
      setErrosMotivo(new Set())
      setSalvoConfirm(true)
      setTimeout(() => setSalvoConfirm(false), 2500)
    } catch (e) {
      console.error('salvarBon:', e)
      toast('Não foi possível salvar o bônus. Verifique sua conexão e tente novamente.', 'error', 6000)
    } finally {
      setSalvandoBon(false)
    }
  }

  return (
    <div className="page">
      {c.isAdmin && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
          {['operacional', 'gestao'].map(a => (
            <button key={a} onClick={() => c.setAba(a)} className={`btn btn-sm ${c.aba === a ? 'btn-primary' : 'btn-ghost'}`}>
              {a === 'operacional' ? 'Operacional' : 'Gestão'}
            </button>
          ))}
        </div>
      )}

      <div className="filters-bar minimal-filters" data-tour="commission-filters">
        <FiltroAnoMes meses={c.mesesDisp} value={c.filtroMes} onChange={c.setFiltroMes} />
        <span className="dash-bar-sep" />
        {c.isAdmin && (
          <FiltroDropdown compact label="Estado" options={c.estadoOpts} value={c.filtroEstado} onChange={v => { c.setFiltroEstado(v); c.setFiltroLojas([]) }} />
        )}
        <FiltroDropdown compact label="Loja"   options={c.lojaOpts}   value={c.filtroLojas}  onChange={c.setFiltroLojas} multi />
        {(c.aba === 'operacional' || !c.isAdmin) && <>
          {c.role !== 'supervisor' && (
            <FiltroDropdown compact label="Supervisor" options={c.supOptsComissoes} value={c.filtroSupervisor} onChange={v => c.setFiltroSupervisor(v === c.filtroSupervisor ? '' : v)} />
          )}
          <FiltroDropdown compact label="Cargo"      options={c.cargoOpts}        value={c.filtroCargo}      onChange={c.setFiltroCargo} multi />
          <FiltroDropdown compact label="Setor"      options={c.setorOpts}        value={c.filtroSetor}      onChange={c.setFiltroSetor} multi />
          <input
            className="filter-select"
            placeholder="Buscar nome..."
          aria-label="Buscar colaborador"
            value={c.buscaNome}
            onChange={e => c.setBuscaNome(e.target.value)}
            style={{ minWidth: 140 }}
          />
        </>}
        {c.temFiltro && <button className="filter-clear" onClick={c.clearFiltros}>✕</button>}
        {c.hasData && (
          <button className="btn btn-ghost btn-sm" onClick={c.todosFechados ? c.expandirTodos : c.recolherTodos}>
            {c.todosFechados ? '▼ Expandir' : '▲ Recolher'}
          </button>
        )}
      </div>

      {/* ── Barra de bônus (admin/coordenador/supervisor, há rascunho) — bônus
           manual segue editável mesmo com o mês fechado (o fechamento raramente
           permite conferir tudo em cima da hora). */}
      {podeEditarBonus && (nAlteracoesBon > 0 || salvoConfirm) && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          backdropFilter: 'blur(10px)',
          background: 'var(--bg2)',
          borderBottom: '1px solid rgba(15,23,42,0.10)',
          boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
          padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {salvoConfirm && nAlteracoesBon === 0 ? (
            <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--green)', fontWeight: 'var(--weight-semibold)' }}>
              ✓ Bônus salvos
            </span>
          ) : (
            <>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)' }}>
                Alterações não salvas
              </span>
              <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>
                {nAlteracoesBon} bônus alterado{nAlteracoesBon !== 1 ? 's' : ''}
                {errosMotivo.size > 0 && (
                  <span style={{ color: 'var(--red)', marginLeft: 8 }}>
                    · {errosMotivo.size} com motivo muito curto (mín. {MIN_MOTIVO} caracteres)
                  </span>
                )}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={descartarBon} disabled={salvandoBon}>Descartar</button>
                <button className="btn btn-primary btn-sm" onClick={salvarBon} disabled={salvandoBon}>
                  {salvandoBon ? 'Salvando...' : 'Salvar bônus'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!c.hasData ? (
        <EmptyState title="Nenhum dado carregado" sub="Importe os arquivos CSV para calcular as comissões." />
      ) : (
        <>
          {c.todasZeradas && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid var(--amber)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-base)' }}>
              <AlertTriangle size={15} strokeWidth={1.75} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <span>
                <strong>Comissões zeradas</strong> — nenhum colaborador tem comissão calculada para {c.mesAtivo}.
                Verifique os percentuais em <strong>Regras</strong>.
              </span>
            </div>
          )}

          <ComissoesInsights operational={c.operacionais} management={c.rankingGestao} history={c.historico} mode={c.aba} month={c.mesAtivo} />

          {(c.aba === 'operacional' || !c.isAdmin) && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Operacional</span>
                <span className="badge badge-gray">{c.operacionais.length} colaborador{c.operacionais.length !== 1 ? 'es' : ''}{c.mesAtivo ? ` · ${c.mesAtivo}` : ''}</span>
                {c.operacionais.length > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--text-sm2)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                    Total: <strong style={{ color: 'var(--green)' }}>{fmtBRL(c.totOpGeral)}</strong>
                  </span>
                )}
                {/* Seletor de colunas */}
                <ColSelector cols={cols} defs={COLS_DEFS} onChange={setCols} />
              </div>

              {c.openOperacionais ? (
                c.operacionais.length === 0 ? (
                  <p className="note" style={{ marginTop: 0 }}>Nenhum colaborador operacional para este mês.</p>
                ) : (
                  <OperacionalLista Portal={ReactDOM} fmt={fmtBRL2} pct={fmtPct} rows={c.operacionais} onBonDraft={podeEditarBonus ? onBonDraft : null} rascunhoBon={rascunhoBon} errosMotivo={errosMotivo} />
                )
              ) : (
                <p className="note" style={{ marginTop: 0 }}>
                  {c.operacionais.length} colaboradores · Total: {fmtBRL(c.totOpGeral)} — use "Expandir Todos" acima
                </p>
              )}
              <p className="note">* Sem meta no mês. Comissão calculada pelo percentual do cargo/estado sobre o realizado.</p>
            </div>
          )}

          {c.isAdmin && c.aba === 'gestao' && (
            <>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Gestão</span>
                  <span className="badge badge-gray">{c.rankingGestao.length} gestor{c.rankingGestao.length !== 1 ? 'es' : ''}{c.mesAtivo ? ` · ${c.mesAtivo}` : ''}</span>
                  {c.rankingGestao.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 'var(--text-sm2)', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                      Total: <strong style={{ color: 'var(--green)' }}>{fmtBRL(c.totGestaoTotal)}</strong>
                    </span>
                  )}
                </div>
                <div style={{ padding: '4px 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                  {c.rankingGestao.map(g => (
                    <GestorCard
                      key={`${c.mesAtivo}:${g.nomeNorm}`}
                      gestor={g}
                      mes={c.mesAtivo}
                      onToggle={(nomeNorm, chave, val) => c.setIndicadorGestao(c.mesAtivo, nomeNorm, chave, val)}
                      onBonusExtra={(nomeNorm, val) => c.setBonusExtraGestao(c.mesAtivo, nomeNorm, val)}
                    />
                  ))}
                  {c.rankingGestao.length === 0 && (
                    <p className="note" style={{ marginTop: 0 }}>Nenhum gestor identificado para este mês.</p>
                  )}
                </div>
              </div>

              <div className="card">
                <CardHead title="Histórico — Meta × Realizado por Mês" />
                {c.openHistorico && (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Mês</th><th>Colab. c/ meta</th>
                          <th>Meta Peças</th><th>Real. Peças</th><th>% Peças</th>
                          <th>Meta OS</th><th>Real. OS</th><th>% OS</th>
                          <th>Comissão</th><th>Bonificação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.historico.map(h => (
                          <tr key={h.mes}>
                            <td style={{ fontWeight: 'var(--weight-bold)' }}>{h.mes}</td>
                            <td>{h.cmMeta}</td>
                            <td>{fmtBRL(h.metaP)}</td>
                            <td style={{ fontWeight: 'var(--weight-bold)' }}>{fmtBRL(h.realP)}</td>
                            <td><StatusBadge pct={h.metaP > 0 ? h.realP / h.metaP : null} /></td>
                            <td>{fmtBRL(h.metaO)}</td>
                            <td style={{ fontWeight: 'var(--weight-bold)' }}>{fmtBRL(h.realO)}</td>
                            <td><StatusBadge pct={h.metaO > 0 ? h.realO / h.metaO : null} /></td>
                            <td>{fmtBRL(h.comTotal)}</td>
                            <td>{fmtBRL(h.bonTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

    </div>
  )
}
