import {useRef,useState} from 'react'
import {Modal} from '../../components/AnalysisDS.jsx'
import {RainbowButton} from '../../components/ui/rainbow-button'
import {parseCSV} from '../../services/processamento/parseCSV.js'
import {processarOS,resumoOS,compararFotos} from '../../services/processamento/processarOS.js'
import {carregarFotoOS,carregarRegrasOS,salvarFotoOS} from '../../services/osMonitor.js'
import {useUploadTasks} from '../../store/uploadTasks.js'
import CartaoImport from './CartaoImport.jsx'

export default function MonitorOSUpload(){
  const ultimo=useRef(null),busy=useRef(false)
  const [review,setReview]=useState(null),[error,setError]=useState(''),[working,setWorking]=useState(false),[done,setDone]=useState(false)
  async function select(file){
    if(!file||busy.current)return
    setError('');setDone(false)
    try{
      if(!/\.csv$/i.test(file.name)||file.size>5_000_000)throw Error('Selecione um CSV de O.S. com até 5 MB.')
      let text;const bytes=await file.arrayBuffer()
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{text=new TextDecoder('windows-1252').decode(bytes)}
      const {rows}=parseCSV(text),records=processarOS(rows)
      if(!records.length||records.some(r=>!r.empresa||!r.emissao||!Number.isFinite(+r.emissao)||!r.situacao||![r.servico,r.revisao,r.cortesia,r.mercadoria,r.valorTotal].every(Number.isFinite)))throw Error('Confira as colunas Empresa, Nº O.S., Data Emissão, Situação e valores. Nenhuma carga foi alterada.')
      const dropped=rows.filter(row=>!processarOS([row]).length).length
      if(dropped)throw Error(`${dropped} linhas estão sem número de O.S. Corrija o arquivo antes de importar.`)
      setReview({file:file.name,records,lines:rows.length})
    }catch(e){setError(e.message)}
  }
  async function save(){
    if(!review||busy.current)return
    busy.current=true;setWorking(true);setError('')
    const tasks=useUploadTasks.getState(),id=tasks.start(review.file,'Atualizando Monitor de O.S.…')
    try{
      const [previous,rules]=await Promise.all([carregarFotoOS(),carregarRegrasOS()])
      const summary=resumoOS(review.records,{regras:rules||{}})
      const old=previous.foto?resumoOS(previous.foto.registros,{regras:rules||{},dataRef:new Date(previous.foto.ts)}):null
      const changes=old?compararFotos(summary.ativos,old.ativos):null
      const dataArquivo=new Date(review.records.reduce((max,r)=>Math.max(max,+r.emissao),0))
      await salvarFotoOS(review.records,{arquivo:review.file,dataArquivo,apuracao:{total:summary.totalOS,criticas:summary.ativos.filter(r=>r.criticidade==='critico').length,extremas:summary.ativos.filter(r=>r.criticidade==='extremo').length,moderadas:summary.moderadas,mediaDias:summary.mediaDias,sairamCritico:changes?.sairamCritico.length||0}})
      tasks.update(id,{status:'done',detail:`${review.records.length} O.S. importadas`});setReview(null);setDone(true)
    }catch(e){setError(e.message);tasks.update(id,{status:'error',detail:e.message})}
    finally{busy.current=false;setWorking(false)}
  }
  const estado=working?'enviando':error?'erro':done?'ok':'pronto'
  const detalhe=working?'Atualizando o monitor…':error||(done?'Carga atualizada agora':'Posição das O.S. em aberto · substitui a carga atual')
  return <>
    <CartaoImport icone="clipboard-check" cor="#cc0000" titulo="Monitor de O.S." estado={estado} detalhe={detalhe}
      onArquivo={f=>{ultimo.current=f;void select(f)}} onTentar={()=>ultimo.current&&void select(ultimo.current)} onLimpar={()=>{setError('');setDone(false)}}/>
    {review&&<Modal title="Confirmar carga de O.S." onClose={()=>{if(!working)setReview(null)}} footer={<><button type="button" className="btn btn-ghost" disabled={working} onClick={()=>setReview(null)}>Cancelar</button><RainbowButton disabled={working} onClick={()=>void save()}>{working?'Importando…':'Confirmar importação'}</RainbowButton></>}>
      <p>{review.file}: {review.lines} linhas consolidadas em {review.records.length} ordens.</p><p>A posição atual será substituída e ficará disponível como carga anterior.</p>
    </Modal>}
  </>
}
