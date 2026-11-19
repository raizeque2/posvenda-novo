import { useState } from 'react'
import { SlidersHorizontal } from '../icons/iconoir'
import { FiltroDropdown, FiltroAnoMes } from '../components/DS.jsx'
import { useMetas } from './metas/useMetas.js'
import { MetasTabela } from './metas/MetasTable.jsx'

export default function Metas() {
  const m = useMetas()
  const [suggestions, setSuggestions] = useState(false)
  const nAlterados = Object.keys(m.rascunho).length

  return (
    <>
    <div className="page">
      <div className="filters-bar minimal-filters" data-tour="metas-filters">
        <FiltroAnoMes meses={m.mesesDisp} value={m.filtroMes} onChange={m.setFiltroMes} />
        <span className="dash-bar-sep" />
        <FiltroDropdown compact label="Estado" options={m.estadoOpts} value={m.filtroEstado}
          onChange={v => m.setFiltrosGlobais({ estado: v === m.filtroEstado ? '' : v, lojas: [] })} />
        <FiltroDropdown compact label="Loja" options={m.lojaOpts} value={m.filtroLojas}
          onChange={v => m.setFiltrosGlobais({ lojas: v })} multi />
        <FiltroDropdown compact label="Supervisor" options={m.supervisorOpts} value={m.filtroSupervisor}
          onChange={v => m.setFiltroSupervisor(v === m.filtroSupervisor ? '' : v)} />
        <FiltroDropdown compact label="Cargo" options={m.cargoOpts} value={m.filtroCargo}
          onChange={m.setFiltroCargo} multi />
        <input
          className="form-input"
          placeholder="Buscar nome..."
          aria-label="Buscar colaborador"
          value={m.filtroNome}
          onChange={e => m.setFiltroNome(e.target.value)}
          style={{ width: 160, fontSize: 'var(--text-sm2)', height: 30 }}
        />
        {!m.soLeitura && <button className="btn btn-ghost btn-sm" style={{marginLeft:'auto'}} onClick={()=>setSuggestions(!suggestions)} aria-expanded={suggestions}><SlidersHorizontal size={15}/> Sugerir metas</button>}
      </div>
      {suggestions && <section className="goal-suggestions"><div><strong>Ajuste sugerido</strong><p>Revise os valores na tabela antes de salvar.</p></div>        {!m.soLeitura && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>Sugestão:</span>
            <input aria-label="Ajuste percentual das sugestões" type="range" min="-0.1" max="0.3" step="0.01" value={m.fator} onChange={e => m.setFator(Number(e.target.value))} style={{ width: 80 }} />
            <span style={{ fontSize: 'var(--text-sm2)', fontWeight: 'var(--weight-bold)', minWidth: 34, color: m.fator >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {m.fator >= 0 ? '+' : ''}{Math.round(m.fator * 100)}%
            </span>
            <button className="btn btn-ghost btn-sm" onClick={m.aplicarSugestoes}>Aplicar sugestões</button>
          </div>
        )}</section>}

      {!m.soLeitura && (nAlterados > 0 || m.salvo) && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          backdropFilter: 'blur(10px)',
          background: 'var(--bg2)',
          borderBottom: '1px solid rgba(15,23,42,0.10)',
          boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
          padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {m.salvo ? (
            <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--green)', fontWeight: 'var(--weight-semibold)' }}>
              ✓ Alterações salvas
            </span>
          ) : (
            <>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)' }}>
                Alterações não salvas
              </span>
              <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>
                {nAlterados} colaborador{nAlterados !== 1 ? 'es' : ''} alterado{nAlterados !== 1 ? 's' : ''}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={m.descartarMetas} disabled={m.salvando}>
                  Descartar
                </button>
                <button className="btn btn-primary btn-sm" onClick={m.salvarTudo} disabled={m.salvando}>
                  {m.salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="tab-nav">
        <button className={`tab-btn${m.abaAtiva === 'pecas'   ? ' active' : ''}`} onClick={() => m.setAbaAtiva('pecas')}>Peças</button>
        <button className={`tab-btn${m.abaAtiva === 'oficina' ? ' active' : ''}`} onClick={() => m.setAbaAtiva('oficina')}>Oficina</button>
      </div>

      <MetasTabela m={m} canais={m.canaisAtivos} secoes={m.secoesAba} />
    </div>
    </>
  )
}
