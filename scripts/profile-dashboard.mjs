import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {performance} from 'node:perf_hooks'
import {normalize,key,aggregate} from '../src/bi/model.js'
import * as territory from '../src/bi/territory.js'
import {kpiInsights} from '../src/bi/kpiInsights.js'
import {dailyRevenueRows,kpiSummary,isVirtualAccount} from '../src/bi/revenue.js'
import {calcLiquido} from '../src/pages/dashboard/dashboard.logic.js'
const root=path.resolve(process.argv[2]),seed=JSON.parse(await readFile(path.join(root,'seed.json'),'utf8'))
const read=async(type,month)=>JSON.parse(await readFile(path.join(root,`${type}-${month.replace('/','-')}.json`),'utf8'))
const [pieces,services,...historical]=await Promise.all([read('pecas','10/2026'),read('oficina','10/2026'),...seed.localDataset.months.filter(m=>m!=='10/2026').flatMap(m=>[read('pecas',m),read('oficina',m)])])
let started=performance.now();const rows=[...normalize(pieces),...normalize(services,true)],history=historical.flatMap((r,i)=>normalize(r,i%2===1));const normalizeMs=performance.now()-started
const index=JSON.parse(await readFile('public/maps/municipios-index.json','utf8')),cities=[...new Map(rows.map(r=>[`${key(r.city)}:${r.uf}`,r])).values()]
started=performance.now();const matched=Object.fromEntries(cities.map(r=>[`${key(r.city)}:${r.uf}`,territory.matchMunicipality(r,index)?.[2]||null]));const matchMs=performance.now()-started
const states=[...new Set(cities.map(r=>territory.matchMunicipality(r,index)?.[1]).filter(Boolean))].sort()
const features=(await Promise.all(states.map(uf=>readFile(`public/maps/${uf}.json`,'utf8').then(JSON.parse)))).flatMap(g=>g.features).slice(0,400)
started=performance.now();const result=process.argv.includes('--baseline')||!territory.aggregateMapFeatures?features.map(f=>{const records=rows.filter(r=>matched[`${key(r.city)}:${r.uf}`]===f.properties.id);return {records:records.length,value:records.reduce((s,r)=>s+r.value,0)}}):territory.aggregateMapFeatures(rows,{features,matchedCities:matched});const mapMs=performance.now()-started
started=performance.now();const dailyRows=process.argv.includes('--baseline')?rows:dailyRevenueRows(rows),dailyHistory=process.argv.includes('--baseline')?history:dailyRevenueRows(history);for(const channel of ['VAREJO','WEB','TELEVENDAS','ATACADO','OFICINA','SERVIÇOS'])kpiInsights(dailyRows,dailyHistory,channel);const insightsMs=performance.now()-started
const products=aggregate(rows,{dimension:'product',metric:'quantity',limit:7})
console.log(JSON.stringify({rows:rows.length,history:history.length,states:states.length,features:features.length,normalizeMs,matchMs,mapMs,insightsMs,matchedRecords:result.reduce((s,r)=>s+r.records,0),products:products.length,channels:[...new Set(rows.map(r=>r.channel))]},null,2))
const summary=kpiSummary(rows),expectedParts=['VAREJO','WEB','TELEVENDAS','ATACADO','OFICINA','OFICINA_GAR','OFICINA_SEG'].reduce((sum,channel)=>sum+calcLiquido(pieces,channel,0,0).liquido,0),share=aggregate(rows,{dimension:'channel',metric:'value',limit:100})
if(Math.abs(summary['TOTAL PEÇAS'].value-expectedParts)>.01)throw Error('Total de peças diverge do dashboard por setores.')
if(Math.abs(share.reduce((s,r)=>s+r.value,0)-summary['TOTAL PEÇAS'].value-summary['MÃO DE OBRA'].value)>.01)throw Error('Participação por canal diverge do faturamento.')
if(aggregate(rows,{dimension:'person',metric:'value',limit:10000}).some(r=>isVirtualAccount(r.name)))throw Error('Conta de canal encontrada na equipe.')
if(!products.length||products.some(p=>!p.name))throw Error('Peças não identificadas.')
console.log('Conciliação: totais do dashboard por setores, participação por canal, peças identificadas e equipe sem contas virtuais passaram.')
