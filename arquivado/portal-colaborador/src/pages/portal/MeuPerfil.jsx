import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, Check } from '../../icons/iconoir'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { salvarPerfilPortal } from '../../services/portalService.js'
import { descreverErro, iniciais } from './portal.logic.js'
import './portal.css'

const LADO = 96
const LIMITE = 115000

/** Reduz a foto para um quadrado pequeno — cabe no documento do perfil. */
async function comprimir(file) {
  const bitmap = await createImageBitmap(file)
  const menor = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = LADO
  canvas.height = LADO
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, (bitmap.width - menor) / 2, (bitmap.height - menor) / 2, menor, menor, 0, 0, LADO, LADO)
  bitmap.close?.()
  let url = canvas.toDataURL('image/jpeg', 0.72)
  if (url.length > LIMITE) url = canvas.toDataURL('image/jpeg', 0.5)
  return url
}

/**
 * Configurações do perfil no portal: a pessoa altera apenas a foto e o nome
 * de exibição. Nome de cadastro, loja, metas e cargo continuam com o
 * administrador (o servidor recusa qualquer outro campo).
 */
export default function MeuPerfil() {
  const { nome, nomeExibicao, foto, aplicarPerfilLocal } = useAuth()
  const input = useRef(null)
  const [exibicao, setExibicao] = useState(nomeExibicao || nome || '')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [local, setLocal] = useState(foto)

  useEffect(() => { setExibicao(nomeExibicao || nome || '') }, [nomeExibicao, nome])
  useEffect(() => { setLocal(foto) }, [foto])

  async function enviar(alteracoes, mensagem) {
    setEnviando(true)
    setErro('')
    setOk('')
    try {
      await salvarPerfilPortal(alteracoes)
      aplicarPerfilLocal(alteracoes)
      setOk(mensagem)
    } catch (e) {
      setErro(descreverErro(e))
    } finally {
      setEnviando(false)
    }
  }

  async function escolherFoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!/^image\/(?:jpeg|png|webp)$/.test(file.type)) { setErro('Envie uma imagem JPEG, PNG ou WebP.'); return }
    if (file.size > 6_000_000) { setErro('A imagem precisa ter menos de 6 MB.'); return }
    try {
      await enviar({ foto: await comprimir(file) }, 'Foto atualizada.')
    } catch {
      setErro('Não foi possível preparar a imagem.')
    }
  }

  async function salvarNome(event) {
    event.preventDefault()
    const limpo = exibicao.trim()
    if (limpo.length < 2 || limpo.length > 60) { setErro('O nome de exibição precisa ter entre 2 e 60 caracteres.'); return }
    await enviar({ nomeExibicao: limpo }, 'Nome de exibição atualizado.')
  }

  return (
    <div className="page">
      <div className="operations-header" style={{ marginBottom: 8 }}>
        <div>
          <p>Configurações</p>
          <h1>Meu perfil</h1>
          <span>Você pode alterar a foto e o nome de exibição. Os demais dados ficam com o administrador.</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Foto</span></div>
        <div className="portal-perfil-foto">
          <span className="portal-avatar">{local ? <img src={local} alt="" /> : iniciais(nomeExibicao || nome)}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={enviando} onClick={() => input.current?.click()}>
              <Upload size={13} /> Trocar foto
            </button>
            {local && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={enviando} onClick={() => enviar({ foto: null }, 'Foto removida.')}>
                <Trash2 size={13} /> Remover
              </button>
            )}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={escolherFoto} />
          </div>
        </div>
        <p className="note">A imagem é reduzida e guardada no seu perfil. Sem a foto, aparecem as iniciais do nome.</p>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Nome de exibição</span></div>
        <form onSubmit={salvarNome} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="portal-campo" style={{ flex: 1, minWidth: 220 }}>
            <label htmlFor="portal-exibicao">Como você aparece no portal</label>
            <input
              id="portal-exibicao"
              className="form-input"
              type="text"
              value={exibicao}
              maxLength={60}
              disabled={enviando}
              onChange={event => setExibicao(event.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={enviando || exibicao.trim() === (nomeExibicao || nome || '')}>
            <Check size={13} /> Salvar
          </button>
        </form>
        <p className="note">O nome do cadastro de colaboradores ({nome}) continua valendo para metas e comissões.</p>
      </div>

      {erro && <p role="alert" className="portal-erro">{erro}</p>}
      {ok && <p role="status" className="note" style={{ color: 'var(--green)' }}>{ok}</p>}
    </div>
  )
}
