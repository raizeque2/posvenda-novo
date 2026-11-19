import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {localDatasetPlugin} from '../scripts/local-dataset.mjs'
import {createRepository,PREVIEW_STORAGE_KEY} from '../src/preview/repository.js'

test('base importada tem armazenamento separado, restaura sua origem e não recebe pessoas fictícias',()=>{
 const values=new Map([[PREVIEW_STORAGE_KEY,JSON.stringify({schema:1,revision:5,docs:{demo:true},files:{}})]])
 const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}
 const seed={schema:1,revision:0,seedMonth:'10/2026',localDataset:{id:'example'},docs:{real:{value:10}},files:{'Dados/Pecas/10-2026.json':{localUrl:'/__preview/local-data/example/pecas.json'}}}
 const repo=createRepository(storage,seed,'isolated-real')
 assert.equal(repo.ensureCurrentMonth(),false);assert.equal(repo.readDoc('real').value,10);assert.equal(repo.readDoc('demo'),undefined)
 repo.commit([{path:'real',data:{value:20}}]);assert.equal(repo.readDoc('real').value,20)
 repo.reset();assert.equal(repo.readDoc('real').value,10);assert.ok(JSON.parse(values.get(PREVIEW_STORAGE_KEY)).docs.demo)
 assert.ok(values.get('isolated-real').length<1000)
})
test('servidor privado só entrega arquivos autorizados no localhost e não aceita origem externa',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'posvenda-dataset-test-'))
 t.after(()=>rm(root,{recursive:true,force:true}))
 const seed={schema:1,docs:{},localDataset:{id:'example'},files:{source:{localUrl:'/__preview/local-data/example/pecas.json'}}}
 await writeFile(path.join(root,'seed.json'),JSON.stringify(seed));await writeFile(path.join(root,'pecas.json'),'[{"valor":10}]')
 let handler
 await localDatasetPlugin(path.join(root,'seed.json')).configureServer({middlewares:{use:fn=>{handler=fn}}})
 async function call(url,headers={},method='GET',address='127.0.0.1'){
  let body,next=false
  const res={statusCode:200,setHeader(){},end:value=>{body=value}}
  await handler({url,headers:{host:'127.0.0.1:5174',...headers},method,socket:{remoteAddress:address}},res,()=>{next=true})
  return {status:res.statusCode,body,next}
 }
 assert.deepEqual(JSON.parse((await call('/__preview/local-data')).body),seed)
 assert.equal(JSON.parse((await call('/__preview/local-data/example/pecas.json')).body)[0].valor,10)
 assert.equal((await call('/__preview/local-data',{origin:'https://other.example'})).status,403)
 assert.equal((await call('/__preview/local-data',{'sec-fetch-site':'cross-site'})).status,403)
 assert.equal((await call('/__preview/local-data',{},'GET','192.168.1.8')).status,403)
 assert.equal((await call('/__preview/local-data/example/../seed.json')).status,404)
 assert.equal((await call('/__preview/local-data',{},'POST')).status,405)
 assert.equal((await call('/other')).next,true)
 let installed=false;await localDatasetPlugin('').configureServer({middlewares:{use:()=>{installed=true}}});assert.equal(installed,false)
})
