import test from 'node:test'
import assert from 'node:assert/strict'
import {normalize,aggregate,analyze,validateGeo} from '../src/bi/model.js'
test('Filtros de fonte e loja mantêm as somas corretas',()=>{
 const rows=[...normalize([{responsavel:'Ana',empresa:'A',valor:100},{responsavel:'Ana',empresa:'B',valor:80}]),...normalize([{consultor:'Ana',empresa:'A',mo:40}],true)]
 assert.equal(aggregate(rows,{dimension:'person',metric:'value',store:'A',source:'pieces'})[0].value,100)
 assert.equal(aggregate(rows,{dimension:'person',metric:'value',source:'services'})[0].value,40)
})
test('Inclui meta sem vendas e limita somente após ordenar por atingimento',()=>{
 const rows=normalize([{responsavel:'Ana',valor:100,cat:'WEB'},{responsavel:'Bia',valor:200,cat:'WEB'}])
 const targets=[{name:'Ana',meta:100,channel:'WEB'},{name:'Bia',meta:1000,channel:'WEB'},{name:'Caio',meta:300,channel:'WEB'}]
 assert.equal(analyze(rows,{dimension:'person',metric:'value',sort:'achievement',limit:1},targets)[0].name,'Ana')
 const all=analyze(rows,{dimension:'person',metric:'value'},targets)
 assert.equal(all.find(r=>r.name==='Caio').value,0)
 assert.equal(all.reduce((s,r)=>s+r.meta,0),1400)
 assert.equal(analyze(rows,{dimension:'person',metric:'value',channel:'ATACADO'},targets).length,0)
 assert.equal(analyze(rows,{dimension:'person',metric:'value',source:'pieces'},targets)[0].meta,0)
})
test('Mapa rejeita nomes duplicados e polígonos abertos',()=>{
 const f={properties:{name:'Maceió'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}
 assert.throws(()=>validateGeo({type:'FeatureCollection',features:[f,{...f,properties:{name:'MACEIO'}}]}),/único/)
 assert.throws(()=>validateGeo({type:'FeatureCollection',features:[{...f,geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1]]]}}]}),/fechados/)
 assert.throws(()=>validateGeo(null))
})
test('Variações de maiúsculas e acentos não duplicam a meta da pessoa',()=>{
 const rows=normalize([{responsavel:'José',valor:100},{responsavel:'JOSE',valor:50}])
 const data=analyze(rows,{dimension:'person',metric:'value'},[{name:'José',meta:200,channel:'WEB'}])
 assert.equal(data.length,1)
 assert.equal(data[0].value,150)
 assert.equal(data[0].meta,200)
})
