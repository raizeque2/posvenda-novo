// Tamanho mínimo do motivo do bônus manual — fonte única (usada em
// Comissoes.jsx e BonInput.jsx; estava duplicada nos dois, valor 20 nos dois
// lugares, até 02/09/2026).
export const MIN_MOTIVO = 15

export const RANK_SORT_FNS = {
  nome:        c => c.nome || '',
  cargo:       c => c.cargo || '',
  loja:        c => c.lojas?.[0] || '',
  comValMO:    c => c.comValMO,
  bonValMO:    c => c.bonValMO,
  comValPO:    c => c.comValPO,
  bonValPO:    c => c.bonValPO,
  comValP:     c => c.comValP,
  bonValP:     c => c.bonValP,
  comTotal:    c => c.comTotal,
  bonCalc:     c => c.bonCalc,
  bon:         c => c.bon,
  totalComBon: c => c.totalComBon,
}

export const CARGO_ABREV = {
  'VENDEDOR DE PECAS EXTERNO': 'VEND. PEÇAS EXT.',
  'VENDEDOR DE PECAS':         'VEND. PEÇAS',
  'ASSISTENTE DE VENDAS':      'ASSIST. VENDAS',
  'CONSULTOR TÉCNICO':         'CONS. TÉCNICO',
  'CONSULTOR TECNICO':         'CONS. TÉCNICO',
  'CONSULTOR E VENDEDOR':      'CONS. E VEND.',
  'MECÂNICO':                  'MECÂNICO',
  'MECANICO':                  'MECÂNICO',
  'AUXILIAR MECANICO':         'AUX. MECÂNICO',
}

export const CANAL_LABEL = {
  tp: 'Peças Total', mo: 'M.O', pocoficina: 'Peças OS', web: 'Web', televendas: 'Televendas', varejo:'Varejo', atacado:'Atacado',
}

export const abrevCargo = c => CARGO_ABREV[c?.toUpperCase()] || c || '–'
