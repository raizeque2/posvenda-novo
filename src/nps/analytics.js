// Números do painel NPS (mesma conta do projeto original).
import { NADA_A_MELHORAR, NOTAS_CAIXA, SETORES_NPS } from '../../functions/src/nps.js'

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
export const diaDa = data => fmtDia.format(new Date(data))
export const npsDe = itens => itens.length ? Math.round(100 * (itens.filter(i => i.nota >= 9).length - itens.filter(i => i.nota <= 6).length) / itens.length) : null
const media = v => v.length ? v.reduce((s, x) => s + x, 0) / v.length : null

export const CORES_PERFIL = { promotores: '#26856d', neutros: '#d7a64e', detratores: '#cb384b' }

export function filtrar(itens, { periodo = 'all', setor = 'all', perfil = 'all' }, agora = new Date()) {
  const fim = diaDa(agora)
  const primeiro = new Date(`${fim}T12:00:00Z`)
  if (periodo !== 'all') primeiro.setUTCDate(primeiro.getUTCDate() - Number(periodo) + 1)
  const inicio = diaDa(primeiro)
  return itens.filter(i => {
    if (setor !== 'all' && String(i.setorId) !== setor) return false
    if (perfil === 'low' && i.nota > 6) return false
    if (perfil === 'middle' && (i.nota < 7 || i.nota > 8)) return false
    if (perfil === 'high' && i.nota < 9) return false
    if (periodo !== 'all') { const d = diaDa(i.criadoEm); if (d < inicio || d > fim) return false }
    return true
  }).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

function contarMotivos(itens, caixa) {
  const contagem = new Map()
  for (const i of itens) for (const m of new Set(caixa ? i.motivosCaixa || [] : i.motivos || [])) {
    if (m === NADA_A_MELHORAR) continue
    contagem.set(m, (contagem.get(m) || 0) + 1)
  }
  return [...contagem].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome)).slice(0, 5)
}

export function analisar(itens) {
  const perfis = [
    { nome: 'Promotores', faixa: '9–10', n: itens.filter(i => i.nota >= 9).length, cor: CORES_PERFIL.promotores },
    { nome: 'Neutros', faixa: '7–8', n: itens.filter(i => i.nota >= 7 && i.nota <= 8).length, cor: CORES_PERFIL.neutros },
    { nome: 'Detratores', faixa: '0–6', n: itens.filter(i => i.nota <= 6).length, cor: CORES_PERFIL.detratores },
  ].map(p => ({ ...p, pct: itens.length ? Math.round(p.n / itens.length * 100) : 0 }))
  const notasSetor = itens.flatMap(i => typeof i.notaSetor === 'number' ? [i.notaSetor] : [])
  const notasCaixa = itens.flatMap(i => i.notaCaixa > 0 ? [i.notaCaixa] : [])
  const porSetor = SETORES_NPS.map(s => {
    const resp = itens.filter(i => i.setorId === s.id)
    const notas = resp.flatMap(i => typeof i.notaSetor === 'number' ? [i.notaSetor] : [])
    return { id: s.id, nome: s.nome, respostas: resp.length, avaliadas: notas.length, media: media(notas), nps: npsDe(resp) }
  })
  const dias = itens.map(i => diaDa(i.criadoEm)).sort()
  const mensal = dias.length > 0 && (Date.parse(dias.at(-1)) - Date.parse(dias[0])) / 86400000 > 60
  const grupos = new Map()
  for (const i of itens) {
    const d = diaDa(i.criadoEm), k = mensal ? d.slice(0, 7) : d
    if (grupos.has(k)) grupos.get(k).push(i); else grupos.set(k, [i])
  }
  // Dias sem resposta ficam como lacuna (não é NPS zero).
  if (dias.length && !mensal) {
    const d = new Date(`${dias[0]}T12:00:00Z`)
    while (diaDa(d) <= dias.at(-1)) { const k = diaDa(d); if (!grupos.has(k)) grupos.set(k, []); d.setUTCDate(d.getUTCDate() + 1) }
  }
  const linhaTempo = [...grupos].sort(([a], [b]) => a.localeCompare(b)).map(([data, r]) => ({
    data, rotulo: mensal ? `${data.slice(5, 7)}/${data.slice(2, 4)}` : `${data.slice(8, 10)}/${data.slice(5, 7)}`,
    respostas: r.length, nps: npsDe(r),
  }))
  return {
    total: itens.length, nps: npsDe(itens), mediaSetor: media(notasSetor), setorAvaliadas: notasSetor.length,
    mediaCaixa: media(notasCaixa), caixaAvaliadas: notasCaixa.length,
    semCaixa: itens.filter(i => i.notaCaixa === 0).length,
    comentarios: itens.filter(i => i.comentario?.trim()).length,
    perfis, porSetor, linhaTempo, mensal,
    caixa: NOTAS_CAIXA.map(c => ({ nome: c.rotulo, n: itens.filter(i => i.notaCaixa === c.valor).length, cor: ['#cb384b', '#e77762', '#d7a64e', '#65a68c', '#26856d'][c.valor - 1] })),
    motivosSetor: contarMotivos(itens, false), motivosCaixa: contarMotivos(itens, true),
  }
}
