import { podeAcessar } from '../functions/src/tabPolicy.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,unlinkSync} from 'node:fs'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {build} from 'esbuild'
import vm from 'node:vm'
import * as wholesale from '../src/pages/atacado/atacado.logic.js'
import {processarOS,resumoOS,compararFotos,GRUPOS_DEFAULT} from '../src/services/processamento/processarOS.js'
import {scopedOSSnapshot,validateOSRules} from '../functions/src/osPolicy.js'
import {dataScope} from '../functions/src/dataScope.js'
import {isActiveProfile} from '../functions/src/securityPolicy.js'

const rows=[
  {cat:'ATACADO',empresa:'ARA',mes:'10/2026',dt:new Date(2026,9,1),responsavel:'ANA','Pessoa':'Cliente A','Município':'Arapiraca','Número':'NF1','Código Mercadoria':'P1',Mercadoria:'Filtro',Quantidade:'2',valor:200,custo:100},
  {cat:'ATACADO',empresa:'ARA',mes:'10/2026',dt:new Date(2026,9,2),responsavel:'ANA','Pessoa':'Cliente A','Município':'Arapiraca','Número':'NF2','Código Mercadoria':'P1',Mercadoria:'Filtro',Quantidade:'1',valor:50,eDevolucao:true},
  {cat:'WEB',empresa:'ARA',mes:'10/2026',dt:new Date(2026,9,1),valor:999},
  {cat:'ATACADO',empresa:'PEI',mes:'10/2026',dt:new Date(2026,9,1),valor:500,'Pessoa':'Outro cliente'},
]
const rawOS=(id,overrides={})=>({Empresa:'ARA','Nº O.S.':id,'Data Emissão':'01/10/2026',Situação:'ABERTA',Consultor:'ANA','Tipo O.S.':'EXTERNO',Pessoa:'Cliente','Total Serviço':'100,00','Total Mercadoria':'50,00','Valor Total':'150,00',...overrides})
test('Atacado concilia devoluções e recortes; identifica clientes, produtos, recompra e cargo do cadastro',()=>{
  const scoped=wholesale.linhasAtacado({'10/2026':rows},{estado:'AL',lojasMap:{ARA:{uf:'AL'},PEI:{uf:'PE'}}})
  assert.equal(scoped.length,2)
  const clients=wholesale.buildClientes(scoped)
  assert.equal(clients.length,1);assert.equal(clients[0].faturamento,150);assert.equal(clients[0].nCompras,2)
  assert.equal(wholesale.buildPecas(scoped)[0].descricao,'Filtro')
  assert.equal(wholesale.buildPecas(scoped)[0].quantidade,1)
  assert.equal(wholesale.histItensCliente(scoped,'CLIENTE A',['10/2026'])[0].totalValor,150)
  assert.equal(wholesale.buildVendedores(scoped,{ANA:{cargo:'VENDEDOR DE PEÇAS EXTERNO'}})[0].tipo,'EXTERNO')
  assert.equal(wholesale.buildCobertura(scoped)[0].faturamento,150)
})
test('Monitor consolida O.S. por loja, exclui encerradas, aplica criticidade e compara cargas',()=>{
  const records=processarOS([rawOS('1'),rawOS('1'),rawOS('1',{Empresa:'PEI'}),rawOS('2',{Situação:'CONCLUIDA'})])
  assert.equal(records.length,3);assert.equal(records[0].valorTotal,300)
  const summary=resumoOS(records,{dataRef:new Date(2026,9,21)})
  assert.equal(summary.totalOS,2);assert.equal(summary.criticasExtremas,2)
  const before=resumoOS(records,{dataRef:new Date(2026,9,5)})
  assert.equal(compararFotos(summary.ativos,before.ativos).novasCriticas.length,2)
  assert.equal(resumoOS(records,{dataRef:new Date(2026,9,21),minDias:30}).totalOS,0)
  const rules={grupos:GRUPOS_DEFAULT,situacoesExcluidas:['CONCLUIDA'],tipoOverrides:{}}
  validateOSRules(rules)
  assert.throws(()=>validateOSRules({...rules,grupos:[{...GRUPOS_DEFAULT.find(g=>!g.judicial),moderado:99}]}),/limites/)
})
test('Snapshot de O.S. respeita equipe e UF e não entrega linhas brutas nem histórico global',()=>{
  const scope=dataScope({role:'supervisor',nome:'GESTOR',estado:'AL'},{'10/2026':{ANA:{loja:'ARA',supervisor:'GESTOR'},BIA:{loja:'PEI'}}},{ARA:{uf:'AL'},PEI:{uf:'PE'}})
  const source={foto:{registros:processarOS([rawOS('1'),rawOS('2',{Empresa:'PEI',Consultor:'BIA'})])},historico:[{total:999}]}
  const result=scopedOSSnapshot(source,scope)
  assert.equal(result.foto.registros.length,1);assert.equal(result.foto.registros[0].linhas,undefined);assert.deepEqual(result.historico,[])
})
test('Persistência de O.S. troca atual/anterior/histórico em uma gravação e preserva a carga em falha',async()=>{
  const files=new Map();let fail=false,writes=0
  const context=vm.createContext({TextDecoder,TextEncoder,Date,JSON,Error,Number,Array,Event,validateOSRules,storage:{},window:{dispatchEvent(){}},hasAdminDataAccess:async()=>true,ref:(_,path)=>path,getBytes:async path=>{if(!files.has(path))throw Object.assign(Error('missing'),{code:'storage/object-not-found'});return new TextEncoder().encode(files.get(path))},uploadString:async(path,text)=>{if(fail)throw Error('Falha de armazenamento');writes++;files.set(path,text)},carregarConfig:async()=>null,salvarConfig:async()=>{}})
  vm.runInContext(readFileSync(new URL('../src/services/osMonitor.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replaceAll('export ','')+';globalThis.api={carregarFotoOS,salvarFotoOS}',context)
  const save=records=>context.api.salvarFotoOS(records,{arquivo:'teste.csv',apuracao:{total:records.length}})
  await save(processarOS([rawOS('1')]))
  await save(processarOS([rawOS('2')]))
  let value=await context.api.carregarFotoOS();assert.equal(writes,2);assert.equal(value.foto.registros[0].nOS,'2');assert.equal(value.anterior.registros[0].nOS,'1');assert.equal(value.historico.length,2)
  fail=true;await assert.rejects(save(processarOS([rawOS('3')])),/armazenamento/)
  value=await context.api.carregarFotoOS();assert.equal(value.foto.registros[0].nOS,'2');assert.equal(value.anterior.registros[0].nOS,'1')
})
test('Gateway só libera consultas de O.S./clientes de atacado para gestão e aplica o escopo',async()=>{
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
  const docs={'usuarios/op':{role:'operacional',nome:'ANA'},'usuarios/sup':{role:'supervisor',nome:'GESTOR',estado:'AL'},'config/colaboradores':{payload:JSON.stringify({'10/2026':{ANA:{loja:'ARA',supervisor:'GESTOR'}}})},'config/lojas':{payload:JSON.stringify({ARA:{uf:'AL'},PEI:{uf:'PE'}})}}
  const db={doc:path=>({get:async()=>({exists:!!docs[path],data:()=>docs[path]})})}
  const bucket={file:path=>({getMetadata:async()=>[{size:1000}],download:async()=>[Buffer.from(JSON.stringify(path.includes('/OS/')?{foto:{registros:processarOS([rawOS('1'),rawOS('2',{Empresa:'PEI'})])}}:rows))]})}
  const context=vm.createContext({Buffer,podeAcessar,dataScope,isActiveProfile,scopedOSSnapshot,HttpsError,getFirestore:()=>db,getStorage:()=>({bucket:()=>bucket}),onCall:(_,fn)=>fn})
  vm.runInContext(readFileSync(new URL('../functions/src/dataAccess.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replaceAll('export ','')+';globalThis.read=lerDadosAutorizados',context)
  const read=(kind,uid)=>context.read({auth:{uid},data:{kind,path:'Dados/Pecas/10-2026.json'}})
  await assert.rejects(read('os','op'),{code:'permission-denied'});await assert.rejects(read('wholesale','op'),{code:'permission-denied'})
  assert.equal((await read('os','sup')).foto.registros.length,1)
  const result=await read('wholesale','sup');assert.equal(result.length,2);assert.equal(result[0].Pessoa,'Cliente A')
})
test('Abas importadas e tabelas de O.S. renderizam com os componentes do projeto',async()=>{
  const outfile=fileURLToPath(new URL(`.analysis-render-${process.pid}.mjs`,import.meta.url))
  const source=`import React from 'react';import {renderToStaticMarkup as render} from 'react-dom/server';
    import {AbaGeral} from '../src/pages/atacado/AbaGeral.jsx';import {AbaPecas} from '../src/pages/atacado/AbaPecas.jsx';import {AbaClientes} from '../src/pages/atacado/AbaClientes.jsx';import {AbaInativos} from '../src/pages/atacado/AbaInativos.jsx';import {AbaCobertura} from '../src/pages/atacado/AbaCobertura.jsx';import {TabelaOS} from '../src/pages/oficina/ModaisOS.jsx';import {CardsSituacao,CardsSupervisor,RankingCriticoPorLoja,ConcentracaoPorGrupo,PontosAtencao,PrioridadeAcao} from '../src/pages/oficina/MonitorOSUI.jsx';
    export function panels(a,r){return [AbaGeral,AbaPecas,AbaClientes,AbaInativos,AbaCobertura].map(C=>render(<C a={a}/>)).concat(render(<><TabelaOS rows={r.ativos} modo="detalhe" porPagina={50}/><CardsSituacao porSituacao={r.porSituacao} resumo={r}/><CardsSupervisor porResponsavel={r.porResponsavel}/><RankingCriticoPorLoja rankingLoja={r.rankingLoja}/><ConcentracaoPorGrupo concentracaoGrupo={r.concentracaoGrupo}/><PontosAtencao pontos={r.pontosAtencao}/><PrioridadeAcao lista={r.prioridadeLista}/></>))};`
  try{
    await build({stdin:{contents:source,resolveDir:fileURLToPath(new URL('.',import.meta.url)),loader:'jsx'},outfile,bundle:true,loader:{'.png':'dataurl'},platform:'node',format:'esm',packages:'external',define:{getComputedStyle:'testComputedStyle','document.documentElement':'testDocument'},banner:{js:'const testComputedStyle=()=>({getPropertyValue:()=>"#cc0000"});const testDocument={};'},jsx:'automatic',logLevel:'silent'})
    const scoped=rows.slice(0,2),clients=wholesale.buildClientes(scoped),r=resumoOS(processarOS([rawOS('1')]),{dataRef:new Date(2026,9,21)})
    const a={realizado:{liquido:150,devol:50,proj:300},metaAtacado:500,margemMes:.5,carteiraData:{positivados:1,positivacao:1,carteira:1},novosReat:{novos:1,reativados:0},ticketMedio:75,itensPorNotaVal:1,concTop10:1,evolucao12:[],vendedoresMes:[],vendedores12m:[],tipoMercData:[],top10Pecas:[],nClientesMes:1,nCidades:1,busca:'',clientes:clients,pecas:wholesale.buildPecas(scoped),cobertura:wholesale.buildCobertura(scoped),inativos:{f1:[],f2:[],f3:[],queda:[]},atacadoConfig:{corte1:30,corte2:90,corte3:180,quedaPct:30},rows6m:scoped,meses6:['10/2026']}
    const {panels}=await import(pathToFileURL(outfile));const html=panels(a,r)
    assert.equal(html.length,6);assert.ok(html.every(text=>text.length>100));assert.match(html[1],/Filtro/);assert.match(html[5],/O.S./)
  }finally{try{unlinkSync(outfile)}catch{}}
})


