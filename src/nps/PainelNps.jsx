// Painel do NPS dentro do Pós-Venda (aba /nps). Dados pela função npsPainel:
// o CPF nunca chega aqui, só se foi informado; a planilha do administrador traz o número.
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { functions } from '../firebase.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { SETORES_NPS } from '../../functions/src/nps.js'
import { analisar, filtrar } from './analytics.js'
import { FiltroDropdown } from '../components/DS.jsx'
import { CalendarDays, LayoutGrid, Smile } from 'lucide-react'

const ICONE_FILTRO = { periodo: CalendarDays, setor: LayoutGrid, perfil: Smile }
import './painel-nps.css'

const npsPainel = httpsCallable(functions, 'npsPainel', { timeout: 60000 })
const POR_PAGINA = 10
const decimal = v => v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const sinal = v => v === null ? '—' : `${v > 0 ? '+' : ''}${v}`
const dataHora = v => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(v))
const ROTULO = { 1: 'Balcão de peças', 2: 'Oficina / garantia', 3: 'Novas / entrega', 4: 'Seminovos', 5: 'Consórcios', 6: 'CNH', 7: 'Outros' }
const eixo = { fontSize: 11, fill: 'var(--text3)' }
const dica = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--text)' }
const ACENTO = 'var(--honda)'

const Icone = ({ id, t = 17 }) => <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><use href={`/icons/iconoir.svg#${id}`} /></svg>

function Painel({ titulo, sub, acao, children, className = '' }) {
  return <section className={`nps-bloco ${className}`}>
    <header><div><h2>{titulo}</h2><p>{sub}</p></div>{acao}</header>
    {children}
  </section>
}
const Vazio = ({ texto = 'As respostas aparecem aqui assim que os clientes responderem.' }) => <div className="nps-vazio"><Icone id="graph-up" t={26} /><p>{texto}</p></div>

export default function PainelNps() {
  const { role } = useAuth()
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [atualizado, setAtualizado] = useState(null)
  const [filtros, setFiltros] = useState({ periodo: 'all', setor: 'all', perfil: 'all' })
  const [aba, setAba] = useState('setor')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aberto, setAberto] = useState(null)

  const carregar = useCallback(async () => {
    setCarregando(true); setErro('')
    try { const { data } = await npsPainel({ acao: 'ler' }); setItens(data.avaliacoes || []); setAtualizado(new Date()) }
    catch (e) { setErro(e?.message || 'Não foi possível carregar as respostas.') }
    finally { setCarregando(false) }
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  async function exportar() {
    setErro('')
    try {
      const { data } = await npsPainel({ acao: 'exportar' })
      const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = 'nps-alagoas-motos.csv'; a.click(); URL.revokeObjectURL(url)
    } catch (e) { setErro(e?.message || 'Não foi possível baixar a planilha.') }
  }

  const filtrar_ = (k, v) => { setFiltros(f => ({ ...f, [k]: v })); setPagina(1) }
  const filtrados = useMemo(() => filtrar(itens, filtros), [itens, filtros])
  const st = useMemo(() => analisar(filtrados), [filtrados])
  const tabela = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    return q ? filtrados.filter(i => [i.setor, i.comentario, ...(i.motivosCaixa || []), ...(i.motivos || [])].join(' ').toLocaleLowerCase('pt-BR').includes(q)) : filtrados
  }, [filtrados, busca])
  const paginas = Math.max(1, Math.ceil(tabela.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas)
  const linhas = tabela.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)
  const motivos = aba === 'setor' ? st.motivosSetor : st.motivosCaixa
  const maxMotivo = Math.max(1, ...motivos.map(m => m.n))
  const setores = st.porSetor.filter(s => s.media !== null).map(s => ({ ...s, rotulo: ROTULO[s.id] || s.nome }))
  const temFiltro = filtros.periodo !== 'all' || filtros.setor !== 'all' || filtros.perfil !== 'all'

  return <div className="page nps-painel">
    <header className="nps-topo">
      <div>
        <h1>NPS</h1>
        <p>O que os clientes dizem no totem da loja.</p>
      </div>
      <div className="nps-acoes">
        <span className="nps-atualizado">{carregando ? 'Atualizando…' : atualizado ? `Atualizado às ${atualizado.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        <button type="button" className="nps-icone" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar" title="Atualizar"><Icone id="refresh-double" /></button>
        <a className="nps-botao" href="/pesquisa" target="_blank" rel="noopener">Abrir pesquisa <Icone id="arrow-up-right" t={15} /></a>
        <button type="button" className="nps-botao nps-botao-forte" onClick={() => void exportar()} title={role === 'admin' ? 'Todas as respostas, com CPF quando informado' : 'Todas as respostas, sem CPF'}><Icone id="download" t={15} /> Exportar CSV</button>
      </div>
    </header>

    {erro && <p className="nps-erro" role="alert">{erro}</p>}

    <section className="nps-filtros" aria-label="Filtros">
      {[
        ['periodo', 'Período', [['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias']]],
        ['setor', 'Setor', SETORES_NPS.map(s => [String(s.id), s.nome])],
        ['perfil', 'Perfil', [['high', 'Promotores · 9–10'], ['middle', 'Neutros · 7–8'], ['low', 'Detratores · 0–6']]],
      ].map(([chave, rotulo, opcoes]) => <FiltroDropdown key={chave} label={rotulo} icon={ICONE_FILTRO[chave]}
        options={opcoes.map(([value, label]) => ({ value, label }))}
        value={filtros[chave] === 'all' ? '' : filtros[chave]} onChange={v => filtrar_(chave, v || 'all')} />)}
      {temFiltro && <button type="button" className="nps-limpar" onClick={() => { setFiltros({ periodo: 'all', setor: 'all', perfil: 'all' }); setPagina(1) }}>Limpar filtros</button>}
    </section>

    <div className="nps-kpis" aria-busy={carregando}>
      <article className="nps-kpi nps-kpi-destaque">
        <span>NPS geral</span>
        <strong>{sinal(st.nps)}</strong>
        <p>% promotores − % detratores</p>
        <div className="nps-trilho">{st.perfis.map(p => <i key={p.nome} style={{ width: `${st.total ? p.n / st.total * 100 : 0}%`, background: p.cor }} />)}</div>
      </article>
      <article className="nps-kpi"><span>Respostas</span><strong>{st.total.toLocaleString('pt-BR')}</strong><p>{st.comentarios} com comentário</p></article>
      <article className="nps-kpi"><span>Nota dos setores</span><strong>{decimal(st.mediaSetor)}<em>/ 10</em></strong><p>{st.setorAvaliadas} {st.setorAvaliadas === 1 ? 'avaliação' : 'avaliações'}</p></article>
      <article className="nps-kpi"><span>Caixa</span><strong>{decimal(st.mediaCaixa)}<em>/ 5</em></strong><p>{st.caixaAvaliadas} {st.caixaAvaliadas === 1 ? 'avaliação' : 'avaliações'}</p></article>
    </div>

    {!filtrados.length && !carregando && <div className="nps-sem-dados"><Icone id="message-text" t={20} /><div><strong>{itens.length ? 'Nenhuma resposta com estes filtros.' : 'Ainda não há respostas.'}</strong><p>{itens.length ? 'Ajuste o período, o setor ou o perfil.' : 'Abra a pesquisa no tablet da loja; as respostas aparecem aqui.'}</p></div></div>}

    <div className="nps-grade">
      <Painel titulo="Evolução" sub={st.mensal ? 'NPS e respostas por mês' : 'NPS e respostas por dia'} acao={<div className="nps-legenda"><span><i style={{ background: ACENTO }} />NPS</span><span><i style={{ background: 'var(--bg4)' }} />Respostas</span></div>}>
        {st.linhaTempo.length ? <div className="nps-grafico"><ResponsiveContainer width="100%" height="100%" minWidth={0}><ComposedChart data={st.linhaTempo} margin={{ top: 14, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={eixo} minTickGap={25} />
          <YAxis yAxisId="v" allowDecimals={false} tickLine={false} axisLine={false} tick={eixo} />
          <YAxis yAxisId="n" orientation="right" domain={[-100, 100]} ticks={[-100, 0, 100]} tickLine={false} axisLine={false} tick={eixo} />
          <Tooltip contentStyle={dica} labelFormatter={(_, p) => p[0]?.payload.data || ''} />
          <Bar yAxisId="v" dataKey="respostas" name="Respostas" fill="var(--bg4)" radius={[4, 4, 0, 0]} maxBarSize={25} />
          <Line yAxisId="n" dataKey="nps" name="NPS" type="monotone" stroke={ACENTO} strokeWidth={2.5} dot={{ r: 3, fill: ACENTO, strokeWidth: 2, stroke: 'var(--bg2)' }} activeDot={{ r: 5 }} connectNulls={false} />
        </ComposedChart></ResponsiveContainer></div> : <Vazio />}
      </Painel>

      <Painel titulo="Perfil das notas" sub="Recomendação de 0 a 10">
        {st.total ? <><div className="nps-rosca"><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={st.perfis} dataKey="n" nameKey="nome" innerRadius={58} outerRadius={78} paddingAngle={3} stroke="none">{st.perfis.map(p => <Cell key={p.nome} fill={p.cor} />)}</Pie><Tooltip contentStyle={dica} /></PieChart></ResponsiveContainer><div className="nps-rosca-centro"><strong>{st.perfis[0].pct}%</strong><span>promotores</span></div></div>
          <div className="nps-perfis">{st.perfis.map(p => <div key={p.nome}><i style={{ background: p.cor }} /><span>{p.nome}<small>{p.faixa}</small></span><b>{p.n}</b><em>{p.pct}%</em></div>)}</div></> : <Vazio />}
      </Painel>

      <Painel titulo="Atendimento por setor" sub="Média da nota do setor · 0 a 10">
        {setores.length ? <div className="nps-grafico"><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={setores} layout="vertical" margin={{ left: 0, right: 35, top: 10, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tickLine={false} axisLine={false} tick={eixo} />
          <YAxis dataKey="rotulo" type="category" width={115} tickLine={false} axisLine={false} tick={{ ...eixo, fill: 'var(--text2)' }} />
          <Tooltip cursor={{ fill: 'var(--bg3)' }} content={({ active, payload }) => { const s = payload?.[0]?.payload; return active && s ? <div className="nps-dica"><strong>{s.nome}</strong><p>Nota média: {decimal(s.media)} / 10</p><p>{s.avaliadas} avaliações · NPS {sinal(s.nps)}</p></div> : null }} />
          <Bar dataKey="media" fill={ACENTO} maxBarSize={17} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: 'var(--text2)', formatter: v => decimal(Number(v)) }} />
        </BarChart></ResponsiveContainer></div> : <Vazio texto="Nenhuma nota de setor neste recorte." />}
      </Painel>

      <Painel titulo="Caixa" sub="Como foi o pagamento">
        {st.caixaAvaliadas ? <div className="nps-grafico"><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={st.caixa} margin={{ left: -25, right: 5, top: 25, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="nome" tickLine={false} axisLine={false} interval={0} tick={{ ...eixo, fontSize: 10 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={eixo} />
          <Tooltip contentStyle={dica} cursor={{ fill: 'var(--bg3)' }} />
          <Bar dataKey="n" name="Respostas" maxBarSize={34} radius={[5, 5, 0, 0]} label={{ position: 'top', fontSize: 11, fill: 'var(--text2)' }}>{st.caixa.map(c => <Cell key={c.nome} fill={c.cor} />)}</Bar>
        </BarChart></ResponsiveContainer></div> : <Vazio texto="Nenhuma avaliação do caixa neste recorte." />}
        <p className="nps-nota">{st.semCaixa} {st.semCaixa === 1 ? 'cliente não passou' : 'clientes não passaram'} pelo caixa (fora da média).</p>
      </Painel>

      <Painel className="nps-largo" titulo="Onde melhorar" sub="Os cinco motivos mais escolhidos" acao={<div className="nps-abas" role="group" aria-label="Motivos"><button type="button" aria-pressed={aba === 'setor'} onClick={() => setAba('setor')}>Setores</button><button type="button" aria-pressed={aba === 'caixa'} onClick={() => setAba('caixa')}>Caixa</button></div>}>
        {motivos.length ? <div className="nps-motivos">{motivos.map((m, i) => <div key={m.nome}><span className="nps-pos">{String(i + 1).padStart(2, '0')}</span><div><span>{m.nome}</span><i><b style={{ width: `${m.n / maxMotivo * 100}%` }} /></i></div><strong>{m.n}</strong></div>)}</div> : <Vazio texto="Nenhum motivo registrado neste recorte." />}
      </Painel>
    </div>

    <Painel className="nps-respostas" titulo="Respostas" sub="Abra para ver motivos e comentário" acao={<label className="nps-busca"><Icone id="search" t={15} /><input type="search" aria-label="Buscar nas respostas" placeholder="Setor, motivo ou comentário" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1) }} /></label>}>
      <div className="nps-tabela"><table>
        <thead><tr><th>Recebida em</th><th>Setor</th><th>NPS</th><th>Setor</th><th>Caixa</th><th>Comentário</th><th><span className="sr-only">Detalhes</span></th></tr></thead>
        <tbody>{linhas.map(i => <Fragment key={i.id}>
          <tr>
            <td>{dataHora(i.criadoEm)}</td><td>{i.setor}</td>
            <td><b className={`nps-nota-chip ${i.nota <= 6 ? 'baixo' : i.nota <= 8 ? 'medio' : 'alto'}`}>{i.nota}</b></td>
            <td>{i.notaSetor ?? '—'}{i.notaSetor != null && '/10'}</td>
            <td>{i.notaCaixa === 0 ? <span className="nps-fraco">Não passou</span> : i.notaCaixa ? `${i.notaCaixa}/5` : '—'}</td>
            <td>{i.comentario?.trim() ? <span className="nps-ok">Recebido</span> : <span className="nps-fraco">—</span>}</td>
            <td><button type="button" className="nps-abrir" aria-expanded={aberto === i.id} aria-label={`Detalhes de ${i.setor} em ${dataHora(i.criadoEm)}`} onClick={() => setAberto(aberto === i.id ? null : i.id)}><Icone id="nav-arrow-down" t={16} /></button></td>
          </tr>
          {aberto === i.id && <tr className="nps-detalhe"><td colSpan={7}><div>
            <section><h3>Motivos do setor</h3><p>{i.motivos?.join(' · ') || 'Nenhum.'}</p></section>
            <section><h3>Motivos do caixa</h3><p>{i.motivosCaixa?.join(' · ') || 'Nenhum.'}</p></section>
            <section><h3>Comentário</h3><p>{i.comentario || 'Sem comentário.'}</p><small>CPF {i.cpfInformado ? 'informado pelo cliente' : 'não informado'}</small></section>
          </div></td></tr>}
        </Fragment>)}</tbody>
      </table>{!linhas.length && <p className="nps-tabela-vazia">{carregando ? 'Carregando respostas…' : 'Nenhuma resposta encontrada.'}</p>}</div>
      <footer className="nps-paginas"><span>{tabela.length ? `${(pag - 1) * POR_PAGINA + 1}–${Math.min(pag * POR_PAGINA, tabela.length)} de ${tabela.length}` : '0 respostas'}</span><div><button type="button" aria-label="Página anterior" disabled={pag === 1} onClick={() => setPagina(pag - 1)}><Icone id="arrow-left" t={15} /></button><span>{pag} / {paginas}</span><button type="button" aria-label="Próxima página" disabled={pag === paginas} onClick={() => setPagina(pag + 1)}><Icone id="arrow-right" t={15} /></button></div></footer>
    </Painel>
    <p className="nps-nota">NPS = % de notas 9–10 menos % de notas 0–6. Motivos podem ser vários por resposta; “Nada a melhorar agora” fica fora do ranking.</p>
  </div>
}
