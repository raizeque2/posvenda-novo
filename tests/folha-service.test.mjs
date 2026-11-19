import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parseFolha,prepareFolha} from '../src/services/processamento/folha.js'
const body=readFileSync(new URL('../src/services/folhaService.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace('export async function salvarFolha','async function salvarFolha')
function service(initial,{admin=true,fail=false}={}){
 const docs=structuredClone(initial),writes=[]
 const save=Function('doc','runTransaction','db','hasAdminDataAccess','prepareFolha',`${body};return salvarFolha`)(
  (_,collection,key)=>`${collection}/${key}`,
  async(_,callback)=>{const ops=[];const result=await callback({get:async path=>({data:()=>docs[path]}),set:(path,value)=>{ops.push([path,value]);if(fail&&ops.length===2)throw Error('Falha de gravação')}});for(const [path,value]of ops){docs[path]=value;writes.push(path)}return result},
  {},async()=>admin,prepareFolha)
 return {docs,writes,save}
}
const mes='10/2026',colaboradores={[mes]:{ANA:{colaborador:'ANA',loja:'ARA',cargo_movimento:'VAREJO',salario_base:1000},BIA:{colaborador:'BIA',loja:'ARA'}}},metas={[mes]:{ANA:{colaborador:'ANA',metas:{VAREJO:{mp:2000}}}}}
const rows=parseFolha('nome;salario_base;meta_varejo\nANA;2500;4000').rows
const initial={'config/colaboradores':{payload:JSON.stringify(colaboradores)},'config/metas':{payload:JSON.stringify(metas)}}
const request=()=>({rows,mes,overrides:{},signature:prepareFolha(rows,mes,colaboradores,metas).signature,fallback:{colaboradores,metas}})
test('transação grava cadastro e metas juntos sem tocar regras ou excluir colegas',async()=>{
 const s=service(initial),result=await s.save(request())
 assert.deepEqual(s.writes,['config/colaboradores','config/metas'])
 assert.equal(result.colaboradores[mes].ANA.salario_base,2500)
 assert.deepEqual(result.colaboradores[mes].BIA,colaboradores[mes].BIA)
 assert.equal(JSON.parse(s.docs['config/metas'].payload)[mes].ANA.metas.VAREJO.mp,4000)
})
test('sem administrador, alteração concorrente e falha de gravação não deixam atualização parcial',async()=>{
 const denied=service(initial,{admin:false});await assert.rejects(denied.save(request()),/administrador/);assert.equal(denied.writes.length,0)
 const concurrent=service(initial),changed=structuredClone(colaboradores);changed[mes].ANA.salario_base=1100;concurrent.docs['config/colaboradores'].payload=JSON.stringify(changed)
 await assert.rejects(concurrent.save(request()),/mudaram/);assert.equal(concurrent.writes.length,0)
 const failed=service(initial,{fail:true});await assert.rejects(failed.save(request()),/Falha/);assert.deepEqual(failed.docs,initial)
})
