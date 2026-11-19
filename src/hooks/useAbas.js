import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import useStore from '../store.js'
import { MODULOS, abasPermitidas, podeAcessar, rotaInicial, temInicio } from '../data/permissoes.js'

/** Abas da pessoa logada (ordem configurada) e checagem de rota. */
export default function useAbas() {
  const { role, setor } = useAuth()
  const permissoes = useStore(s => s.permissoes)
  return useMemo(() => {
    const configuradas = abasPermitidas(role, permissoes, setor)
    // Início não é configurável: admin já o recebe na lista; coordenador e supervisor ganham no topo.
    const paths = temInicio(role) && !configuradas.includes('/') ? ['/', ...configuradas] : configuradas
    const porPath = Object.fromEntries(MODULOS.map(m => [m.path, m]))
    return {
      abas: paths.map(p => porPath[p]).filter(Boolean),
      pode: path => podeAcessar(role, path, permissoes, setor),
      inicio: rotaInicial(role, permissoes, setor),
    }
  }, [role, setor, permissoes])
}
