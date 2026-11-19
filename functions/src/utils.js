export function parseDateBR(s) {
  if (!s) return null
  const part = String(s).trim().split(' ')[0]
  const [d, m, y] = part.split('/')
  if (!d || !m || !y) return null
  return new Date(+y, +m - 1, +d)
}

export function getMes(dt) {
  if (!dt) return null
  return String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear()
}

export function parseBR(v) {
  if (!v) return 0
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0
}
