import { useState } from 'react'
import App from '../App.jsx'
import { getRepository } from '../preview/repository.js'
import { sampleCSV } from '../preview/seed.js'
import { invalidarCacheMeses } from '../services/cloudLoader.js'
import { FlaskConical, ChevronDown, RotateCcw, Download, X } from '../icons/iconoir'
import './bi.css'
import './preview.css'

export default function Preview(){
 const dataset=getRepository().dataset
 const [help,setHelp]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function reset(){
  if(!window.confirm(dataset?'Restaurar a base importada do ZIP? As alterações locais serão desfeitas.':'Restaurar os dados demonstrativos? As edições e importações locais da prévia serão desfeitas. Seus perfis BI serão mantidos.'))return
  setBusy(true)
  try{
   getRepository().reset()
   localStorage.removeItem('posvenda_preview_regras_v2')
   sessionStorage.removeItem('pv_preview_filtro_mes')
   await invalidarCacheMeses()
   location.href='/'
  }catch(e){setMessage(e.message);setBusy(false)}
 }
 function download(tipo){
  const url=URL.createObjectURL(new Blob([sampleCSV(tipo)],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a');a.href=url;a.download=`exemplo-previa-${tipo}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <div className="full-preview">
  <div className="preview-ribbon no-print"><span><FlaskConical size={16}/><strong>{dataset?'Base local do ZIP':'Prévia completa'}</strong><span className="preview-ribbon-description">{dataset?'Dados importados · alterações somente neste navegador':'Dados fictícios · alterações somente neste navegador'}</span></span><button onClick={()=>setHelp(!help)} aria-expanded={help}>{dataset?'Sobre os dados':'Sobre a prévia'} <ChevronDown size={14}/></button></div>
  {help&&<section className="preview-help no-print" aria-label="Sobre a prévia">
   <header><h2>Explore o sistema completo</h2><button onClick={()=>setHelp(false)} aria-label="Fechar informações"><X size={18}/></button></header>
   <p>{dataset?`${dataset.summary.payroll} pessoas da folha, ${dataset.summary.stores.length} lojas e dados de ${dataset.months.join(', ')}. A folha de agosto é a referência cadastral; não representa um histórico mensal de salários. As metas e os vínculos de supervisão não vieram nos CSVs e precisam ser configurados.`:'Use o menu para navegar por vendas, desempenho, estoque, metas, comissões, supervisores, colaboradores, regras, importações e acessos. Os nomes e valores são demonstrativos. As lojas seguem o cadastro do projeto.'} Entre com login teste e senha teste.</p>
   <p>Edições e importações ficam neste navegador. Criação de login, recuperação de senha e links permanentes de colaboradores precisam do aplicativo conectado. Relatórios abertos por link nesta prévia usam apenas sua base local e não concedem acesso a dados reais.</p>
   <p>{dataset?'Os arquivos do ZIP ficam fora do projeto e não entram no build. Restaurar dados recupera a base importada.':'Os exemplos de importação substituem os registros demonstrativos do mês para o tipo escolhido. Use Restaurar dados para recuperar a base inicial.'}</p>
   <div>{!dataset&&<><button onClick={()=>download('pecas')}><Download size={15}/> CSV de peças</button><button onClick={()=>download('oficina')}><Download size={15}/> CSV de serviços</button></>}<button onClick={reset} disabled={busy}><RotateCcw size={15}/>{busy?'Restaurando…':'Restaurar dados'}</button></div>
   {message&&<p role="alert">{message}</p>}
  </section>}
  <App/>
 </div>
}
