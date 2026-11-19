import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, CircleAlert, RefreshCw } from '../icons/iconoir'
import useStore from '../store.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { podeAcessar } from '../data/permissoes.js'
import { LOJAS } from '../data/regras.js'
import { homeSummary } from '../analytics/home.js'
import { carregarPosicaoMes } from '../services/cloudStorage.js'
import { resumoEstoque } from '../services/processamento/processarObsoleto.js'
import { fmtBRL2 as money } from '../utils/formatacao.js'
import { saudacaoBrasil } from '../utils/time.js'
import { ResultadoGeral } from '../pv/PainelEquipe.jsx'
import { useEscopoGestao } from '../pv/org.js'

const TITULO_CARGO={admin:'Resultado da empresa',coordenador:'Resultado da sua coordenação',supervisor:'Resultado da sua equipe'}
function ResultadoDoCargo({role,nome,linkPainel}){
  const {mes,atribuicoes,supervisores}=useEscopoGestao(role,nome)
  if(role==='coordenador'&&!supervisores.length)return <section className="pe-resultado"><header><div><h2>{TITULO_CARGO.coordenador}</h2><p>Nenhum supervisor ligado a você no organograma ainda.</p></div></header></section>
  return <ResultadoGeral mes={mes} supervisores={supervisores} atribuicoes={atribuicoes} titulo={TITULO_CARGO[role]} agruparPor={role==='admin'?'loja':role==='coordenador'?'supervisor':'nenhum'} linkPainel={linkPainel}/>
}
import { ServiceCard } from '../components/ui/service-card'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../components/ui/dialog'
import '../theme/operations.css'
import './home.css'

const shortcuts=[
  {title:'Dashboard',description:'Todos os setores em uma visão.',to:'/dashboard',imgSrc:'/illustrations/sales.png',variant:'red'},
  {title:'Meu desempenho',description:'Evolução, ritmo e próximos passos.',to:'/desempenho',imgSrc:'/illustrations/targets.png'},
  {title:'Estoque',description:'Giro, itens parados e oportunidades.',to:'/estoque',imgSrc:'/illustrations/stock.png',variant:'gray'},
  {title:'Comissões',description:'Entenda os valores de cada pessoa.',to:'/comissoes',imgSrc:'/illustrations/commissions.png',variant:'blue'},
  {title:'Metas',description:'Planeje e acompanhe os objetivos.',to:'/metas',imgSrc:'/illustrations/targets.png',variant:'gray'},
  {title:'Supervisores',description:'Acompanhe a evolução das equipes.',to:'/equipes',imgSrc:'/illustrations/sales.png'},
]
function movementLabel(person){
  const metrics=[['Peças',person.tp||0],['Mão de obra',(person.ehConsultor?person.morealCons:person.morealTec)||0],['Peças de O.S.',(person.pocoficina||0)-(person.devPocoficina||0)]]
  return metrics.filter(([,value])=>value!==0).map(([label,value])=>`${label} ${money(value)}`).join(' · ')||'Movimentação líquida zerada'
}
// Primeiro nome da conta logada (antes era um nome fixo para todo administrador).
const primeiroNome=nome=>String(nome||'').trim().split(/\s+/)[0]?.toLocaleLowerCase('pt-BR').replace(/^./,c=>c.toUpperCase())||''
export default function Home(){
  const permissoes=useStore(s=>s.permissoes),lojas=useStore(s=>s.lojas),ultimasAtualizacoes=useStore(s=>s.ultimasAtualizacoes),regras=useStore(s=>s.regras),comissaoGestao=useStore(s=>s.comissaoGestao),colaboradoresPorMes=useStore(s=>s.colaboradoresPorMes),metasPorMes=useStore(s=>s.metasPorMes),bonificacoes=useStore(s=>s.bonificacoes),apelidoMap=useStore(s=>s.apelidoMap),pecasPorMes=useStore(s=>s.pecasPorMes),oficinaPorMes=useStore(s=>s.oficinaPorMes)
  // Objeto só com o que o resumo lê — o store inteiro (filtros, uploads,
  // progresso) não recalcula mais a home a cada mudança.
  const state=useMemo(()=>({permissoes,lojas,ultimasAtualizacoes,regras,comissaoGestao,colaboradoresPorMes,metasPorMes,bonificacoes,apelidoMap,pecasPorMes,oficinaPorMes}),[permissoes,lojas,ultimasAtualizacoes,regras,comissaoGestao,colaboradoresPorMes,metasPorMes,bonificacoes,apelidoMap,pecasPorMes,oficinaPorMes])
  const {nome,role,estados}=useAuth(), full=role!=='operacional'&&podeAcessar(role,'/dashboard',state.permissoes)
  const [peopleView,setPeopleView]=useState(null),[clock,setClock]=useState(()=>new Date())
  useEffect(()=>{const timer=setInterval(()=>setClock(new Date()),60000);return()=>clearInterval(timer)},[])
  const summary=useMemo(()=>homeSummary(state,{name:nome,full,estados}),[state,nome,full,estados])
  const [stock,setStock]=useState(null),[stockError,setStockError]=useState(false),[retry,setRetry]=useState(0)
  const canStock=podeAcessar(role,'/estoque',state.permissoes)
  useEffect(()=>{if(!canStock)return;let live=true;setStockError(false);carregarPosicaoMes(summary.month).then(pos=>{if(live)setStock(pos)}).catch(()=>{if(live)setStockError(true)});return()=>{live=false}},[canStock,summary.month,retry,state.ultimasAtualizacoes.estoque])
  const inventory=useMemo(()=>stock&&!stock.semDado?resumoEstoque((stock.itens||[]).filter(r=>!estados?.length||estados.includes((state.lojas?.[r.loja]||LOJAS[r.loja])?.uf))):null,[stock,estados,state.lojas])
  const greeting=saudacaoBrasil(clock)
  const attentionRows=summary.attention.filter((p,i,all)=>all.findIndex(a=>a.name===p.name)===i)
  const attentionPeople=new Set(summary.attention.map(p=>p.name)).size
  const stale=summary.cutoff&&summary.cutoff.toDateString()!==new Date().toDateString()
  const visibleShortcuts=shortcuts.filter(s=>podeAcessar(role,s.to,state.permissoes))
  return <div className="page home-page">
    <div className="home-content">
    <section className="home-hero"><div className="home-greeting"><h1>{greeting}{primeiroNome(nome)?`, ${primeiroNome(nome)}`:''}.</h1></div></section>
    {/* No lugar do assistente: o resultado do recorte de cada cargo (empresa, coordenação, equipe). */}
    {['admin','coordenador','supervisor'].includes(role)&&<ResultadoDoCargo role={role} nome={nome} linkPainel={podeAcessar(role,'/painel',state.permissoes)?'/painel':null}/>}
    <section className="home-daily" data-tour="home-summary"><header><div><h2>{full?'O pulso da operação':'Seu resumo'}</h2><p>{summary.cutoff?`Última data de vendas na base: ${summary.cutoff.toLocaleDateString('pt-BR')}${stale?' · atualização pendente para hoje':''}`:'Aguardando dados de vendas deste mês'}</p></div><Link to={full?'/dashboard':'/desempenho'}>Explorar <ArrowUpRight size={14}/></Link></header><div className="home-daily-values"><Link className="home-daily-card" to={full?'/dashboard':'/desempenho'}><span>Receita da última data</span><strong>{summary.cutoff?money(summary.revenue):'—'}</strong><small>Peças + mão de obra, sem duplicar técnicos</small></Link>{full?<button className="home-daily-card" type="button" onClick={()=>setPeopleView('moving')}><span>Colaboradores com movimento</span><strong>{summary.people} / {summary.ranking.length}</strong><small>Ver pessoas com vendas · {summary.month}</small></button>:<Link className="home-daily-card" to="/desempenho"><span>Seus registros do dia</span><strong>{summary.records}</strong><small>Ver seu acompanhamento</small></Link>}<button className="home-daily-card" type="button" onClick={()=>setPeopleView('attention')}><span>{full?'Pessoas em atenção':'Metas em atenção'}</span><strong className={attentionPeople?'status-attention':''}>{full?attentionPeople:summary.attention.length}</strong><small>Ver pessoas e projeções abaixo da meta</small></button></div></section>
    <section className="home-status" aria-label="Status da operação"><div className="home-status-item"><span className={`status-dot ${stale||!summary.cutoff?'attention':''}`}/><div><strong>Vendas</strong><small>{!summary.cutoff?'Sem base neste mês':stale?'Base anterior ao dia de hoje':'Há registros de hoje'}</small></div>{stale?<CircleAlert size={16}/>:summary.cutoff?<Check size={16}/>:null}</div><div className="home-status-item"><span className={`status-dot ${attentionPeople?'attention':''}`}/><div><strong>Metas da equipe</strong><small>{attentionPeople?`${attentionPeople} pessoa(s) precisam de acompanhamento`:summary.cutoff?'Nenhuma projeção abaixo da meta':'Aguardando base para avaliar'}</small></div><Link to={podeAcessar(role,'/metas',state.permissoes)?'/metas':'/desempenho'} aria-label="Acompanhar metas"><ArrowUpRight size={16}/></Link></div>{canStock&&<div className="home-status-item"><span className={`status-dot ${!inventory||inventory.obsItens?'attention':''}`}/><div><strong>Estoque</strong><small>{stockError?'Não foi possível carregar':stock?.semDado?'Sem posição neste mês':inventory?`${inventory.obsItens} de ${inventory.totalItens} itens em curvas obsoletas${stock?.dataISO?' · posição '+stock.dataISO.split('-').reverse().join('/'):''}`:'Carregando posição…'}</small></div>{stockError?<button onClick={()=>setRetry(r=>r+1)} aria-label="Recarregar estoque"><RefreshCw size={15}/></button>:<Link to="/estoque" aria-label="Abrir estoque"><ArrowUpRight size={16}/></Link>}</div>}</section>
    <section className="home-shortcuts" data-tour="home-shortcuts"><header><h2>Seu espaço de trabalho</h2><span>Acesso rápido às páginas</span></header><div>{visibleShortcuts.map(s=><ServiceCard key={s.to} {...s}/>)}</div></section>
    <section className="operations-panel home-attention" id="home-attention"><header><div><h2>Onde vale olhar mais de perto</h2><p>Atenção considera o ritmo dos dias úteis até a data da base. Não classifica pessoas sem meta ou sem dados.</p></div><CircleAlert size={18}/></header>{summary.attention.length?<div className="attention-list">{attentionRows.slice(0,8).map((p,i)=><Link key={`${p.name}${i}`} to={full?`/perfil/${encodeURIComponent(p.name)}`:'/desempenho'}><span className="attention-avatar">{p.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><strong>{p.name}</strong><small>{p.metric} · realizado {money(p.real)} de {money(p.target)}</small></div><span><b>ATENÇÃO</b><small>Projeção {money(p.projection)}</small></span><ArrowUpRight size={15}/></Link>)}</div>:<p>Nenhuma projeção abaixo da meta na base disponível. Continue acompanhando a atualização dos dados.</p>}</section>
    <aside className="home-news"><span className="news-shimmer">Novo no seu pós-venda</span><p>Resultado da empresa, da coordenação e da equipe logo no início, além do acompanhamento individual.</p><button className="btn btn-ghost btn-sm" onClick={()=>window.dispatchEvent(new Event('posvenda:start-tour'))}>Ver o que mudou <ArrowUpRight size={14}/></button></aside>
    </div>
    <Dialog open={peopleView!==null} onOpenChange={open=>{if(!open)setPeopleView(null)}}><DialogContent className="home-people-dialog"><DialogTitle>{peopleView==='moving'?'Colaboradores com movimento':'Pessoas em atenção'}</DialogTitle><DialogDescription>{summary.month} · {peopleView==='moving'?'Pessoas com registros de vendas no mês.':'Acompanhamento das projeções abaixo da meta.'} Selecione uma pessoa para abrir o acompanhamento.</DialogDescription><div className="home-people-list">{(peopleView==='moving'?summary.moving:attentionRows).map(p=>{const name=p.nome||p.name;const content=<><span className="attention-avatar">{name.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><div><strong>{name}</strong><small>{peopleView==='moving'?movementLabel(p):`${p.metric} · projeção ${money(p.projection)} de ${money(p.target)}`}</small></div><ArrowUpRight size={16}/></>;return !full||podeAcessar(role,`/perfil/${encodeURIComponent(name)}`,state.permissoes)?<Link key={name} to={full?`/perfil/${encodeURIComponent(name)}`:'/desempenho'} onClick={()=>setPeopleView(null)}>{content}</Link>:<div key={name}>{content}</div>})}{!(peopleView==='moving'?summary.moving:attentionRows).length&&<p>Nenhuma pessoa neste recorte.</p>}</div></DialogContent></Dialog>
  </div>
}
