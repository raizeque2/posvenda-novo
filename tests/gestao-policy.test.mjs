import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGestaoComissao } from '../src/services/ranking/buildGestaoComissao.js'
import { validateGestaoPolicy, applyGestaoPolicy } from '../src/services/ranking/gestaoPolicy.js'

const person={nome:'Ana',supervisor:'Bruno',tp:950,mp:1000,moreal:190,mo:200,varejo:400,devVarejo:20,metaVarejo:400}
const cfg={colaborador:'Bruno',canaisBase:['tp'],comissao:.01,bonificacao:.02,indicadores:[{chave:'mo',nome:'M.O',tipo:'auto',autoKey:'pctMO',threshold:.95,pct:.01},{chave:'tsi',nome:'TSI',tipo:'valor',operador:'gte',threshold:90,pct:.01}]}
test('95% libera todos os bônus; abaixo bloqueia inclusive extra, sem cortar comissão',()=>{
 const rule={...cfg,bonusMinimo:.95};const manual={BRUNO:{tsi:90,bonusExtra:25}}
 const [ok]=buildGestaoComissao([person],[rule],manual)
 assert.equal(ok.bonusLiberado,true);assert.equal(ok.bonificacao,19);assert.equal(ok.bonusExtra,25);assert.equal(ok.bonusIndicadores,19)
 const [no]=buildGestaoComissao([{...person,tp:949}],[rule],manual)
 assert.equal(no.bonusLiberado,false);assert.equal(no.bonificacao,0);assert.equal(no.bonusExtra,0);assert.equal(no.bonusIndicadores,0);assert.equal(no.total,9.49)
})
test('sem meta não libera bônus condicionado; sem condição preserva cálculo antigo',()=>{
 assert.equal(buildGestaoComissao([{...person,mp:0}],[{...cfg,bonusMinimo:.95}])[0].bonusLiberado,false)
 assert.equal(buildGestaoComissao([person],[cfg])[0].bonificacao,19)
})
test('metas específicas e varejo líquido alimentam indicador automático',()=>{
 const [g]=buildGestaoComissao([person],[{...cfg,metasCanais:{tp:2000,varejo:500},indicadores:[{chave:'varejo',nome:'Varejo',tipo:'auto',autoKey:'pctVarejo',threshold:.75,pct:.01}]}])
 assert.equal(g.metaPorCanal.tp,2000);assert.equal(g.pctFaturamento,.475);assert.equal(g.pctVarejo,.76);assert.equal(g.indicadores[0].atingido,true)
})
test('comparação numérica aceita zero, limites exatos e não trata booleano como medição',()=>{
 const rule={...cfg,indicadores:[{chave:'dias',nome:'Dias',tipo:'valor',operador:'lt',threshold:48,pct:.01},{chave:'pend',nome:'Pendências',tipo:'valor',operador:'lte',threshold:0,pct:.01}]}
 const [g]=buildGestaoComissao([person],[rule],{BRUNO:{dias:48,pend:0}})
 assert.equal(g.indicadores[0].atingido,false);assert.equal(g.indicadores[1].atingido,true)
 assert.equal(buildGestaoComissao([person],[rule],{BRUNO:{pend:false}})[0].indicadores[1].atingido,false)
})
test('regra salva altera só pessoa e mês escolhidos e detecta edição concorrente',()=>{
 const other={...cfg,colaborador:'Carla'},rules={'10/2026':{gestao:[cfg,other]},'11/2026':{gestao:[cfg]}}
 const next=applyGestaoPolicy(rules,'10/2026','Bruno',cfg,{...cfg,bonusMinimo:.95})
 assert.equal(next['10/2026'].gestao[0].bonusMinimo,.95);assert.deepEqual(next['10/2026'].gestao[1],other);assert.deepEqual(next['11/2026'],rules['11/2026'])
 assert.throws(()=>applyGestaoPolicy(next,'10/2026','Bruno',cfg,cfg),/alterada/)
})
test('validação rejeita percentuais inválidos, indicadores duplicados e canais sobrepostos',()=>{
 assert.throws(()=>validateGestaoPolicy({...cfg,comissao:-1}))
 assert.throws(()=>validateGestaoPolicy({...cfg,canaisBase:['tp','varejo']}))
 assert.throws(()=>validateGestaoPolicy({...cfg,indicadores:[cfg.indicadores[0],cfg.indicadores[0]]}))
 assert.throws(()=>validateGestaoPolicy({...cfg,bonusMinimo:NaN}))
 assert.throws(()=>validateGestaoPolicy({...cfg,metasCanais:{mo:-1}}))
 assert.doesNotThrow(()=>validateGestaoPolicy({...cfg,bonusMinimo:0}))
})
test('bônus próprios também são bloqueados e os valores manuais permanecem informados',()=>{
 const proprio={nome:'Bruno',tp:100,mp:200,moreal:50,mo:100}
 const rule={...cfg,baseCalculo:'equipe_mais_propria',bonusMoPropria:.1,bonusPecasProprias:.1,bonusMinimo:.95}
 const [g]=buildGestaoComissao([person,proprio],[rule],{BRUNO:{bonusExtra:40,comissaoExtra:20}})
 assert.equal(g.bonusLiberado,false);assert.equal(g.bonusMoPropria,0);assert.equal(g.bonusPecasProprias,0);assert.equal(g.bonusExtraInformado,40);assert.equal(g.comissao,30.5)
})
test('recalcular acima da meta recupera o bônus extra sem precisar informá-lo novamente',()=>{
 const manual={BRUNO:{bonusExtra:45}},rule={...cfg,bonusMinimo:.95}
 assert.equal(buildGestaoComissao([{...person,tp:900}],[rule],manual)[0].bonusExtra,0)
 assert.equal(buildGestaoComissao([person],[rule],manual)[0].bonusExtra,45)
 assert.equal(manual.BRUNO.bonusExtra,45)
})
test('metas de canal usam os nomes do ranking e não repetem a meta total',()=>{
 const [g]=buildGestaoComissao([{...person,web:100,metaWeb:250,televendas:50,metaTelevendas:100}],[{...cfg,canaisBase:['web','televendas']}])
 assert.equal(g.metaBase,350);assert.equal(g.fatBase,150)
})
