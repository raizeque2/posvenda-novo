import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import AuthShell, { Alerta, AuthSelect, Field, PasswordInput, SubmitButton } from '../components/auth/AuthShell.jsx'
import VerificacaoPopup from '../components/auth/VerificacaoPopup.jsx'
import { forcaSenha, mensagemDeErro } from '../services/authService.js'
import { CARGOS_PEDIDO, SETORES_CADASTRO, problemaDaSenha } from '../../functions/src/cadastroPolicy.js'

const PAINEL = {
  titulo: 'Peça seu acesso em um minuto',
  texto: 'Escolha seu setor e cargo e crie sua senha. O administrador confere e libera o acesso.',
  cardTitulo: 'Aprovação do administrador',
  cardTexto: 'Sua conta fica bloqueada até a aprovação. O administrador confirma o cargo e as áreas que você vai usar.',
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Registro() {
  const { user, carregando } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [setor, setSetor] = useState('')
  const [cargo, setCargo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [verificando, setVerificando] = useState(false)

  if (!carregando && user) return <Navigate to="/" replace />

  // Valida os campos primeiro; a verificação da Cloudflare só abre com tudo certo.
  function enviar(event) {
    event.preventDefault()
    if (loading || verificando) return
    const proximos = {}
    if (nome.trim().length < 2) proximos.nome = 'Informe seu nome completo.'
    if (!EMAIL.test(email.trim())) proximos.email = 'Informe um e-mail válido.'
    if (!setor) proximos.setor = 'Escolha o seu setor.'
    if (!cargo) proximos.cargo = 'Escolha o seu cargo.'
    const senhaRuim = problemaDaSenha(senha)
    if (senhaRuim) proximos.senha = senhaRuim
    else if (senha !== confirmacao) proximos.confirmacao = 'As senhas não são iguais.'
    setErros(proximos)
    if (Object.keys(proximos).length) return
    setErro('')
    setVerificando(true)
  }

  async function verificado(token) {
    setVerificando(false)
    setLoading(true)
    try {
      await httpsCallable(functions, 'solicitarAcesso')({ nome: nome.trim(), email: email.trim().toLowerCase(), setor, cargo, senha, turnstileToken: token })
      setSenha(''); setConfirmacao('')
      setSucesso(true)
    } catch (error) {
      setErro(mensagemDeErro(error, 'Não foi possível enviar agora. Confira os dados e tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  if (sucesso) return (
    <AuthShell title="Solicitação enviada" painel={PAINEL}>
      <div className="auth-success" role="status">
        <span className="auth-success-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><use href="/icons/iconoir.svg#check" /></svg></span>
        <p>Recebemos o pedido de <strong>{email.trim().toLowerCase()}</strong>. Assim que o administrador aprovar, é só entrar com esse e-mail e a senha que você criou.</p>
        <p>Se esse e-mail já tinha acesso ou um pedido em andamento, nada muda: fale com o administrador.</p>
        <Link className="auth-secondary" to="/login">Voltar para o login</Link>
      </div>
    </AuthShell>
  )

  const nivel = forcaSenha(senha)
  return (
    <AuthShell title="Solicitar cadastro" subtitle="O acesso é liberado depois da aprovação do administrador." painel={PAINEL}>
      <form className="auth-form" onSubmit={enviar} noValidate>
        <Field id="cadastro-nome" label="Nome completo" error={erros.nome}>
          <input id="cadastro-nome" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} maxLength={100} disabled={loading} placeholder="Como está no cadastro da empresa" aria-invalid={!!erros.nome} aria-describedby={erros.nome ? 'cadastro-nome-erro' : undefined} />
        </Field>
        <Field id="cadastro-email" label="E-mail" error={erros.email}>
          <input id="cadastro-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} disabled={loading} placeholder="nome@empresa.com.br" aria-invalid={!!erros.email} aria-describedby={erros.email ? 'cadastro-email-erro' : undefined} />
        </Field>
        <div className="auth-duas">
          <Field id="cadastro-setor" label="Setor" error={erros.setor}>
            <AuthSelect id="cadastro-setor" value={setor} onChange={setSetor} options={SETORES_CADASTRO} disabled={loading} invalid={!!erros.setor} />
          </Field>
          <div className={`auth-field auth-enter${erros.cargo ? ' has-error' : ''}`} role="radiogroup" aria-labelledby="cadastro-cargo-rotulo">
            <span id="cadastro-cargo-rotulo" className="auth-rotulo">Cargo</span>
            <div className="auth-segmento">
              {CARGOS_PEDIDO.map(c => <button key={c.value} type="button" role="radio" aria-checked={cargo === c.value} disabled={loading} onClick={() => setCargo(c.value)}>{c.label}</button>)}
            </div>
            {erros.cargo && <small className="auth-field-error" role="alert">{erros.cargo}</small>}
          </div>
        </div>
        <Field id="cadastro-senha" label="Crie uma senha" error={erros.senha} hint="Mínimo de 8 caracteres, com letras e números.">
          <PasswordInput id="cadastro-senha" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" disabled={loading} describedBy="cadastro-senha-hint cadastro-senha-forca" />
          <div id="cadastro-senha-forca" className="auth-strength" data-nivel={nivel} aria-label={`Força da senha: ${['vazia', 'fraca', 'razoável', 'boa', 'forte'][nivel]}`}><i /><i /><i /><i /></div>
        </Field>
        <Field id="cadastro-senha-2" label="Repita a senha" error={erros.confirmacao}>
          <PasswordInput id="cadastro-senha-2" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} autoComplete="new-password" disabled={loading} />
        </Field>
        <Alerta>{erro}</Alerta>
        <SubmitButton loading={loading} loadingText="Enviando…">Solicitar cadastro</SubmitButton>
        <p className="auth-muted auth-enter">Já tem acesso? <Link className="auth-link" to="/login">Entrar</Link></p>
      </form>
      <VerificacaoPopup aberto={verificando} action="cadastro" texto="Confirme que é você para enviar o pedido. Leva só um instante." onToken={verificado} onFechar={() => setVerificando(false)} />
    </AuthShell>
  )
}
