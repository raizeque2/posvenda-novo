import { useState } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase.js'
import AuthShell, { Alerta, Field, SubmitButton, emailDeLogin } from '../components/auth/AuthShell.jsx'
import VerificacaoPopup from '../components/auth/VerificacaoPopup.jsx'
import { mensagemDeErro, verificarTurnstile } from '../services/authService.js'

const PAINEL = {
  titulo: 'Esqueceu a senha? Acontece.',
  texto: 'Informe o usuário ou e-mail cadastrado. Se ele existir, mandamos um link seguro para você criar uma senha nova.',
  cardTitulo: 'Siga o link do e-mail',
  cardTexto: 'O link vale por pouco tempo e só pode ser usado uma vez. Não achou? Confira a caixa de spam ou de lixo eletrônico.',
}
// Erros que não devem revelar se a conta existe.
const SILENCIOSOS = ['auth/user-not-found', 'auth/invalid-email', 'auth/missing-email']

export default function EsqueciSenha() {
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [verificando, setVerificando] = useState(false)

  function enviar(event) {
    event.preventDefault()
    if (loading || verificando || !valor.trim()) return
    setErro('')
    setVerificando(true)
  }

  async function verificado(token) {
    setVerificando(false)
    setLoading(true)
    try {
      await verificarTurnstile('reset_senha', token)
      await sendPasswordResetEmail(auth, emailDeLogin(valor))
      setEnviado(true)
    } catch (error) {
      if (SILENCIOSOS.includes(error?.code)) setEnviado(true)
      else setErro(mensagemDeErro(error, 'Não foi possível enviar o link agora. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  if (enviado) return (
    <AuthShell title="Confira seu e-mail" painel={PAINEL}>
      <div className="auth-success" role="status">
        <span className="auth-success-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><use href="/icons/iconoir.svg#mail-in" /></svg></span>
        <p>Se houver uma conta para <strong>{valor.trim()}</strong>, você vai receber um link para redefinir a senha em alguns minutos.</p>
        <p>Usuários sem e-mail próprio (login curto) devem pedir a redefinição ao administrador.</p>
        <div className="auth-row">
          <Link className="auth-secondary" to="/login">Voltar para o login</Link>
          <button type="button" className="auth-link" onClick={() => setEnviado(false)}>Enviar de novo</button>
        </div>
      </div>
    </AuthShell>
  )

  return (
    <AuthShell title="Redefinir senha" subtitle="Enviaremos as instruções para o e-mail da conta." painel={PAINEL}>
      <form className="auth-form" onSubmit={enviar} noValidate>
        <Field id="reset-email" label="Usuário ou e-mail">
          <input id="reset-email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={valor} onChange={e => setValor(e.target.value)} required disabled={loading} placeholder="nome@empresa.com.br" />
        </Field>
        <Alerta>{erro}</Alerta>
        <SubmitButton loading={loading} disabled={!valor.trim()} loadingText="Enviando…">Enviar link</SubmitButton>
        <p className="auth-muted auth-enter"><Link className="auth-link" to="/login">← Voltar para o login</Link></p>
      </form>
      <VerificacaoPopup aberto={verificando} action="reset_senha" texto="Confirme que é você para receber o link. Leva só um instante." onToken={verificado} onFechar={() => setVerificando(false)} />
    </AuthShell>
  )
}
