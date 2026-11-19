import { RainbowButton } from '../../components/ui/rainbow-button'
import { DropdownMenu } from '../../components/ui/dropdown-menu'
import { ArrowLeft, Lock } from '../../icons/iconoir'
import logoHorizontal from '../../assets/logo-login.webp'
import { usePortal } from './usePortal'
import Turnstile from '../../components/auth/Turnstile.jsx'
import { ETAPAS, iniciais, pessoasParaOpcoes } from './portal.logic'
import './portal.css'

/**
 * Entrada do portal: quem é você → senha. Parte do desenho do Login (mesma
 * faixa vermelha, mesmo card, mesma tipografia) e só mostra nome e loja antes
 * do login.
 */
export default function PortalEntrada() {
  const p = usePortal()
  const opcoes = pessoasParaOpcoes(p.pessoas)

  return (
    <div className="portal-entrada">
      <div className="portal-card">
        <div className="portal-stripe" />
        <header className="portal-head">
          <h1>Pós-Venda</h1>
          <p>{p.tipo === 'supervisor' ? 'Portal do supervisor' : p.tipo === 'colaborador' ? 'Portal do colaborador' : 'Portal da equipe'}</p>
        </header>

        <div className="portal-body">
          <div className="page-transition" key={p.etapa}>
            {p.etapa === ETAPAS.INICIO && (
              <div className="portal-inicio">
                <RainbowButton onClick={() => p.escolherTipo('colaborador')}>Entrar como colaborador</RainbowButton>
                <RainbowButton onClick={() => p.escolherTipo('supervisor')}>Entrar como supervisor</RainbowButton>
                <p className="portal-hint">Escolha seu nome na lista. Nenhum resultado aparece antes do login.</p>
              </div>
            )}

            {p.etapa === ETAPAS.PESSOA && (
              <div className="portal-selecao">
                <div className="portal-selecao-topo">
                  <button type="button" className="portal-voltar" onClick={p.voltar} aria-label="Voltar">
                    <ArrowLeft size={15} />
                  </button>
                  <h2>Quem é você?</h2>
                </div>
                {p.carregando ? (
                  <p className="portal-hint">Carregando a lista…</p>
                ) : opcoes.length ? (
                  <div className="portal-seletor">
                    <DropdownMenu
                      options={opcoes}
                      value={p.pessoaId}
                      onChange={p.escolherPessoa}
                      placeholder="Selecione seu nome"
                      ariaLabel="Selecionar pessoa"
                      searchable
                    />
                    <p className="portal-hint">Nome e loja aparecem aqui do mesmo jeito que no cadastro de colaboradores.</p>
                  </div>
                ) : (
                  <p className="portal-hint">Nenhuma pessoa cadastrada neste tipo de acesso. Fale com o administrador.</p>
                )}
                {p.erro && <p role="alert" className="portal-erro">{p.erro}</p>}
              </div>
            )}

            {p.etapa === ETAPAS.SENHA && p.pessoa && (
              <form className="portal-senha" onSubmit={p.entrar}>
                <div className="portal-pessoa">
                  <span className="portal-avatar" aria-hidden="true">{iniciais(p.pessoa.nome)}</span>
                  <div>
                    <strong>{p.pessoa.nome}</strong>
                    <small>{p.pessoa.loja}</small>
                  </div>
                </div>

                <div className="portal-campo">
                  <label htmlFor="portal-senha">Senha</label>
                  <input
                    id="portal-senha"
                    className="form-input"
                    type="password"
                    value={p.senha}
                    autoFocus
                    autoComplete={p.pessoa.primeiroAcesso ? 'new-password' : 'current-password'}
                    maxLength={128}
                    disabled={p.enviando}
                    onChange={event => p.setSenha(event.target.value)}
                  />
                </div>

                {p.pessoa.primeiroAcesso && (
                  <div className="portal-campo">
                    <label htmlFor="portal-confirmacao">Confirmar senha</label>
                    <input
                      id="portal-confirmacao"
                      className="form-input"
                      type="password"
                      value={p.confirmacao}
                      autoComplete="new-password"
                      maxLength={128}
                      disabled={p.enviando}
                      onChange={event => p.setConfirmacao(event.target.value)}
                    />
                  </div>
                )}

                <p className="portal-hint">
                  {p.pessoa.primeiroAcesso
                    ? 'Primeiro acesso: crie uma senha só sua, com pelo menos 8 caracteres, uma letra e um número.'
                    : 'Errou cinco vezes, o acesso é bloqueado e só o administrador libera de novo.'}
                </p>

                <Turnstile ref={p.turnstile} action="portal_login" onToken={p.setTurnstileToken} />

                {p.erro && <p role="alert" className="portal-erro">{p.erro}</p>}

                <div className="portal-acoes">
                  <button type="button" className="btn btn-ghost" onClick={p.voltar} disabled={p.enviando}>Voltar</button>
                  <button type="submit" className="btn btn-primary" disabled={p.enviando}>
                    <Lock size={13} />
                    {p.enviando ? 'Entrando…' : p.pessoa.primeiroAcesso ? 'Criar senha e entrar' : 'Entrar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="portal-rodape">
          <img src={logoHorizontal} alt="Pernambuco Motos" />
        </div>
      </div>
    </div>
  )
}
