import { executarGestaoEquipe, ErroEquipe } from '../../functions/src/gestaoEquipe.js'
import { ErroNps, idValido, MOTIVOS_CAIXA, NADA_A_MELHORAR, SETORES_NPS, melhoriaDoSetor, paraCsv, paraPainel, perguntarMelhoria, prepararAvaliacao, prepararComentario, situacaoComentario } from '../../functions/src/nps.js'
import { podeAcessar } from '../../functions/src/tabPolicy.js'
import { validarCadastro } from '../../functions/src/cadastroPolicy.js'
import { getRepository } from './repository.js'
import { monthKey, PREVIEW_UID } from './seed.js'
import { parseCSV } from '../../functions/src/parseCSV.js'
import { processarPecas } from '../../functions/src/processarPecas.js'
import { processarOficina } from '../../functions/src/processarOficina.js'
import { LOJAS } from '../data/regras.js'
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim().toUpperCase()
const config=(repo,key)=>JSON.parse(repo.readDoc(`config/${key}`)?.payload||'{}')
const periodNumber=mes=>{const [m,y]=mes.split('/').map(Number);return y*12+m}
// Respostas fictícias do NPS (sem CPF, sem nomes), geradas uma vez na base da prévia.
function npsDemo(repo){
 const docs=repo.allDocs(),ja=Object.keys(docs).filter(p=>p.startsWith('nps/'))
 if(ja.length||docs['config/npsDemo'])return
 let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647
 const hex=n=>Array.from({length:n},()=>Math.floor(r()*16).toString(16)).join('')
 const comentarios=['Atendimento rápido, gostei.','Demorou um pouco para separar a peça.','Equipe muito educada.','Poderia ter mais opções de pagamento.','Voltarei com certeza!']
 const ops=[],agora=Date.now()
 for(let i=0;i<140;i++){
  const setorId=SETORES_NPS[Math.floor(r()**1.6*SETORES_NPS.length)].id
  const nota=Math.min(10,Math.max(0,Math.round(10-r()**2*9))),notaSetor=Math.min(10,Math.max(0,nota+Math.round(r()*2-1)))
  const opcoes=melhoriaDoSetor(setorId).opcoes.slice(0,-1)
  const motivos=perguntarMelhoria(notaSetor)?(r()<.25?[NADA_A_MELHORAR]:[opcoes[Math.floor(r()*opcoes.length)]]):[]
  const notaCaixa=r()<.18?0:Math.min(5,Math.max(1,Math.round(5-r()**2*4)))
  const motivosCaixa=notaCaixa>=1&&notaCaixa<=3?[MOTIVOS_CAIXA[Math.floor(r()*MOTIVOS_CAIXA.length)]]:[]
  const id=`${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(r()*4)]}${hex(3)}-${hex(12)}`
  const doc=prepararAvaliacao({id,nota,notaSetor,setorId,motivos,notaCaixa,motivosCaixa,cpf:''},new Date(agora-Math.floor(r()*75*86400000)).toISOString())
  if(r()<.22)doc.comentario=comentarios[Math.floor(r()*comentarios.length)]
  ops.push({path:`nps/${id}`,data:doc})
 }
 ops.push({path:'config/npsDemo',data:{ts:agora}})
 repo.commit(ops,repo.revision())
}
function npsPrevia(name,data,repo){
 if(name==='npsPesquisa'){
  if(data.acao==='avaliar'){
   const doc=prepararAvaliacao(data.avaliacao)
   if(!repo.readDoc(`nps/${doc.id}`))repo.commit([{path:`nps/${doc.id}`,data:doc}],repo.revision())
   return {id:doc.id}
  }
  if(data.acao==='comentario'||data.acao==='comentar'){
   const atual=idValido(data.id)&&repo.readDoc(`nps/${data.id}`)
   if(!atual)throw new ErroNps('not-found','Avaliação não encontrada.')
   if(data.acao==='comentario')return {situacao:situacaoComentario(atual)}
   repo.commit([{path:`nps/${data.id}`,data:prepararComentario(atual,data.comentario)}],repo.revision())
   return {situacao:'comentado'}
  }
  throw new ErroNps('invalid-argument','Ação inválida.')
 }
 let profile=repo.readDoc(`usuarios/${PREVIEW_UID}`)
 try{const ver=JSON.parse(window.sessionStorage.getItem('pv_ver_como'));if(ver?.role)profile={...profile,role:ver.role}}catch{}
 if(!podeAcessar(profile?.role,'/nps',config(repo,'permissoes'),profile?.setor))throw new ErroNps('permission-denied','Módulo não autorizado para este perfil.')
 npsDemo(repo)
 const docs=Object.entries(repo.allDocs()).filter(([p])=>p.startsWith('nps/')).map(([,d])=>d).sort((a,b)=>b.criadoEm.localeCompare(a.criadoEm))
 if(data.acao==='ler')return {avaliacoes:docs.map(paraPainel),limite:false}
 if(data.acao==='exportar')return {csv:paraCsv(docs,{comCpf:profile.role==='admin'})}
 throw new ErroNps('invalid-argument','Ação inválida.')
}
export async function callPreviewFunction(name,data={},repo=getRepository()){
 // Mesma regra do servidor (functions/src/gestaoEquipe.js). Só na prévia o "Ver como" troca o
 // perfil, para dar para testar o fluxo do supervisor sem outra conta.
 if(name==='gestaoEquipe'){
  let profile=repo.readDoc(`usuarios/${PREVIEW_UID}`)
  try{const ver=JSON.parse(window.sessionStorage.getItem('pv_ver_como'));if(ver?.nome&&ver?.role)profile={...profile,role:ver.role,nome:ver.nome}}catch{}
  const revision=repo.revision(),docs=repo.allDocs(),operations=[]
  try{
   const result=await executarGestaoEquipe(profile,data,{get:async path=>structuredClone(docs[path]),set:async(path,value)=>operations.push({path,data:value})})
   if(operations.length)repo.commit(operations,revision)
   return result
  }catch(error){if(error instanceof ErroEquipe)throw Object.assign(Error(error.message),{code:`functions/${error.code}`});throw error}
 }
 // NPS: mesmas regras de functions/src/npsCallable.js, gravando em nps/{id} da prévia.
 if(name==='npsPesquisa'||name==='npsPainel'){
  try{return npsPrevia(name,data,repo)}catch(error){if(error instanceof ErroNps)throw Object.assign(Error(error.message),{code:`functions/${error.code}`});throw error}
 }
 // Turnstile real só no servidor conectado; aqui só exige que o widget (chave
 // de teste) tenha emitido um token, sem guardar nem enviar nada.
 if(name==='verificarTurnstile'){
  if(!['login','reset_senha'].includes(data.action)||typeof data.turnstileToken!=='string'||!data.turnstileToken)throw Object.assign(Error('Verificação de segurança ausente.'),{code:'functions/failed-precondition'})
  return {ok:true}
 }
 if(name==='solicitarAcesso'){
  if(typeof data.turnstileToken!=='string'||!data.turnstileToken)throw Object.assign(Error('Verificação de segurança ausente.'),{code:'functions/failed-precondition'})
  // Mesma validação do servidor; a prévia não cria conta nem guarda a senha.
  try{validarCadastro(data)}catch(error){throw Object.assign(Error(error.message),{code:'functions/invalid-argument'})}
  return {ok:true}
 }
 if(name==='gerenciarLinkBI'&&data.action==='list')return {links:[]}
 if(['criarLinkBI','gerenciarLinkBI','portalBI'].includes(name))throw Error('Links pessoais permanentes exigem o aplicativo conectado ao Firebase. Nenhum acesso real é gerado nesta prévia.')
 if(name==='gerenciarUsuario'){
  if(['criar','resetSenha','resetarSenha','gerarLinkReset'].includes(data.acao)||/reset|senha/i.test(data.acao||''))throw Error('Criação de login e recuperação de senha exigem o aplicativo conectado. A prévia não cria credenciais nem envia mensagens.')
  const path=`usuarios/${data.uid}`,existing=repo.readDoc(path)
  if(!existing)throw Error('Selecione uma conta demonstrativa.')
  if(data.uid===PREVIEW_UID)throw Error('A conta de acesso da prévia é fixa. Use outra conta demonstrativa para testar alterações.')
  if(data.acao==='excluir'){repo.commit([{path,delete:true}]);return {ok:true}}
  if(['desativar','reativar'].includes(data.acao)){repo.commit([{path,data:{ativo:data.acao==='reativar'},merge:true}]);return{ok:true}}
  if(data.acao==='atualizarPerfil'){
   const changes={};for(const k of ['nome','role','estados'])if(data[k]!==undefined)changes[k]=data[k]
   repo.commit([{path,data:changes,merge:true}]);return{ok:true}
  }
  throw Error('Essa operação de acesso não está disponível na prévia local.')
 }
 if(name!=='processarCSV')throw Error('Esta ação depende do aplicativo conectado.')
 const {tipo,csvText,retroativo=false,motivo=''}=data
 if(!['pecas','oficina'].includes(tipo))throw Error('Tipo de importação inválido.')
 if(typeof csvText!=='string'||csvText.length<10||new TextEncoder().encode(csvText).length>1000000)throw Error('Use um CSV de até 1 MB para testar a importação local da prévia.')
 const {rows}=parseCSV(csvText)
 if(!rows.length)throw Error('CSV sem linhas válidas.')
 const rules=config(repo,'regras')
 const resolver=(tipoMov,mes,empresa)=>{
  const entries=rules[mes]?.[tipo]?.[LOJAS[empresa]?.uf]
  return Object.entries(entries||{}).find(([name])=>norm(name)===tipoMov)?.[1]||null
 }
 const {registros,inconsistencias}=tipo==='pecas'?processarPecas(rows,resolver):processarOficina(rows,resolver)
 const grouped={};for(const row of registros)if(row.mes)(grouped[row.mes]||=[]).push(row)
 const mesesNovos=Object.keys(grouped),current=monthKey(new Date())
 if(!mesesNovos.length)throw Error('Nenhum registro válido. Confira datas, loja e tipos de movimento cadastrados nas Regras.')
 const closed=mesesNovos.filter(m=>periodNumber(m)<periodNumber(current))
 if(closed.length&&(!retroativo||motivo.trim().length<10))throw Error('Mês fechado: marque Upload retroativo e informe um motivo de pelo menos 10 caracteres. A correção será apenas local.')
 const oldIndex=repo.readDoc('config/mesesDisponiveis')||{pecas:[],oficina:[]},ops=[],timestamp=Date.now(),pasta=tipo==='pecas'?'Pecas':'Oficina'
 for(const mes of mesesNovos){
  const path=`Dados/${pasta}/${mes.replace('/','-')}.json`
  if(closed.includes(mes)&&repo.readFile(path))ops.push({file:true,path:`Dados/${pasta}/historico/${mes.replace('/','-')}__${timestamp}.json`,data:repo.readFile(path)})
  ops.push({file:true,path,data:{content:JSON.stringify(grouped[mes]),updated:new Date(timestamp).toISOString()}})
 }
 ops.push({path:'config/mesesDisponiveis',data:{...oldIndex,[tipo]:[...new Set([...(oldIndex[tipo]||[]),...mesesNovos])],alteracoes:{...oldIndex.alteracoes,...Object.fromEntries(mesesNovos.map(m=>[m,timestamp]))}}})
 repo.commit(ops)
 return {mesesNovos,mesesFechadosCorrigidos:closed,totalRegistros:registros.length,inconsistencias}
}
