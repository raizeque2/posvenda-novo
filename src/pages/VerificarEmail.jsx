import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { sendEmailVerification } from 'firebase/auth'
import { useAuth } from '../contexts/AuthContext.jsx'
import AuthShell, { Alerta } from '../components/auth/AuthShell.jsx'
import { mensagemDeErro } from '../services/authService.js'

const PAINEL = {
  titulo: 'Falta só confirmar seu e-mail',
  texto: 'Mandamos um link para o endereço da sua conta. É ele que permite recuperar a senha sem depender de ninguém.',
  cardTitulo: 'Não chegou?',
  cardTexto: 'Espere um minuto e confira o spam. Se precisar, peça outro link — o anterior deixa de valer.',
}
const ESPERA = 60

export default function VerificarEmail() {
  const { user, carregando } = useAuth()
  const navigate = useNavigate()
  const [msg, setMsg] = useState({ tipo: 'info', texto: '' })
  const [loading, setLoading] = useState(false)
  const [espera, setEspera] = useState(0)

  useEffect(() => {
    if (!espera) return
    const id = setTimeout(() => setEspera(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [espera])

  if (carregando) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.emailVerified) return <Navigate to="/" replace />

  async function enviar() {
    setLoading(true)
    try {
      await sendEmailVerification(user)
      setMsg({ tipo: 'ok', texto: `Link enviado para ${user.email}.` })
      setEspera(ESPERA)
    } catch (error) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(error, 'Não foi possível enviar agora. Tente de novo em instantes.') })
    } finally { setLoading(false) }
  }
  async function jaConfirmei() {
    setLoading(true)
    try {
      await user.reload?.()
      if (user.emailVerified) navigate('/', { replace: true })
      else setMsg({ tipo: 'info', texto: 'Ainda não identificamos a confirmação. Abra o link do e-mail e tente de novo.' })
    } catch (error) {
      setMsg({ tipo: 'erro', texto: mensagemDeErro(error) })
    } finally { setLoading(false) }
  }

  return (
    <AuthShell title="Verifique seu e-mail" subtitle={<>Conta <strong>{user.email}</strong></>} painel={PAINEL}>
      <div className="auth-form">
        <Alerta tipo={msg.tipo}>{msg.texto}</Alerta>
        <button type="button" className="auth-submit auth-enter" onClick={enviar} disabled={loading || espera > 0} aria-busy={loading || undefined}>
          {espera > 0 ? `Reenviar em ${espera}s` : 'Enviar link de confirmação'}
        </button>
        <button type="button" className="auth-secondary auth-enter" onClick={jaConfirmei} disabled={loading}>Já confirmei</button>
        <p className="auth-muted auth-enter"><Link className="auth-link" to="/">Fazer isso depois</Link></p>
      </div>
    </AuthShell>
  )
}
