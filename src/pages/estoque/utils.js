export function fmtK(v)    { return v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v.toFixed(0)}` }
export function fmtPct(v)  { if (v == null || isNaN(v)) return '–'; return `${(v*100).toFixed(1)}%` }
export function corCobertura(dias) {
  if (dias == null) return 'var(--text3)'
  if (dias <= 50)   return 'var(--green)'
  if (dias <= 65)   return 'var(--amber)'
  return 'var(--red-critical)'
}
export function fmtData(d)      { if (!d) return '–'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}` }
export function fmtMesAno(d)    { if (!d) return '–'; const [y,m] = d.split('-'); return `${m}/${y}` }
export function fmtDataCurta(d) { if (!d) return '–'; const [,m,dd] = d.split('-'); return `${dd}/${m}` }
export function isoParaMesAno(d){ if (!d) return ''; const [y,m] = d.split('-'); return `${m}/${y}` }

export const CURVAS_ORDER = ['CURVA_A','CURVA_B','CURVA_C','CURVA_D','CURVA_E','SEM_DATA']
export const MESES_ABREV  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
