import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useStore from '../../store.js'
import { authorizedData, hasAdminDataAccess } from '../../services/authorizedAccess.js'
import { fmtBRL2 } from '../../utils/formatacao.js'
import { Estado } from '../../components/Estados.jsx'
import GraficoCilindros from './GraficoCilindros.jsx'
import { METRICAS, dataReferencia, metricasDaPessoa, monthKey, progressoMetas, rankingSetor, resumoPeriodo } from '../../analytics/meuDesempenho.js'
import { fotoDe, useMudancasOrg } from '../../pv/org.js'
import './meu-desempenho.css'

const Icone = ({ nome, size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><use href={`/icons/iconoir.svg#${nome}`} /></svg>
const iniciais = nome => String(nome || '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
const pct = v => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

// "R$ 12.345,67" com os centavos mais leves, como na referência.
function Valor({ v, className }) {
  const texto = fmtBRL2(v)
  const i = texto.lastIndexOf(',')
  return <span className={className}>{i > 0 ? <>{texto.slice(0, i)}<small>{texto.slice(i)}</small></> : texto}</span>
}
function Variacao({ v, rotulo }) {
  if (v === null || v === undefined) return <span className="md-var is-neutra">Sem base anterior</span>
  const sobe = v >= 0
  return <span className={`md-var ${sobe ? 'is-sobe' : 'is-desce'}`}><Icone nome={sobe ? 'arrow-up-right' : 'arrow-down-right'} size={14} />{pct(Math.abs(v))}<em>{rotulo}</em></span>
}

const primeiroNome = nome => String(nome || '').trim().split(/\s+/)[0]?.toLocaleLowerCase('pt-BR').replace(/^./, c => c.toUpperCase()) || ''

// Quem tem a base completa (admin, prévia) calcula aqui. Os demais recebem do
// servidor só nome e % da meta dos colegas do setor.
function useRankingSetor(state, nome, mes, metrica) {
  const local = useMemo(() => metrica ? rankingSetor(state, nome, mes, metrica) : { lista: [], minhaPosicao: null }, [state, nome, mes, metrica])
  const [remoto, setRemoto] = useState(null)
  useEffect(() => {
    let vivo = true
    setRemoto(null)
    if (!metrica) return
    hasAdminDataAccess().then(admin => {
      if (admin || !vivo) return
      setRemoto({ carregando: true, lista: [] })
      return authorizedData({ kind: 'rankingSetor', mes, metrica })
        .then(r => vivo && setRemoto(r || { lista: [], minhaPosicao: null }))
    }).catch(() => vivo && setRemoto({ erro: true, lista: [], minhaPosicao: null }))
    return () => { vivo = false }
  }, [nome, mes, metrica])
  return remoto || local
}

export default function MeuDesempenho({ nome, onDetalhes, pessoas, nomeSelecionado, onTrocarPessoa }) {
  const pecasPorMes = useStore(s => s.pecasPorMes), oficinaPorMes = useStore(s => s.oficinaPorMes), colaboradoresPorMes = useStore(s => s.colaboradoresPorMes), metasPorMes = useStore(s => s.metasPorMes), bonificacoes = useStore(s => s.bonificacoes), apelidoMap = useStore(s => s.apelidoMap), regras = useStore(s => s.regras), comissaoGestao = useStore(s => s.comissaoGestao), lojas = useStore(s => s.lojas)
  const state = useMemo(() => ({ pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, bonificacoes, apelidoMap, regras, comissaoGestao, lojas }), [pecasPorMes, oficinaPorMes, colaboradoresPorMes, metasPorMes, bonificacoes, apelidoMap, regras, comissaoGestao, lojas])
  const [modo, setModo] = useState('mes')
  const [metricaEscolhida, setMetrica] = useState(null)
  useMudancasOrg() // re-renderiza quando as fotos da equipe chegam


  const ref = useMemo(() => dataReferencia(state), [state])
  const mes = monthKey(ref)
  const metricas = useMemo(() => metricasDaPessoa(state, nome, mes), [state, nome, mes])
  const metrica = metricas.includes(metricaEscolhida) ? metricaEscolhida : metricas[0]
  const resumos = useMemo(() => Object.fromEntries(metricas.map(k => [k, resumoPeriodo(state, nome, k, modo, ref)])), [state, nome, metricas, modo, ref])
  const metas = useMemo(() => progressoMetas(state, nome, mes, metricas), [state, nome, mes, metricas])
  const ranking = useRankingSetor(state, nome, mes, metrica)

  if (!metricas.length) return (
    <Estado tipo="semDados" titulo="Ainda não há resultados neste mês" texto={`Não encontramos vendas nem metas de ${nome} em ${mes}. Assim que a base do mês for carregada, seus números aparecem aqui.`} />
  )

  const totalAtual = metricas.reduce((s, k) => s + resumos[k].atual, 0)
  const totalAnterior = metricas.reduce((s, k) => s + resumos[k].anterior, 0)
  const variacaoTotal = totalAnterior > 0 ? (totalAtual - totalAnterior) / totalAnterior : null
  const rotuloComparacao = modo === 'semana' ? 'vs semana anterior' : 'vs mês anterior'
  const r = resumos[metrica]
  const periodoTexto = modo === 'semana'
    ? `Semana de ${r.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${ref.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
    : `${ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} até dia ${ref.getDate()}`
  const variacaoMeta = r.metaAteHoje > 0 ? r.atual / r.metaAteHoje - 1 : null

  return (
    <div className="md">
      {/* Topo do app: avatar (perfil) e de quem são os números. Gestores trocam a pessoa aqui. */}
      <header className="md-topo">
        <Link to="/conta" className="md-avatar" aria-label="Abrir meu perfil">{fotoDe(nome) ? <img src={fotoDe(nome)} alt="" /> : iniciais(nome)}</Link>
        <div className="md-topo-quem">
          <small>{pessoas?.length > 1 ? 'Vendo resultados de' : 'Olá,'}</small>
          {pessoas?.length > 1
            ? <label className="md-topo-pessoa"><span className="sr-only">Selecionar colaborador</span><select value={nomeSelecionado} onChange={e => onTrocarPessoa(e.target.value)}>{pessoas.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select><Icone nome="nav-arrow-down" size={14} /></label>
            : <strong>{primeiroNome(nome)}</strong>}
        </div>
      </header>

      <div className="md-colunas">
        <div className="md-coluna">
          {/* Saldo → total realizado no período */}
          <section className="md-saldo" aria-labelledby="md-saldo-t">
            <span id="md-saldo-t">Total realizado · {modo === 'semana' ? 'semana' : 'mês'}</span>
            <Valor v={totalAtual} className="md-saldo-valor" />
            <div className="md-saldo-var"><Variacao v={variacaoTotal} rotulo={rotuloComparacao} /></div>
            <p className="md-saldo-periodo">{periodoTexto}</p>
          </section>

          {/* Add Money / Withdraw → Semana / Mês */}
          <div className="md-periodos" role="group" aria-label="Período">
            <button type="button" aria-pressed={modo === 'semana'} className={modo === 'semana' ? 'is-ativo' : ''} onClick={() => setModo('semana')}><Icone nome="calendar" />Semana</button>
            <button type="button" aria-pressed={modo === 'mes'} className={modo === 'mes' ? 'is-ativo' : ''} onClick={() => setModo('mes')}><Icone nome="graph-up" />Mês</button>
          </div>

          {/* My Cards → resultados por métrica */}
          <section aria-labelledby="md-cards-t">
            <h2 id="md-cards-t" className="md-rotulo">Meus resultados</h2>
            <div className="md-cards" role="list">
              {metricas.map((k, i) => {
                const rk = resumos[k], meta = metas.find(m => m.metrica === k)
                return (
                  <button type="button" role="listitem" key={k} className={`md-card md-card-${i % 3}${k === metrica ? ' is-ativo' : ''}`} aria-pressed={k === metrica} onClick={() => setMetrica(k)}>
                    <span className="md-card-topo"><span className="md-card-chave" aria-hidden="true"><i /></span><b>{meta?.pct != null ? `${pct(meta.pct)} da meta` : 'Sem meta'}</b></span>
                    <Valor v={rk.atual} className="md-card-valor" />
                    <span className="md-card-rodape"><span>{METRICAS[k].rotulo}</span><span>{rk.variacao === null ? '—' : `${rk.variacao >= 0 ? '+' : '−'}${pct(Math.abs(rk.variacao))}`}</span></span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Monthly limits → progresso de cada meta */}
          <section className="md-metas" aria-labelledby="md-metas-t">
            <h2 id="md-metas-t" className="md-rotulo">Metas do mês</h2>
            {metas.map(m => (
              <article key={m.metrica} className="md-meta">
                <header>
                  <span className="md-meta-icone" aria-hidden="true"><Icone nome={m.metrica === 'mo' ? 'wrench' : m.metrica === 'mpo' ? 'packages' : 'box'} /></span>
                  <div><strong>{m.rotulo}</strong><small>{fmtBRL2(m.real)} de {m.meta ? fmtBRL2(m.meta) : 'meta não cadastrada'}</small></div>
                </header>
                {m.meta > 0 ? <>
                  <div className="md-barra" role="progressbar" aria-label={`Progresso de ${m.rotulo}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, m.pct) * 100)}><i style={{ width: `${Math.min(100, m.pct * 100)}%` }} /></div>
                  <p>{m.pct >= 1 ? 'Meta batida' : `${pct(m.pct)} · faltam ${fmtBRL2(m.falta)}${m.necessarioDia ? ` · ${fmtBRL2(m.necessarioDia)} por dia útil` : ''}`}</p>
                </> : <p>Peça ao seu gestor para cadastrar a meta desta métrica.</p>}
              </article>
            ))}
          </section>
        </div>

        <div className="md-coluna">
          {/* Statistic → realizado diário × meta em cilindros */}
          <section className="md-estat" aria-labelledby="md-estat-t">
            {/* Período e métrica vêm dos botões Semana/Mês e dos cards acima: um controle para cada coisa. */}
            <header>
              <h2 id="md-estat-t">Realizado × meta</h2>
              <small>{METRICAS[metrica].rotulo} · {modo === 'semana' ? 'por dia' : 'por semana'}</small>
            </header>
            <GraficoCilindros barras={r.barras} />
            <div className="md-estat-totais">
              <div><span>Realizado</span><Valor v={r.atual} className="md-estat-valor" /><Variacao v={r.variacao} rotulo={rotuloComparacao} /></div>
              <div><span>Meta até hoje</span><Valor v={r.metaAteHoje} className="md-estat-valor" />{variacaoMeta === null ? <span className="md-var is-neutra">Sem meta</span> : <Variacao v={variacaoMeta} rotulo={variacaoMeta >= 0 ? 'acima' : 'abaixo'} />}</div>
            </div>
          </section>

          {/* Transactions → ranking do setor */}
          <section className="md-ranking" aria-labelledby="md-rank-t">
            <header><h2 id="md-rank-t">Ranking do setor</h2><small>{METRICAS[metrica].rotulo}{ranking.setor ? ` · ${ranking.setor}` : ''} · % da meta</small></header>
            {ranking.carregando ? <div className="md-rank-carregando" aria-busy="true" aria-label="Carregando ranking"><i /><i /><i /></div> : ranking.lista.length > 1 ? (
              <ol className="md-rank-lista">
                {ranking.lista.slice(0, 10).concat(ranking.minhaPosicao > 10 ? ranking.lista.filter(c => c.eu) : []).map(c => (
                  <li key={c.nome} className={c.eu ? 'is-eu' : undefined}>
                    <span className={`md-rank-avatar md-rank-${Math.min(c.posicao, 4)}`}>{iniciais(c.nome)}</span>
                    <div><strong>{c.eu ? `${c.nome} (você)` : c.nome}</strong><small>{c.posicao}º lugar{c.eu ? ` · ${fmtBRL2(c.real)}` : ''}</small></div>
                    <b>{pct(c.pct)}</b>
                  </li>
                ))}
              </ol>
            ) : (
              ranking.erro
                ? <Estado compacto tipo="erro" titulo="Não foi possível carregar o ranking" texto="Verifique a conexão e abra a página de novo." />
                : <Estado compacto tipo="vazio" titulo="Ranking ainda vazio" texto={ranking.minhaPosicao ? 'Ninguém mais do seu setor tem meta cadastrada neste mês.' : 'Você precisa ter setor e meta cadastrados neste mês para entrar no ranking.'} />
            )}
          </section>
        </div>
      </div>
      <button type="button" className="md-detalhes" onClick={onDetalhes}>Ver detalhamento completo<Icone nome="nav-arrow-right" size={16} /></button>
    </div>
  )
}
