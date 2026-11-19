import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import AuthShell, { Alerta, Field, PasswordInput, SubmitButton, emailDeLogin } from '../components/auth/AuthShell.jsx'
import VerificacaoPopup from '../components/auth/VerificacaoPopup.jsx'
import { mensagemDeErro, verificarTurnstile } from '../services/authService.js'

const PAINEL = {
  titulo: 'Bom te ver de novo!',
  texto: 'Faturamento, metas e comissões de peças e oficina, atualizados em um só lugar.',
  cardTitulo: 'Entre com seu acesso',
  cardTexto: 'Use o usuário ou e-mail cadastrado pelo administrador. Cada perfil vê apenas o que está liberado para ele.',
}
const PREVIA = import.meta.env.MODE === 'preview'

export default function Login() {
  const { login, user, carregando, erroLogin } = useAuth()
  const { state } = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  // A verificação da Cloudflare só aparece ao clicar em Entrar, num popup no meio da tela.
  // Cada tentativa abre um widget novo (o token é de uso único).
  const [verificando, setVerificando] = useState(false)

  // Bloqueio pós-autenticação (perfil inexistente ou desativado) vem do contexto.
  useEffect(() => { if (erroLogin) { setLoading(false); setErro(erroLogin) } }, [erroLogin])

  if (!carregando && user) return <Navigate to={state?.de || '/'} replace />

  function entrar(event) {
    event.preventDefault()
    if (loading || verificando) return
    setErro('')
    setVerificando(true)
  }

  async function verificado(token) {
    setVerificando(false)
    setLoading(true)
    try {
      await verificarTurnstile('login', token)
      await login(emailDeLogin(email), senha)
    } catch (error) {
      setErro(mensagemDeErro(error, 'Não foi possível entrar. Tente novamente.'))
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Entrar no Pós-Venda" subtitle="Acesse com o usuário ou e-mail cadastrado." painel={PAINEL}>
      <form className="auth-form" onSubmit={entrar} noValidate>
        {state?.aviso && <Alerta tipo="ok">{state.aviso}</Alerta>}
        {PREVIA && <p className="auth-preview-note">Prévia local: usuário <strong>teste</strong> e senha <strong>teste</strong>.</p>}
        <Field id="login-usuario" label="Usuário ou e-mail">
          <input id="login-usuario" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} placeholder="seu.usuario" />
        </Field>
        <Field id="login-senha" label="Senha">
          <PasswordInput id="login-senha" value={senha} onChange={e => setSenha(e.target.value)} required disabled={loading} placeholder="Sua senha" />
        </Field>
        <div className="auth-row auth-enter">
          <Link className="auth-link" to="/esqueci-senha">Esqueci minha senha</Link>
        </div>
        <Alerta>{erro}</Alerta>
        <SubmitButton loading={loading} disabled={!email.trim() || !senha} loadingText="Entrando…">Entrar</SubmitButton>
        <p className="auth-muted auth-enter">Ainda não tem acesso? <Link className="auth-link" to="/registrar">Solicitar cadastro</Link></p>
      </form>
      <VerificacaoPopup aberto={verificando} action="login" texto="Confirme que é você para entrar. Leva só um instante." onToken={verificado} onFechar={() => setVerificando(false)} />
    </AuthShell>
  )
}
