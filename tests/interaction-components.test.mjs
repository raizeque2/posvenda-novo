import test from 'node:test'
import assert from 'node:assert/strict'
import { siteActions, searchActions } from '../src/data/siteActions.js'
import { activityPeriods } from '../src/analytics/activity.js'

test('busca ignora acentos, filtra permissões e não trata perguntas como navegação', () => {
  const admin = siteActions('admin')
  assert.equal(searchActions(admin, 'comissao')[0].path, '/comissoes')
  assert.equal(searchActions(admin, 'abrir estoque')[0].path, '/estoque')
  assert.equal(searchActions(admin, 'como foram as vendas deste mês?').length, 0)
  assert.equal(siteActions('operacional', { operacional: ['/desempenho'] }).some(a => a.path === '/upload'), false)
  assert.equal(searchActions(siteActions('supervisor', { supervisor: [] }), 'metas').length, 0)
})
test('anéis mostram mês, semana e dia; previsão mensal é da mesma pessoa e não vira realizado', () => {
  const date=new Date(2026,9,10)
  const calendar=Array.from({length:31},(_,i)=>({day:i+1,date:new Date(2026,9,i+1),amount:i+1===10?30:0,observed:i+1<=10}))
  const d={ month:'10/2026',target:1000,total:20,elapsed:5.5,cutoff:date,limit:10,real:300,projection:1200,holidays:[],calendar }
  const [month,week,day]=activityPeriods(d)
  assert.deepEqual([month.id,week.id,day.id],['month','week','day'])
  assert.equal(day.target,25);assert.equal(day.current,30);assert.equal(day.percent,120)
  assert.equal(week.target,275);assert.equal(week.current,30)
  assert.equal(month.target,1000);assert.equal(month.current,300);assert.equal(month.projection,1200);assert.equal(month.projectionPercent,120)
  assert.equal(activityPeriods({...d,cutoff:null})[0].percent,null)
  assert.equal(activityPeriods({...d,target:0})[0].percent,null)
  assert.equal(activityPeriods(d,20)[2].percent,null)
  assert.equal(activityPeriods({...d,projection:null})[0].projection,null)
  // A week crossing a month boundary uses only this month's target days.
  const firstWeek=activityPeriods(d,3)[1]
  assert.equal(firstWeek.target,125)
  const holiday=activityPeriods({...d,holidays:[new Date(2026,9,9)]})[1]
  assert.equal(holiday.target,225)
})
