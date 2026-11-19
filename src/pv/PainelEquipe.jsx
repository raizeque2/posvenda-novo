import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useStore from '../store.js'
import { norm, resolveNome } from '../utils/normalizacao.js'
import { buildRanking } from '../services/ranking/buildRanking.js'
import { latestDate, monthProgress } from '../analytics/personal.js'
import { iniciais, moeda } from './org.js'
import './painel-equipe.css'

const Icone = ({ nome, size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><use href={`/icons/iconoir.svg#${nome}`} /></svg>
const pct = v => v == null ? '—' : `${Math.round(v * 100).toLocaleString('pt-BR')}%`
const CANAIS = ['VAREJO', 'ATACADO', 'WEB', 'TELEVENDAS']
const DIA = 86400000
const linkPessoa = nome => `/desempenho/${encodeURIComponent(nome)}`

/**
 * Indicadores por pessoa do mês: venda (peças), meta, projeção pelo ritmo de
 * dias úteis, última venda e quantidade de vendas. Uma passada em buildRanking
 * para o mês inteiro, não uma por pessoa.
 */
function useIndicadores(mes) {
  const pecasPorMes = useStore(s => s.pecasPorMes), oficinaPorMes = useStore(s => s.oficinaPorMes), colaboradoresPorMes = useStore(s => s.colaboradoresPorMes), metasPorMes = useStore(s => s.metasPorMes), apelidoMap = useStore(s => s.apelidoMap)
  return useMemo(() => {
    const pecas = pecasPorMes[mes] || []
    const ranking = buildRanking(pecas, oficinaPorMes[mes] || [], mes, colaboradoresPorMes, metasPorMes, {}, 0, 0, apelidoMap)
    const corte = latestDate(pecas)
    const prog = monthProgress(mes, corte)
    const ultima = new Map(), vendas = new Map(), diaAnterior = new Map()
    const ontem = corte ? new Date(corte.getFullYear(), corte.getMonth(), corte.getDate()) : null
    for (const r of pecas) {
      if (!CANAIS.includes(r.cat) || r.eDevolucao || !(r.dt instanceof Date)) continue
      const k = norm(resolveNome(r.responsavel, apelidoMap) || r.responsavel)
      if (!ultima.has(k) || r.dt > ultima.get(k)) ultima.set(k, r.dt)
      vendas.set(k, (vendas.get(k) || 0) + 1)
      if (ontem && r.dt >= ontem) diaAnterior.set(k, (diaAnterior.get(k) || 0) + (Number(r.valor) || 0))
    }
    const porNome = new Map()
    for (const c of ranking) {
      const k = norm(c.nome)
      const projecao = prog.elapsed > 0 ? c.tp / prog.elapsed * prog.total : null
      const ult = ultima.get(k)
      porNome.set(k, {
        venda: c.tp, meta: c.mp || 0, pctMeta: c.mp > 0 ? c.tp / c.mp : null,
        projecao, pctProjecao: c.mp > 0 && projecao != null ? projecao / c.mp : null,
        falta: Math.max(0, (c.mp || 0) - c.tp), porDia: prog.remaining > 0 && c.mp > c.tp ? (c.mp - c.tp) / prog.remaining : null,
        diasSemVenda: corte && ult ? Math.round((new Date(corte.getFullYear(), corte.getMonth(), corte.getDate()) - new Date(ult.getFullYear(), ult.getMonth(), ult.getDate())) / DIA) : null,
        ultimaVenda: ult || null, qtdVendas: vendas.get(k) || 0, ultimoDia: diaAnterior.get(k) || 0,
      })
    }
    return { porNome, corte, prog }
  }, [mes, pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, apelidoMap])
}

function Barra({ v, tom }) {
  return <span className={`pe-barra is-${tom}`}><i style={{ width: `${Math.min(100, Math.max(0, (v || 0) * 100))}%` }} /></span>
}
const tomDe = p => p.meta <= 0 ? 'neutro' : p.pctProjecao >= 1 ? 'ok' : p.pctProjecao >= .85 ? 'atencao' : 'risco'
const ROTULO_TOM = { ok: 'No ritmo', atencao: 'Perto', risco: 'Abaixo do ritmo', neutro: 'Sem meta' }

/**
 * Painel de gestão (admin, coordenação e supervisor): o que está acontecendo
 * com a equipe e para onde olhar, com atalho para o desempenho de cada pessoa.
 */
// Pessoas das equipes escolhidas, cada uma com os indicadores do mês (uma linha por pessoa,
// mesmo quando ela aparece em duas equipes no mês).
function usePessoasGestao(mes, supervisores, atribuicoes) {
  const { porNome, corte, prog } = useIndicadores(mes)
  const pessoas = useMemo(() => {
    const vistos = new Map()
    for (const a of atribuicoes) {
      if (!supervisores.includes(a.supervisor)) continue
      const k = norm(a.colaborador)
      const atual = vistos.get(k)
      if (atual) { atual.supervisores.push(a.supervisor); continue }
      vistos.set(k, { nome: a.colaborador, loja: a.loja, cargo: a.cargo, supervisores: [a.supervisor], ...(porNome.get(k) || { venda: 0, meta: 0, pctMeta: null, pctProjecao: null, falta: 0, diasSemVenda: null, qtdVendas: 0, ultimoDia: 0 }) })
    }
    return [...vistos.values()]
  }, [atribuicoes, supervisores, porNome])
  return { pessoas, corte, prog }
}

const somar = (lista, campo) => lista.reduce((s, p) => s + (p[campo] || 0), 0)

/**
 * Resumo do Início para gestão: resultado do recorte do cargo (empresa para o admin,
 * coordenação, equipe do supervisor) com os mesmos números do Meu Painel.
 */
export function ResultadoGeral({ mes, supervisores, atribuicoes, titulo, agruparPor = 'loja', linkPainel }) {
  const { pessoas, corte, prog } = usePessoasGestao(mes, supervisores, atribuicoes)
  const venda = somar(pessoas, 'venda'), meta = somar(pessoas, 'meta')
  const projecao = prog.elapsed > 0 ? venda / prog.elapsed * prog.total : null
  const comMeta = pessoas.filter(p => p.meta > 0), noRitmo = comMeta.filter(p => p.pctProjecao >= 1)
  const parados = pessoas.filter(p => (p.meta > 0 || p.venda > 0) && (p.diasSemVenda == null || p.diasSemVenda >= 3))
  const grupos = useMemo(() => {
    const m = new Map()
    for (const p of pessoas) for (const g of agruparPor === 'loja' ? [p.loja || 'Sem loja'] : agruparPor === 'supervisor' ? p.supervisores : []) {
      const item = m.get(g) || { nome: g, venda: 0, meta: 0, pessoas: 0 }
      item.venda += p.venda; item.meta += p.meta; item.pessoas++
      m.set(g, item)
    }
    return [...m.values()].sort((a, b) => b.venda - a.venda)
  }, [pessoas, agruparPor])
  const destaques = comMeta.filter(p => p.venda > 0).sort((a, b) => b.pctMeta - a.pctMeta).slice(0, 3)
  const atencao = comMeta.filter(p => p.pctProjecao < 1).sort((a, b) => b.falta - a.falta).slice(0, 3)
  const dataCorte = corte ? corte.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null

  return (
    <section className="pe-resultado" aria-label={titulo}>
      <header>
        <div><h2>{titulo}</h2><p>Vendas de peças · {mes}{dataCorte ? ` · até ${dataCorte}` : ''}{prog.remaining ? ` · ${Math.ceil(prog.remaining)} dias úteis restantes` : ''}</p></div>
        {linkPainel && <Link to={linkPainel}>Painel completo <Icone nome="arrow-up-right" size={14} /></Link>}
      </header>
      {!pessoas.length ? <p className="pe-vazio">Nenhuma pessoa vinculada neste mês.</p> : <>
        <div className="pe-kpis">
          <article><span>Vendido</span><strong>{moeda(venda)}</strong><Barra v={meta ? venda / meta : 0} tom="ok" /><small>{meta ? `${pct(venda / meta)} da meta de ${moeda(meta)}` : 'Sem meta cadastrada'}</small></article>
          <article><span>Projeção do mês</span><strong>{projecao == null ? '—' : moeda(projecao)}</strong><small>{meta && projecao != null ? `${pct(projecao / meta)} da meta pelo ritmo atual` : 'Pelo ritmo dos dias úteis'}</small></article>
          <article><span>No ritmo da meta</span><strong>{noRitmo.length}<em> de {comMeta.length}</em></strong><Barra v={comMeta.length ? noRitmo.length / comMeta.length : 0} tom={noRitmo.length >= comMeta.length / 2 ? 'ok' : 'atencao'} /><small>pessoas com projeção acima da meta</small></article>
          <article className={parados.length ? 'is-alerta' : undefined}><span>Sem vender há 3+ dias</span><strong>{parados.length}</strong><small>{parados.length ? parados.slice(0, 3).map(p => p.nome.split(' ')[0]).join(', ') + (parados.length > 3 ? '…' : '') : 'Todos venderam recentemente'}</small></article>
        </div>
        <div className="pe-resultado-baixo">
          {grupos.length > 1 && (
            <section className="pe-bloco">
              <header><Icone nome={agruparPor === 'loja' ? 'building' : 'group'} /><div><h2>{agruparPor === 'loja' ? 'Por loja' : 'Por equipe'}</h2><p>Vendido e % da meta</p></div></header>
              <ul className="pe-grupos">{grupos.slice(0, 8).map(g => (
                <li key={g.nome}>
                  <span className="pe-info"><strong>{g.nome}</strong><small>{g.pessoas} pessoas</small></span>
                  <span className="pe-grupo-valor"><b>{moeda(g.venda)}</b><Barra v={g.meta ? g.venda / g.meta : 0} tom={g.meta && g.venda / g.meta >= prog.elapsed / Math.max(1, prog.total) ? 'ok' : 'atencao'} /><small>{g.meta ? `${pct(g.venda / g.meta)} da meta` : 'Sem meta'}</small></span>
                </li>
              ))}</ul>
            </section>
          )}
          <section className="pe-bloco">
            <header><Icone nome="trophy" /><div><h2>Destaques</h2><p>Maior % da meta</p></div></header>
            {destaques.length ? <ul className="pe-lista">{destaques.map((p, i) => (
              <li key={p.nome}><Link to={linkPessoa(p.nome)}><span className={`pe-avatar pe-medalha-${i + 1}`}>{iniciais(p.nome)}</span><span className="pe-info"><strong>{p.nome}</strong><small>{moeda(p.venda)}</small></span><span className="pe-selo is-ok">{pct(p.pctMeta)}</span></Link></li>
            ))}</ul> : <p className="pe-vazio">Sem metas cadastradas neste mês.</p>}
          </section>
          <section className="pe-bloco">
            <header><Icone nome="warning-triangle" /><div><h2>Precisa de atenção</h2><p>Abaixo do ritmo da meta</p></div></header>
            {atencao.length ? <ul className="pe-lista">{atencao.map(p => (
              <li key={p.nome}><Link to={linkPessoa(p.nome)}><span className="pe-avatar">{iniciais(p.nome)}</span><span className="pe-info"><strong>{p.nome}</strong><small>faltam {moeda(p.falta)}</small></span><span className={`pe-selo is-${tomDe(p)}`}>{pct(p.pctProjecao)}</span></Link></li>
            ))}</ul> : <p className="pe-vazio">Todo mundo com meta está no ritmo.</p>}
          </section>
        </div>
      </>}
    </section>
  )
}

export default function PainelEquipe({ mes, supervisores, atribuicoes, titulo, mostrarSupervisores = true }) {
  const { pessoas, corte, prog } = usePessoasGestao(mes, supervisores, atribuicoes)
  const [filtro, setFiltro] = useState(null)
  const [ordem, setOrdem] = useState('venda')

  const visiveis = useMemo(() => {
    const base = filtro ? pessoas.filter(p => p.supervisores.includes(filtro)) : pessoas
    const chave = { venda: p => -p.venda, meta: p => -(p.pctMeta ?? -1), ritmo: p => p.pctProjecao ?? 9, parado: p => -(p.diasSemVenda ?? -1) }[ordem]
    return [...base].sort((a, b) => chave(a) - chave(b) || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [pessoas, filtro, ordem])

  const doRecorte = filtro ? pessoas.filter(p => p.supervisores.includes(filtro)) : pessoas
  const venda = doRecorte.reduce((s, p) => s + p.venda, 0), meta = doRecorte.reduce((s, p) => s + p.meta, 0)
  const projecao = prog.elapsed > 0 ? venda / prog.elapsed * prog.total : null
  const comMeta = doRecorte.filter(p => p.meta > 0), noRitmo = comMeta.filter(p => p.pctProjecao >= 1)
  // Só quem vende peças (tem meta ou já vendeu no mês); oficina e apoio não entram.
  const parados = doRecorte.filter(p => (p.meta > 0 || p.venda > 0) && (p.diasSemVenda == null || p.diasSemVenda >= 3))
  const atencao = comMeta.filter(p => p.pctProjecao < 1).sort((a, b) => b.falta - a.falta).slice(0, 5)
  const destaques = comMeta.filter(p => p.venda > 0).sort((a, b) => b.pctMeta - a.pctMeta).slice(0, 3)
  const ultimoDia = doRecorte.filter(p => p.ultimoDia > 0).sort((a, b) => b.ultimoDia - a.ultimoDia).slice(0, 3)
  const dataCorte = corte ? corte.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null

  const cards = useMemo(() => supervisores.map(s => {
    const equipe = pessoas.filter(p => p.supervisores.includes(s))
    const v = equipe.reduce((t, p) => t + p.venda, 0), m = equipe.reduce((t, p) => t + p.meta, 0)
    const cm = equipe.filter(p => p.meta > 0)
    return { nome: s, equipe, venda: v, meta: m, pct: m > 0 ? v / m : null, noRitmo: cm.filter(p => p.pctProjecao >= 1).length, comMeta: cm.length, lider: [...equipe].sort((a, b) => b.venda - a.venda)[0] }
  }).filter(c => c.equipe.length).sort((a, b) => b.venda - a.venda), [supervisores, pessoas])

  if (!pessoas.length) return <p className="page-sub">Nenhuma pessoa vinculada neste mês.</p>

  return (
    <div className="pe">
      <div className="pe-kpis">
        <article><span>Vendas {filtro ? `· ${filtro}` : 'da equipe'}</span><strong>{moeda(venda)}</strong><Barra v={meta ? venda / meta : 0} tom="ok" /><small>{meta ? `${pct(venda / meta)} da meta de ${moeda(meta)}` : 'Sem meta cadastrada'}</small></article>
        <article><span>Projeção do mês</span><strong>{projecao == null ? '—' : moeda(projecao)}</strong><small>{meta && projecao != null ? `${pct(projecao / meta)} da meta pelo ritmo atual` : 'Pelo ritmo dos dias úteis'}{prog.remaining ? ` · ${Math.ceil(prog.remaining)} dias úteis restantes` : ''}</small></article>
        <article><span>No ritmo da meta</span><strong>{noRitmo.length}<em> de {comMeta.length}</em></strong><Barra v={comMeta.length ? noRitmo.length / comMeta.length : 0} tom={noRitmo.length >= comMeta.length / 2 ? 'ok' : 'atencao'} /><small>pessoas com projeção acima da meta</small></article>
        <article className={parados.length ? 'is-alerta' : undefined}><span>Sem vender há 3+ dias</span><strong>{parados.length}</strong><small>{parados.length ? parados.slice(0, 3).map(p => p.nome.split(' ')[0]).join(', ') + (parados.length > 3 ? '…' : '') : 'Todos venderam recentemente'}</small></article>
      </div>

      <div className="pe-blocos">
        <section className="pe-bloco">
          <header><Icone nome="warning-triangle" /><div><h2>Precisa de atenção</h2><p>Abaixo do ritmo, por quanto falta para a meta</p></div></header>
          {atencao.length ? <ul className="pe-lista">{atencao.map(p => (
            <li key={p.nome}><Link to={linkPessoa(p.nome)}>
              <span className="pe-avatar">{iniciais(p.nome)}</span>
              <span className="pe-info"><strong>{p.nome}</strong><small>faltam {moeda(p.falta)}{p.porDia ? ` · ${moeda(p.porDia)}/dia útil` : ''}</small></span>
              <span className={`pe-selo is-${tomDe(p)}`}>{pct(p.pctProjecao)}</span>
            </Link></li>
          ))}</ul> : <p className="pe-vazio">Todo mundo com meta está no ritmo. 👏</p>}
        </section>
        <section className="pe-bloco">
          <header><Icone nome="trophy" /><div><h2>Destaques do mês</h2><p>Maior % da meta já realizada</p></div></header>
          {destaques.length ? <ul className="pe-lista">{destaques.map((p, i) => (
            <li key={p.nome}><Link to={linkPessoa(p.nome)}>
              <span className={`pe-avatar pe-medalha-${i + 1}`}>{iniciais(p.nome)}</span>
              <span className="pe-info"><strong>{p.nome}</strong><small>{moeda(p.venda)} · {p.qtdVendas} vendas</small></span>
              <span className="pe-selo is-ok">{pct(p.pctMeta)}</span>
            </Link></li>
          ))}</ul> : <p className="pe-vazio">Sem metas cadastradas neste mês.</p>}
          {ultimoDia.length > 0 && <p className="pe-nota"><Icone nome="clock" size={14} /> Em {dataCorte}: {ultimoDia.map(p => `${p.nome.split(' ')[0]} ${moeda(p.ultimoDia)}`).join(' · ')}</p>}
        </section>
      </div>

      {mostrarSupervisores && cards.length > 1 && (
        <section>
          <h2 className="pe-secao">Equipes {filtro && <button type="button" className="pe-limpar" onClick={() => setFiltro(null)}>Ver todas</button>}</h2>
          <div className="pe-sups">{cards.map(c => (
            <button type="button" key={c.nome} className={`pe-sup${filtro === c.nome ? ' is-ativo' : ''}`} aria-pressed={filtro === c.nome} onClick={() => setFiltro(filtro === c.nome ? null : c.nome)}>
              <span className="pe-sup-topo"><span className="pe-avatar">{iniciais(c.nome)}</span><span><strong>{c.nome}</strong><small>{c.equipe.length} pessoas</small></span></span>
              <b>{moeda(c.venda)}</b>
              <Barra v={c.pct} tom={c.pct >= 1 ? 'ok' : 'atencao'} />
              <small>{c.pct == null ? 'Sem meta' : `${pct(c.pct)} da meta`} · {c.noRitmo}/{c.comMeta} no ritmo{c.lider?.venda ? ` · destaque ${c.lider.nome.split(' ')[0]}` : ''}</small>
            </button>
          ))}</div>
        </section>
      )}

      <section className="pe-tabela">
        <header>
          <h2>{titulo}{filtro ? ` · ${filtro}` : ''}</h2>
          <label><span className="sr-only">Ordenar</span><select value={ordem} onChange={e => setOrdem(e.target.value)}><option value="venda">Maior venda</option><option value="meta">Maior % da meta</option><option value="ritmo">Mais abaixo do ritmo</option><option value="parado">Mais tempo sem vender</option></select></label>
        </header>
        <ol>{visiveis.map((p, i) => {
          const tom = tomDe(p)
          return (
            <li key={p.nome}><Link to={linkPessoa(p.nome)}>
              <span className="pe-pos">{i + 1}</span>
              <span className="pe-avatar">{iniciais(p.nome)}</span>
              <span className="pe-info"><strong>{p.nome}</strong><small>{[p.loja, p.supervisores.join(' / ')].filter(Boolean).join(' · ')}</small><Barra v={p.pctMeta} tom={tom} /></span>
              <span className="pe-col"><b>{moeda(p.venda)}</b><small>{p.meta ? `${pct(p.pctMeta)} de ${moeda(p.meta)}` : 'Sem meta'}</small></span>
              <span className="pe-col pe-col-ritmo"><span className={`pe-selo is-${tom}`}>{ROTULO_TOM[tom]}</span><small>{p.diasSemVenda == null ? 'Sem vendas no mês' : p.diasSemVenda === 0 ? `Vendeu em ${dataCorte}` : `Última venda há ${p.diasSemVenda} ${p.diasSemVenda > 1 ? 'dias' : 'dia'}`}</small></span>
              <Icone nome="nav-arrow-right" />
            </Link></li>
          )
        })}</ol>
      </section>
    </div>
  )
}
