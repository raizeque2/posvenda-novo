import { useEffect, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'
import useStore from '../store.js'
import { LOJAS } from '../data/regras.js'
import { sortMesAno } from '../utils/datas.js'
import './bi.css'
const IS_PREVIEW = import.meta.env.MODE === 'preview'
export default function LinksAdmin() {
  const { colaboradoresPorMes } = useStore(),
    [name, setName] = useState(''),
    [links, setLinks] = useState([]),
    [url, setUrl] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false),
    [stateFilter, setStateFilter] = useState(''),
    [storeFilter, setStoreFilter] = useState(''),
    [sectorFilter, setSectorFilter] = useState(''),
    [message, setMessage] = useState('')
  const month = Object.keys(colaboradoresPorMes).sort(sortMesAno).at(-1)
  const collaborators = Object.values(colaboradoresPorMes[month] || {}).filter(c => c.ativo !== false && c.colaborador)
  const stores = [...new Set(collaborators.map(c => c.loja).filter(Boolean))].sort()
  const sectors = [...new Set(collaborators.flatMap(c => (c.cargo_movimento || c.centro_custo || '').split(';').map(s => s.trim()).filter(Boolean)))].sort()
  const filtered = collaborators.filter(c =>
    (!stateFilter || LOJAS[c.loja]?.uf === stateFilter) &&
    (!storeFilter || c.loja === storeFilter) &&
    (!sectorFilter || (c.cargo_movimento || c.centro_custo || '').split(';').map(s => s.trim()).includes(sectorFilter))
  )
  const names = [...new Set(collaborators.map(c => c.colaborador))].sort()
  async function load() {
    try {
      setLinks(
        (await httpsCallable(functions, 'gerenciarLinkBI')({ action: 'list' }))
          .data.links,
      )
    } catch {
      setStatus(
        'Não foi possível carregar os links. Confira a implantação das funções BI.',
      )
    }
  }
  useEffect(() => {
    if (!IS_PREVIEW) load()
  }, [])
  async function create() {
    if (!name || busy) return
    setBusy(true)
    setUrl('')
    try {
      const { data } = await httpsCallable(functions, 'criarLinkBI')({ name })
      setUrl(`${location.origin}/pessoal/${data.token}`)
      setStatus('Link criado. Copie e guarde este endereço antes de sair.')
      await load()
    } catch (e) {
      setStatus(e.message)
    } finally {
      setBusy(false)
    }
  }
  async function revoke(id) {
    if (
      !confirm(
        'Revogar este link? O perfil será preservado, mas o endereço deixará de abrir.',
      )
    )
      return
    try {
      await httpsCallable(
        functions,
        'gerenciarLinkBI',
      )({ action: 'revoke', id })
      await load()
      setStatus('Link revogado. Os demais continuam funcionando.')
    } catch (e) {
      setStatus(e.message)
    }
  }
  async function createBatch() {
    if (IS_PREVIEW || busy || !filtered.length) return
    setBusy(true)
    setMessage('')
    const lines = ['Links individuais de desempenho:', '']
    let created = 0
    try {
      for (const person of filtered) {
        const { data } = await httpsCallable(functions, 'criarLinkBI')({ name: person.colaborador })
        lines.push(`${person.colaborador}: ${location.origin}/pessoal/${data.token}`)
        created++
      }
      lines.push('', 'Cada link abre apenas o perfil da pessoa indicada. Guarde esta mensagem em local seguro.')
      setMessage(lines.join('\n'))
      setStatus(`${created} links criados. Copie a mensagem antes de sair desta página.`)
      await load()
    } catch {
      if (created) {
        setMessage([...lines, '', `Criação interrompida após ${created} links. Copie estes endereços antes de tentar novamente.`].join('\n'))
      }
      setStatus(`Falha ao gerar os links. ${created} de ${filtered.length} foram criados; os restantes não foram processados.`)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="bi-workspace">
      <div className="bi-heading">
        <div>
          <span className="bi-eyebrow">ACESSOS INDIVIDUAIS</span>
          <h2>Um espaço para cada colaborador</h2>
          <p>
            Link permanente, nome, foto e visualizações independentes. Quem
            recebe o link consegue acessar o desempenho daquela pessoa.
          </p>
        </div>
      </div>
      <p hidden={!IS_PREVIEW} role="note">Links pessoais permanentes estão disponíveis no aplicativo conectado. Esta prévia não cria endereços de acesso para outras pessoas.</p>
      <div className="bi-link-batch">
        <h3>Mensagem única para WhatsApp</h3>
        <p>Escolha as pessoas por estado, loja e setor. Cada colaborador recebe um endereço individual e permanente.</p>
        <p><strong>Privacidade:</strong> quem receber a mensagem completa poderá abrir todos os perfis listados. Envie a mensagem apenas ao responsável por distribuir cada link individualmente.</p>
        <div className="bi-link-filters">
          <label>Estado <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setStoreFilter('') }}><option value="">Todos</option>{[...new Set(stores.map(s => LOJAS[s]?.uf).filter(Boolean))].sort().map(uf => <option key={uf}>{uf}</option>)}</select></label>
          <label>Loja <select value={storeFilter} onChange={e => setStoreFilter(e.target.value)}><option value="">Todas</option>{stores.filter(s => !stateFilter || LOJAS[s]?.uf === stateFilter).map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Setor <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}><option value="">Todos</option>{sectors.map(s => <option key={s}>{s}</option>)}</select></label>
        </div>
        <p>{filtered.length} colaborador{filtered.length === 1 ? '' : 'es'} selecionado{filtered.length === 1 ? '' : 's'}{filtered.length > 30 ? ' · selecione até 30 pessoas por mensagem' : ''}.</p>
        <button className="primary" disabled={IS_PREVIEW || busy || !filtered.length || filtered.length > 30} onClick={createBatch}>{busy ? 'Gerando links…' : 'Gerar links e mensagem'}</button>
        {message && <div className="bi-link-result"><label>Mensagem pronta<textarea readOnly value={message} rows={Math.min(18, filtered.length + 4)} onFocus={e => e.target.select()} /></label><button onClick={async () => { try { await navigator.clipboard.writeText(message); setStatus('Mensagem copiada.') } catch { setStatus('Selecione o texto da mensagem para copiar.') } }}>Copiar mensagem</button><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a></div>}
      </div>
      <div className="bi-toolbar">
        <select
          aria-label="Colaborador do novo link"
          value={name}
          onChange={(e) => setName(e.target.value)}
        >
          <option value="">Selecione o colaborador</option>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <button className="primary" disabled={IS_PREVIEW || !name || busy} onClick={create}>
          {busy ? 'Criando…' : 'Criar link permanente'}
        </button>
      </div>
      {url && (
        <div className="bi-account" style={{ maxWidth: '100%' }}>
          <input
            aria-label="Novo link permanente"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url)
                setStatus('Link copiado.')
              } catch {
                setStatus('Selecione o endereço acima para copiar.')
              }
            }}
          >
            Copiar link
          </button>
        </div>
      )}
      <p role="status">{status}</p>
      <div className="bi-records">
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Criado em</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td>{l.name}</td>
                <td>{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                <td>{l.active ? 'Ativo' : 'Revogado'}</td>
                <td>
                  <button disabled={!l.active} onClick={() => revoke(l.id)}>
                    Revogar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small>
        Criar outro link preserva o anterior e inicia um perfil independente.
        Por segurança, o endereço completo só é mostrado na criação.
      </small>
    </section>
  )
}
