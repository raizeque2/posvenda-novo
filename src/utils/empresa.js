import { LOJAS } from '../data/regras.js'

/**
 * Empresa exibida no logo: AL só quando não existe nenhuma loja PE nos dados
 * carregados. Percorre até achar as duas UFs, em vez de montar arrays novos
 * com todas as vendas a cada render.
 */
export function empresaAtual(pecasPorMes) {
  let al = false
  let pe = false
  for (const rows of Object.values(pecasPorMes || {})) {
    for (const row of rows) {
      const uf = LOJAS[row.empresa]?.uf
      if (uf === 'AL') al = true
      else if (uf === 'PE') pe = true
      if (al && pe) return 'PE'
    }
  }
  return al && !pe ? 'AL' : 'PE'
}
