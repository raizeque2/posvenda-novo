import { createDemoSeed } from './seed.js'
export const PREVIEW_STORAGE_KEY = 'posvenda:full-preview:v1'
export function createRepository(storage, seed = createDemoSeed(),storageKey=PREVIEW_STORAGE_KEY) {
 let state=structuredClone(seed)
 const listeners=new Set()
 const copy=value=>value === undefined?undefined:structuredClone(value)
 function refresh(){
  const saved=storage.getItem(storageKey)
  if(saved){const parsed=JSON.parse(saved);if(parsed.schema!==1||!parsed.docs||!parsed.files)throw Error('A base local da prévia está inválida. Restaure os dados demonstrativos.');state=parsed}
  else state=copy(seed)
  return state
 }
 function notify(paths){for(const listener of listeners)listener(paths)}
 try{refresh()}catch{ /* The first write reports unavailable browser storage. */ }
 return {
  storageKey,
  dataset:seed.localDataset||null,
  readDoc:path=>copy(refresh().docs[path]),
  allDocs:()=>copy(refresh().docs),
  readFile:path=>copy(refresh().files[path]),
  allFiles:()=>copy(refresh().files),
  revision:()=>refresh().revision,
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
  receive(){refresh();notify(null)},
  commit(operations,expected){
   const current=refresh()
   if(expected!==undefined&&expected!==current.revision)throw Error('A prévia mudou em outra aba. Recarregue antes de salvar.')
   const next=copy(current), changed=[]
   for(const op of operations){
    const table=op.file?next.files:next.docs
    if(op.delete)delete table[op.path]
    else table[op.path]=op.merge?{...table[op.path],...copy(op.data)}:copy(op.data)
    changed.push(`${op.file?'file:':''}${op.path}`)
   }
   next.revision++
   try{storage.setItem(storageKey,JSON.stringify(next))}catch{throw Error('Não foi possível salvar a prévia neste navegador. Verifique o espaço disponível; a alteração não foi gravada.')}
   state=next;notify(changed)
   return next.revision
  },
  ensureCurrentMonth(){
   if(seed.localDataset)return false
   const current=refresh(),month=seed.seedMonth,operations=[]
   const prepared=current.docs['config/previewDemoDefaults']?.months||[]
   for(const type of ['Pecas','Oficina']){
    const path=`Dados/${type}/${month.replace('/','-')}.json`
    if(!current.files[path])operations.push({file:true,path,data:copy(seed.files[path])})
   }
   for(const name of ['colaboradores','metas','regras']){
    const path=`config/${name}`,existing=JSON.parse(current.docs[path]?.payload||'{}')
    const example=JSON.parse(seed.docs[path].payload)[month]
    let value=existing[month]
    if(!value)value=example
    else if(name==='metas'&&!prepared.includes(month)){
     value={...value}
     for(const [person,target] of Object.entries(example)){
      const previous=value[person]
      if(previous&&!Object.keys(previous.metas||{}).length&&!previous.mp&&!previous.mo&&!previous.mpo&&Object.keys(target.metas||{}).length)value[person]={...previous,metas:target.metas}
     }
    }
    if(JSON.stringify(value)!==JSON.stringify(existing[month]))operations.push({path,data:{...current.docs[path],payload:JSON.stringify({...existing,[month]:value})}})
   }
   const path='config/mesesDisponiveis',available=current.docs[path]||{}
   const next={...available}
   for(const type of ['pecas','oficina'])next[type]=[...new Set([...(available[type]||[]),month])]
   if(JSON.stringify(next)!==JSON.stringify(available))operations.push({path,data:next})
   if(!prepared.includes(month))operations.push({path:'config/previewDemoDefaults',data:{months:[...prepared,month]}})
   if(operations.length)this.commit(operations,current.revision)
   return operations.length>0
  },
  reset(nextSeed=seed){
   const next={...copy(nextSeed),revision:(state.revision||0)+1}
   try{storage.setItem(storageKey,JSON.stringify(next))}catch{throw Error('Não foi possível restaurar a prévia neste navegador. Os dados anteriores foram preservados.')}
   state=next;notify(null)
  },
 }
}
let repository
export function configureLocalRepository(seed){
 if(repository)throw Error('A base local deve ser escolhida antes de iniciar o aplicativo.')
 if(seed.schema!==1||!seed.localDataset?.id||!seed.docs||!seed.files)throw Error('Base local inválida.')
 repository=createRepository(window.localStorage,seed,`${PREVIEW_STORAGE_KEY}:dataset:${seed.localDataset.id}`)
 window.addEventListener('storage',e=>{if(e.key===repository.storageKey)repository.receive()})
}
export function getRepository(){
 if(!repository){
  repository=createRepository(window.localStorage)
  repository.ensureCurrentMonth()
  window.addEventListener('storage',e=>{if(e.key===repository.storageKey)repository.receive()})
 }
 return repository
}
