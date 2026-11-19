export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  let i = 0
  const n = text.length
  const rows = []

  function parseField() {
    if (i < n && text[i] === '"') {
      i++
      let val = ''
      while (i < n) {
        if (text[i] === '"') {
          i++
          if (i < n && text[i] === '"') { val += '"'; i++ }
          else break
        } else {
          val += text[i++]
        }
      }
      return val.trim()
    } else {
      let val = ''
      while (i < n && text[i] !== ';' && text[i] !== '\n' && text[i] !== '\r') {
        val += text[i++]
      }
      return val.trim()
    }
  }

  function parseLine() {
    const fields = []
    while (i < n && text[i] !== '\n' && text[i] !== '\r') {
      fields.push(parseField())
      if (i < n && text[i] === ';') i++
    }
    if (i < n && text[i] === '\r') i++
    if (i < n && text[i] === '\n') i++
    return fields
  }

  const header = parseLine()

  while (i < n) {
    if (text[i] === '\r' || text[i] === '\n') { i++; continue }
    const cols = parseLine()
    if (cols.length < 2) continue
    const row = {}
    header.forEach((h, j) => { row[h] = cols[j] ?? '' })
    rows.push(row)
  }

  return { header, rows }
}
