// Comentário pelo celular do cliente (QR do totem). Público, sem login.
import { useEffect, useState } from 'react'
import { idValido } from '../../functions/src/nps.js'
import { npsPesquisa } from './Pesquisa.jsx'
import './pesquisa.css'

export default function Comentar() {
  const [id] = useState(() => new URLSearchParams(window.location.search).get('id') || '')
  const [comentario, setComentario] = useState('')
  const [estado, setEstado] = useState('carregando')
  const [erro, setErro] = useState('')

  async function verificar() {
    if (!idValido(id)) { setEstado('invalido'); return }
    setEstado('carregando')
    try {
      const { data } = await npsPesquisa({ acao: 'comentario', id })
      setEstado(data.situacao === 'aberto' ? 'pronto' : data.situacao)
    } catch (e) { setEstado(e?.code === 'functions/not-found' ? 'invalido' : 'indisponivel') }
  }
  useEffect(() => { document.title = 'Comentário · Alagoas Motos'; void verificar() }, [])

  async function enviar(e) {
    e.preventDefault()
    if (estado !== 'pronto' || !comentario.trim()) return
    setEstado('enviando'); setErro('')
    try { await npsPesquisa({ acao: 'comentar', id, comentario }); setEstado('comentado'); setComentario('') }
    catch (x) { setEstado('pronto'); setErro(x?.message || 'Não foi possível enviar. Tente novamente.') }
  }

  return <main className="nps-pesquisa mobile-feedback">
    <img src="/nps/alagoas-motos-logo.webp" alt="Alagoas Motos" className="mobile-feedback-logo" />
    <h1>{estado === 'comentado' ? 'Obrigado por compartilhar!' : 'Há algo específico que você gostaria de destacar sobre sua experiência?'}</h1>
    {estado === 'carregando' && <p role="status">Localizando sua avaliação…</p>}
    {estado === 'comentado' && <p>Seu comentário foi recebido e está vinculado à sua avaliação. Você já pode fechar esta página.</p>}
    {estado === 'expirado' && <p>O prazo para comentar esta avaliação terminou. Obrigado mesmo assim!</p>}
    {estado === 'invalido' && <p role="alert">Avaliação não encontrada. Escaneie de novo o QR code exibido no totem.</p>}
    {estado === 'indisponivel' && <><p>Não foi possível carregar agora.</p><button className="survey-primary" onClick={() => void verificar()}>Tentar novamente</button></>}
    {(estado === 'pronto' || estado === 'enviando') && <form onSubmit={enviar}>
      <label htmlFor="comment">Seu comentário, elogio ou sugestão</label>
      <textarea id="comment" value={comentario} onChange={e => setComentario(e.target.value)} maxLength={1200} rows={7} disabled={estado === 'enviando'} placeholder="Conte como foi sua experiência…" />
      <p className="mobile-feedback-hint">{comentario.length}/1200 caracteres. Não inclua dados pessoais.</p>
      <button className="survey-primary" type="submit" disabled={!comentario.trim() || estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Enviar comentário'}</button>
      {erro && <p className="survey-error" role="alert">{erro}</p>}
    </form>}
  </main>
}
