import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'
import Workspace from '../bi/Workspace.jsx'
import { initial } from '../bi/model.js'
import '../bi/bi.css'
export default function PersonalBI() {
  const { token } = useParams(),
    [data, setData] = useState(null),
    [month, setMonth] = useState(''),
    [tab, setTab] = useState('bi'),
    [error, setError] = useState(''),
    [name, setName] = useState(''),
    [photo, setPhoto] = useState(''),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState('')
  useEffect(() => {
    let active = true
    setData(null)
    httpsCallable(
      functions,
      'portalBI',
    )({ token, month: month || undefined })
      .then((r) => {
        if (!active) return
        setData(r.data)
        setName(r.data.profile?.name || r.data.name)
        setPhoto(r.data.profile?.photo || '')
        setError('')
      })
      .catch(() => {
        if (active)
          setError(
            'Não foi possível abrir este link. Ele pode estar indisponível ou sua conexão falhou.',
          )
      })
    return () => {
      active = false
    }
  }, [token, month])
  async function upload(e) {
    try {
      const f = e.target.files[0]
      if (!f) return
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
        f.size > 8e6
      )
        throw Error('Use JPG, PNG ou WebP de até 8 MB.')
      const bitmap = await createImageBitmap(f),
        canvas = document.createElement('canvas')
      canvas.width = canvas.height = 256
      const ctx = canvas.getContext('2d'),
        side = Math.min(bitmap.width, bitmap.height)
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      )
      bitmap.close()
      setPhoto(canvas.toDataURL('image/jpeg', 0.8))
      setStatus('Foto pronta. Salve o perfil para aplicar.')
    } catch (e) {
      setStatus(e.message)
    }
  }
  async function save() {
    setBusy(true)
    try {
      const call = httpsCallable(functions, 'portalBI'),
        { data: current } = await call({ token, action: 'profile' })
      if (JSON.stringify(current.profile) !== JSON.stringify(data.profile))
        throw Error('Nome ou foto mudou em outro dispositivo. Recarregue antes de salvar para revisar a alteração.')
      await call({
        token,
        action: 'save',
        revision: current.revision,
        state: current.state || initial(),
        profile: { name: name.trim(), photo },
      })
      setStatus('Nome e foto salvos.')
      setData((d) => ({ ...d, profile: { name: name.trim(), photo } }))
    } catch (e) {
      setStatus(e.message || 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }
  if (error)
    return (
      <div className="bi-empty">
        {error}
        <button onClick={() => location.reload()}>Tentar novamente</button>
      </div>
    )
  if (!data) return <div className="bi-empty">Preparando seu espaço…</div>
  return (
    <main
      className="bi-workspace"
      style={{ maxWidth: 1400, margin: 'auto', padding: '25px' }}
    >
      <div className="bi-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {data.profile?.photo && (
            <img
              className="bi-profile-avatar"
              src={data.profile.photo}
              alt="Sua foto"
            />
          )}
          <div>
            <span className="bi-eyebrow">PÓS-VENDA • ESPAÇO PESSOAL</span>
            <h2>{data.profile?.name || data.name}</h2>
          </div>
        </div>
        <div className="bi-segment">
          <button
            onClick={() => setTab('bi')}
            className={tab === 'bi' ? 'active' : ''}
          >
            Meu desempenho
          </button>
          <button
            onClick={() => setTab('profile')}
            className={tab === 'profile' ? 'active' : ''}
          >
            Meu perfil
          </button>
        </div>
      </div>
      {tab === 'profile' ? (
        <section className="bi-account">
          <h2>Deixe com a sua cara</h2>
          <p>
            Seu nome de exibição e foto não alteram o vínculo com suas vendas.
          </p>
          {photo && (
            <img
              className="bi-profile-avatar"
              src={photo}
              alt="Prévia da foto"
            />
          )}
          <label>
            Nome de exibição
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Foto (opcional)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
            />
          </label>
          <button onClick={() => setPhoto('')}>Remover foto</button>
          <button
            className="primary"
            disabled={busy || !name.trim()}
            onClick={save}
          >
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </button>
          <p role="status">{status}</p>
        </section>
      ) : (
        <>
          <select
            aria-label="Mês de desempenho"
            value={data.month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {data.months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <Workspace
            key={token}
            token={token}
            scope="personal"
            personal
            person={data.name}
            pieces={data.pieces}
            services={data.services}
            targets={data.targets}
          />
        </>
      )}
    </main>
  )
}
