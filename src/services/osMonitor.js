import {ref,uploadString,getBytes} from 'firebase/storage'
import {storage} from '../firebase.js'
import {hasAdminDataAccess,authorizedData} from './authorizedAccess.js'
import {carregarConfig,salvarConfig} from './firestoreService.js'
import {validateOSRules} from '../../functions/src/osPolicy.js'
const PATH='Dados/OS/monitor.json'
function revive(photo){return photo?{...photo,dataArquivo:photo.dataArquivo?new Date(photo.dataArquivo):null,registros:(photo.registros||[]).map(row=>({...row,emissao:row.emissao?new Date(row.emissao):null,conclusao:row.conclusao?new Date(row.conclusao):null,tipos:row.tipos||[]}))}:null}
async function read(){
  if(!await hasAdminDataAccess())return authorizedData({kind:'os'})
  try{return JSON.parse(new TextDecoder().decode(await getBytes(ref(storage,PATH),15_000_000)))}
  catch(error){if(error.code==='storage/object-not-found')return {foto:null,anterior:null,historico:[]};throw error}
}
export async function carregarFotoOS(){const data=await read();return {...data,foto:revive(data.foto),anterior:revive(data.anterior),historico:data.historico||[]}}
export async function salvarFotoOS(registros,{dataArquivo=null,arquivo='',apuracao=null}={}){
  if(!await hasAdminDataAccess())throw Error('A importação de O.S. exige administrador.')
  if(!Array.isArray(registros)||!registros.length||registros.some(row=>!row.nOS||!row.empresa))throw Error('O arquivo deve conter O.S. e loja em todos os registros.')
  const previous=await read(),ts=Date.now()
  const value={foto:{ts,dataArquivo,total:registros.length,registros},anterior:previous.foto||null,historico:[{ts,arquivo,...apuracao},...(previous.historico||[])].slice(0,60)}
  const text=JSON.stringify(value)
  if(new TextEncoder().encode(text).byteLength>15_000_000)throw Error('A carga com histórico excede 15 MB. Reduza o arquivo antes de importar.')
  await uploadString(ref(storage,PATH),text,'raw',{contentType:'application/json'})
  window.dispatchEvent(new Event('posvenda:os-updated'))
}
export const carregarRegrasOS=()=>carregarConfig('regrasOS')
export const salvarRegrasOS=regras=>salvarConfig('regrasOS',validateOSRules(regras))
