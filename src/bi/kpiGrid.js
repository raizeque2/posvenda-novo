// Grade dos cards de canal: cada card ocupa 1 a 3 colunas (Compacto, Duplo, Triplo) e as
// linhas sempre fecham certinho. Por dentro a grade tem 420 subcolunas (divisível por 1 a 7
// colunas, para os 7 cards caberem numa linha só no computador): a sobra de uma linha incompleta é dividida igualmente entre os cards dela, em vez
// de esticar só o último (que fazia um card "Compacto" parecer Duplo).
export const TAMANHO_MAXIMO = 3
export const SUBCOLUNAS = 420
export const COLUNAS_MAXIMAS = 7

export function colunasDaGrade(largura, gap = 16) {
  if (!largura) return 4
  // Computador: largura mínima pequena para os 7 cards caberem numa linha mesmo com a sidebar aberta;
  // o próprio card se compacta quando fica estreito (bi.css, @container).
  const minimo = largura <= 600 ? 150 : 112
  return Math.max(1, Math.min(COLUNAS_MAXIMAS, Math.floor((largura + gap) / (minimo + gap))))
}

// Devolve, por id, { span: colunas escolhidas (já limitadas), sub: subcolunas ocupadas }.
export function arrumarKpis(ids, tamanhos = {}, colunas = 4) {
  const cols = Math.max(1, Math.min(COLUNAS_MAXIMAS, colunas))
  const unidade = SUBCOLUNAS / cols
  const out = new Map()
  let linha = [], resto = cols
  const fecharLinha = () => {
    if (!linha.length) return
    const usadas = linha.reduce((s, id) => s + out.get(id).span, 0)
    const sobra = (cols - usadas) * unidade
    const extra = Math.floor(sobra / linha.length)
    let ultimoExtra = sobra - extra * linha.length
    for (const id of linha) {
      const item = out.get(id)
      item.sub = item.span * unidade + extra + (ultimoExtra-- > 0 ? 1 : 0)
    }
    linha = []; resto = cols
  }
  for (const id of ids) {
    const span = Math.max(1, Math.min(Number(tamanhos[id]) || 1, TAMANHO_MAXIMO, cols))
    if (span > resto) fecharLinha()
    out.set(id, { span, sub: span * unidade }); linha.push(id); resto -= span
    if (resto === 0) fecharLinha()
  }
  fecharLinha()
  return out
}

export function moverPara(ids, id, alvo) {
  const de = ids.indexOf(id), para = ids.indexOf(alvo)
  if (de < 0 || para < 0 || de === para) return ids
  const novo = [...ids]
  novo.splice(de, 1)
  novo.splice(para, 0, id)
  return novo
}
