import {doc,runTransaction} from 'firebase/firestore'
import {db} from '../firebase.js'
import {hasAdminDataAccess} from './authorizedAccess.js'
import {prepareFolha} from './processamento/folha.js'

export async function salvarFolha({rows,mes,overrides,signature,fallback}){
  if(!await hasAdminDataAccess())throw Error('Esta importação exige administrador.')
  return runTransaction(db,async transaction=>{
    const refs=[doc(db,'config','colaboradores'),doc(db,'config','metas')]
    const snapshots=await Promise.all(refs.map(ref=>transaction.get(ref)))
    const [colaboradores,metas]=snapshots.map(s=>JSON.parse(s.data()?.payload||'{}'))
    if(!colaboradores[mes]&&fallback.colaboradores[mes])colaboradores[mes]=fallback.colaboradores[mes]
    if(!metas[mes]&&fallback.metas[mes])metas[mes]=fallback.metas[mes]
    const plan=prepareFolha(rows,mes,colaboradores,metas,overrides)
    if(plan.signature!==signature)throw Error('O cadastro ou as metas mudaram durante a revisão. Feche e selecione o arquivo novamente para conferir os valores atuais.')
    const ts=Date.now()
    transaction.set(refs[0],{payload:JSON.stringify(plan.colaboradores),ts})
    transaction.set(refs[1],{payload:JSON.stringify(plan.metas),ts})
    return plan
  })
}
