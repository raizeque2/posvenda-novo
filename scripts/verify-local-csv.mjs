import {readFile} from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {buildRanking} from '../src/services/ranking/buildRanking.js'
import {createRepository} from '../src/preview/repository.js'
const root=path.resolve(process.argv[2]),seed=JSON.parse(await readFile(path.join(root,'seed.json'),'utf8'))
const configs=key=>JSON.parse(seed.docs[`config/${key}`].payload),colabs=configs('colaboradores'),metas=configs('metas'),regras=configs('regras')
const memory=new Map(),repo=createRepository({getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)},seed,'private-test')
assert.equal(repo.ensureCurrentMonth(),false)
repo.commit([{path:'config/verification',data:{ok:true}}])
assert.ok(memory.get('private-test').length<4_000_000)
const report=[]
for(const mes of seed.localDataset.months){
 const load=async type=>{const file=seed.files[`Dados/${type}/${mes.replace('/','-')}.json`];return JSON.parse(await readFile(path.join(root,path.basename(file.localUrl)),'utf8')).map(row=>({...row,dt:new Date(row.dt)}))}
 const [pecas,oficina]=await Promise.all([load('Pecas'),load('Oficina')])
 const row=seed.localDataset.summary.months[mes]
 assert.equal(pecas.length,row.pecas.input);assert.equal(oficina.length,row.oficina.input)
 const ranking=buildRanking(pecas,oficina,mes,colabs,metas,{},0,0,{},regras[mes].comissao,regras[mes].gestao)
 assert.ok(ranking.length>0);assert.ok(ranking.every(person=>Number.isFinite(person.tp)&&Number.isFinite(person.moreal)))
 assert.ok(ranking.every(person=>!person.mp&&!person.mo&&!person.mpo))
 const stock=JSON.parse(await readFile(path.join(root,`estoque-${mes.replace('/','-')}.json`),'utf8'))
 assert.equal(stock.itens.length,row.estoque.input);assert.ok(stock.itens.every(item=>item.loja))
 report.push({mes,pecas:pecas.length,oficina:oficina.length,estoque:stock.itens.length,pessoasComMovimento:ranking.filter(p=>p.tp||p.moreal||p.pocoficina).length,vendasPecas:Math.round(ranking.reduce((s,p)=>s+p.tp,0)*100)/100})
}
console.log(JSON.stringify({validated:true,localStorageBytes:memory.get('private-test').length,months:report},null,2))
