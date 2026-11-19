// Quoting alone does not stop spreadsheets from evaluating imported formulas.
export function csvCell(value) {
  let text = String(value ?? '')
  const numeric = /^-?\d+(?:[.,]\d+)?%?$/.test(text)
  if (!numeric && (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text))) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
