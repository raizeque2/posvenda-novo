import test from 'node:test'
import assert from 'node:assert/strict'
import {parseFolha,prepareFolha} from '../src/services/processamento/folha.js'
import {buildRanking} from '../src/services/ranking/buildRanking.js'
import {readFileSync} from 'node:fs'
const mes='10/2026'
const cadastro={[mes]:{'ANA COSTA':{colaborador:'ANA COSTA',loja:'ARA',cargo:'VENDEDOR DE PECAS',cargo_movimento:'VAREJO',salario_base:2000,supervisor:'BRUNO',ativo:true},BIA:{colaborador:'BIA',loja:'ARA'}}}
const metas={[mes]:{'ANA COSTA':{colaborador:'ANA COSTA',loja:'ARA',salario_base:2000,metas:{VAREJO:{mp:1000},WEB:{mp:500}},comissaoOverrides:{cp:.02}}},'09/2026':{Ana:{mp:99}}}
test('CSV português aceita dinheiro BR e atualiza salário e meta sem remover colegas ou outros meses',()=>{
 const parsed=parseFolha('Nome;Salário base;Meta Varejo\nAna Costa;R$ 2.500,50;3.000,00')
 const plan=prepareFolha(parsed.rows,mes,cadastro,metas)
 assert.equal(plan.colaboradores[mes]['ANA COSTA'].salario_base,2500.5)
 assert.equal(plan.metas[mes]['ANA COSTA'].metas.VAREJO.mp,3000)
 assert.equal(plan.metas[mes]['ANA COSTA'].metas.WEB.mp,500)
 assert.equal(plan.metas[mes]['ANA COSTA'].comissaoOverrides.cp,.02)
 assert.deepEqual(plan.colaboradores[mes].BIA,cadastro[mes].BIA)
 assert.deepEqual(plan.metas['09/2026'],metas['09/2026'])
 const r=buildRanking([],[],mes,plan.colaboradores,plan.metas).find(r=>r.nome==='ANA COSTA')
 assert.equal(r.mp,3000)
})
test('vazio preserva; zero explícito zera a meta; cadastro ausente no CSV não é desativado',()=>{
 const plan=prepareFolha(parseFolha('nome;salario_base;meta_varejo\nANA COSTA;;0').rows,mes,cadastro,metas)
 assert.equal(plan.colaboradores[mes]['ANA COSTA'].salario_base,2000)
 assert.equal(plan.metas[mes]['ANA COSTA'].metas.VAREJO.mp,0)
 assert.equal(plan.colaboradores[mes]['ANA COSTA'].supervisor,'BRUNO')
})
test('novos funcionários exigem loja; M.O e OS alimentam metas reais',()=>{
 const rows=parseFolha('nome;loja;meta_mo;meta_pecas_os;salario_base\nCARLA;ARA;12000;9000;2200').rows
 const plan=prepareFolha(rows,mes,cadastro,metas)
 assert.equal(plan.colaboradores[mes].CARLA.cargo_movimento,'OS')
 const r=buildRanking([],[],mes,plan.colaboradores,plan.metas).find(r=>r.nome==='CARLA')
 assert.equal(r.mo,12000);assert.equal(r.mpo,9000)
 assert.throws(()=>prepareFolha(parseFolha('nome;salario_base\nCARLA;2000').rows,mes,cadastro,metas),/loja/i)
})
test('rejeita números inválidos, duplicatas, competências diferentes e meta genérica ambígua',()=>{
 assert.throws(()=>parseFolha('nome;meta_mo\nANA;abc'),/valor/i)
 assert.throws(()=>parseFolha('nome;salario_base\nANA;-10'),/valor/i)
 assert.throws(()=>parseFolha('nome;loja\nAna;ARA\nÁna;ARA'),/repetido/i)
 assert.throws(()=>parseFolha('nome;competencia\nAna;10/2026\nBia;11/2026'),/competência/i)
 assert.throws(()=>prepareFolha(parseFolha('nome;meta_pecas;setor\nANA COSTA;2000;"VAREJO;WEB"').rows,mes,cadastro,metas),/canal/i)
})
test('CSV com vírgulas e nomes acentuados não duplica o cadastro',()=>{
 const rows=parseFolha('Funcionário,Loja,Meta M.O\n"Ána Costa",ARA,100').rows
 const plan=prepareFolha(rows,mes,cadastro,metas)
 assert.equal(Object.keys(plan.colaboradores[mes]).length,2)
 assert.equal(plan.metas[mes]['ANA COSTA'].metas.OS.mo,100)
})
test('arquivo cadastral comum preserva todas as metas, salário omitido e ativos',()=>{
 const rows=parseFolha('nome;loja;cargo;centro_custo\nANA COSTA;ARA;VENDEDOR;PEÇAS').rows
 const plan=prepareFolha(rows,mes,cadastro,metas)
 assert.equal(plan.metas[mes]['ANA COSTA'].metas.VAREJO.mp,1000)
 assert.equal(plan.colaboradores[mes]['ANA COSTA'].salario_base,2000)
 assert.equal(plan.colaboradores[mes]['ANA COSTA'].ativo,true)
})
test('cadastro legado apenas em metas é preservado e não duplica a pessoa',()=>{
 const legacy={[mes]:{'ANA COSTA':{colaborador:'ANA COSTA',loja:'ARA',cargo_movimento:'VAREJO',salario_base:2000,mp:1000}}}
 const plan=prepareFolha(parseFolha('nome;meta_varejo\nAna Costa;1500').rows,mes,{},legacy)
 assert.equal(plan.colaboradores[mes]['ANA COSTA'].salario_base,2000)
 assert.equal(plan.colaboradores[mes]['ANA COSTA'].loja,'ARA')
 assert.equal(plan.metas[mes]['ANA COSTA'].metas.VAREJO.mp,1500)
})
test('modelo CSV fornecido é aceito e metas de cada setor chegam ao ranking',()=>{
 const text=readFileSync(new URL('../public/modelos/folha-pessoal.csv',import.meta.url),'utf8')
 const parsed=parseFolha(text),plan=prepareFolha(parsed.rows,mes,{},{})
 const ranking=buildRanking([],[],mes,plan.colaboradores,plan.metas)
 assert.equal(ranking.find(r=>r.nome.includes('PECAS')).mp,40000)
 assert.equal(ranking.find(r=>r.nome.includes('OFICINA')).mo,30000)
})
