/**
 * Baixa um CSV no padrão do app (separador ";", BOM UTF-8 para o Excel abrir
 * com acento certo). `linhas` = array de arrays de valores já formatados.
 */
import {csvCell as q} from './csv.js'
export function baixarCSV(nomeArquivo, cabecalho, linhas) {
  const csv = [cabecalho, ...linhas].map(l => l.map(q).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}
