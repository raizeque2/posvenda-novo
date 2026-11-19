import { useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import useStore from '../store.js'
import useAbas from '../hooks/useAbas.js'
import PageLoading from './PageLoading.jsx'
import { AcessoNegado } from '../pages/StatusPages.jsx'

/**
 * Sem `area`: só exige sessão (usado em volta do layout inteiro).
 * Com `area`: aplica a política de abas (cargo + setor) — a mesma que monta o
 * menu e que o servidor usa em lerDadosAutorizados.
 */
export default function PrivateRoute({ children, area = false }) {
  const { user, role, carregando } = useAuth()
  const permissoesCarregadas = useStore(s => s.permissoesCarregadas)
  const { pode, inicio } = useAbas()
  const { pathname } = useLocation()

  if (carregando) return null
  if (!user) return <Navigate to="/login" replace state={{ de: pathname }} />
  if (!area) return children
  if (role !== 'admin' && !permissoesCarregadas) return <PageLoading />
  if (pode(pathname)) return children
  // Início é exclusivo do administrador: os demais vão direto para a primeira aba liberada.
  if (pathname === '/') return <Navigate to={inicio} replace />
  return <AcessoNegado />
}
