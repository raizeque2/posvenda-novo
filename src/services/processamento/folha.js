import {parseCSV} from './parseCSV.js'
import {norm} from '../../utils/normalizacao.js'
import {LOJAS} from '../../data/regras.js'
import {sortMesAno} from '../../utils/datas.js'

const cleanHeader=s=>norm(s).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')
const aliases={nome:['nome','funcionario','colaborador','nome_do_funcionario','nome_completo'],loja:['loja','empresa','unidade'],cargo:['cargo','funcao'],centro_custo:['centro_custo','centro_de_custo'],salario_base:['salario_base','salario','salario_contratual'],competencia:['competencia','mes','mes_ano'],cargo_movimento:['cargo_movimento','setor','canal'],supervisor:['supervisor','gestor'],apelido:['apelido'],ativo:['ativo'],mp:['mp','meta_pecas','meta_pecas_total'],mo:['mo','meta_mo','meta_m_o','meta_mao_de_obra'],mpo:['mpo','meta_pecas_os','meta_os'],varejo:['meta_varejo','meta_pecas_varejo'],atacado:['meta_atacado'],web:['meta_web'],televendas:['meta_televendas']}
const headerKeys=Object.fromEntries(Object.entries(aliases).flatMap(([key,values])=>values.map(value=>[value,key])))
const numeric=['salario_base','mp','mo','mpo','varejo','atacado','web','televendas']
const cadastroFields=['loja','cargo','centro_custo','salario_base','cargo_movimento','supervisor','apelido','ativo']
const channelFields={varejo:'VAREJO',atacado:'ATACADO',web:'WEB',televendas:'TELEVENDAS'}
export const FOLHA_LABELS={salario_base:'Salário',loja:'Loja',cargo:'Cargo',centro_custo:'Centro de custo',supervisor:'Supervisor',apelido:'Apelido',ativo:'Ativo',cargo_movimento:'Canais',mp:'Meta peças',mo:'Meta M.O',mpo:'Meta peças O.S.',varejo:'Meta varejo',atacado:'Meta atacado',web:'Meta web',televendas:'Meta televendas'}
const validMonth=m=>/^(0[1-9]|1[0-2])\/20\d{2}$/.test(m)
function money(value,label){
  let raw=String(value).trim().replace(/^R\$\s*/i,'').replace(/\s/g,'')
  if(raw.includes(',')){if(!/^(?:\d{1,3}(?:\.\d{3})+|\d+),\d{1,2}$/.test(raw))throw Error(`${label}: valor inválido (${value}).`);raw=raw.replaceAll('.','').replace(',','.')}
  else if(/^\d{1,3}(?:\.\d{3})+$/.test(raw))raw=raw.replaceAll('.','')
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(Number(raw))||Number(raw)>1e12)throw Error(`${label}: valor inválido (${value}).`)
  return Number(raw)
}
export function inferirLoja(value){
  const input=norm(value||'');if(LOJAS[input])return input
  const matches=Object.entries(LOJAS).filter(([,loja])=>input&&input.includes(norm(loja.un)))
  return matches.length===1?matches[0][0]:''
}
export function parseFolha(text){
  if(new TextEncoder().encode(text).length>5_000_000)throw Error('A folha deve ter até 5 MB.')
  const firstLine=text.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]
  const {header,rows:source}=parseCSV(text,firstLine.includes(';')?';':',')
  const keys=header.map(h=>headerKeys[cleanHeader(h)]),known=keys.filter(Boolean)
  if(!known.includes('nome'))throw Error('Coluna nome não encontrada. Use o modelo de folha CSV.')
  if(new Set(known).size!==known.length)throw Error('Há colunas repetidas para o mesmo campo.')
  if(!source.length||source.length>10000)throw Error('A folha deve conter de 1 a 10.000 funcionários.')
  const names=new Set(),months=new Set()
  const rows=source.map((original,index)=>{
    const row={}
    header.forEach((h,i)=>{if(keys[i]&&original[h]?.trim())row[keys[i]]=original[h].trim()})
    if(!row.nome||row.nome.length>160||['__PROTO__','CONSTRUCTOR','PROTOTYPE'].includes(norm(row.nome)))throw Error(`Linha ${index+2}: informe um nome válido.`)
    if(names.has(norm(row.nome)))throw Error(`Nome repetido na folha: ${row.nome}.`);names.add(norm(row.nome))
    for(const key of numeric)if(row[key]!==undefined)row[key]=money(row[key],`Linha ${index+2} · ${FOLHA_LABELS[key]}`)
    if(row.competencia){if(!validMonth(row.competencia))throw Error(`Linha ${index+2}: competência deve ser MM/AAAA.`);months.add(row.competencia)}
    if(row.ativo!==undefined){const value=norm(row.ativo);if(!['SIM','NAO','TRUE','FALSE','1','0'].includes(value))throw Error('Ativo deve ser sim ou não.');row.ativo=['SIM','TRUE','1'].includes(value)}
    for(const key of cadastroFields)if(typeof row[key]==='string'&&row[key].length>300)throw Error(`Linha ${index+2}: campo ${key} muito longo.`)
    return row
  })
  if(months.size>1)throw Error('Use uma competência por arquivo de folha.')
  return {rows,competencia:[...months][0]||'',ignored:header.filter((_,i)=>!keys[i])}
}
function findPerson(records,name){
  const found=Object.entries(records||{}).filter(([key,row])=>norm(row.colaborador||key)===norm(name))
  if(found.length>1)throw Error(`Há cadastros ambíguos para ${name}. Corrija-os antes de importar.`)
  return found[0]
}
export function prepareFolha(rows,mes,colaboradores,metas,overrides={},allowMissingLoja=false){
  if(!validMonth(mes))throw Error('Escolha um mês válido para importar.')
  const colabs=structuredClone(colaboradores),targets=structuredClone(metas),changes=[],before=[],missing=[]
  colabs[mes]??={};targets[mes]??={}
  const anteriores=Object.keys(colaboradores).filter(m=>sortMesAno(m,mes)<0).sort((a,b)=>sortMesAno(b,a))
  for(const row of rows){
    const current=findPerson(colaboradores[mes],row.nome),target=findPerson(metas[mes],row.nome)
    const previous=current||anteriores.map(m=>findPerson(colaboradores[m],row.nome)).find(Boolean)
    const name=current?.[0]||target?.[0]||previous?.[0]||row.nome.trim().toUpperCase()
    const oldTarget=target?.[1]||{}
    const legacyCadastro=Object.fromEntries(cadastroFields.filter(key=>oldTarget[key]!==undefined).map(key=>[key,oldTarget[key]]))
    const base={...legacyCadastro,...(current?.[1]||previous?.[1]||{})}
    before.push({name,current:current?.[1]??null,target:target?.[1]??null,fallback:current?null:previous?.[1]??null})
    const cad={...base,colaborador:name,mes,ativo:base.ativo!==false}
    for(const key of cadastroFields)if(row[key]!==undefined&&key!=='loja')cad[key]=row[key]
    const loja=overrides[row.nome]||inferirLoja(row.loja)||(!row.loja?base.loja:'')
    if(!LOJAS[loja]){missing.push(row.nome);if(!allowMissingLoja)throw Error(`Selecione a loja de ${row.nome}.`)}
    cad.loja=loja||''
    let channels=String(cad.cargo_movimento||'').split(/[;,|]/).map(norm).filter(Boolean).map(c=>['OFICINA','O.S.','O S'].includes(c)?'OS':c)
    if(channels.some(c=>!['VAREJO','ATACADO','WEB','TELEVENDAS','OS'].includes(c)))throw Error(`Canais de ${name}: use VAREJO, ATACADO, WEB, TELEVENDAS ou OS.`)
    const goalPatch={}
    for(const [field,channel] of Object.entries(channelFields))if(row[field]!==undefined){goalPatch[channel]={mp:row[field]};if(!channels.includes(channel))channels.push(channel)}
    if(row.mp!==undefined){const pecas=channels.filter(c=>c!=='OS');if(pecas.length!==1)throw Error(`${name}: para meta de peças, informe um único canal no setor ou use as colunas meta_varejo, meta_atacado, meta_web e meta_televendas.`);if(goalPatch[pecas[0]])throw Error(`${name}: meta de peças e meta do canal foram informadas juntas.`);goalPatch[pecas[0]]={mp:row.mp}}
    if(row.mo!==undefined||row.mpo!==undefined){goalPatch.OS={...(row.mo!==undefined?{mo:row.mo}:{}),...(row.mpo!==undefined?{mpo:row.mpo}:{})};if(!channels.includes('OS'))channels.push('OS')}
    cad.cargo_movimento=[...new Set(channels)].join(';')
    const nextTarget={...oldTarget,colaborador:name,mes}
    // Cadastro has one source of truth; old target records may still contain stale salary/role fields.
    for(const field of cadastroFields)delete nextTarget[field]
    if(Object.keys(goalPatch).length){
      const existing=structuredClone(oldTarget.metas||{})
      if(!oldTarget.metas){
        const pecas=channels.filter(c=>c!=='OS')
        if(oldTarget.mp>0&&pecas.length>1&&pecas.some(c=>!goalPatch[c]))throw Error(`${name}: distribua a meta antiga pelas colunas de cada canal antes de importar.`)
        if(pecas.length===1)existing[pecas[0]]={mp:oldTarget.mp||0}
        existing.OS={mo:oldTarget.mo||0,mpo:oldTarget.mpo||0}
      }
      for(const [channel,values] of Object.entries(goalPatch))existing[channel]={...(existing[channel]||{}),...values}
      nextTarget.metas=existing;nextTarget.mp=channels.filter(c=>c!=='OS').reduce((sum,c)=>sum+(existing[c]?.mp||0),0);nextTarget.mo=existing.OS?.mo||0;nextTarget.mpo=existing.OS?.mpo||0
    }
    colabs[mes][name]=cad
    if(target&&target[0]!==name)delete targets[mes][target[0]]
    if(target||Object.keys(goalPatch).length)targets[mes][name]=nextTarget
    const alteracoes=[]
    for(const key of cadastroFields)if(cad[key]!==base[key]&&!(cad[key]===''&&base[key]===undefined))alteracoes.push({label:FOLHA_LABELS[key],before:base[key]??'—',after:cad[key],money:key==='salario_base'})
    for(const [channel,values] of Object.entries(goalPatch))for(const [field,value] of Object.entries(values))alteracoes.push({label:`Meta ${channel==='OS'?field==='mo'?'M.O':'peças O.S.':channel}`,before:oldTarget.metas?.[channel]?.[field]??oldTarget[field]??0,after:value,money:true})
    changes.push({nome:name,loja:cad.loja,novo:!current,cargo:cad.cargo||'',alteracoes})
  }
  return {colaboradores:colabs,metas:targets,changes,missing,signature:JSON.stringify(before)}
}
