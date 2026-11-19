// ── REGRAS DE PEÇAS ─────────────────────────────────────────────────────────
// Fonte: regra_pos_venda.xlsx aba Regra_Pecas
export const REGRA_PECAS = {
  "BONIFICAÇÃO BALCAO - CNH":                          { cat: "INTERNA",    meta: false, com: false },
  "BONIFICAÇÃO BALCÃO - NOVOS":                        { cat: "INTERNA",    meta: false, com: false },
  "BONIFICAÇÃO BALCÃO - PEÇAS":                        { cat: "INTERNA",    meta: false, com: false },
  "BONIFICAÇÃO BALCÃO - USADOS":                       { cat: "INTERNA",    meta: false, com: false },
  "COMPRA DA FÁBRICA":                                 { cat: "COMPRA",     meta: false, com: false },
  "COMPRA DE OUTRA CONCESSIONÁRIA":                    { cat: "COMPRA",     meta: false, com: false },
  "COMPRA DE OUTRO FORNECEDOR":                        { cat: "COMPRA",     meta: false, com: false },
  "DEVOLUÇÃO DE COMPRA":                               { cat: "DEV.COMPRA", meta: false, com: false },
  "DEVOLUÇÃO DE VENDA":                                { cat: "VAREJO",     meta: true,  com: true  },
  "DEVOLUÇÃO VENDA ATACADO":                           { cat: "ATACADO",    meta: true,  com: true  },
  "DEVOLUÇÃO VENDA WEB":                               { cat: "WEB",        meta: true,  com: true  },
  "DEVOLUÇÃO VENDAS POR O.S":                          { cat: "OFICINA",    meta: true,  com: true  },
  "ENTRADA POR TRANSFERÊNCIA":                         { cat: "COMPRA",     meta: false, com: false },
  "ENTRADA SIMPLES REMESSA":                           { cat: "COMPRA",     meta: false, com: false },
  "IMPLANTAÇÃO DE SALDO INICIAL":                      { cat: "COMPRA",     meta: false, com: false },
  "SAÍDA PARA TRANSFERÊNCIA":                          { cat: "TRANSF",     meta: false, com: false },
  "SAÍDA POR BONIFICAÇÃO OLEO GRATIS":                 { cat: "INTERNA",    meta: false, com: false },
  "SAÍDA SEGURADORA PAD":                              { cat: "OFICINA_SEG", meta: true,  com: true  },
  "SAÍDA SIMPLES REMESSA":                             { cat: "SAIDA",      meta: false, com: false },
  "USO FIRMA BALCAO - ADM":                            { cat: "INTERNA",    meta: false, com: false },
  "USO FIRMA BALCAO - CNH":                            { cat: "INTERNA",    meta: false, com: false },
  "USO FIRMA BALCAO - NOVOS":                          { cat: "INTERNA",    meta: false, com: false },
  "USO FIRMA BALCAO - OFICINA":                        { cat: "INTERNA",    meta: false, com: false },
  "USO FIRMA BALCAO - PEÇAS":                          { cat: "INTERNA",    meta: false, com: false },
  "USO FIRMA BALCAO - SEMINOVOS":                      { cat: "INTERNA",    meta: false, com: false },
  "USO FIRMA POR O.S. - ADM":                         { cat: "OFICINA_INT", meta: true,  com: true  },
  "USO FIRMA POR O.S. - MOTOS INT. (VEND. EXTERNO PC)": { cat: "OFICINA_INT", meta: true, com: true },
  "USO FIRMA POR O.S. - NOVOS":                        { cat: "OFICINA_INT", meta: true,  com: true  },
  "USO FIRMA POR O.S. - OFICINA":                      { cat: "INTERNA",    meta: false, com: false },
  "USO FIRMA POR O.S. - PEÇAS":                        { cat: "OFICINA_INT", meta: false, com: false },
  "USO FIRMA POR O.S. - SEMINOVOS":                    { cat: "OFICINA_INT", meta: true,  com: true  },
  "VENDA ATACADO":                                     { cat: "ATACADO",    meta: true,  com: true  },
  "VENDA ENTRE GRUPO":                                 { cat: "VAREJO",     meta: false, com: false },
  "VENDA GARANTIA POR O.S.":                           { cat: "OFICINA_GAR", meta: true,  com: true  },
  "VENDA POR O.S.":                                    { cat: "OFICINA",    meta: true,  com: true  },
  "VENDA SEGURADORA POR O.S.":                         { cat: "OFICINA_SEG", meta: true,  com: true  },
  "VENDA TELEVENDAS":                                  { cat: "TELEVENDAS", meta: true,  com: true  },
  "VENDA VAREJO":                                      { cat: "VAREJO",     meta: true,  com: true  },
  "VENDA WEB":                                         { cat: "WEB",        meta: true,  com: true  },
}

// ── REGRAS DE OFICINA ────────────────────────────────────────────────────────
// Fonte: regra_pos_venda.xlsx aba Regra_Oficina
// CORRIGIDO: adicionados os 6 tipos que constam no arquivo mas estavam faltando
export const REGRA_OFICINA = {
  "INTERNO - PEÇAS":                   { cat: "INTERNAS",          meta: false, com: false },
  "OLEO GRÁTIS - 7 REVISÕES":          { cat: "INTERNAS",          meta: false, com: false },
  "OLEO GRÁTIS - 7 REVISÕES ":         { cat: "INTERNAS",          meta: false, com: false }, // com espaço trailing
  "INTERNO - OFICINA":                  { cat: "INTERNAS",          meta: false, com: false },
  "1ª REVISÃO GRATUITA EXPRESSO":       { cat: "REV. GRATUITA",    meta: true,  com: true  },
  "2ª REVISÃO GRATUITA EXPRESSO":       { cat: "REV. GRATUITA",    meta: true,  com: true  },
  "EXTERNO EXPRESSO":                   { cat: "SERV. EXPRESSO",   meta: true,  com: true  },
  "00 - GARANTIA":                      { cat: "GARANTIA",         meta: true,  com: true  },
  "00 - RECALL":                        { cat: "GARANTIA",         meta: true,  com: true  },
  "INTERNO - ADMINISTRATIVO":           { cat: "INTERNAS",         meta: true,  com: true  },
  "INTERNO - LOGISTICA":                { cat: "INTERNAS",         meta: true,  com: true  },
  "INTERNO - NOVOS":                    { cat: "INTERNAS",         meta: true,  com: true  },
  "INTERNO - RETRABALHO - SEMINOVOS":   { cat: "INTERNAS",         meta: true,  com: true  },
  "INTERNO - SEMINOVOS":                { cat: "INTERNAS",         meta: true,  com: true  },
  "INTERNO - SEMINOVOS EM ESTOQUE":     { cat: "INTERNAS",         meta: true,  com: true  },
  "DIAGNÓSTICO":                        { cat: "MECÂNICA",         meta: true,  com: true  },
  "DIAGNÓSTICO EXTERNO":                { cat: "MECÂNICA",         meta: true,  com: true  },
  "EXTERNO":                            { cat: "MECÂNICA",         meta: true,  com: true  },
  "PROCESSO JUDICIAL":                  { cat: "MECÂNICA",         meta: true,  com: false },
  "REVISÃO PERIÓDICA":                  { cat: "REV. PERIÓDICA",   meta: true,  com: true  },
  // ── Os 6 que estavam faltando ──────────────────────────────────────────────
  "PROTEÇÃO VEÍCULAR":                  { cat: "MECÂNICA",         meta: true,  com: true  },
  "PROTEÇÃO VEÍCULAR - FRANQUIA":       { cat: "MECÂNICA",         meta: true,  com: true  },
  "RETRABALHO":                         { cat: "MECÂNICA",         meta: true,  com: true  },
  "SEGURADORA":                         { cat: "MECÂNICA",         meta: true,  com: true  },
  "SEGURADORA - FRANQUIA":              { cat: "MECÂNICA",         meta: true,  com: true  },
  "SEGURADORA - PAD":                   { cat: "MECÂNICA",         meta: true,  com: true  },
}

// ── LOJAS ────────────────────────────────────────────────────────────────────
export const LOJAS = {
  ARA: { uf: "AL", estado: "Alagoas",     un: "Arapiraca"    },
  PLT: { uf: "PE", estado: "Pernambuco",  un: "Paulista"     },
  PEI: { uf: "PE", estado: "Pernambuco",  un: "Peixinhos"    },
  GRA: { uf: "PE", estado: "Pernambuco",  un: "Graças"       },
  BEB: { uf: "PE", estado: "Pernambuco",  un: "Beberibe"     },
  IGA: { uf: "PE", estado: "Pernambuco",  un: "Igarassu"     },
  PAD: { uf: "PE", estado: "Pernambuco",  un: "Paudalho"     },
  JAB: { uf: "PE", estado: "Pernambuco",  un: "Jaboatão"     },
  BOA: { uf: "PE", estado: "Pernambuco",  un: "Boa Viagem"   },
  EZD: { uf: "PE", estado: "Pernambuco",  un: "Encruzilhada" },
  CAM: { uf: "PE", estado: "Pernambuco",  un: "Camaragibe"   },
  PIN: { uf: "PE", estado: "Pernambuco",  un: "Pina"         },
}

// ── COMISSÃO OPERACIONAL ─────────────────────────────────────────────────────
// Fonte: Regra_Comissao_Operacional — vigência 01/2026 a 12/2026
export const COMISSAO_OPERACIONAL = [
  { uf: "PE", cargo: "VENDEDOR DE PECAS",     cp: 0.012, cpo: 0,    cmo: 0     },
  { uf: "PE", cargo: "ASSISTENTE DE VENDAS",  cp: 0.005, cpo: 0,    cmo: 0     },
  { uf: "PE", cargo: "CONSULTOR TÉCNICO",     cp: 0,     cpo: 0.01, cmo: 0.02  },
  { uf: "PE", cargo: "CONSULTOR TECNICO",     cp: 0,     cpo: 0.01, cmo: 0.02  },
  { uf: "PE", cargo: "CONSULTOR E VENDEDOR",  cp: 0.01,  cpo: 0.01, cmo: 0.02  },
  { uf: "PE", cargo: "MECÂNICO",              cp: 0,     cpo: 0.01, cmo: 0.05  },
  { uf: "PE", cargo: "MECANICO",              cp: 0,     cpo: 0.01, cmo: 0.05  },
  { uf: "AL", cargo: "VENDEDOR DE PECAS EXTERNO", cp: 0.012, cpo: 0, cmo: 0   },
  { uf: "AL", cargo: "VENDEDOR DE PECAS",     cp: 0.01,  cpo: 0,    cmo: 0     },
  { uf: "AL", cargo: "ASSISTENTE DE VENDAS",  cp: 0.005, cpo: 0,    cmo: 0     },
  { uf: "AL", cargo: "CONSULTOR TÉCNICO",     cp: 0,     cpo: 0.01, cmo: 0.03  },
  { uf: "AL", cargo: "CONSULTOR TECNICO",     cp: 0,     cpo: 0.01, cmo: 0.03  },
  { uf: "AL", cargo: "MECÂNICO",              cp: 0,     cpo: 0.01, cmo: 0.01  },
  { uf: "AL", cargo: "MECANICO",              cp: 0,     cpo: 0.01, cmo: 0.01  },
  { uf: "AL", cargo: "AUXILIAR MECANICO",     cp: 0,     cpo: 0.01, cmo: 0.01  },
]

// ── COMISSÃO GESTÃO ──────────────────────────────────────────────────────────
// cp/cpo/cmo = 0 para todos: comissão individual zerada no buildRanking.
// Toda a remuneração de gestores vem do buildGestaoComissao (equipe + indicadores).
// Configuração nominativa é carregada do Firestore autenticado.
export const COMISSAO_GESTAO = []
