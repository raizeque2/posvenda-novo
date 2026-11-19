import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'
import PortalEntrada from './PortalEntrada.jsx'
import PortalArea from './PortalArea.jsx'

/**
 * Rota própria do portal (/portal). Sem sessão, mostra a entrada; com sessão
 * do portal, a área da pessoa; com sessão do sistema (admin/coordenação), volta
 * para o aplicativo — o portal não é um segundo menu do admin.
 */
export default function Portal() {
  const { user, carregando, portal } = useAuth()
  if (carregando) return null
  if (!user) return <PortalEntrada />
  if (portal !== true) return <Navigate to="/" replace />
  return <PortalArea />
}
