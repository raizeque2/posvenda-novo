// A política de abas é a mesma no navegador e no servidor: ver
// functions/src/tabPolicy.js. Este arquivo só reexporta para o app.
export {
  MODULOS, MODULOS_CONFIGURAVEIS, CARGOS, SETORES, PERMISSOES_PADRAO,
  normalizePermissions, abasPermitidas, podeAcessar, rotaInicial, tetoDoCargo, temInicio,
} from '../../functions/src/tabPolicy.js'

/** Agrupa abas por seção como a sidebar desenha: seções na ordem em que aparecem. */
export function agruparPorSecao(abas) {
  const secoes = [...new Set(abas.map(a => a.section))]
  return secoes.map(secao => ({ secao, abas: abas.filter(a => a.section === secao) }))
}
