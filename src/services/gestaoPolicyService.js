import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase.js'
import { hasAdminDataAccess } from './authorizedAccess.js'
import { applyGestaoPolicy } from './ranking/gestaoPolicy.js'

export async function salvarPoliticaGestao({mes,nome,expected,next,fallback}){
  if(!await hasAdminDataAccess())throw Error('Somente administradores podem editar estas regras.')
  return runTransaction(db,async transaction=>{
    const ref=doc(db,'config','regras'),snapshot=await transaction.get(ref)
    const rules=JSON.parse(snapshot.data()?.payload||'{}')
    if(!rules[mes]?.gestao)rules[mes]={...(rules[mes]||fallback),gestao:fallback.gestao}
    const updated=applyGestaoPolicy(rules,mes,nome,expected,next)
    transaction.set(ref,{payload:JSON.stringify(updated),ts:Date.now()})
    return updated
  })
}
