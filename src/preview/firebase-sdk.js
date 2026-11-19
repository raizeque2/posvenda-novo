// This module is selected ONLY by the preview build. It has no network client.
import { getRepository } from './repository.js'
import { PREVIEW_UID } from './seed.js'
const clone=v=>v===undefined?undefined:structuredClone(v)
const pathOf=(base,parts)=>[base?.path,...parts].filter(Boolean).join('/').replace(/\/+$/,'')
const reference=(kind,base,parts)=>({kind,path:pathOf(base,parts)})
export const initializeApp=()=>({kind:'preview-app'})
export const getFirestore=()=>({kind:'database'})
export const getStorage=()=>({kind:'storage'})
export const getFunctions=()=>({kind:'functions'})
export const doc=(base,...parts)=>reference('document',base,parts)
export const collection=(base,...parts)=>reference('collection',base,parts)
export const query=(ref,...constraints)=>({...ref,constraints})
export const where=(field,op,value)=>({field,op,value})
export const serverTimestamp=()=>({seconds:Math.floor(Date.now()/1000),nanoseconds:0})
const snapshot=(ref,value)=>({id:ref.path.split('/').pop(),ref,exists:()=>value!==undefined,data:()=>clone(value)})
export const getDoc=async ref=>snapshot(ref,getRepository().readDoc(ref.path))
function querySnapshot(ref){
 const entries=Object.entries(getRepository().allDocs()).filter(([path,data])=>path.startsWith(ref.path+'/')&&!path.slice(ref.path.length+1).includes('/')&&(ref.constraints||[]).every(c=>{if(c.op!=='==')throw Error('Filtro indisponível na prévia.');return data[c.field]===c.value}))
 const docs=entries.map(([path,value])=>snapshot({kind:'document',path},value))
 return {docs,empty:!docs.length,size:docs.length,forEach:fn=>docs.forEach(fn),docChanges:()=>docs.map(doc=>({type:'added',doc}))}
}
export const getDocs=async ref=>querySnapshot(ref)
export const setDoc=async(ref,data,options={})=>getRepository().commit([{path:ref.path,data,merge:options.merge}])
export const deleteDoc=async ref=>getRepository().commit([{path:ref.path,delete:true}])
export const addDoc=async(ref,data)=>{const created=doc(ref,crypto.randomUUID());await setDoc(created,data);return created}
export function writeBatch(){
 const ops=[]
 return {set(ref,data,options={}){ops.push({path:ref.path,data,merge:options.merge});return this},update(ref,data){ops.push({path:ref.path,data,merge:true});return this},delete(ref){ops.push({path:ref.path,delete:true});return this},commit:async()=>getRepository().commit(ops)}
}
export async function runTransaction(db,fn){
 const run=async()=>{
  const repo=getRepository(),revision=repo.revision(),ops=[]
  const result=await fn({get:getDoc,set:(ref,data,options={})=>ops.push({path:ref.path,data,merge:options.merge}),update:(ref,data)=>ops.push({path:ref.path,data,merge:true}),delete:ref=>ops.push({path:ref.path,delete:true})})
  if(ops.length)repo.commit(ops,revision)
  return result
 }
 return globalThis.navigator?.locks? navigator.locks.request('posvenda-preview-write',run):run()
}
export function onSnapshot(ref,next,error){
 let active=true, previous={}
 const deliver=()=>{
  if(!active)return
  try{
   if(ref.kind==='document') next(snapshot(ref,getRepository().readDoc(ref.path)))
   else {
    const result=querySnapshot(ref),current=Object.fromEntries(result.docs.map(d=>[d.id,d]))
    result.docChanges=()=>[
     ...result.docs.filter(d=>JSON.stringify(previous[d.id]?.data())!==JSON.stringify(d.data())).map(doc=>({type:previous[doc.id]?'modified':'added',doc})),
     ...Object.values(previous).filter(d=>!current[d.id]).map(doc=>({type:'removed',doc})),
    ]
    next(result);previous=current
   }
  }catch(e){error?.(e)}
 }
 queueMicrotask(deliver)
 const unsubscribe=getRepository().subscribe(paths=>{if(!paths||paths.some(p=>ref.kind==='document'?p===ref.path:p.startsWith(ref.path+'/')))queueMicrotask(deliver)})
 return()=>{active=false;unsubscribe()}
}
const user={uid:PREVIEW_UID,email:'administrador@exemplo.invalid',displayName:'ANA COSTA',emailVerified:true,reload:async()=>{}}
export const PREVIEW_SESSION_KEY='posvenda:preview:session:v1'
function hasPreviewSession(){try{return window.sessionStorage.getItem(PREVIEW_SESSION_KEY)==='signed-in'}catch{return false}}
const auth={currentUser:hasPreviewSession()?user:null}
const authListeners=new Set()
export const getAuth=()=>auth
export function onAuthStateChanged(_,next){authListeners.add(next);queueMicrotask(()=>next(auth.currentUser));return()=>authListeners.delete(next)}
export async function signInWithEmailAndPassword(_,username,password){
 if(!['teste','teste@posvenda.app'].includes(String(username||'').trim().toLowerCase())||password!=='teste')throw Object.assign(Error('Use o login teste e a senha teste.'),{code:'auth/invalid-credential'})
 try{window.sessionStorage.setItem(PREVIEW_SESSION_KEY,'signed-in')}catch{throw Error('O navegador não permitiu abrir a sessão de teste. Habilite o armazenamento local e tente novamente.')}
 auth.currentUser=user;authListeners.forEach(fn=>fn(user));return{user}
}
export async function signOut(){window.sessionStorage.removeItem(PREVIEW_SESSION_KEY);auth.currentUser=null;authListeners.forEach(fn=>fn(null))}
// Fluxos de e-mail simulados: nada é enviado. Na prévia, o código "demo" é o
// único link válido de redefinição/confirmação; qualquer outro simula link expirado.
export async function sendPasswordResetEmail(){}
export async function sendEmailVerification(){}
const demoCode=code=>{if(code!=='demo')throw Object.assign(Error('Link expirado (prévia).'),{code:'auth/expired-action-code'})}
export async function verifyPasswordResetCode(_,code){demoCode(code);return 'colaborador@exemplo.invalid'}
export async function confirmPasswordReset(_,code,senha){demoCode(code);if(String(senha||'').length<8)throw Object.assign(Error('Senha fraca'),{code:'auth/weak-password'})}
export async function applyActionCode(_,code){demoCode(code)}
// Portal de colaboradores/supervisores: a sessão é emitida por uma função do
// servidor, então a prévia (sem backend) não consegue entrar.
export async function signInWithCustomToken(){throw Error('O portal de colaboradores exige o aplicativo conectado ao Firebase.')}
export const ref=(base,...parts)=>{const r=reference('file',base,parts);return {...r,name:r.path.split('/').pop(),fullPath:r.path}}
const fileOf=ref=>{const file=getRepository().readFile(ref.path);if(!file)throw Object.assign(Error('Arquivo demonstrativo não encontrado.'),{code:'storage/object-not-found'});return file}
const urls=new Map()
export async function getDownloadURL(ref){
 const file=fileOf(ref),old=urls.get(ref.path)
 if(file.localUrl)return file.localUrl
 if(old?.content===file.content)return old.url
 if(old)URL.revokeObjectURL(old.url)
 const url=URL.createObjectURL(new Blob([file.content],{type:'application/json'}))
 urls.set(ref.path,{content:file.content,url});return url
}
export const getMetadata=async ref=>({updated:fileOf(ref).updated})
export const getBytes=async ref=>{const file=fileOf(ref);if(file.localUrl){const response=await fetch(file.localUrl);if(!response.ok)throw Error('Arquivo local indisponível.');return response.arrayBuffer()}return new TextEncoder().encode(file.content).buffer}
export const uploadString=async(ref,content)=>getRepository().commit([{file:true,path:ref.path,data:{content,updated:new Date().toISOString()}}])
export const deleteObject=async ref=>getRepository().commit([{file:true,path:ref.path,delete:true}])
export const listAll=async base=>({items:Object.keys(getRepository().allFiles()).filter(path=>path.startsWith(base.path+'/')&&!path.slice(base.path.length+1).includes('/')).map(path=>ref(null,path)),prefixes:[]})
export const httpsCallable=(_,name)=>async data=>{
 const { callPreviewFunction }=await import('./actions.js')
 return {data:await callPreviewFunction(name,data)}
}
