import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {parseCSV} from '../src/services/processamento/parseCSV.js'
import {parseFolha,inferirLoja} from '../src/services/processamento/folha.js'
import {processarPecas} from '../functions/src/processarPecas.js'
import {processarOficina} from '../functions/src/processarOficina.js'
import {processarEstoque,resumoEstoque} from '../src/services/processamento/processarObsoleto.js'
import {REGRA_PECAS,REGRA_OFICINA,LOJAS,COMISSAO_OPERACIONAL} from '../src/data/regras.js'
import {norm} from '../src/utils/normalizacao.js'

const [input,output]=process.argv.slice(2)
if(!input||!output)throw Error('Uso: node scripts/import-local-csv.mjs pasta-dos-csvs pasta-privada-de-saida')
const root=path.resolve(input),destination=path.resolve(output)
if(destination.startsWith(path.resolve('public')+path.sep))throw Error('Os dados locais não devem ser gravados em public/.')
await mkdir(destination,{recursive:true})
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]))).flat()}
async function text(file){const bytes=await readFile(file);try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return new TextDecoder('windows-1252').decode(bytes)}}
const files=(await walk(root)).filter(file=>file.endsWith('.csv')).sort(),hash=createHash('sha256')
for(const file of files){hash.update(path.relative(root,file));hash.update(await readFile(file))}
const id=hash.digest('hex').slice(0,16),now=new Date(),stamp=now.toISOString()
const seed={schema:1,revision:0,docs:{},files:{},seedMonth:'10/2026',localDataset:{id,label:'downloads.zip',importedAt:stamp,months:[],payrollMonth:'08/2026',missing:['Metas não constam nos CSVs','Vínculos entre supervisores e equipes não constam nos CSVs']}}
const report={files:files.length,months:{},payroll:0,people:0,supervisors:0,unmappedPayrollStores:0,unknownTypes:[],missing:seed.localDataset.missing}
const localPecasRules={...REGRA_PECAS,'DEVOLUÇÃO TELEVENDAS':{cat:'TELEVENDAS',meta:true,com:true},'SAÍDA PERDA/QUEBRA':{cat:'SAIDA',meta:false,com:false},'ENTRADA BONIFICAÇÃO':{cat:'COMPRA',meta:false,com:false}}
const localOficinaRules={...REGRA_OFICINA,'INTERNO - NOVOS EM ESTOQUE':{...REGRA_OFICINA['INTERNO - NOVOS']}}
const ruleMaps={pecas:Object.fromEntries(Object.entries(localPecasRules).map(([key,value])=>[norm(key),value])),oficina:Object.fromEntries(Object.entries(localOficinaRules).map(([key,value])=>[norm(key),value]))}
report.additionalRules=['DEVOLUÇÃO TELEVENDAS → TELEVENDAS (devolução)','SAÍDA PERDA/QUEBRA → SAIDA (sem meta/comissão)','ENTRADA BONIFICAÇÃO → COMPRA (sem meta/comissão)','INTERNO - NOVOS EM ESTOQUE → mesma regra de INTERNO - NOVOS']
const allRows={},stockFiles=[],rawPeople=new Map()
const config=(key,data)=>{seed.docs[`config/${key}`]={payload:JSON.stringify(data),ts:+now}}
async function dataFile(logical,name,data){await writeFile(path.join(destination,name),JSON.stringify(data));seed.files[logical]={localUrl:`/__preview/local-data/${id}/${name}`,updated:stamp}}
const folhaFile=files.find(file=>path.basename(file).startsWith('folha_'))
const payroll=folhaFile?parseFolha(await text(folhaFile)).rows:[]
report.payroll=payroll.length
for(const row of payroll){const key=norm(row.nome);rawPeople.set(key,{colaborador:row.nome.trim().toUpperCase(),loja:inferirLoja(row.loja),cargo:row.cargo||'',centro_custo:row.centro_custo||'',salario_base:row.salario_base??'',ativo:true,supervisor:'',apelido:'',cargo_movimento:'',fonteCadastro:'Folha 08/2026'});if(!inferirLoja(row.loja))report.unmappedPayrollStores++}
for(const file of files){
 const type=['pecas','oficina','estoque'].find(type=>file.split(path.sep).includes(type));if(!type)continue
 const match=path.basename(file).match(/(2026)-(\d{2})-(\d{2})/);if(!match)throw Error('Data não identificada no arquivo '+path.basename(file))
 const mes=`${match[2]}/${match[1]}`,sourceDate=`${match[1]}-${match[2]}-${match[3]}`
 const {rows}=parseCSV(await text(file));report.months[mes]??={};report.months[mes][type]={input:rows.length,sourceDate}
 if(type==='estoque'){stockFiles.push({mes,sourceDate,rows});continue}
 const resolver=key=>ruleMaps[type][key]||null
 const result=type==='pecas'?processarPecas(rows,resolver):processarOficina(rows,resolver)
 report.months[mes][type].accepted=result.registros.length
 report.months[mes][type].net=result.registros.reduce((sum,row)=>sum+(type==='pecas'?row.valor:row.mo),0)
 for(const inc of result.inconsistencias)report.unknownTypes.push({mes,type,...inc})
 if(result.registros.some(row=>row.mes!==mes||!LOJAS[row.empresa]))throw Error(`Mês ou loja inválida em ${path.basename(file)}.`)
 allRows[mes]??={pecas:[],oficina:[]};allRows[mes][type]=result.registros
 for(const r of result.registros){for(const name of type==='pecas'?[r.responsavel,r.tecnico]:[r.consultor,r.tecnico]){if(!name)continue;const key=norm(name);if(!rawPeople.has(key))rawPeople.set(key,{colaborador:name.trim().toUpperCase(),loja:r.empresa,cargo:'',centro_custo:'',salario_base:'',ativo:true,supervisor:'',apelido:'',cargo_movimento:'',fonteCadastro:'Identificado em movimentação'})}}
}
const months=Object.keys(allRows).sort((a,b)=>Number(a.slice(3)+a.slice(0,2))-Number(b.slice(3)+b.slice(0,2)))
seed.localDataset.months=months;seed.seedMonth=months.at(-1)
const colaboradores={},metas={},regras={}
const gestores=[...rawPeople.values()].filter(c=>/SUPERVISOR|GERENTE|CHEFE|ENCARREGADO/.test(norm(c.cargo))).map(c=>({colaborador:c.colaborador,cargo:c.cargo,baseCalculo:'equipe',canaisBase:['tp','mo','pocoficina'],comissao:0,bonificacao:0,indicadores:[]}))
for(const mes of months){
 const channels=new Map(),activity=new Map()
 const addChannel=(name,channel,store)=>{if(!name)return;const key=norm(name);if(channel){if(!channels.has(key))channels.set(key,new Set());channels.get(key).add(channel)}if(!activity.has(key))activity.set(key,new Map());const stores=activity.get(key);stores.set(store,(stores.get(store)||0)+1)}
 for(const r of allRows[mes].pecas){r.responsavel=rawPeople.get(norm(r.responsavel))?.colaborador||r.responsavel;r.tecnico=rawPeople.get(norm(r.tecnico))?.colaborador||r.tecnico;const channel=['VAREJO','ATACADO','WEB','TELEVENDAS'].includes(r.cat)?r.cat:r.cat.startsWith('OFICINA')?'OS':'';addChannel(r.responsavel,channel,r.empresa);if(channel==='OS')addChannel(r.tecnico,'OS',r.empresa)}
 for(const r of allRows[mes].oficina){r.consultor=rawPeople.get(norm(r.consultor))?.colaborador||r.consultor;r.tecnico=rawPeople.get(norm(r.tecnico))?.colaborador||r.tecnico;addChannel(r.consultor,'OS',r.empresa);addChannel(r.tecnico,'OS',r.empresa)}
 colaboradores[mes]={};metas[mes]={}
 for(const [key,person]of rawPeople){const loja=person.loja||[...(activity.get(key)||[])].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';const c={...person,loja,cargo_movimento:[...(channels.get(key)||[])].join(';'),mes};colaboradores[mes][c.colaborador]=c;metas[mes][c.colaborador]={colaborador:c.colaborador,mes,mp:0,mo:0,mpo:0,metas:{}}}
 regras[mes]={pecas:{AL:localPecasRules,PE:localPecasRules},oficina:{AL:localOficinaRules,PE:localOficinaRules},lojas:LOJAS,comissao:COMISSAO_OPERACIONAL,gestao:gestores}
 await dataFile(`Dados/Pecas/${mes.replace('/','-')}.json`,`pecas-${mes.replace('/','-')}.json`,allRows[mes].pecas)
 await dataFile(`Dados/Oficina/${mes.replace('/','-')}.json`,`oficina-${mes.replace('/','-')}.json`,allRows[mes].oficina)
}
const fechamentos={},arquivosAtuais=[]
for(const {mes,sourceDate,rows}of stockFiles){const reference=new Date(`${sourceDate}T12:00:00-03:00`),itens=processarEstoque(rows,undefined,reference),logical=`Dados/Estoque/local-${mes.replace('/','-')}.json`;await dataFile(logical,`estoque-${mes.replace('/','-')}.json`,{dataISO:sourceDate,itens,resumo:resumoEstoque(itens)});report.months[mes].estoque.accepted=itens.length;if(mes===seed.seedMonth)arquivosAtuais.push({path:logical,hash:id,maxData:reference.toISOString(),uploadedAt:+now});else fechamentos[mes]={path:logical,origem:'CSV local',congeladoEm:+now,dataUltimoDado:reference.toISOString()}}
config('colaboradores',colaboradores);config('metas',metas);config('regras',regras);config('comissao_gestao',gestores)
config('snapshotConfig',{chaveSecreta:'',configs:{}})
seed.docs['config/mesesDisponiveis']={pecas:months,oficina:months,alteracoes:Object.fromEntries(months.map(m=>[m,+now]))}
seed.docs['config/estoqueControle']={mesAtual:seed.seedMonth,fechamentos,arquivosAtuais}
seed.docs['config/previewDemoDefaults']={months}
seed.docs['usuarios/preview-admin']={nome:'Bruno',email:'administrador@localhost.invalid',role:'admin',ativo:true,estados:null}
report.people=rawPeople.size;report.managers=gestores.length;report.supervisors=[...rawPeople.values()].filter(c=>norm(c.cargo).includes('SUPERVISOR')).length;report.stores=[...new Set([...rawPeople.values()].map(c=>c.loja).filter(Boolean))]
seed.localDataset.summary=report
await writeFile(path.join(destination,'seed.json'),JSON.stringify(seed))
await writeFile(path.join(destination,'report.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
