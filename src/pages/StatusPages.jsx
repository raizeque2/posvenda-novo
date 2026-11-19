import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAbas from '../hooks/useAbas.js'
import { Estado } from '../components/Estados.jsx'
import '../components/estados.css'

export function AcessoNegado() {
  const { inicio } = useAbas()
  return (
    <div className="page estado-pagina">
      <Estado tipo="bloqueado" titulo="Esta área não está liberada para o seu perfil" texto="O administrador define quais abas cada cargo e setor podem abrir. Se você precisa deste acesso, peça a liberação em Acessos.">
        <Link className="btn btn-primary" to={inicio}>Ir para minha área</Link>
      </Estado>
    </div>
  )
}

/** 404 dentro do app: oferece voltar e atalhos para as abas liberadas. */
export function NaoEncontrada() {
  const { abas, inicio } = useAbas()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const atalhos = abas.filter(a => a.path !== '/').slice(0, 4)
  return (
    <div className="page pagina-404">
      <section className="p404-texto">
        <span className="p404-codigo">Erro 404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço <code>{pathname}</code> não existe ou mudou de lugar. Volte para uma área válida do sistema.</p>
        <div className="p404-acoes">
          <Link className="btn btn-primary" to={inicio}>Ir para minha área</Link>
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Voltar</button>
        </div>
        {atalhos.length > 0 && (
          <nav className="p404-atalhos" aria-label="Atalhos">
            <span>Atalhos</span>
            {atalhos.map(a => <Link key={a.path} to={a.path}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><use href={`/icons/iconoir.svg#${a.icon}`} /></svg>{a.label}</Link>)}
          </nav>
        )}
      </section>
      <div className="p404-arte" aria-hidden="true"><b>404</b></div>
    </div>
  )
}
