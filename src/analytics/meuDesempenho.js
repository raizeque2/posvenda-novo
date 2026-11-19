// Dados da página "Meu desempenho": resultado por período (semana ou mês)
// comparado ao período anterior equivalente, realização diária × meta e
// ranking do mesmo setor. Usa somente o que já está no store — ou seja, só os
// dados que o servidor liberou para o perfil. Nada é estimado ou inventado.
import { rankingDoSetor } from '../../functions/src/rankingSetor.js'
import { latestDate, monthKey, monthProgress, personMonth, personalRows, workWeight } from './personal.js'

export const METRICAS = {
  mp: { rotulo: 'Peças', descricao: 'Venda de peças (varejo, atacado, web e televendas)' },
  mo: { rotulo: 'Mão de obra', descricao: 'Mão de obra das O.S.' },
  mpo: { rotulo: 'Peças de O.S.', descricao: 'Peças aplicadas nas O.S.' },
}
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const inicioDoDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const somarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const mesDe = d => monthKey(d)
const mesAnterior = d => new Date(d.getFullYear(), d.getMonth() - 1, 1)
const dataDe = r => (r.dt instanceof Date && !Number.isNaN(+r.dt) ? r.dt : null)

/** Métricas com meta ou movimento para a pessoa no mês. */
export function metricasDaPessoa(state, nome, mes) {
  const base = personMonth(state, nome, mes, 'mp')
  const e = base.entry
  return ['mp', 'mo', 'mpo'].filter(k => (e?.[k] || 0) > 0 || (k === 'mp' ? base.real : k === 'mo' ? (e?.ehConsultor ? e?.morealCons : e?.morealTec) : (e?.pocoficina || 0) - (e?.devPocoficina || 0)) > 0)
}

/** Data de referência: última data com venda carregada no mês atual (ou hoje). */
export function dataReferencia(state, agora = new Date()) {
  const mes = mesDe(agora)
  const ultima = latestDate([...(state.pecasPorMes[mes] || []), ...(state.oficinaPorMes[mes] || [])], agora)
  return inicioDoDia(ultima || agora)
}

function linhasEntre(state, nome, metrica, inicio, fim) {
  const meses = new Set([mesDe(inicio), mesDe(fim)])
  const linhas = [...meses].flatMap(m => personalRows(state, nome, m, metrica))
  return linhas.filter(r => { const d = dataDe(r); return d && d >= inicio && d < somarDias(fim, 1) })
}
const total = linhas => linhas.reduce((s, r) => s + r.amount, 0)

// Meta diária esperada: a meta do mês distribuída pelos dias úteis (sábado = meio dia).
function metaDiaria(state, nome, metrica, dia, cache) {
  const mes = mesDe(dia)
  if (!cache.has(mes)) {
    const p = personMonth(state, nome, mes, metrica)
    cache.set(mes, { alvo: p.target, total: p.total, feriados: p.holidays })
  }
  const { alvo, total: dias, feriados } = cache.get(mes)
  return alvo && dias ? alvo * workWeight(dia, feriados) / dias : 0
}

/**
 * Resumo do período: total atual, total do período anterior equivalente
 * (mesma quantidade de dias corridos) e as barras de realizado × meta.
 * modo 'semana': segunda a sábado da semana da data de referência.
 * modo 'mes': semanas do mês da data de referência.
 */
export function resumoPeriodo(state, nome, metrica, modo, refInformada) {
  const ref = inicioDoDia(refInformada)
  const cache = new Map()
  let inicio, inicioAnterior, fimAnterior
  if (modo === 'semana') {
    const dow = (ref.getDay() + 6) % 7 // segunda = 0
    inicio = somarDias(ref, -dow)
    inicioAnterior = somarDias(inicio, -7)
    fimAnterior = somarDias(ref, -7)
  } else {
    inicio = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const ant = mesAnterior(ref), fimMesAnt = new Date(ant.getFullYear(), ant.getMonth() + 1, 0)
    inicioAnterior = ant
    fimAnterior = new Date(ant.getFullYear(), ant.getMonth(), Math.min(ref.getDate(), fimMesAnt.getDate()))
  }
  const atual = total(linhasEntre(state, nome, metrica, inicio, ref))
  const anterior = total(linhasEntre(state, nome, metrica, inicioAnterior, fimAnterior))
  const variacao = anterior > 0 ? (atual - anterior) / anterior : null

  const porDia = new Map()
  const fimPeriodo = modo === 'semana' ? somarDias(inicio, 5) : new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
  for (const r of linhasEntre(state, nome, metrica, inicio, fimPeriodo)) {
    const k = inicioDoDia(dataDe(r)).getTime()
    porDia.set(k, (porDia.get(k) || 0) + r.amount)
  }
  const barras = []
  if (modo === 'semana') {
    for (let i = 0; i < 6; i++) {
      const dia = somarDias(inicio, i), futuro = dia > ref
      barras.push({ rotulo: DIAS[dia.getDay()], titulo: dia.toLocaleDateString('pt-BR'), real: futuro ? null : porDia.get(dia.getTime()) || 0, meta: metaDiaria(state, nome, metrica, dia, cache), atual: +dia === +ref })
    }
  } else {
    let semana = null
    for (let dia = new Date(inicio); dia <= fimPeriodo; dia = somarDias(dia, 1)) {
      // Nova semana na segunda — exceto quando a anterior só tinha dias sem expediente (ex.: mês que começa no domingo).
      if (!semana || (dia.getDay() === 1 && semana.meta > 0)) { semana = { rotulo: `S${barras.length + 1}`, de: new Date(dia), real: null, meta: 0, atual: false }; barras.push(semana) }
      semana.meta += metaDiaria(state, nome, metrica, dia, cache)
      if (dia <= ref) semana.real = (semana.real || 0) + (porDia.get(dia.getTime()) || 0)
      if (+dia === +ref) semana.atual = true
      semana.ate = new Date(dia)
    }
    for (const s of barras) s.titulo = `${s.de.toLocaleDateString('pt-BR')} a ${s.ate.toLocaleDateString('pt-BR')}`
  }
  const metaPeriodo = barras.reduce((s, b) => s + b.meta, 0)
  const metaAteHoje = barras.filter(b => b.real !== null).reduce((s, b) => s + b.meta, 0)
  return { atual, anterior, variacao, inicio, fim: ref, inicioAnterior, fimAnterior, barras, metaPeriodo, metaAteHoje }
}

/** Progresso do mês contra a meta de cada métrica aplicável. */
export function progressoMetas(state, nome, mes, metricas) {
  return metricas.map(k => {
    const p = personMonth(state, nome, mes, k)
    return { metrica: k, rotulo: METRICAS[k].rotulo, real: p.real, meta: p.target, pct: p.target > 0 ? p.real / p.target : null, projecao: p.projection, falta: p.gap, necessarioDia: p.needed, diasRestantes: p.remaining }
  }).filter(m => m.meta > 0 || m.real > 0)
}

/**
 * Ranking de quem tem o mesmo setor (cargo_movimento) no mês, ordenado pelo
 * percentual da meta da métrica. Só considera as pessoas presentes nos dados
 * liberados para o perfil; quem não tem meta fica fora da comparação.
 */
export function rankingSetor(state, nome, mes, metrica = 'mp') {
  // Mesma função que o servidor usa para quem não recebe os dados dos colegas.
  return rankingDoSetor({ pecas: state.pecasPorMes[mes] || [], oficina: state.oficinaPorMes[mes] || [], colaboradores: state.colaboradoresPorMes, metas: state.metasPorMes, mes, meuNome: nome, metrica })
}

export { monthKey, monthProgress }
