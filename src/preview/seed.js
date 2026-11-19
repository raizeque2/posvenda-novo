import { REGRA_PECAS, REGRA_OFICINA, LOJAS, COMISSAO_OPERACIONAL, COMISSAO_GESTAO } from '../data/regras.js'
import { processarEstoque, resumoEstoque } from '../services/processamento/processarObsoleto.js'

export const PREVIEW_UID = 'preview-admin'
export const monthKey = date => `${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`
const br = date => `${String(date.getDate()).padStart(2,'0')}/${monthKey(date)}`
export const demoPeople = [
 ['ANA COSTA','ARA','VENDEDOR DE PECAS','VAREJO'],
 ['BRUNO LIMA','ARA','ASSISTENTE DE VENDAS','TELEVENDAS'],
 ['CARLA SANTOS','PEI','VENDEDOR DE PECAS','ATACADO'],
 ['DIEGO ALVES','PEI','VENDEDOR DE PECAS','WEB'],
 ['ELISA MELO','ARA','CONSULTOR TECNICO','OS'],
 ['FELIPE ROCHA','ARA','MECANICO','OS'],
 ['GABRIELA SOUZA','PEI','CONSULTOR TECNICO','OS'],
 ['IGOR LOPES','PEI','MECANICO','OS'],
 ['JULIA NUNES','ARA','VENDEDOR DE PECAS','VAREJO'],
 ['HUGO MARTINS','ARA','SUPERVISOR DE PÓS-VENDA',''],
 ['LUCAS MORAES','PEI','SUPERVISOR DE PÓS-VENDA',''],
]
export const productNames = ['Kit relação','Óleo motor 10W30','Pastilha de freio','Filtro de ar','Pneu traseiro','Bateria','Vela de ignição','Cabo de embreagem','Retrovisor','Rolamento']

export function createDemoSeed(now = new Date()) {
 const docs={}, files={}, metas={}, colaboradores={}, regras={}, periods=[]
 const gestores=['HUGO MARTINS','LUCAS MORAES'].map(colaborador=>({...structuredClone(COMISSAO_GESTAO[0]),colaborador}))
 const writeConfig=(key,value)=> {docs[`config/${key}`]={payload:JSON.stringify(value),ts:+now}}
 const writeFile=(path,value,updated=now.toISOString())=>{files[path]={content:JSON.stringify(value),updated}}
 const fechamentos={}, arquivosAtuais=[]
 for(let offset=2;offset>=0;offset--){
  const reference=new Date(now.getFullYear(),now.getMonth()-offset,1,12)
  const mes=monthKey(reference);periods.push(mes)
  const end=offset?new Date(reference.getFullYear(),reference.getMonth()+1,0,12):new Date(now.getFullYear(),now.getMonth(),now.getDate(),12)
  colaboradores[mes]={};metas[mes]={}
  demoPeople.forEach(([nome,loja,cargo,channel],i)=>{
   const c={colaborador:nome,apelido:'',loja,cargo,cargo_movimento:channel,supervisor:i<9?(loja==='ARA'?'HUGO MARTINS':'LUCAS MORAES'):'',ativo:true,mes,salario_base:2200+i*120,centro_custo:channel==='OS'?'OFICINA':'PECAS'}
   colaboradores[mes][nome]=c
   metas[mes][nome]={...c,metas:channel?{[channel]:channel==='OS'?{mp:0,mo:24000+i*600,mpo:32000}:{mp:36000+i*2000,mo:0,mpo:0}}:{}}
  })
  regras[mes]={pecas:{AL:REGRA_PECAS,PE:REGRA_PECAS},oficina:{AL:REGRA_OFICINA,PE:REGRA_OFICINA},lojas:Object.fromEntries(Object.entries(LOJAS).map(([k,v])=>[k,{...v,aliqImposto:.075}])),comissao:COMISSAO_OPERACIONAL,gestao:gestores}
  const pecas=[],oficina=[]
  for(let day=1;day<=end.getDate();day++){
   const dt=new Date(reference.getFullYear(),reference.getMonth(),day,12).toISOString()
   for(let p=0;p<4;p++)for(let item=0;item<2;item++){
    const [responsavel,empresa,,cat]=demoPeople[p], n=(day+p+item)%productNames.length
    const eDevolucao=day%11===0&&item===0, valor=(eDevolucao?-1:1)*(360+(day*37+p*119+item*231)%900)
    pecas.push({dt,mes,empresa,responsavel,tecnico:'',cat,comissao:true,tipoMov:eDevolucao?'DEVOLUÇÃO DE VENDA':`VENDA ${cat}`,valor,custo:Math.round(valor*.64),eDevolucao,nrReq:`DEMO-${mes}-${day}-${p}`,produto:productNames[n],quantidade:1+n%4,tipoMercadoria:'PEÇAS','Código Produto':`DEMO-${100+n}`,Cidade:empresa==='ARA'?'Arapiraca':'Recife',Bairro:empresa==='ARA'?(p%2?'Centro':'Brasília'):(p%2?'Boa Viagem':'Imbiribeira')})
   }
   for(const [c,t] of [[4,5],[6,7]]){
    const empresa=demoPeople[c][1],consultor=demoPeople[c][0],tecnico=demoPeople[t][0],osId=`DEMO-${empresa}-${day}`
    const mo=420+(day*43+c*23)%550
    oficina.push({dt,mes,empresa,consultor,tecnico,mo,comissao:true,tipoOS:'EXTERNO',cat:'EXTERNAS',osId,contaPassagem:true,totalServico:mo,totalRevisao:0,totalCortesia:0,pocoficina:0,Cidade:empresa==='ARA'?'Arapiraca':'Recife',Bairro:empresa==='ARA'?'Centro':'Boa Viagem'})
    pecas.push({dt,mes,empresa,responsavel:consultor,tecnico,cat:'OFICINA',comissao:true,tipoMov:'VENDA POR O.S.',valor:600+day*13,custo:300+day*7,eDevolucao:false,nrReq:osId,produto:productNames[day%10],quantidade:2,tipoMercadoria:'PEÇAS','Código Produto':`DEMO-${100+day%10}`,Cidade:empresa==='ARA'?'Arapiraca':'Recife',Bairro:empresa==='ARA'?'Centro':'Boa Viagem'})
   }
  }
  writeFile(`Dados/Pecas/${mes.replace('/','-')}.json`,pecas)
  writeFile(`Dados/Oficina/${mes.replace('/','-')}.json`,oficina)
  const rawStock=Array.from({length:40},(_,i)=>{
   const old=new Date(+end-(i%6)*85*864e5),entry=new Date(+old-20*864e5)
   return {Loja:i%2?'PEI':'ARA','Código':`DEMO-${100+i}`,'Descrição':productNames[i%10]+' · '+(i+1),'Tipo':'PEÇAS','Quantidade':String(4+i%20),'Custo Médio':String(60+i*11),'Preço Venda':String(95+i*17),'Última Entrada':br(entry),'Última Saída':br(old)}
  })
  const itens=processarEstoque(rawStock,undefined,end),path=`Dados/Estoque/preview-${mes.replace('/','-')}.json`
  writeFile(path,{dataISO:end.toISOString().slice(0,10),itens,resumo:resumoEstoque(itens)},end.toISOString())
  if(offset)fechamentos[mes]={path,origem:'base demonstrativa',congeladoEm:+end,dataUltimoDado:end.toISOString()}
  else arquivosAtuais.push({path,hash:'demo-current',maxData:end.toISOString(),uploadedAt:+now})
 }
 writeConfig('colaboradores',colaboradores);writeConfig('metas',metas);writeConfig('regras',regras)
 writeConfig('comissao_gestao',gestores)
 writeConfig('snapshotConfig',{chaveSecreta:'preview-local-snapshot',configs:{'AL-pecas':{ativo:true},'AL-oficina':{ativo:true},'PE-pecas':{ativo:true},'PE-oficina':{ativo:true}}})
 docs['config/mesesDisponiveis']={pecas:periods,oficina:periods}
 docs['config/previewDemoDefaults']={months:periods}
 docs['config/estoqueControle']={mesAtual:monthKey(now),arquivosAtuais,fechamentos}
 docs[`usuarios/${PREVIEW_UID}`]={nome:'ANA COSTA',email:'administrador@exemplo.invalid',role:'admin',ativo:true,estados:null}
 docs['usuarios/preview-supervisor']={nome:'HUGO MARTINS',email:'supervisor@exemplo.invalid',role:'supervisor',ativo:true,estados:['AL']}
 docs['usuarios/preview-vendedor']={nome:'BRUNO LIMA',email:'vendedor@exemplo.invalid',role:'operacional',ativo:true,estados:['AL']}
 docs['solicitacoes/preview-request']={nome:'Conta demonstrativa',email:'solicitacao@exemplo.invalid',criadoEm:{seconds:Math.floor(+now/1000)}}
 docs[`bonificacoes/ANA COSTA__${monthKey(now).replace('/','-')}`]={nome:'ANA COSTA',mes:monthKey(now),valor:150,por:'Prévia local',em:+now,obs:'Bônus demonstrativo',historico:[]}
 return {docs,files,revision:0,seedMonth:monthKey(now),schema:1}
}

export function sampleCSV(tipo,now=new Date()) {
 if(tipo==='pecas')return '\ufeffData;Empresa;Tipo Movimento;Vendedor;Valor Total;CMV;Número;Descrição Produto;Quantidade\n'+`${br(now)};ARA;VENDA VAREJO;ANA COSTA;500,00;320,00;DEMO-IMPORT-1;Filtro de ar;2\n`
 return '\ufeffData Conclusão;Empresa;Tipo O.S.;Consultor;Técnico Nome;Total Serviço;Total Revisão;Total Cortesia;Nº O.S.\n'+`${br(now)};ARA;EXTERNO;ELISA MELO;FELIPE ROCHA;400,00;0;0;DEMO-IMPORT-1\n`
}
