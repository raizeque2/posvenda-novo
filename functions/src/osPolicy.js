export function validateOSRules(value){
  if(!value||!Array.isArray(value.grupos)||!value.grupos.length||value.grupos.length>40)throw Error('Informe os grupos de criticidade.')
  const keys=new Set()
  for(const group of value.grupos){
    if(typeof group.key!=='string'||!group.key||keys.has(group.key)||typeof group.label!=='string'||!Array.isArray(group.keywords))throw Error('Grupo inválido ou duplicado.')
    keys.add(group.key)
    if(!group.judicial&&(![group.moderado,group.critico,group.extremo].every(n=>Number.isInteger(n)&&n>=0&&n<=3650)||group.moderado>group.critico||group.critico>group.extremo))throw Error('Os limites devem seguir a ordem moderado ≤ crítico ≤ extremo, entre 0 e 3650 dias.')
  }
  if(!Array.isArray(value.situacoesExcluidas)||value.situacoesExcluidas.some(s=>typeof s!=='string'||s.length>200)||Object.values(value.tipoOverrides||{}).some(key=>!keys.has(key)))throw Error('Situação ou vínculo de grupo inválido.')
  return value
}
export function scopedOSSnapshot(value,scope){
  const photo=p=>p?{ts:p.ts,dataArquivo:p.dataArquivo,registros:(p.registros||[]).filter(scope.rowAllowed).map(({linhas,...row})=>row)}:null
  return {foto:photo(value?.foto),anterior:photo(value?.anterior),historico:[]}
}
