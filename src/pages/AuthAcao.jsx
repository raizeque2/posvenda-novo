// Destino dos links enviados pelo Firebase Auth (redefinir senha e confirmar
// e-mail). Configure no Console do Firebase → Authentication → Templates →
// "URL de ação personalizada" = https://<domínio>/auth/acao
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '../firebase.js'
import AuthShell, { Alerta, Field, PasswordInput, SubmitButton } from '../components/auth/AuthShell.jsx'
import { forcaSenha, mensagemDeErro, validarNovaSenha } from '../services/authService.js'

const PAINEL_SENHA = {
  titulo: 'Senha nova, acesso de volta',
  texto: 'Escolha uma senha que você não usa em outros sites. Ela vale para o Pós-Venda em qualquer dispositivo.',
  cardTitulo: 'Dica de senha forte',
  cardTexto: 'Pelo menos 8 caracteres misturando letras e números. Uma frase curta costuma ser fácil de lembrar e difícil de adivinhar.',
}
const PAINEL_EMAIL = {
  titulo: 'E-mail confirmado, conta protegida',
  texto: 'Com o e-mail confirmado você consegue recuperar a senha sozinho quando precisar.',
  cardTitulo: 'Por que confirmar?',
  cardTexto: 'Garante que avisos e links de redefinição cheguem só para você.',
}
const ICONE = ok => <span className={`auth-success-icon${ok ? '' : ' is-erro'}`}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><use href={`/icons/iconoir.svg#${ok ? 'check' : 'warning-triangle'}`} /></svg></span>

function RedefinirSenha({ code }) {
  const navigate = useNavigate()
  const [fase, setFase] = useState('verificando') // verificando | form | invalido
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let vivo = true
    verifyPasswordResetCode(auth, code)
      .then(conta => { if (vivo) { setEmail(conta); setFase('form') } })
      .catch(error => { if (vivo) { setErro(mensagemDeErro(error, 'Este link é inválido ou expirou.')); setFase('invalido') } })
    return () => { vivo = false }
  }, [code])

  async function salvar(event) {
    event.preventDefault()
    const problema = validarNovaSenha(senha, confirmacao)
    if (problema) { setErro(problema); return }
    setErro('')
    setLoading(true)
    try {
      await confirmPasswordReset(auth, code, senha)
      navigate('/login', { replace: true, state: { aviso: 'Senha alterada. Entre com a senha nova.' } })
    } catch (error) {
      setErro(mensagemDeErro(error))
      setLoading(false)
    }
  }

  if (fase === 'verificando') return <AuthShell title="Conferindo o link…" painel={PAINEL_SENHA}><p className="auth-muted" role="status"><span className="ui-spinner" aria-hidden="true" /> Validando o link de redefinição.</p></AuthShell>
  if (fase === 'invalido') return (
    <AuthShell title="Link indisponível" painel={PAINEL_SENHA}>
      <div className="auth-success">{ICONE(false)}<p>{erro}</p><Link className="auth-secondary" to="/esqueci-senha">Pedir um novo link</Link></div>
    </AuthShell>
  )
  const nivel = forcaSenha(senha)
  return (
    <AuthShell title="Criar senha nova" subtitle={<>Conta <strong>{email}</strong></>} painel={PAINEL_SENHA}>
      <form className="auth-form" onSubmit={salvar} noValidate>
        <Field id="nova-senha" label="Senha nova" hint="Mínimo de 8 caracteres, com letras e números.">
          <PasswordInput id="nova-senha" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" disabled={loading} describedBy="nova-senha-hint nova-senha-forca" />
          <div id="nova-senha-forca" className="auth-strength" data-nivel={nivel} aria-label={`Força da senha: ${['vazia', 'fraca', 'razoável', 'boa', 'forte'][nivel]}`}><i /><i /><i /><i /></div>
        </Field>
        <Field id="nova-senha-2" label="Repita a senha">
          <PasswordInput id="nova-senha-2" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} autoComplete="new-password" disabled={loading} />
        </Field>
        <Alerta>{erro}</Alerta>
        <SubmitButton loading={loading} disabled={!senha || !confirmacao} loadingText="Salvando…">Salvar senha</SubmitButton>
      </form>
    </AuthShell>
  )
}

function ConfirmarEmail({ code }) {
  const [estado, setEstado] = useState({ fase: 'verificando', erro: '' })
  useEffect(() => {
    let vivo = true
    applyActionCode(auth, code)
      .then(async () => { await auth.currentUser?.reload?.(); if (vivo) setEstado({ fase: 'ok', erro: '' }) })
      .catch(error => vivo && setEstado({ fase: 'erro', erro: mensagemDeErro(error, 'Este link é inválido ou expirou.') }))
    return () => { vivo = false }
  }, [code])
  return (
    <AuthShell title={estado.fase === 'ok' ? 'E-mail confirmado' : estado.fase === 'erro' ? 'Não deu para confirmar' : 'Confirmando e-mail…'} painel={PAINEL_EMAIL}>
      {estado.fase === 'verificando'
        ? <p className="auth-muted" role="status"><span className="ui-spinner" aria-hidden="true" /> Validando o link.</p>
        : <div className="auth-success" role="status">{ICONE(estado.fase === 'ok')}<p>{estado.fase === 'ok' ? 'Tudo certo. Seu e-mail está confirmado.' : estado.erro}</p>
            <Link className="auth-secondary" to={estado.fase === 'ok' ? '/' : '/verificar-email'}>{estado.fase === 'ok' ? 'Continuar' : 'Enviar novo link'}</Link></div>}
    </AuthShell>
  )
}

export default function AuthAcao() {
  const [params] = useSearchParams()
  const mode = params.get('mode'), code = params.get('oobCode') || ''
  if (code && mode === 'resetPassword') return <RedefinirSenha code={code} />
  if (code && mode === 'verifyEmail') return <ConfirmarEmail code={code} />
  return (
    <AuthShell title="Link incompleto" painel={PAINEL_SENHA}>
      <div className="auth-success">{ICONE(false)}<p>Abra o link exatamente como chegou no e-mail. Se o problema continuar, peça um novo.</p><Link className="auth-secondary" to="/login">Ir para o login</Link></div>
    </AuthShell>
  )
}
