import jsPDF from 'jspdf'
import { fmtBRL, fmtPct, nomeAbrev } from '../../utils/formatacao.js'
import { calcProjecao } from '../../utils/datas.js'

// Relatório do Faturamento em PDF (A4 retrato). Visual limpo: página branca,
// cards arredondados com ícone e barra de progresso, tabelas com medalhas no
// pódio e % da meta em selo colorido. Ícones desenhados com formas do jsPDF
// (sem imagens nem fontes externas).

const COR = {
  texto: [17, 24, 39], texto2: [75, 85, 99], texto3: [140, 147, 160],
  borda: [226, 228, 233], fundo: [247, 248, 250], fundo2: [241, 243, 246],
  marca: [204, 0, 0], verde: [22, 163, 74], ambar: [217, 119, 6], vermelho: [220, 38, 38],
  ouro: [245, 158, 11], prata: [148, 163, 184], bronze: [194, 65, 12],
}
const CANAL_COR = {
  Varejo: [13, 148, 136], Web: [59, 130, 246], Televendas: [124, 58, 237], Atacado: [249, 115, 22],
  'Mão de obra': [204, 0, 0], 'Peças O.S.': [22, 163, 74], Consultores: [204, 0, 0], 'Mecânicos': [71, 85, 105],
}
const CANAL_ICONE = { Varejo: 'sacola', Web: 'globo', Televendas: 'fone', Atacado: 'caixas', 'Mão de obra': 'chave', 'Peças O.S.': 'caixa', Consultores: 'pessoa', 'Mecânicos': 'chave' }
const tomPct = p => p == null ? COR.texto3 : p >= 1 ? COR.verde : p >= 0.8 ? COR.ambar : COR.vermelho
const claro = (c, a = 0.12) => c.map(v => Math.round(255 - (255 - v) * a))

export async function gerarPDF({
  filtroEstado, mesAtivo, diasDec, diasMes, ultimaAtualizacao,
  verVarejo, verAtacado, verOficina,
  vare, atac, webL, telev, pof, mor,
  metaVarejo, metaAtacado, metaWeb, metaTelevendas, metaMO, metaPecOSof,
  exportSels,
  printVarejoRows, printWebRows, printTelvRows, printAtacadoRows,
  printConsultRows, printTecRows,
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210, PH = 297, ML = 12, CW = PW - 24, RODAPE = 14

  const pecasInPrint     = ['varejo', 'web', 'televendas', 'atacado'].some(k => exportSels.has(k))
  const consultInPrint   = exportSels.has('consultores')
  const mecanicosInPrint = exportSels.has('mecanicos')
  const estadoNome = { PE: 'Pernambuco', AL: 'Alagoas' }[filtroEstado] || 'Todos os estados'

  const fonte = (peso, tam, cor) => doc.setFont('helvetica', peso).setFontSize(tam).setTextColor(...cor)
  const preencher = c => doc.setFillColor(...c)
  const traco = (c, w = 0.3) => doc.setDrawColor(...c).setLineWidth(w)

  // ── Ícones vetoriais simples (centro cx,cy; tamanho s) ─────────────────────
  function icone(nome, cx, cy, s, cor) {
    traco(cor, 0.45); preencher(cor)
    const h = s / 2
    if (nome === 'sacola') { doc.roundedRect(cx - h * .8, cy - h * .35, h * 1.6, h * 1.25, .5, .5, 'S'); doc.ellipse(cx, cy - h * .35, h * .45, h * .5, 'S') }
    else if (nome === 'globo') { doc.circle(cx, cy, h * .9, 'S'); doc.ellipse(cx, cy, h * .38, h * .9, 'S'); doc.line(cx - h * .9, cy, cx + h * .9, cy) }
    else if (nome === 'fone') { doc.roundedRect(cx - h * .5, cy - h * .9, h, h * 1.8, .6, .6, 'S'); doc.line(cx - h * .15, cy + h * .6, cx + h * .15, cy + h * .6) }
    else if (nome === 'caixas') { doc.rect(cx - h * .9, cy, h * .85, h * .8, 'S'); doc.rect(cx + h * .05, cy, h * .85, h * .8, 'S'); doc.rect(cx - h * .42, cy - h * .8, h * .85, h * .8, 'S') }
    else if (nome === 'caixa') { doc.rect(cx - h * .8, cy - h * .55, h * 1.6, h * 1.35, 'S'); doc.line(cx - h * .8, cy - h * .1, cx + h * .8, cy - h * .1); doc.line(cx, cy - h * .55, cx, cy - h * .1) }
    else if (nome === 'chave') { doc.circle(cx + h * .35, cy - h * .35, h * .42, 'S'); traco(cor, 0.8); doc.line(cx + h * .05, cy - h * .05, cx - h * .75, cy + h * .75) }
    else if (nome === 'pessoa') { doc.circle(cx, cy - h * .4, h * .38, 'S'); doc.ellipse(cx, cy + h * .6, h * .75, h * .4, 'S') }
    else if (nome === 'calendario') { doc.roundedRect(cx - h * .8, cy - h * .6, h * 1.6, h * 1.4, .4, .4, 'S'); doc.line(cx - h * .8, cy - h * .15, cx + h * .8, cy - h * .15) }
    else if (nome === 'relogio') { doc.circle(cx, cy, h * .85, 'S'); doc.line(cx, cy, cx, cy - h * .5); doc.line(cx, cy, cx + h * .4, cy) }
    else if (nome === 'atualizar') { doc.circle(cx, cy, h * .8, 'S'); preencher(cor); doc.triangle(cx + h * .55, cy - h * .95, cx + h * 1.05, cy - h * .55, cx + h * .45, cy - h * .35, 'F') }
  }
  function bolhaIcone(nome, x, y, d, cor) {
    preencher(claro(cor, 0.14)); doc.roundedRect(x, y, d, d, 2, 2, 'F')
    icone(nome, x + d / 2, y + d / 2, d * .55, cor)
  }
  function selo(txt, xDir, y, cor, tam = 6.5) {
    fonte('bold', tam, cor)
    const w = doc.getTextWidth(txt) + 4.5, h = tam * .55
    preencher(claro(cor, 0.13)); doc.roundedRect(xDir - w, y - h / 2, w, h, h / 2, h / 2, 'F')
    doc.text(txt, xDir - w / 2, y + tam * .12, { align: 'center' })
    return w
  }
  function barra(x, y, w, pct, cor, marcador) {
    preencher(COR.fundo2); doc.roundedRect(x, y, w, 1.6, .8, .8, 'F')
    if (pct > 0) { preencher(cor); doc.roundedRect(x, y, Math.max(1.6, w * Math.min(1, pct)), 1.6, .8, .8, 'F') }
    if (marcador != null && marcador > 0) { traco(COR.texto2, 0.35); const mx = x + w * Math.min(1, marcador); doc.line(mx, y - .8, mx, y + 2.4) }
  }

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  function cabecalho(tipo) {
    preencher(COR.marca); doc.rect(0, 0, PW, 2.2, 'F')
    preencher(COR.marca); doc.roundedRect(ML, 9, 11, 11, 2.5, 2.5, 'F')
    fonte('bold', 11, [255, 255, 255]); doc.text('P', ML + 5.5, 16.6, { align: 'center' })
    fonte('bold', 15, COR.texto); doc.text(`Relatório de ${tipo.toLowerCase()}`, ML + 15, 14.2)
    fonte('normal', 8, COR.texto3); doc.text(`Pós-Venda · ${estadoNome} · ${mesAtivo}`, ML + 15, 19)

    const restantes = Math.max(0, Math.round((diasMes - diasDec) * 10) / 10)
    const chips = [
      ['calendario', 'Dias úteis', `${String(Math.round(diasDec * 10) / 10).replace('.', ',')} de ${diasMes}`, COR.texto2],
      ['relogio', 'Restantes', String(restantes).replace('.', ','), restantes <= 3 ? COR.vermelho : COR.texto2],
      ...(ultimaAtualizacao ? [['atualizar', 'Atualizado', ultimaAtualizacao, COR.texto2]] : []),
    ]
    let x = ML + CW
    for (const [ic, rot, val, cor] of [...chips].reverse()) {
      fonte('bold', 8.5, COR.texto); const w = Math.max(doc.getTextWidth(val), 14) + 14
      x -= w
      preencher(COR.fundo); traco(COR.borda, .25); doc.roundedRect(x, 8.5, w, 12, 2.5, 2.5, 'FD')
      icone(ic, x + 5, 14.5, 4, cor)
      fonte('normal', 5.8, COR.texto3); doc.text(rot.toUpperCase(), x + 9, 12.8)
      fonte('bold', 8.5, cor === COR.texto2 ? COR.texto : cor); doc.text(val, x + 9, 17.6)
      x -= 2.5
    }
    traco(COR.borda, .3); doc.line(ML, 25, ML + CW, 25)
    return 30
  }

  // ── Cards de indicadores ───────────────────────────────────────────────────
  function cards(y, itens) {
    const gap = 4, porLinha = Math.min(itens.length, 4), W = (CW - gap * (porLinha - 1)) / porLinha, H = 33
    itens.forEach((k, i) => {
      const col = i % porLinha, lin = Math.floor(i / porLinha)
      const x = ML + col * (W + gap), yy = y + lin * (H + gap)
      const cor = CANAL_COR[k.label] || COR.marca
      preencher([255, 255, 255]); traco(COR.borda, .3); doc.roundedRect(x, yy, W, H, 3, 3, 'FD')
      bolhaIcone(CANAL_ICONE[k.label] || 'caixa', x + 4, yy + 4, 8, cor)
      fonte('bold', 7.5, COR.texto2); doc.text(k.label, x + 14.5, yy + 9.2)
      if (k.pct != null) selo(`${Math.round(k.pct * 100)}%`, x + W - 4, yy + 17.8, tomPct(k.pct), 7)
      fonte('bold', 13, COR.texto); doc.text(k.value, x + 4, yy + 19.5)
      barra(x + 4, yy + 23, W - 8, k.meta > 0 ? k.real / k.meta : 0, cor, k.meta > 0 && k.projV ? k.projV / k.meta : null)
      fonte('normal', 6, COR.texto3)
      doc.text(k.meta > 0 ? `Meta ${fmtBRL(k.meta)}` : 'Sem meta', x + 4, yy + 29.5)
      if (k.projV) doc.text(`Proj. ${fmtBRL(k.projV)}`, x + W - 4, yy + 29.5, { align: 'right' })
    })
    const linhas = Math.ceil(itens.length / porLinha)
    fonte('normal', 5.6, COR.texto3)
    doc.text('Barra: realizado sobre a meta · traço: projeção do mês · selo: % da meta pela projeção', ML, y + linhas * (H + gap) + 1)
    return y + linhas * (H + gap) + 6
  }

  // ── Tabelas ────────────────────────────────────────────────────────────────
  let pagina = null
  function quebra(y, precisa) {
    if (y + precisa <= PH - RODAPE) return y
    doc.addPage()
    return cabecalho(pagina)
  }
  function tabela(y, titulo, rows, cols) {
    if (!rows || rows.length === 0) return y
    const H_ROW = 7.4, cor = CANAL_COR[titulo] || COR.marca
    y = quebra(y, 26)
    bolhaIcone(CANAL_ICONE[titulo] || 'caixa', ML, y, 7, cor)
    fonte('bold', 10.5, COR.texto); doc.text(titulo, ML + 9.5, y + 4.9)
    const tw = doc.getTextWidth(titulo), contagem = `${rows.length} ${rows.length === 1 ? 'pessoa' : 'pessoas'}`
    fonte('bold', 6, COR.texto2)
    selo(contagem, ML + 9.5 + tw + 3 + doc.getTextWidth(contagem) + 4.5, y + 3.6, COR.texto2, 6)
    y += 10

    const cabecalhoTabela = yy => {
      preencher(COR.fundo); doc.roundedRect(ML, yy, CW, 6.5, 1.8, 1.8, 'F')
      let cx = ML + 2
      cols.forEach(c => {
        fonte('bold', 5.8, COR.texto3)
        const tx = c.align === 'right' ? cx + c.w - 1 : c.align === 'center' ? cx + c.w / 2 : cx
        doc.text(c.label.toUpperCase(), tx, yy + 4.3, { align: c.align || 'left' })
        cx += c.w
      })
      return yy + 6.5
    }
    y = cabecalhoTabela(y)
    rows.forEach((r, ri) => {
      if (y + H_ROW > PH - RODAPE) { doc.addPage(); y = cabecalhoTabela(cabecalho(pagina)) }
      const meio = y + H_ROW / 2
      let cx = ML + 2
      cols.forEach(c => {
        const tx = c.align === 'right' ? cx + c.w - 1 : c.align === 'center' ? cx + c.w / 2 : cx
        if (c.rank) {
          const medalha = [COR.ouro, COR.prata, COR.bronze][ri]
          if (medalha) { preencher(medalha); doc.circle(cx + c.w / 2, meio, 2.3, 'F'); fonte('bold', 6, [255, 255, 255]) }
          else fonte('normal', 6.5, COR.texto3)
          doc.text(String(ri + 1), cx + c.w / 2, meio + 0.9, { align: 'center' })
        } else if (c.pct) {
          const p = c.pct(r)
          if (p == null) { fonte('normal', 6.5, COR.texto3); doc.text('–', tx, meio + 1, { align: 'right' }) }
          else selo(`${Math.round(p * 100)}%`, cx + c.w - 1, meio, tomPct(p), 6.3)
        } else {
          const v = c.get(r, ri)
          fonte(c.bold ? 'bold' : 'normal', c.bold ? 7 : 6.6, c.bold ? COR.texto : c.muted ? COR.texto3 : COR.texto2)
          doc.text(v, tx, meio + 1, { align: c.align || 'left' })
        }
        cx += c.w
      })
      traco(COR.borda, .2); doc.line(ML + 2, y + H_ROW, ML + CW - 2, y + H_ROW)
      y += H_ROW
    })
    return y + 7
  }

  const dinheiro = v => v > 0 ? fmtBRL(v) : '–'
  const COLS_PECAS = [
    { label: '#', w: 9, align: 'center', rank: true },
    { label: 'Colaborador', w: 41, get: r => nomeAbrev(r.nome) },
    { label: 'Loja', w: 12, muted: true, get: r => (r.lojas || [])[0] || '' },
    { label: 'Realizado', w: 23, align: 'right', bold: true, get: r => fmtBRL(r.liq) },
    { label: 'Meta', w: 22, align: 'right', muted: true, get: r => dinheiro(r.metaCanal) },
    { label: '% Meta', w: 15, align: 'right', pct: r => r.metaCanal > 0 ? r.projCanal / r.metaCanal : null },
    { label: 'Projeção', w: 22, align: 'right', muted: true, get: r => dinheiro(r.projCanal) },
    { label: 'Hoje', w: 16, align: 'right', muted: true, get: r => dinheiro(r.hoje) },
    { label: 'Margem', w: 14, align: 'right', muted: true, get: r => r.margem != null ? fmtPct(r.margem) : '–' },
    { label: 'TM', w: 10, align: 'right', muted: true, get: r => r.tm > 0 ? fmtBRL(r.tm).replace('R$', '').trim() : '–' },
  ]
  const COLS_OFI = [
    { label: '#', w: 9, align: 'center', rank: true },
    { label: 'Colaborador', w: 36, get: r => nomeAbrev(r.nome) },
    { label: 'Loja', w: 11, muted: true, get: r => (r.lojas || [])[0] || '' },
    { label: 'M.O.', w: 20, align: 'right', bold: true, get: r => fmtBRL(r.moreal) },
    { label: 'Meta M.O.', w: 19, align: 'right', muted: true, get: r => dinheiro(r.mo) },
    { label: '% M.O.', w: 13, align: 'right', pct: r => r.mo > 0 ? r.projMO / r.mo : null },
    { label: 'Peças O.S.', w: 20, align: 'right', bold: true, get: r => fmtBRL(r.pocoficina) },
    { label: 'Meta P.O.', w: 18, align: 'right', muted: true, get: r => dinheiro(r.mpo) },
    { label: '% P.O.', w: 13, align: 'right', pct: r => r.mpo > 0 ? r.projPO / r.mpo : null },
    { label: 'Pass.', w: 9, align: 'right', muted: true, get: r => String(r.passagens ?? 0) },
    { label: 'Hoje', w: 12, align: 'right', muted: true, get: r => r.hoje > 0 ? fmtBRL(r.hoje).replace('R$', '').trim() : '–' },
  ]

  let primeira = true
  const novaSecao = tipo => { if (!primeira) doc.addPage(); primeira = false; pagina = tipo; return cabecalho(tipo) }

  if (pecasInPrint) {
    let y = novaSecao('Peças')
    const k = []
    const add = (label, real, meta, proj) => { if (real + meta > 0) k.push({ label, real, value: fmtBRL(real), meta, projV: meta > 0 ? proj : null, pct: meta > 0 ? proj / meta : null }) }
    add('Varejo', vare.liquido, metaVarejo, vare.proj)
    add('Web', webL.liquido, metaWeb, webL.proj)
    add('Televendas', telev.liquido, metaTelevendas, telev.proj)
    add('Atacado', atac.liquido, metaAtacado, atac.proj)
    if (k.length) y = cards(y, k)
    if (verVarejo && exportSels.has('varejo')) y = tabela(y, 'Varejo', printVarejoRows, COLS_PECAS)
    if (verVarejo && exportSels.has('web')) y = tabela(y, 'Web', printWebRows, COLS_PECAS)
    if (verVarejo && exportSels.has('televendas')) y = tabela(y, 'Televendas', printTelvRows, COLS_PECAS)
    if (verAtacado && exportSels.has('atacado')) y = tabela(y, 'Atacado', printAtacadoRows, COLS_PECAS)
  }

  if (verOficina && (consultInPrint || mecanicosInPrint)) {
    let y = novaSecao('Oficina')
    const projMO = calcProjecao(mor, diasDec, diasMes)
    const k = []
    if (mor + metaMO > 0) k.push({ label: 'Mão de obra', real: mor, value: fmtBRL(mor), meta: metaMO, projV: metaMO > 0 ? projMO : null, pct: metaMO > 0 ? projMO / metaMO : null })
    if (pof.liquido + metaPecOSof > 0) k.push({ label: 'Peças O.S.', real: pof.liquido, value: fmtBRL(pof.liquido), meta: metaPecOSof, projV: metaPecOSof > 0 ? pof.proj : null, pct: metaPecOSof > 0 ? pof.proj / metaPecOSof : null })
    if (k.length) y = cards(y, k)
    if (consultInPrint) y = tabela(y, 'Consultores', printConsultRows, COLS_OFI)
    if (mecanicosInPrint) y = tabela(y, 'Mecânicos', printTecRows, COLS_OFI.map(c => c.label === 'Colaborador' ? { ...c, label: 'Mecânico' } : c))
  }

  // ── Rodapé em todas as páginas ─────────────────────────────────────────────
  const total = doc.getNumberOfPages()
  const gerado = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    traco(COR.borda, .25); doc.line(ML, PH - 10, ML + CW, PH - 10)
    fonte('normal', 6.2, COR.texto3)
    doc.text(`Gerado em ${gerado} · valores líquidos de devoluções`, ML, PH - 6)
    doc.text(`Página ${i} de ${total}`, ML + CW, PH - 6, { align: 'right' })
  }

  doc.save(`Pos-Venda_${filtroEstado || 'Todos'}_${mesAtivo.replace('/', '-')}.pdf`)
}
