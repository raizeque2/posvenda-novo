import { podeAcessar,normalizePermissions } from '../src/data/permissoes.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { homeSummary,localAnswer } from '../src/analytics/home.js'
const month='10/2026',now=new Date(2026,9,9,17)
const people={ANA:{colaborador:'ANA COSTA',cargo_movimento:'VAREJO',loja:'ARA',ativo:true},BIA:{colaborador:'BIA',cargo_movimento:'WEB',loja:'PEI',ativo:true}}
const state={pecasPorMes:{[month]:[{dt:now,responsavel:'ANA COSTA',cat:'VAREJO',empresa:'ARA',valor:100},{dt:now,responsavel:'ANA COSTA',cat:'VAREJO',empresa:'ARA',valor:20,eDevolucao:true},{dt:now,responsavel:'BIA',cat:'WEB',empresa:'PEI',valor:900}]},oficinaPorMes:{[month]:[{dt:now,empresa:'ARA',consultor:'Elisa',tecnico:'Felipe',mo:300}]},colaboradoresPorMes:{[month]:{'ANA COSTA':people.ANA,BIA:people.BIA}},metasPorMes:{[month]:{'ANA COSTA':{colaborador:'ANA COSTA',metas:{VAREJO:{mp:200}}}}},apelidoMap:{},regras:{},comissaoGestao:[],lojas:{}}
test('Resumo soma MO uma vez e desconta devoluções',()=>{const s=homeSummary(state,{full:true,now});assert.equal(s.revenue,1280);assert.equal(s.top[0].name,'BIA')})
test('Lista de pessoas com movimento corresponde ao card e inclui movimentação líquida zero',()=>{const s=homeSummary({...state,pecasPorMes:{[month]:[{dt:now,responsavel:'ANA COSTA',cat:'VAREJO',empresa:'ARA',valor:100},{dt:now,responsavel:'ANA COSTA',cat:'VAREJO',empresa:'ARA',valor:100,eDevolucao:true}]}},{full:true,now});assert.equal(s.people,s.moving.length);assert.ok(s.moving.some(person=>person.nome==='ANA COSTA'));assert.ok(!s.moving.some(person=>person.nome==='BIA'))})
test('Home operacional e consulta local não expõem ranking de outros',()=>{const s=homeSummary(state,{name:'ANA COSTA',full:false,now});assert.equal(s.revenue,80);assert.equal(s.top.length,1);assert(!localAnswer('quem vende mais',s).text.includes('BIA'))})
test('Recorte autorizado por UF não inclui vendas PE',()=>{const s=homeSummary(state,{full:true,estados:['AL'],now});assert.equal(s.revenue,380);assert(!s.top.some(p=>p.name==='BIA'))})


test('Rotas novas preservam permissões antigas e permitem revogar dashboard',()=>{const legacy={supervisor:['/','/desempenho']};assert(podeAcessar('supervisor','/dashboard',legacy));const migrated=normalizePermissions(legacy);assert.deepEqual(migrated.supervisor,['/dashboard','/desempenho']);assert(!podeAcessar('supervisor','/dashboard',{supervisor:['/desempenho']}));assert(!podeAcessar('operacional','/'));assert(podeAcessar('admin','/'));assert(!podeAcessar('operacional','/dashboard'));assert(podeAcessar('supervisor','/perfil/Ana',legacy))})
