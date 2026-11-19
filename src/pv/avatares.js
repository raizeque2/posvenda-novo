// Marca as células de nome com iniciais. Só escreve atributos: nós do React ficam intactos.
const NAME_HEADER = /^(colaborador|nome|usu[aá]rio)\b/i
const IGNORED = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'])

function initials(name) {
  const parts = name.trim().toUpperCase().split(/\s+/).filter(p => !IGNORED.has(p))
  if (!parts.length) return ''
  return parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]
}

function markTable(table) {
  const headers = [...table.querySelectorAll('thead th')]
  const column = headers.findIndex(th => NAME_HEADER.test(th.textContent.trim()))
  if (column < 0) return
  for (const row of table.tBodies[0]?.rows ?? []) {
    if (row.cells.length !== headers.length) continue
    const cell = row.cells[column]
    // Célula que já tem foto própria (tabela de pessoas): não desenha as iniciais por cima dela.
    if (cell.querySelector('.pv-foto')) { cell.classList.remove('pv-person'); continue }
    const value = initials(cell.textContent || cell.querySelector('input')?.value || '')
    if (cell.dataset.initials !== value) cell.dataset.initials = value
    cell.classList.toggle('pv-person', value !== '')
  }
}

let queued = false
const observer = new MutationObserver(() => {
  if (queued) return
  queued = true
  setTimeout(() => {
    queued = false
    document.querySelectorAll('.main table').forEach(markTable)
  }, 50)
})
observer.observe(document.getElementById('root'), { childList: true, subtree: true, characterData: true })

// Aviso fora do React enquanto o admin testa a visão de outra pessoa
try {
  const ver = JSON.parse(sessionStorage.getItem('pv_ver_como'))
  if (ver && !ver.conta) {
    const aviso = document.createElement('button')
    aviso.type = 'button'
    aviso.className = 'pv-ver-como'
    aviso.textContent = `Vendo como ${ver.nome} · Voltar para admin`
    aviso.onclick = () => { sessionStorage.removeItem('pv_ver_como'); location.href = '/organograma' }
    document.body.append(aviso)
  }
} catch {}
