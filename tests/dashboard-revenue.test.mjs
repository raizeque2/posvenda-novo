import test from 'node:test'
import assert from 'node:assert/strict'
import {normalize,aggregate,analyze,upgradeBiProfiles} from '../src/bi/model.js'
import {DASHBOARD_CHANNELS,matchesChannel,kpiSummary,kpiBreakdown,dailyRevenueRows} from '../src/bi/revenue.js'
import {kpiInsights} from '../src/bi/kpiInsights.js'
import {aggregateCityPoints,matchMunicipality} from '../src/bi/territory.js'
import {BRAZIL_BOUNDS,compactMapRows,geometryCenter,projectPoints,projectRings} from '../src/bi/mapGeometry.js'
import {tooltipPosition} from '../src/bi/tooltipPosition.js'

const pieces=[{cat:'VAREJO',valor:100,responsavel:'ANA',Mercadoria:'Filtro',Quantidade:'2'},{cat:'WEB',valor:80,responsavel:'MERCADO LIVRE VENDEDOR',Mercadoria:'Óleo',Quantidade:'3'},{cat:'OFICINA',valor:30,responsavel:'BIA'},{cat:'OFICINA_GAR',valor:20,responsavel:'BIA'},{cat:'OFICINA_INT',valor:500},{cat:'COMPRA',valor:900},{cat:'TRANSF',valor:400},{cat:'SAIDA',valor:200}]
test('sete blocos têm ordem fixa e total de peças não inclui compras, transferências, internas ou M.O',()=>{
 assert.deepEqual(DASHBOARD_CHANNELS,['VAREJO','WEB','TELEVENDAS','ATACADO','PEÇAS OS','TOTAL PEÇAS','MÃO DE OBRA'])
 const rows=[...normalize(pieces),...normalize([{mo:40,consultor:'BIA'}],true)]
 const totals=kpiSummary(rows,[])
 assert.equal(totals['PEÇAS OS'].value,50);assert.equal(totals['TOTAL PEÇAS'].value,230);assert.equal(totals['MÃO DE OBRA'].value,40)
 assert.equal(rows.length,5)
 const share=aggregate(rows,{dimension:'channel',metric:'value',limit:20})
 assert.equal(share.reduce((sum,r)=>sum+r.value,0),270)
 assert.ok(!share.some(r=>r.name==='TOTAL PEÇAS'))
 assert.equal(share.find(r=>r.name==='PEÇAS OS').value,50)
})
test('Mercadoria do CSV é identificada e conta virtual sai só da equipe, mantendo a receita web',()=>{
 const rows=normalize(pieces)
 assert.equal(aggregate(rows,{dimension:'product',metric:'quantity'})[0].name,'Óleo')
 assert.equal(aggregate(rows,{dimension:'product',metric:'quantity'})[0].value,3)
 assert.ok(!analyze(rows,{dimension:'person',metric:'value'}).some(r=>/MERCADO LIVRE/.test(r.name)))
 assert.equal(aggregate(rows,{dimension:'channel',metric:'value'}).find(r=>r.name==='WEB').value,80)
})
test('agrupamento de meta e detalhes de O.S. preserva metas e não duplica canais',()=>{
 const rows=normalize(pieces),targets=[{name:'Ana',channel:'VAREJO',meta:200},{name:'Bia',channel:'OFICINA',meta:100},{name:'Bia',channel:'SERVIÇOS',meta:300}]
 const totals=kpiSummary(rows,targets)
 assert.equal(totals['TOTAL PEÇAS'].target,300);assert.equal(totals['MÃO DE OBRA'].target,300)
 assert.equal(kpiBreakdown(rows,'PEÇAS OS').reduce((sum,r)=>sum+r.value,0),50)
 assert.ok(matchesChannel({source:'services',channel:'SERVIÇOS'},'MÃO DE OBRA'))
})
test('mapa agrega registros uma vez e separa cidades homônimas por UF',()=>{
 let reads=0
 const rows=Array.from({length:100},(_,i)=>({get city(){reads++;return 'Bom Jardim'},uf:i%2?'PE':'RJ',value:1,channel:'WEB'}))
 const index=[['Bom Jardim','PE',1],['Bom Jardim','RJ',2]]
 const centers=new Map([[1,[-35.6,-7.9]],[2,[-43.2,-22.9]]])
 const result=aggregateCityPoints(rows,index,centers)
 assert.equal(result.find(f=>f.id===1).value,50);assert.equal(result.find(f=>f.id===2).value,50)
 // Uma leitura por registro: não cresce com o número de municípios da malha.
 assert.ok(reads<=rows.length)
 assert.equal(result.find(f=>f.id===1).uf,'PE')
 assert.equal(matchMunicipality({city:'BOM JARDIM',uf:''},index),null)
})
test('mapa compacto mantém totais e projeta um ponto por cidade com venda',()=>{
 const rows=[{city:'Recife',uf:'PE',region:'Capital',source:'pieces',value:100},{city:'Recife',uf:'PE',region:'Capital',source:'pieces',value:20},{city:'Olinda',uf:'PE',region:'Metropolitana',source:'services',value:30}]
 const compact=compactMapRows(rows)
 assert.equal(compact.length,2)
 assert.deepEqual(compact.find(row=>row.city==='Recife'),{city:'Recife',uf:'PE',region:'Capital',source:'pieces',value:120,recordCount:2})
 const index=[['Recife','PE',2611606],['Olinda','PE',2609600]]
 const centers=new Map([[2611606,[-34.88,-8.05]],[2609600,[-34.85,-7.99]]])
 const points=aggregateCityPoints(compact,index,centers)
 assert.equal(points.length,2)
 const result=projectPoints(points,BRAZIL_BOUNDS)
 assert.equal(result.points.length,2)
 assert.deepEqual(result.context,{x:0,y:0,width:640,height:370})
 for(const point of result.points){assert.ok(point.x>0&&point.x<640);assert.ok(point.y>0&&point.y<370)}
 // Mapa importado continua funcionando: o ponto é o centro da geometria da região.
 const geometry={type:'Polygon',coordinates:[[[-35,-8],[-34.9,-8],[-34.9,-8.1],[-35,-8.1],[-35,-8]]]}
 assert.deepEqual(geometryCenter(geometry),[-34.95,-8.05])
})
test('contorno do país usa a mesma projeção dos pontos de calor',()=>{
 // Sem malha municipal: o fundo é um único contorno, projetado junto com os pontos.
 const rings=projectRings([[[-74,-34],[-34,-34],[-34,6],[-74,6]]],BRAZIL_BOUNDS)
 assert.equal(rings.length,1)
 assert.equal(rings[0].length,4)
 const [[x1,y1],[x2,y2],[,y3]]=rings[0]
 assert.ok(x1>=0&&x2<=640&&y1>=0&&y3<=370)
 // Aresta de baixo, da esquerda para a direita; o topo fica acima dela.
 assert.ok(x1<x2&&Math.abs(y1-y2)<0.5)
 assert.ok(y3<y1)
 assert.deepEqual(projectRings([],BRAZIL_BOUNDS),[])
})
test('tooltip flutuante fica dentro da janela quando o gráfico encosta na borda',()=>{
 assert.deepEqual(tooltipPosition(990,10,180,80,1100,700),{left:800,top:10})
 assert.deepEqual(tooltipPosition(0,0,180,80,1100,700),{left:10,top:8})
})
test('perfil antigo corrige o gráfico padrão de peças sem sobrescrever gráficos personalizados',()=>{
 const state={profiles:[{id:'overview',desktop:[{id:'parts',title:'Peças mais vendidas',metric:'value'},{id:'custom',title:'Meu gráfico',metric:'value'}],mobile:null}]}
 const next=upgradeBiProfiles(state)
 assert.equal(next.profiles[0].desktop[0].metric,'quantity');assert.equal(next.profiles[0].desktop[0].source,'pieces')
 assert.deepEqual(next.profiles[0].desktop[1],state.profiles[0].desktop[1])
 assert.deepEqual(upgradeBiProfiles(next),next)
})
test('compactação diária preserva comparativos de receita, registros e quantidades',()=>{
 const data=normalize([{dt:'2026-10-01T12:00:00',cat:'VAREJO',valor:10,quantidade:2},{dt:'2026-10-07T12:00:00',cat:'VAREJO',valor:20,quantidade:3},{dt:'2026-10-08T12:00:00',cat:'VAREJO',valor:30},{dt:'2026-10-08T12:00:00',cat:'VAREJO',valor:40,quantidade:4}])
 const history=normalize([{dt:'2026-09-01T12:00:00',cat:'VAREJO',valor:10,quantidade:1},{dt:'2026-09-08T12:00:00',cat:'VAREJO',valor:20,quantidade:2}])
 for(const metric of ['value','records','quantity'])assert.deepEqual(kpiInsights(dailyRevenueRows(data),dailyRevenueRows(history),'VAREJO',metric),kpiInsights(data,history,'VAREJO',metric))
})
