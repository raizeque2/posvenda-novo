import { useState, useMemo } from 'react'
import {RainbowButton} from '../../components/ui/rainbow-button'
import { CardHead, ValorInput, SeletorUnico } from '../../components/AnalysisDS.jsx'
import { useToast } from '../../hooks/useToast.jsx'
import { salvarRegrasOS } from '../../services/osMonitor.js'
import { GRUPOS_DEFAULT, SITUACOES_EXCLUIDAS_DEFAULT, grupoDoTipo } from '../../services/processamento/processarOS.js'

const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()

export function AbaRegrasOS({ regras, setRegras, tiposConhecidos = [], situacoesConhecidas = [], canEdit }) {
  const toast = useToast()

  const inicial = useMemo(() => ({
    grupos: (regras.grupos?.length ? regras.grupos : GRUPOS_DEFAULT).map(g => ({ ...g })),
    tipoOverrides: { ...(regras.tipoOverrides || {}) },
    situacoesExcluidas: (regras.situacoesExcluidas || SITUACOES_EXCLUIDAS_DEFAULT).map(norm),
  }), [regras])

  const [local, setLocal]       = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo]       = useState(false)

  const sujo = JSON.stringify(local) !== JSON.stringify(inicial)

  const opcoesGrupo = local.grupos.map(g => ({ value: g.key, label: g.label }))
  const situacoes   = [...new Set([...situacoesConhecidas.map(norm), ...local.situacoesExcluidas])].filter(Boolean).sort()

  function editarCorte(key, campo, valor) {
    setLocal(p => ({ ...p, grupos: p.grupos.map(g => g.key === key ? { ...g, [campo]: valor } : g) }))
  }
  function moverTipo(tipo, grupoKey) {
    setLocal(p => ({ ...p, tipoOverrides: { ...p.tipoOverrides, [norm(tipo)]: grupoKey } }))
  }
  function toggleExcluida(sit) {
    setLocal(p => ({ ...p, situacoesExcluidas: p.situacoesExcluidas.includes(sit) ? p.situacoesExcluidas.filter(s => s !== sit) : [...p.situacoesExcluidas, sit] }))
  }

  async function salvar() {
    setSalvando(true)
    try {
      await salvarRegrasOS({ grupos: local.grupos, tipoOverrides: local.tipoOverrides, situacoesExcluidas: local.situacoesExcluidas })
      setRegras({ grupos: local.grupos, tipoOverrides: local.tipoOverrides, situacoesExcluidas: local.situacoesExcluidas })
      setSalvo(true); setTimeout(() => setSalvo(false), 3000)
    } catch (e) {
      toast?.(e.message||'Não foi possível salvar. Verifique sua conexão e tente novamente.', 'error', 6000)
    } finally {
      setSalvando(false)
    }
  }
  function descartar() { setLocal(inicial) }

  return (
    <div>
      {/* Cortes de dias por grupo */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <div className="card-header">
          <span className="card-title">Criticidade por grupo (dias em aberto)</span>
          {!canEdit && <span className="badge badge-gray" style={{ marginLeft: 'var(--space-sm)' }}>Somente leitura</span>}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Grupo</th>
                <th style={{ textAlign: 'center', width: 110 }}>Moderado &gt;</th>
                <th style={{ textAlign: 'center', width: 110 }}>Crítico &gt;</th>
                <th style={{ textAlign: 'center', width: 110 }}>Extremo &gt;</th>
              </tr>
            </thead>
            <tbody>
              {local.grupos.map(g => (
                <tr key={g.key}>
                  <td style={{ fontSize: 'var(--text-base)' }}>{g.label}</td>
                  {g.judicial ? (
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>categoria à parte — não classifica por dias</td>
                  ) : (
                    <>
                      <td style={{ textAlign: 'center' }}><ValorInput tipo="inteiro" readOnly={!canEdit} min={0} max={3650} largura={56} value={g.moderado} onSave={v => editarCorte(g.key, 'moderado', v)} /></td>
                      <td style={{ textAlign: 'center' }}><ValorInput tipo="inteiro" readOnly={!canEdit} min={0} max={3650} largura={56} value={g.critico}  onSave={v => editarCorte(g.key, 'critico', v)} /></td>
                      <td style={{ textAlign: 'center' }}><ValorInput tipo="inteiro" readOnly={!canEdit} min={0} max={3650} largura={56} value={g.extremo}  onSave={v => editarCorte(g.key, 'extremo', v)} /></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Abaixo de "Moderado" a O.S. é <strong>Normal</strong>. Cada Tipo O.S. cai num grupo por palavra-chave — ajuste abaixo quem caiu errado.</p>
      </div>

      {/* Tipo O.S. → grupo */}
      {tiposConhecidos.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
          <CardHead title="Tipo de O.S. → grupo" badge={`${tiposConhecidos.length} tipos`} />
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Tipo O.S.</th><th style={{ width: 240 }}>Grupo</th></tr></thead>
              <tbody>
                {tiposConhecidos.map(tipo => {
                  const atual = grupoDoTipo(tipo, local.grupos, local.tipoOverrides).key
                  return (
                    <tr key={tipo}>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{tipo}</td>
                      <td>
                        {canEdit
                          ? <SeletorUnico value={atual} onChange={v => v && moverTipo(tipo, v)} options={opcoesGrupo} mostrarLimpar={false} />
                          : <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text2)' }}>{opcoesGrupo.find(o => o.value === atual)?.label || atual}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Situações excluídas */}
      <div className="card" style={{ marginBottom: 'var(--space-md)' }}>
        <CardHead title="Situações que NÃO entram na foto" badge="encerradas" />
        <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          {situacoes.length === 0 && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>Nenhuma situação carregada ainda.</span>}
          {situacoes.map(sit => (
            <label key={sit} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-base)', cursor: canEdit ? 'pointer' : 'default' }}>
              <input type="checkbox" disabled={!canEdit} checked={local.situacoesExcluidas.includes(sit)} onChange={() => toggleExcluida(sit)} style={{ accentColor: 'var(--honda)', cursor: canEdit ? 'pointer' : 'default' }} />
              {sit}
            </label>
          ))}
        </div>
      </div>

      {canEdit && sujo && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', alignItems: 'center' }}>
          {salvo && <span style={{ color: 'var(--green)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>✓ Salvo</span>}
          <button className="btn btn-ghost btn-sm" onClick={descartar} disabled={salvando}>Descartar</button>
          <RainbowButton className="btn btn-sm" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar regras'}</RainbowButton>
        </div>
      )}
    </div>
  )
}

