/**
 * Calcula a data da Páscoa pelo algoritmo de Butcher
 */
function getEaster(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

const addDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/**
 * Retorna feriados nacionais brasileiros para o ano dado
 * Inclui fixos e móveis (Carnaval, Sexta Santa, Corpus Christi)
 */
export function feriadosNacionais(ano) {
  const pascoa = getEaster(ano)
  return [
    new Date(ano, 0, 1),        // Ano Novo
    addDias(pascoa, -48),       // Carnaval — segunda
    addDias(pascoa, -47),       // Carnaval — terça
    addDias(pascoa, -2),        // Sexta-feira Santa
    new Date(ano, 3, 21),       // Tiradentes
    new Date(ano, 4, 1),        // Dia do Trabalho
    addDias(pascoa, 60),        // Corpus Christi
    new Date(ano, 8, 7),        // Independência
    new Date(ano, 9, 12),       // Nossa Senhora Aparecida
    new Date(ano, 10, 2),       // Finados
    new Date(ano, 10, 15),      // Proclamação da República
    new Date(ano, 10, 20),      // Consciência Negra
    new Date(ano, 11, 25),      // Natal
  ]
}

/**
 * Retorna feriados estaduais adicionais (além dos nacionais) para uma UF
 */
export function feriadosEstaduais(uf, ano) {
  switch (uf) {
    case 'AL':
      return [
        new Date(ano, 8, 16),  // Emancipação Política de Alagoas
        new Date(ano, 5, 24),  // São João (feriado estadual em AL)
      ]
    case 'PE':
      return [
        new Date(ano, 2, 6),   // Revolução Pernambucana (1817)
        new Date(ano, 5, 24),  // São João (feriado estadual em PE)
      ]
    default: {
      // visão combinada: apenas feriados comuns a todos os estados
      const [primeiro, ...resto] = ['PE', 'AL'].map(u => new Set(feriadosEstaduais(u, ano).map(d => d.toDateString())))
      const comuns = [...primeiro].filter(k => resto.every(s => s.has(k)))
      return comuns.map(k => new Date(k))
    }
  }
}

/**
 * Retorna todos os feriados (nacionais + estaduais) para uma UF e ano
 */
export function feriadosPorUF(uf, ano) {
  return [...feriadosNacionais(ano), ...feriadosEstaduais(uf, ano)]
}

/**
 * Parseia data no formato brasileiro dd/mm/yyyy [hh:mm:ss]
 */
export function parseDateBR(s) {
  if (!s) return null
  const part = String(s).trim().split(' ')[0]
  const [d, m, y] = part.split('/')
  if (!d || !m || !y) return null
  return new Date(+y, +m - 1, +d)
}

/**
 * Converte uma data ISO gravada (ex.: "2026-06-30T00:00:00.000Z") num Date
 * ancorado no DIA-CALENDÁRIO ao meio-dia local — imune a fuso.
 * Sem isso, uma data gravada em UTC (upload manual, servidor UTC) aparece
 * um dia antes no Brasil (UTC-3). Pega só a parte YYYY-MM-DD do ISO.
 */
export function dtFromISO(iso) {
  if (!iso) return null
  if (iso instanceof Date) return iso
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12)
  return new Date(iso)
}

/**
 * Retorna "MM/YYYY" a partir de um Date
 */
export function getMes(dt) {
  if (!dt) return null
  return String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear()
}

/**
 * Dias úteis no mês: seg-sex = 1, sáb = 0.5, dom = 0
 * feriados podem ser injetados como array de Date
 */
export function diasUteisMes(ano, mes, feriados = []) {
  let total = 0
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const feriadosStr = new Set(feriados.map(f => f.toDateString()))
  for (let d = 1; d <= diasNoMes; d++) {
    const dt = new Date(ano, mes - 1, d)
    if (feriadosStr.has(dt.toDateString())) continue
    const dow = dt.getDay()
    if (dow === 0) total += 0
    else if (dow === 6) total += 0.5
    else total += 1
  }
  return total
}

/**
 * Dias úteis decorridos até hoje (ou até o fim do mês se já passou)
 * Para o dia atual no mês vigente aplica fração por hora:
 *   dia útil  — antes 12h: 0 | 12h–17h: 0.5 | 17h+: 1.0
 *   sábado    — antes 12h: 0 | 12h+:    0.5
 */
export function diasUteisDecorridos(ano, mes, hoje = new Date(), feriados = []) {
  const mesHoje = hoje.getMonth() + 1
  const anoHoje = hoje.getFullYear()
  const ultimoDia = ano === anoHoje && mes === mesHoje
    ? hoje.getDate()
    : new Date(ano, mes, 0).getDate()
  let total = 0
  const feriadosStr = new Set(feriados.map(f => f.toDateString()))
  const agora = new Date()
  for (let d = 1; d <= ultimoDia; d++) {
    const dt = new Date(ano, mes - 1, d)
    if (feriadosStr.has(dt.toDateString())) continue
    const dow = dt.getDay()
    if (dow === 0) continue
    const eHoje = d === agora.getDate() && mes === agora.getMonth() + 1 && ano === agora.getFullYear()
    if (eHoje) {
      const h = agora.getHours()
      if (dow === 6) total += h >= 12 ? 0.5 : 0
      else if (h < 12) total += 0
      else if (h < 17) total += 0.5
      else total += 1
    } else {
      total += dow === 6 ? 0.5 : 1
    }
  }
  return total
}

/**
 * Projeção linear pelo ritmo de dias úteis
 */
export function calcProjecao(realizado, decorridos, totalMes) {
  if (!decorridos || !totalMes) return realizado
  return (realizado / decorridos) * totalMes
}

/**
 * Comparador cronológico para chaves "MM/YYYY"
 */
export function sortMesAno(a, b) {
  const [ma, aa] = a.split('/').map(Number)
  const [mb, ab] = b.split('/').map(Number)
  return aa !== ab ? aa - ab : ma - mb
}

/**
 * Parseia "MM/YYYY" → { mes: number, ano: number }
 */
export function parseMesAno(s) {
  if (!s) return null
  const [m, a] = s.split('/')
  return { mes: +m, ano: +a }
}

/**
 * Normaliza qualquer chave de mês para o formato canônico "MM/YYYY".
 * Aceita "MM/YYYY", "YYYY/MM", "MM-YYYY" e "YYYY-MM". Se não reconhecer, devolve como veio.
 * Serve de blindagem: mês em formato divergente nunca mais gera carga/dedup duplicada.
 */
export function normalizarMes(s) {
  if (!s) return s
  const [a, b] = String(s).trim().split(/[/-]/)
  if (!a || !b) return s
  return a.length === 4
    ? `${b.padStart(2, '0')}/${a}`   // YYYY/MM → MM/YYYY
    : `${a.padStart(2, '0')}/${b}`   // já MM/YYYY
}

export function mesAtualStr() {
  const now = new Date()
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
}

export function proximoMesStr(mesAno) {
  const [m, a] = mesAno.split('/').map(Number)
  const prox = new Date(a, m, 1)
  return `${String(prox.getMonth() + 1).padStart(2, '0')}/${prox.getFullYear()}`
}
