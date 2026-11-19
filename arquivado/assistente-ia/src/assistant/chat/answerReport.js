// Relatório em PDF de uma resposta do assistente: pergunta, resposta, tabelas dos gráficos e fontes.
// reportSections é puro (testado em tests/assistant-report.test.mjs); baixarRelatorio desenha com jsPDF.

const brl = value => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
// Helvetica do jsPDF cobre Latin-1 (acentos do português); setas e símbolos fora dele viram texto.
const latin = text => String(text ?? '').replace(/[→⟶]/g, '->').replace(/[←]/g, '<-').replace(/[•·]/g, '-').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')

export function markdownLines(markdown) {
  const lines = []
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (/^\|?\s*:?-{3,}/.test(line)) continue // separador de tabela
    const cells = line.startsWith('|') ? line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()) : null
    const text = (cells ? cells.join('   |   ') : line)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/, '').replace(/^[-*+]\s+/, '- ').replace(/\*\*|__|`/g, '').replace(/(^|\s)[*_]([^*_]+)[*_]/g, '$1$2')
    lines.push({ text, heading: /^#{1,6}\s/.test(line), table: !!cells })
  }
  return lines
}

export function reportSections(question, message, now = new Date()) {
  const p = message.provenance || {}
  const sections = [
    { title: 'Pergunta', lines: [question || '(sem pergunta)'] },
    { title: 'Resposta', markdown: markdownLines(message.text) },
  ]
  for (const chart of message.charts || []) {
    if (!Array.isArray(chart.data) || !chart.data.length) continue
    sections.push({ title: chart.title || 'Dados', table: { head: ['Item', 'Valor', 'Registros'], rows: chart.data.slice(0, 100).map(row => [String(row.name ?? ''), brl(row.value), row.records ?? '']) }, note: chart.note })
  }
  if (message.proposal) {
    const pr = message.proposal
    sections.push({ title: 'Proposta de alteração', lines: [`${pr.label} · ${pr.person} · ${pr.month}`, `Situação: ${message.changeStatus === 'applied' ? 'salva' : message.changeStatus === 'cancelled' ? 'cancelada' : 'não confirmada'}`] })
  }
  const fontes = (p.sources || []).map(s => `${s.kind} ${s.month}: ${s.records} registro(s)${s.updatedAt ? `, atualizado em ${new Date(s.updatedAt).toLocaleString('pt-BR')}` : ''}`)
  sections.push({ title: 'Fontes e recorte', lines: [
    `Períodos: ${(p.periods || []).join(', ') || '-'}`, `Recorte: ${p.scope || 'Todos os dados autorizados'}`,
    ...(p.lastRecordDate ? [`Última data registrada: ${p.lastRecordDate}`] : []), ...fontes, ...(p.warnings || []),
    `Gerado em ${now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} pelo assistente do Pós-Venda. Confira valores finais nas páginas do sistema.`,
  ] })
  return sections
}

export async function baixarRelatorio(question, message) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' }), width = 210, margin = 16, usable = width - margin * 2, bottom = 297 - 16
  let y = 20
  const room = height => { if (y + height > bottom) { pdf.addPage(); y = 20 } }
  const write = (text, { size = 10, bold = false, color = [55, 65, 81], gap = 1.5 } = {}) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color)
    for (const line of pdf.splitTextToSize(latin(text), usable)) { room(size * 0.45); pdf.text(line, margin, y); y += size * 0.42 + gap }
  }
  write('Relatório do assistente · Pós-Venda', { size: 16, bold: true, color: [17, 24, 39], gap: 3 })
  for (const section of reportSections(question, message)) {
    y += 3; room(12)
    write(section.title, { size: 12, bold: true, color: [204, 0, 0], gap: 2 })
    for (const line of section.lines || []) write(line)
    for (const line of section.markdown || []) line.text ? write(line.text, { bold: line.heading, size: line.table ? 9 : 10 }) : (y += 2)
    if (section.table) {
      const cols = [usable * 0.6, usable * 0.25, usable * 0.15]
      const row = (cells, bold) => {
        room(6); pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(9); pdf.setTextColor(55, 65, 81)
        let x = margin
        cells.forEach((cell, i) => { pdf.text(pdf.splitTextToSize(latin(cell), cols[i] - 2)[0] || '', i ? x + cols[i] - 2 : x, y, i ? { align: 'right' } : undefined); x += cols[i] })
        y += 5.2
      }
      row(section.table.head, true); pdf.setDrawColor(226, 228, 233); pdf.line(margin, y - 3.8, margin + usable, y - 3.8)
      for (const cells of section.table.rows) row(cells)
      if (section.note) write(section.note, { size: 8, color: [140, 147, 160] })
    }
  }
  pdf.save(`relatorio-assistente-${new Date().toISOString().slice(0, 10)}.pdf`)
}
