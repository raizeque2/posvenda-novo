import test from 'node:test'
import assert from 'node:assert/strict'
import {createRepository, PREVIEW_STORAGE_KEY} from '../src/preview/repository.js'
import {createDemoSeed, monthKey, sampleCSV} from '../src/preview/seed.js'
import {callPreviewFunction} from '../src/preview/actions.js'

function memory() {
 const values=new Map()
 return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
}
const current=()=>new Date()
const historical=()=>new Date(new Date().getFullYear(),new Date().getMonth()-1,15,12)
const create=()=>createRepository(memory(),createDemoSeed())

test('Prévia mantém alterações ao reabrir, sem misturar a chave do sistema conectado',()=>{
 const storage=memory();storage.setItem('posvenda_regras_v2','dados conectados')
 const first=createRepository(storage)
 first.commit([{path:'config/prova',data:{meta:41000}}])
 const reopened=createRepository(storage)
 assert.equal(reopened.readDoc('config/prova').meta,41000)
 assert.equal(storage.getItem('posvenda_regras_v2'),'dados conectados')
 const read=reopened.readDoc('config/prova');read.meta=1
 assert.equal(first.readDoc('config/prova').meta,41000)
})

test('Falha de armazenamento e revisão desatualizada não deixam gravações parciais',()=>{
 const storage=memory(),repo=createRepository(storage)
 repo.commit([{path:'config/prova',data:{meta:100}}])
 const before=storage.getItem(PREVIEW_STORAGE_KEY),revision=repo.revision()
 assert.throws(()=>repo.commit([{path:'config/prova',data:{meta:1}}],revision-1),/outra aba/)
 const save=storage.setItem;storage.setItem=()=>{throw Error('QuotaExceededError')}
 assert.throws(()=>repo.commit([{path:'config/prova',data:{meta:200}},{file:true,path:'Dados/test.json',data:{content:'[]'}}]),/não foi gravada/)
 assert.equal(repo.readDoc('config/prova').meta,100)
 assert.equal(repo.readFile('Dados/test.json'),undefined)
 assert.equal(storage.getItem(PREVIEW_STORAGE_KEY),before)
 storage.setItem=save
})

test('Restauração aparece em outra instância e recupera JSON inválido',()=>{
 const storage=memory(),a=createRepository(storage),b=createRepository(storage)
 a.commit([{path:'config/prova',data:{meta:1}}]);assert.ok(b.readDoc('config/prova'))
 a.reset();b.receive();assert.equal(b.readDoc('config/prova'),undefined)
 storage.setItem(PREVIEW_STORAGE_KEY,'invalid')
 assert.throws(()=>b.readDoc('config/metas'))
 a.reset();assert.ok(b.readDoc('config/metas'))
})

test('Base fictícia possui três meses, lojas válidas e colaborador com meta sem vendas',()=>{
 const seed=createDemoSeed(),mes=monthKey(current())
 assert.equal(seed.docs['config/mesesDisponiveis'].pecas.length,3)
 const targets=JSON.parse(seed.docs['config/metas'].payload)
 assert.equal(targets[mes]['JULIA NUNES'].metas.VAREJO.mp,52000)
 const rows=JSON.parse(seed.files[`Dados/Pecas/${mes.replace('/','-')}.json`].content)
 assert.ok(rows.length>0)
 assert.ok(rows.every(r=>['ARA','PEI'].includes(r.empresa)))
 assert.ok(!rows.some(r=>r.responsavel==='JULIA NUNES'))
 assert.ok(Object.entries(seed.docs).filter(([k])=>k.startsWith('usuarios/')).every(([,v])=>v.email.endsWith('@exemplo.invalid')))
})

test('Novo mês da prévia recebe dados de todos os setores sem substituir edições anteriores',()=>{
 const storage=memory(),old=createRepository(storage,createDemoSeed(new Date(2026,8,17,12)))
 const oldPath='Dados/Pecas/09-2026.json'
 old.commit([{file:true,path:oldPath,data:{content:'[{"valor":500}]'}},{path:'config/prova',data:{meta:41000}}])
 const next=createRepository(storage,createDemoSeed(new Date(2026,9,8,12)))
 assert.equal(next.ensureCurrentMonth(),true)
 assert.equal(next.readFile(oldPath).content,'[{"valor":500}]')
 assert.equal(next.readDoc('config/prova').meta,41000)
 const rows=JSON.parse(next.readFile('Dados/Pecas/10-2026.json').content)
 assert.deepEqual([...new Set(rows.map(row=>row.cat))].sort(),['ATACADO','OFICINA','TELEVENDAS','VAREJO','WEB'])
 assert.ok(JSON.parse(next.readFile('Dados/Oficina/10-2026.json').content).length>0)
 assert.ok(JSON.parse(next.readDoc('config/metas').payload)['10/2026'])
 assert.ok(next.readDoc('config/mesesDisponiveis').pecas.includes('10/2026'))
 const revision=next.revision()
 next.commit([{file:true,path:'Dados/Pecas/10-2026.json',data:{content:'[]'}}])
 assert.equal(next.ensureCurrentMonth(),false)
 assert.equal(next.readFile('Dados/Pecas/10-2026.json').content,'[]')
 assert.equal(next.revision(),revision+1)
})

test('Prévia preenche metas demonstrativas vazias e preserva as metas já ajustadas',()=>{
 const storage=memory(),seed=createDemoSeed(new Date(2026,9,8,12)),repo=createRepository(storage,seed)
 const targets=JSON.parse(seed.docs['config/metas'].payload)
 targets['10/2026']['ANA COSTA']={...targets['10/2026']['ANA COSTA'],mp:0,mo:0,mpo:0,metas:{}}
 targets['10/2026']['BRUNO LIMA'].metas.TELEVENDAS.mp=41000
 repo.commit([{path:'config/metas',data:{payload:JSON.stringify(targets)}},{path:'config/previewDemoDefaults',delete:true}])
 assert.equal(repo.ensureCurrentMonth(),true)
 const result=JSON.parse(repo.readDoc('config/metas').payload)['10/2026']
 assert.equal(result['ANA COSTA'].metas.VAREJO.mp,36000)
 assert.equal(result['BRUNO LIMA'].metas.TELEVENDAS.mp,41000)
 assert.equal(repo.ensureCurrentMonth(),false)
 result['ANA COSTA'].metas={}
 repo.commit([{path:'config/metas',data:{payload:JSON.stringify({...targets,'10/2026':result})}}])
 assert.equal(repo.ensureCurrentMonth(),false)
 assert.deepEqual(JSON.parse(repo.readDoc('config/metas').payload)['10/2026']['ANA COSTA'].metas,{})
})

test('Importação usa o parser real, troca o mês de peças e preserva oficina e histórico',async()=>{
 const repo=create(),mes=monthKey(current()),old=monthKey(historical())
 const service=repo.readFile(`Dados/Oficina/${mes.replace('/','-')}.json`)
 const previous=repo.readFile(`Dados/Pecas/${old.replace('/','-')}.json`)
 const result=await callPreviewFunction('processarCSV',{tipo:'pecas',csvText:sampleCSV('pecas')},repo)
 assert.equal(result.totalRegistros,1);assert.equal(result.inconsistencias.length,0)
 const rows=JSON.parse(repo.readFile(`Dados/Pecas/${mes.replace('/','-')}.json`).content)
 assert.equal(rows.length,1);assert.equal(rows[0].valor,500);assert.equal(rows[0].responsavel,'ANA COSTA')
 assert.deepEqual(repo.readFile(`Dados/Oficina/${mes.replace('/','-')}.json`),service)
 assert.deepEqual(repo.readFile(`Dados/Pecas/${old.replace('/','-')}.json`),previous)
})

test('Importação de serviço concilia mão de obra sem somar peças',async()=>{
 const repo=create(),mes=monthKey(current())
 await callPreviewFunction('processarCSV',{tipo:'oficina',csvText:sampleCSV('oficina')},repo)
 const rows=JSON.parse(repo.readFile(`Dados/Oficina/${mes.replace('/','-')}.json`).content)
 assert.equal(rows.length,1);assert.equal(rows[0].mo,400)
 assert.equal(rows[0].consultor,'ELISA MELO');assert.equal(rows[0].tecnico,'FELIPE ROCHA')
})

test('Mês fechado exige autorização retroativa e mantém backup antes da substituição',async()=>{
 const repo=create(),csvText=sampleCSV('pecas',historical()),mes=monthKey(historical()),path=`Dados/Pecas/${mes.replace('/','-')}.json`,before=repo.readFile(path)
 await assert.rejects(callPreviewFunction('processarCSV',{tipo:'pecas',csvText},repo),/Mês fechado/)
 assert.deepEqual(repo.readFile(path),before)
 const result=await callPreviewFunction('processarCSV',{tipo:'pecas',csvText,retroativo:true,motivo:'Correção demonstrativa de teste'},repo)
 assert.deepEqual(result.mesesFechadosCorrigidos,[mes])
 const backups=Object.entries(repo.allFiles()).filter(([p])=>p.startsWith(`Dados/Pecas/historico/${mes.replace('/','-')}__`))
 assert.equal(backups.length,1);assert.deepEqual(backups[0][1],before)
})

test('CSV inválido e acima do limite não alteram a base',async()=>{
 const repo=create(),before=repo.allFiles()
 await assert.rejects(callPreviewFunction('processarCSV',{tipo:'pecas',csvText:'Data;Empresa\ninválida;ARA'},repo),/Nenhum registro válido/)
 await assert.rejects(callPreviewFunction('processarCSV',{tipo:'pecas',csvText:'a'.repeat(1000001)},repo),/1 MB/)
 assert.deepEqual(repo.allFiles(),before)
})

test('Acessos editam apenas contas fictícias e não criam credenciais ou links',async()=>{
 const repo=create()
 for(const [name,data] of [['gerenciarUsuario',{acao:'criar'}],['gerenciarUsuario',{acao:'resetSenha'}],['criarLinkBI',{name:'ANA COSTA'}],['portalBI',{token:'test'}],['naoPermitida',{}]])await assert.rejects(callPreviewFunction(name,data,repo))
 await callPreviewFunction('gerenciarUsuario',{acao:'atualizarPerfil',uid:'preview-supervisor',nome:'HUGO DEMONSTRAÇÃO'},repo)
 assert.equal(repo.readDoc('usuarios/preview-supervisor').nome,'HUGO DEMONSTRAÇÃO')
 await assert.rejects(callPreviewFunction('gerenciarUsuario',{acao:'excluir',uid:'preview-admin'},repo),/fixa/)
 await callPreviewFunction('gerenciarUsuario',{acao:'desativar',uid:'preview-vendedor'},repo)
 assert.equal(repo.readDoc('usuarios/preview-vendedor').ativo,false)
})

test('Notificações e transações da prévia atualizam os serviços sem rede',async()=>{
 globalThis.window={localStorage:memory(),sessionStorage:memory(),addEventListener(){}}
 const sdk=await import('../src/preview/firebase-sdk.js')
 const reference=sdk.doc(sdk.getFirestore(),'config','previewIntegration'),updates=[]
 const unsubscribe=sdk.onSnapshot(reference,s=>updates.push(s.data()))
 await new Promise(resolve=>queueMicrotask(resolve))
 await sdk.setDoc(reference,{meta:100})
 await sdk.runTransaction(sdk.getFirestore(),async tx=>{const old=await tx.get(reference);tx.set(reference,{meta:old.data().meta+50})})
 await new Promise(resolve=>queueMicrotask(resolve))
 assert.equal((await sdk.getDoc(reference)).data().meta,150)
 assert.ok(updates.some(d=>d?.meta===100));assert.equal(updates.at(-1).meta,150)
 unsubscribe()
 const before=updates.length;await sdk.setDoc(reference,{meta:200});await new Promise(resolve=>queueMicrotask(resolve));assert.equal(updates.length,before)
})

test('Login demonstrativo rejeita senha incorreta, aceita teste/teste e encerra a sessão',async()=>{
 const sdk=await import('../src/preview/firebase-sdk.js')
 assert.equal(sdk.getAuth().currentUser,null)
 await assert.rejects(sdk.signInWithEmailAndPassword(sdk.getAuth(),'teste','incorreta'),/login teste/)
 assert.equal(window.sessionStorage.getItem(sdk.PREVIEW_SESSION_KEY),null)
 await sdk.signInWithEmailAndPassword(sdk.getAuth(),'teste','teste')
 assert.equal(sdk.getAuth().currentUser.uid,'preview-admin')
 assert.equal(window.sessionStorage.getItem(sdk.PREVIEW_SESSION_KEY),'signed-in')
 await sdk.signOut()
 assert.equal(sdk.getAuth().currentUser,null)
 assert.equal(window.sessionStorage.getItem(sdk.PREVIEW_SESSION_KEY),null)
})
