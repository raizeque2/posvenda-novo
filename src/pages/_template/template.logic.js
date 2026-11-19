/**
 * template.logic.js — funções puras de cálculo.
 * Renomear para [nome-pagina].logic.js ao copiar o template.
 *
 * Regras:
 *  ✅ Somente funções puras (entrada → saída, sem efeitos)
 *  ✅ Toda lógica de negócio, filtros e agregações ficam aqui
 *  ✅ Fácil de testar isoladamente
 *  ❌ Nunca importar React, store ou componentes aqui
 */

import { fmtBRL } from '../../utils/formatacao.js'

/**
 * Filtra e agrega os dados brutos conforme os filtros ativos.
 * @param {Array}  brutos  — linhas cruas vindas do store (pecasPorMes[mes])
 * @param {Object} filtros — { mes, loja, ... }
 * @returns {{ dados: Array, kpis: Array }}
 */
export function calcularDados(brutos, filtros) {
  // 1. Filtrar
  const filtrados = brutos.filter(r => {
    if (filtros.loja && r.loja !== filtros.loja) return false
    return true
  })

  // 2. Agregar / transformar
  const dados = filtrados.map(r => ({
    id:    r.id    ?? r.codigo,
    nome:  r.nome  ?? r.colaborador ?? '',
    loja:  r.loja  ?? '',
    valor: r.valor ?? r.total ?? 0,
  }))

  // 3. KPIs — substitua com os indicadores reais da página
  const totalValor = dados.reduce((s, r) => s + r.valor, 0)
  const kpis = [
    { label: 'Total', valor: fmtBRL(totalValor) },
    { label: 'Registros', valor: String(dados.length) },
  ]

  return { dados, kpis }
}
