import { useState,useMemo,useEffect } from 'react'
import {flushSync} from 'react-dom'
import {isRevenueRecord} from '../bi/revenue.js'
import Workspace from '../bi/Workspace.jsx'
import useStore from '../store.js'
import { norm, resolveNome } from '../utils/normalizacao.js'
import { calcProjecao } from '../utils/datas.js'
import { fmtBRL, fmtPct, nomeAbrev } from '../utils/formatacao.js'
import { KpiCard, StatusBadge, LojaTags, FiltroDropdown, FiltroAnoMes, getStatus, EmptyState, Modal } from '../components/DS.jsx'
import { FolderOpen, WifiOff } from '../icons/iconoir'
import { ThSort, RankLabel, rowClass, PecasOSHover } from './dashboard/DashAux.jsx'
import { CanalCard } from './dashboard/CanalCard.jsx'
import { PrintHeader, PrintKpiCard, PrintCanalCard, PrintOficinaTabela, printKpiSub } from './dashboard/PrintComponents.jsx'
import { useDashboard, SECOES_LABELS, TODAS_SECOES } from './dashboard/useDashboard.js'

const tStyle   = { padding: '9px 12px', color: 'var(--text3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', textAlign: 'center', verticalAlign: 'middle', position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 3 }
const grpStyle = { padding: '4px 8px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', color: 'var(--text3)', borderLeft: '1px solid var(--border2)', borderRight: '1px solid var(--border2)' }
const grpBorder = { borderLeft: '1px solid var(--border2)' }

export default function Dashboard() {
  const d = useDashboard()
  const apelidoMap=useStore(s=>s.apelidoMap)
  // Espaços na barra de filtros onde o Workspace coloca seus controles (visão, Personalizar, ⋯ e Salvar).
  const [slotVisao, setSlotVisao] = useState(null), [slotSalvar, setSlotSalvar] = useState(null)
  const barraBI = useMemo(() => ({ inicio: slotVisao, fim: slotSalvar }), [slotVisao, slotSalvar])
  const biTargets = useMemo(()=> [[d.verVarejo?d.varejoRows:[], "VAREJO"],[d.verAtacado?d.atacadoRows:[],"ATACADO"],[d.verVarejo?d.webRows:[],"WEB"],[d.verVarejo?d.televRows:[],"TELEVENDAS"]].flatMap(([rows,channel])=>rows.map(r=>({name:r.nome,meta:r.metaCanal,channel}))).concat(d.verOficina?d.consultoresLista.flatMap(r=>[{name:r.nome,meta:r.mo||0,channel:'SERVIÇOS'},{name:r.nome,meta:r.mpo||0,channel:'OFICINA'}]):[]),[d.verVarejo,d.verAtacado,d.verOficina,d.varejoRows,d.atacadoRows,d.webRows,d.televRows,d.consultoresLista])
  const biPieces=useMemo(()=>d.fp.filter(r=>isRevenueRecord(r)).filter(r=>r.cat==="ATACADO"?d.verAtacado:r.cat?.startsWith("OFICINA")?d.verOficina:d.verVarejo).map(r=>({...r,responsavel:resolveNome(r.responsavel,apelidoMap)||r.responsavel})),[d.fp,d.verVarejo,d.verAtacado,d.verOficina,apelidoMap])

  const biServices=useMemo(()=>d.verOficina?d.fo.map(r=>({...r,consultor:resolveNome(r.consultor,apelidoMap)||r.consultor})):[],[d.fo,d.verOficina,apelidoMap])
  const biHistoryPieces=useMemo(()=>d.comparisonHistory.pieces.filter(r=>isRevenueRecord(r)).filter(r=>r.cat==='ATACADO'?d.verAtacado:r.cat?.startsWith('OFICINA')?d.verOficina:d.verVarejo),[d.comparisonHistory.pieces,d.verVarejo,d.verAtacado,d.verOficina])
  const biHistoryServices=useMemo(()=>d.verOficina?d.comparisonHistory.services:[],[d.comparisonHistory.services,d.verOficina])
  const [printing,setPrinting]=useState(false)
  useEffect(()=>{const before=()=>flushSync(()=>setPrinting(true)),after=()=>setPrinting(false);window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);return()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after)}},[])
  const cmvTotal   = d.cmvVarejo + d.cmvAtacado + d.cmvWeb + d.cmvTelevendas + d.cmvPecOS
  const impTotal   = d.impVarejo + d.impAtacado + d.impWeb + d.impTelevendas + d.impPecOS
  const devolTotal = d.vare.devol + d.atac.devol + d.webL.devol + d.telev.devol + d.pof.devol
  const hojeTotal  = Object.values(d.vendaHojePorCanal).reduce((s, v) => s + v, 0)
  const totalSetores = (d.verVarejo ? d.vare.liquido + d.webL.liquido + d.telev.liquido : 0)
    + (d.verAtacado ? d.atac.liquido : 0)
    + (d.verOficina ? d.pof.liquido + d.pofGar.liquido + d.pofSeg.liquido + d.mor : 0)

  return (
    <>
    <div className="page no-print">

      {/* ── Barra de filtros ─────────────────────────────────────────────── */}
      <div className="filters-bar dash-top-bar">
        <FiltroAnoMes meses={d.mesesDisp} value={d.filtroMes} onChange={d.setFiltroMes} />
        <span className="dash-bar-sep" />
        {d.isAdmin && <FiltroDropdown compact label="Estado" options={d.optsEstado} value={d.filtroEstado} onChange={d.setFiltroEstado} />}
        <FiltroDropdown compact label="Loja" options={d.optsLojas} value={d.filtroLojas} onChange={d.setFiltroLojas} multi />
        {d.optsSupervisores.length > 0 && (
          <FiltroDropdown compact label="Supervisor" options={d.optsSupervisores} value={d.filtroSupervisor} onChange={d.setFiltroSupervisor} />
        )}
        {((d.filtroMes && d.filtroMes !== d.mesHoje) || (d.isAdmin && d.filtroEstado) || d.filtroLojas.length > 0 || d.filtroSupervisor) &&
          <button className="filter-clear" onClick={d.clearFiltros}>✕</button>}

        <span className="dash-bar-sep" />
        <div className="dash-bi-slot bi-toolbar" ref={setSlotVisao} />

        <div className="dash-right-tools no-print">
          <button className="dash-icon-action" onClick={() => d.setScrollAtivo(v => !v)} title={d.scrollAtivo ? 'Desativar scroll' : 'Ativar scroll'} aria-label="Alternar rolagem das tabelas">⇕</button>
          <button className="dash-icon-action" onClick={d.abrirExport} title="Exportar relatório" aria-label="Exportar relatório">⎙</button>
          {d.mesAtivo && <div className="dash-day-summary" aria-label="Dias úteis do período">
            <span><b>{d.diasMes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b> úteis</span><span><b>{d.diasDec.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b> passados</span><span className={d.diasFaltantes <= 3 ? 'c-red' : ''}><b>{d.diasFaltantes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</b> restantes</span>
          </div>}
          <div className="dash-bi-salvar bi-toolbar" ref={setSlotSalvar} />
        </div>
      </div>

      <Workspace pieces={biPieces} services={biServices} historyPieces={biHistoryPieces} historyServices={biHistoryServices} targets={biTargets} barra={barraBI}/>
      {/* ── Modal de exportação ────────────────────────────────────────────── */}
      {d.exportModal && (
        <Modal
          className="no-print"
          title="Imprimir / Exportar"
          onClose={() => d.setExportModal(false)}
          maxWidth={300}
          footer={<>
            <button className="btn btn-ghost btn-sm" onClick={() => d.setExportModal(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={d.imprimir} disabled={d.exportSels.size === 0 || d.gerando}>{d.gerando ? '⏳ Gerando PDF...' : '⎙ Gerar PDF'}</button>
          </>}
        >
          <div style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)', marginBottom: 16, marginTop: -8 }}>Selecione as seções a incluir:</div>
          {TODAS_SECOES.map(key => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              <input type="checkbox" checked={d.exportSels.has(key)} onChange={() => d.toggleExportSel(key)}
                style={{ width: 15, height: 15, accentColor: 'var(--honda)', cursor: 'pointer' }} />
              <span style={{ fontSize: 'var(--text-base)', fontWeight: d.exportSels.has(key) ? 600 : 400 }}>{SECOES_LABELS[key]}</span>
            </label>
          ))}
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <button style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
              onClick={() => d.setExportSels(new Set(TODAS_SECOES))}>Selecionar tudo</button>
            <span style={{ color: 'var(--text3)', fontSize: 'var(--text-sm)' }}>·</span>
            <button style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
              onClick={() => d.setExportSels(new Set())}>Limpar</button>
          </div>
        </Modal>
      )}
    </div>

    {/* ── Seção de impressão (CSS print) ────────────────────────────────────── */}
    {printing&&<div className="print-only snap-print">
      <PrintHeader estado={d.filtroEstado} tipo="Peças" mes={d.mesAtivo} diasDec={d.diasDec} diasMes={d.diasMes} ultimaAtualizacao={d.ultimaAtualizacao} />
      <div style={{ margin: '6px 0 4px', fontSize: 9, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visão Geral</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 8 }}>
        {d.verVarejo && d.vare.liquido + d.metaVarejo > 0 && (
          <PrintKpiCard label="Varejo" value={fmtBRL(d.vare.liquido)} status={getStatus(d.vare.liquido, d.metaVarejo)}
            badge={d.metaVarejo > 0 ? <StatusBadge pct={d.vare.proj / d.metaVarejo} /> : null}
            sub={printKpiSub(d.vare.proj, d.metaVarejo, d.vendaHojePorCanal.VAREJO ?? 0)} />
        )}
        {d.verVarejo && (d.webRows.length > 0 || d.metaWeb > 0) && (
          <PrintKpiCard label="Web" value={fmtBRL(d.webL.liquido)} status={getStatus(d.webL.liquido, d.metaWeb)}
            badge={d.metaWeb > 0 ? <StatusBadge pct={d.webL.proj / d.metaWeb} /> : null}
            sub={printKpiSub(d.webL.proj, d.metaWeb, d.vendaHojePorCanal.WEB ?? 0)} />
        )}
        {d.verVarejo && (d.televRows.length > 0 || d.metaTelevendas > 0) && (
          <PrintKpiCard label="Televendas" value={fmtBRL(d.telev.liquido)} status={getStatus(d.telev.liquido, d.metaTelevendas)}
            badge={d.metaTelevendas > 0 ? <StatusBadge pct={d.telev.proj / d.metaTelevendas} /> : null}
            sub={printKpiSub(d.telev.proj, d.metaTelevendas, d.vendaHojePorCanal.TELEVENDAS ?? 0)} />
        )}
        {d.verAtacado && d.atac.liquido + d.metaAtacado > 0 && (
          <PrintKpiCard label="Atacado" value={fmtBRL(d.atac.liquido)} status={getStatus(d.atac.liquido, d.metaAtacado)}
            badge={d.metaAtacado > 0 ? <StatusBadge pct={d.atac.proj / d.metaAtacado} /> : null}
            sub={printKpiSub(d.atac.proj, d.metaAtacado, d.vendaHojePorCanal.ATACADO ?? 0)} />
        )}
        {(d.verVarejo || d.verAtacado) && d.tPBalcao + d.metaTotalPecas > 0 && (
          <PrintKpiCard label="Total Peças" value={fmtBRL(d.tPBalcao)} status={getStatus(d.tPBalcao, d.metaTotalPecas)}
            badge={d.metaTotalPecas > 0 ? <StatusBadge pct={calcProjecao(d.tPBalcao, d.diasDec, d.diasMes) / d.metaTotalPecas} /> : null}
            sub={printKpiSub(calcProjecao(d.tPBalcao, d.diasDec, d.diasMes), d.metaTotalPecas, 0)} />
        )}
      </div>
      {(d.verVarejo || d.verAtacado) && (
        <>
          <div style={{ margin: '6px 0 4px', fontSize: 9, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Peças</div>
          <div>
            {d.verVarejo  && d.exportSels.has('varejo')     && <PrintCanalCard titulo="Varejo"     rows={d.printVarejoRows}  />}
            {d.verVarejo  && d.exportSels.has('web')        && <PrintCanalCard titulo="Web"        rows={d.printWebRows}     />}
            {d.verVarejo  && d.exportSels.has('televendas') && <PrintCanalCard titulo="Televendas" rows={d.printTelvRows}    />}
            {d.verAtacado && d.exportSels.has('atacado')    && <PrintCanalCard titulo="Atacado"    rows={d.printAtacadoRows} />}
          </div>
        </>
      )}
      {d.verOficina && (d.consultInPrint || d.mecanicosInPrint) && (
        <div style={{ breakBefore: 'page' }}>
          <PrintHeader estado={d.filtroEstado} tipo="Oficina" mes={d.mesAtivo} diasDec={d.diasDec} diasMes={d.diasMes} ultimaAtualizacao={d.ultimaAtualizacao} />
          <div style={{ margin: '6px 0 4px', fontSize: 9, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Visão Geral</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 8 }}>
            {d.mor + d.metaMO > 0 && (
              <PrintKpiCard label="Mão de Obra" value={fmtBRL(d.mor)} status={getStatus(d.mor, d.metaMO)}
                badge={d.metaMO > 0 ? <StatusBadge pct={calcProjecao(d.mor, d.diasDec, d.diasMes) / d.metaMO} /> : null}
                sub={printKpiSub(calcProjecao(d.mor, d.diasDec, d.diasMes), d.metaMO, 0)} />
            )}
            {d.pof.liquido + d.metaPecOSof > 0 && (
              <PrintKpiCard label="Peças OS" value={fmtBRL(d.pof.liquido)} status={getStatus(d.pof.liquido, d.metaPecOSof)}
                badge={d.metaPecOSof > 0 ? <StatusBadge pct={d.pof.proj / d.metaPecOSof} /> : null}
                sub={printKpiSub(d.pof.proj, d.metaPecOSof, 0)} />
            )}
          </div>
          {d.consultInPrint   && <PrintOficinaTabela rows={d.printConsultRows} titulo="Oficina"   label="Consultor" />}
          {d.mecanicosInPrint && <PrintOficinaTabela rows={d.printTecRows}     titulo="Mecânicos" label="Mecânico"  />}
        </div>
      )}
    </div>}
    </>
  )
}
