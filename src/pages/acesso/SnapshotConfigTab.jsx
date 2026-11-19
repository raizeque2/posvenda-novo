import { useState, useEffect } from 'react'
import useStore from '../../store.js'
import { gerarToken, dataExpiracao, urlSnapshot } from '../../utils/snapshot.js'
import { useConfirm } from '../../hooks/useConfirm.jsx'
import { genUUID } from '../../utils/formatacao.js'
import { Clipboard, Check, X, AlertTriangle, Package, Wrench, Lock } from '../../icons/iconoir'

const IS_PREVIEW = import.meta.env.MODE === 'preview'
const SLOTS = [
  { estado: 'PE', tipo: 'pecas',   label: 'Pernambuco · Peças',  icon: Package },
  { estado: 'PE', tipo: 'oficina', label: 'Pernambuco · Oficina', icon: Wrench },
  { estado: 'AL', tipo: 'pecas',   label: 'Alagoas · Peças',      icon: Package },
  { estado: 'AL', tipo: 'oficina', label: 'Alagoas · Oficina',    icon: Wrench },
]

export function SnapshotConfigTab() {
  const { snapshotConfig, salvarSnapshotConfig, publicarSnapshots } = useStore()
  const [tokens, setTokens]       = useState({})
  const [copiado, setCopiado]     = useState({})
  const [configs, setConfigs]     = useState({})
  const [publicando, setPublicando] = useState(false)
  const [pubStatus, setPubStatus]   = useState(null)
  const [pubErro, setPubErro]       = useState('')
  const { confirm, modal: confirmModal } = useConfirm()
  const baseUrl = window.location.origin

  useEffect(() => { setConfigs(snapshotConfig.configs || {}) }, [snapshotConfig.configs])

  useEffect(() => {
    if (!snapshotConfig.chaveSecreta) return
    Promise.all(
      SLOTS.map(async ({ estado, tipo }) => {
        const key   = `${estado}-${tipo}`
        const chave = snapshotConfig.configs?.[key]?.chaveOverride || snapshotConfig.chaveSecreta
        return { key, token: await gerarToken(chave, estado, tipo) }
      })
    ).then(results => {
      const map = {}
      results.forEach(({ key, token }) => { map[key] = token })
      setTokens(map)
    })
  }, [snapshotConfig])

  async function copiar(estado, tipo) {
    const key = `${estado}-${tipo}`
    await navigator.clipboard.writeText(urlSnapshot(baseUrl, estado, tipo, tokens[key]))
    setCopiado(c => ({ ...c, [key]: true }))
    setTimeout(() => setCopiado(c => ({ ...c, [key]: false })), 2000)
  }

  async function toggleAtivo(key, valor) {
    const novos = { ...configs, [key]: { ...configs[key], ativo: valor } }
    setConfigs(novos)
    await salvarSnapshotConfig({ ...snapshotConfig, configs: novos })
  }

  async function revogar(key, estado, tipo) {
    if (!await confirm(`Revogar o link "${key}" invalida o acesso imediatamente. Confirmar?`)) return
    const novaChave = snapshotConfig.chaveSecreta + '_' + key + '_' + Date.now()
    const novos = { ...configs, [key]: { ...configs[key], chaveOverride: novaChave } }
    setConfigs(novos)
    await salvarSnapshotConfig({ ...snapshotConfig, configs: novos })
    setTokens(t => ({ ...t, [key]: null }))
    gerarToken(novaChave, estado, tipo).then(tok => setTokens(t => ({ ...t, [key]: tok })))
  }

  async function publicarAgora() {
    setPublicando(true); setPubStatus(null); setPubErro('')
    try { await publicarSnapshots(); setPubStatus('ok') }
    catch (e) { setPubStatus('erro'); setPubErro(e?.message || String(e)) }
    finally { setPublicando(false); setTimeout(() => { setPubStatus(null); setPubErro('') }, 10000) }
  }

  async function revogarTodos() {
    if (!await confirm('Revogar TODOS os links invalida todos os acessos imediatamente. Confirmar?')) return
    const novaChave   = genUUID()
    const novosConfigs = {}
    Object.keys(configs).forEach(k => { novosConfigs[k] = { ...configs[k], chaveOverride: undefined } })
    await salvarSnapshotConfig({ ...snapshotConfig, chaveSecreta: novaChave, configs: novosConfigs })
    const map = {}
    for (const { estado, tipo } of SLOTS) map[`${estado}-${tipo}`] = await gerarToken(novaChave, estado, tipo)
    setTokens(map)
    setConfigs(novosConfigs)
  }

  return (
    <>
    <div style={{ maxWidth: 580 }}>
      <h3>Links por setor · visão da equipe</h3>
      <p className="note" style={{ marginBottom: 16 }}>Quem receber estes links poderá consultar os resultados da equipe do setor. Para compartilhar somente os resultados de uma pessoa, use os links individuais.</p>
      {IS_PREVIEW && <p className="note" style={{ marginBottom: 16 }}>Snapshots demonstrativos: configuração e atualização ficam neste navegador. O compartilhamento de links exige o aplicativo conectado.</p>}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 'var(--text-sm2)', color: 'var(--text2)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Lock size={14} strokeWidth={1.75} style={{ flexShrink: 0 }} />
        <span>Links válidos até <strong>{dataExpiracao()}</strong> — renovam automaticamente no dia 1 de cada mês.</span>
      </div>

      {SLOTS.map(({ estado, tipo, label, icon: Icon }) => {
        const key = `${estado}-${tipo}`
        const cfg = configs[key] || { ativo: true }
        const url = tokens[key] ? urlSnapshot(baseUrl, estado, tipo, tokens[key]) : 'Gerando…'
        return (
          <div key={key} style={{ border: '1px solid var(--border2)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 10, opacity: cfg.ativo === false ? 0.6 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon size={16} strokeWidth={1.75} style={{ color: 'var(--text2)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)' }}>{label}</span>
              <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.ativo !== false} onChange={e => toggleAtivo(key, e.target.checked)} style={{ accentColor: 'var(--honda)' }} />
                Ativo
              </label>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius)', padding: '7px 10px', fontSize: 'var(--text-sm)', fontFamily: 'monospace', color: 'var(--text2)', marginBottom: 10, wordBreak: 'break-all', lineHeight: 1.5 }}>
              {url}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)', fontSize: 'var(--text-sm)' }} onClick={() => revogar(key, estado, tipo)}>Revogar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => copiar(estado, tipo)} disabled={IS_PREVIEW || !tokens[key]} style={{ marginLeft: 'auto' }}>
                {copiado[key] ? <><Check size={12} style={{ marginRight: 4 }} /> Copiado!</> : <><Clipboard size={12} style={{ marginRight: 4 }} /> Copiar link</>}
              </button>
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={revogarTodos} style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>
          <AlertTriangle size={12} style={{ marginRight: 4 }} /> Revogar todos os links
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {pubStatus === 'ok'   && <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--green)', fontWeight: 'var(--weight-semibold)', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={13} /> {IS_PREVIEW ? 'Snapshots atualizados localmente' : 'Snapshots publicados'}</span>}
          {pubStatus === 'erro' && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--red)', fontWeight: 'var(--weight-semibold)', maxWidth: 300, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: 4 }}><X size={13} /> {pubErro || 'Erro ao publicar'}</span>}
          <button className="btn btn-primary btn-sm" onClick={publicarAgora} disabled={publicando}>
            {publicando ? 'Atualizando…' : IS_PREVIEW ? 'Atualizar snapshots locais' : '↑ Publicar snapshots agora'}
          </button>
        </div>
      </div>
    </div>
    {confirmModal}
    </>
  )
}
