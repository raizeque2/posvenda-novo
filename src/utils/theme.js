/**
 * theme.js — ponte entre os Design Tokens (src/theme/tokens.css) e código que
 * não pode ler `var(--token)` diretamente (bibliotecas de gráfico como Recharts,
 * que exigem uma cor já resolvida no atributo SVG `fill`/`stroke`).
 *
 * Uso: resolveVar('var(--honda)') → '#cc0000' (lido do tokens.css em tempo real).
 * Se o valor não for uma referência var(--...), devolve o próprio valor sem alterar.
 */
export function resolveVar(valor) {
  if (typeof valor !== 'string' || !valor.startsWith('var(')) return valor
  const nomeToken = valor.slice(4, -1).split(',')[0].trim()
  const resolvido = getComputedStyle(document.documentElement).getPropertyValue(nomeToken).trim()
  return resolvido || valor
}
