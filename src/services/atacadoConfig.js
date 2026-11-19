import {useEffect,useState} from 'react'
import {carregarConfig,salvarConfig} from './firestoreService.js'
export const ATACADO_DEFAULT={corte1:30,corte2:90,corte3:180,quedaPct:30}
export function validateAtacado(value){
  if(!['corte1','corte2','corte3','quedaPct'].every(k=>Number.isInteger(value[k]))||value.corte1<1||value.corte1>=value.corte2||value.corte2>=value.corte3||value.corte3>3650||value.quedaPct<1||value.quedaPct>100)throw Error('Use cortes crescentes entre 1 e 3650 dias e queda entre 1% e 100%.')
  return value
}
export function useAtacadoConfig(){
  const [value,setValue]=useState(ATACADO_DEFAULT),[error,setError]=useState('')
  useEffect(()=>{let live=true;const load=()=>carregarConfig('atacadoConfig').then(v=>{if(live){setValue({...ATACADO_DEFAULT,...v});setError('')}}).catch(()=>{if(live)setError('Não foi possível carregar as regras do atacado.')});load();window.addEventListener('posvenda:atacado-config',load);return()=>{live=false;window.removeEventListener('posvenda:atacado-config',load)}},[])
  async function save(next){await salvarConfig('atacadoConfig',validateAtacado(next));setValue(next);window.dispatchEvent(new Event('posvenda:atacado-config'))}
  return {value,save,error}
}
