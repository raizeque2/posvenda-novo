// Ranking do setor em "Meu desempenho". Função pura usada pelo servidor
// (lerDadosAutorizados, kind 'rankingSetor') e pelo app, para os dois darem o
// mesmo resultado. Segue as mesmas regras de buildRanking para realizado e meta.
//
// O que sai daqui para quem não é admin: nome e % da meta dos colegas do mesmo
// setor (cargo_movimento). Valor em R$ e meta só da própria pessoa.

const norm = s => String(s || '').replace(/^﻿/, '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim()
const CANAIS_PECAS = ['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS']
const OFICINA = new Set(['OFICINA', 'OFICINA_INT', 'OFICINA_GAR', 'OFICINA_SEG'])
const canais = s => String(s || '').split(';').map(c => c.trim()).filter(Boolean)
const num = v => Number(v) || 0
const metaCanal = (mt, canal, campo) => mt.metas && mt.metas[canal] !== undefined ? num(mt.metas[canal][campo]) : num(mt[campo])
const ordemMes = m => { const [mm, aa] = String(m).split('/').map(Number); return aa * 100 + mm }

/** Apelido/nome normalizado → nome do cadastro. O mês mais recente vence. */
export function mapaDeApelidos(colaboradoresPorMes = {}) {
  const map = {}
  for (const mes of Object.keys(colaboradoresPorMes).sort((a, b) => ordemMes(a) - ordemMes(b))) {
    for (const d of Object.values(colaboradoresPorMes[mes] || {})) {
      if (!d?.colaborador) continue
      map[norm(d.colaborador)] = d.colaborador
      if (d.apelido && norm(d.apelido)) map[norm(d.apelido)] = d.colaborador
    }
  }
  return map
}

export function rankingDoSetor({ pecas = [], oficina = [], colaboradores = {}, metas = {}, mes, meuNome, metrica = 'mp' }) {
  const vazio = { setor: '', lista: [], minhaPosicao: null }
  if (!['mp', 'mo', 'mpo'].includes(metrica) || !norm(meuNome)) return vazio
  const apelidos = mapaDeApelidos(colaboradores)
  const chave = nome => norm(apelidos[norm(nome)] || nome)
  const cad = colaboradores[mes] || {}, mts = metas[mes] || {}
  const pessoas = new Map()
  for (const [nome, c] of Object.entries(cad)) pessoas.set(norm(nome), { ...c, ...(mts[nome] || {}), nome: c?.colaborador || nome })
  for (const [nome, mt] of Object.entries(mts)) if (!pessoas.has(norm(nome))) pessoas.set(norm(nome), { ...mt, nome: mt?.colaborador || nome })

  const acc = new Map()
  const de = nome => {
    const k = chave(nome)
    if (!pessoas.has(k)) return null
    if (!acc.has(k)) acc.set(k, { tp: 0, poc: 0, devPoc: 0, moCons: 0, moTec: 0, consultor: false, tecnico: false })
    return acc.get(k)
  }
  for (const r of pecas) {
    const v = num(r.valor)
    const c = r.responsavel ? de(r.responsavel) : null
    if (c) {
      if (r.eDevolucao) {
        if (OFICINA.has(r.cat)) c.devPoc += Math.abs(v)
        else if (r.cat !== 'COMPRA' && r.cat !== 'DEV.COMPRA') c.tp -= Math.abs(v)
      } else if (CANAIS_PECAS.includes(r.cat)) c.tp += v
      else if (OFICINA.has(r.cat)) c.poc += v
    }
    const t = OFICINA.has(r.cat) && r.tecnico ? de(r.tecnico) : null
    if (t) { if (r.eDevolucao) t.devPoc += Math.abs(v); else t.poc += v; t.tecnico = true }
  }
  for (const r of oficina) {
    const c = r.consultor ? de(r.consultor) : null
    if (c) { c.moCons += num(r.mo); c.poc += num(r.pocoficina); c.consultor = true }
    const t = r.tecnico ? de(r.tecnico) : null
    if (t) { t.moTec += num(r.mo); t.tecnico = true }
  }

  const linhas = [...pessoas].map(([k, mt]) => {
    const a = acc.get(k) || { tp: 0, poc: 0, devPoc: 0, moCons: 0, moTec: 0, consultor: false, tecnico: false }
    const lista = canais(mt.cargo_movimento)
    const semMeta = mt.ativo === false
    const meta = semMeta ? 0 : metrica === 'mp'
      ? (mt.metas ? lista.filter(c => CANAIS_PECAS.includes(c)).reduce((s, c) => s + num(mt.metas[c]?.mp), 0) : num(mt.mp))
      : metaCanal(mt, 'OS', metrica)
    let real = a.tp
    if (metrica === 'mpo') real = a.poc - a.devPoc
    if (metrica === 'mo') {
      const mo = semMeta ? 0 : metaCanal(mt, 'OS', 'mo'), mpo = semMeta ? 0 : metaCanal(mt, 'OS', 'mpo')
      const principal = lista.find(c => CANAIS_PECAS.includes(c)) || (lista.includes('OS') ? 'OS' : lista[0])
      const soMeta = principal === 'OS' && !a.consultor && !a.tecnico && (mo > 0 || mpo > 0)
      const tecMeta = soMeta && /MECÂN|MECANI|BORRACHEIRO|AUXILIAR.MECA/i.test(mt.cargo || '')
      const ehTecnico = a.tecnico || tecMeta
      const ehConsultor = a.consultor || (!a.tecnico && a.poc - a.devPoc > 0) || (soMeta && !tecMeta) || (lista.includes('OS') && !ehTecnico && (mo > 0 || mpo > 0))
      real = ehConsultor ? a.moCons : a.moTec
    }
    return { k, nome: mt.nome, canais: lista, meta, real }
  })

  const eu = linhas.find(l => l.k === chave(meuNome))
  if (!eu || !eu.canais.length) return vazio
  const lista = linhas
    .filter(l => l.meta > 0 && l.canais.some(c => eu.canais.includes(c)))
    .map(l => ({ nome: l.nome, eu: l === eu, pct: l.real / l.meta, real: l.real, meta: l.meta }))
    .sort((a, b) => b.pct - a.pct || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((l, i) => ({ ...l, posicao: i + 1 }))
  return { setor: eu.canais.join(' · '), lista, minhaPosicao: lista.find(l => l.eu)?.posicao ?? null }
}

/** O que o servidor devolve para o perfil: sem R$ nem meta de colegas. */
export function rankingPublico(ranking) {
  return { ...ranking, lista: ranking.lista.map(({ nome, eu, pct, posicao, real, meta }) => eu ? { nome, eu, pct, posicao, real, meta } : { nome, eu, pct, posicao }) }
}
