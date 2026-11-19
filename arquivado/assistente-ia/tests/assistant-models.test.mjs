import test from 'node:test'
import assert from 'node:assert/strict'
import { assistantModels, selectAssistantModel, assistantModelParameters } from '../functions/src/assistantModels.js'

const config={openaiEnabled:true,openaiModels:[{id:'gpt-test',name:'Modelo autorizado',thinking:['low','medium','high'],defaultThinking:'medium'},{id:'gpt-other'}],claudeEnabled:true,claudeModels:[{id:'claude-test',thinking:['low','high']}]}
test('Cliente só escolhe modelos e esforços autorizados pelo servidor',()=>{
  assert.throws(()=>selectAssistantModel(config,'openai',{model:'gpt-injected'}))
  assert.throws(()=>selectAssistantModel(config,'openai',{model:'gpt-test',thinking:'max'}))
  assert.throws(()=>selectAssistantModel({...config,openaiEnabled:false},'openai',{}))
  assert.deepEqual(selectAssistantModel(config,'openai',{model:'gpt-test',thinking:'high'}),{model:'gpt-test',thinking:'high'})
})
test('Esforço selecionado chega ao parâmetro oficial de cada provedor',()=>{
  assert.deepEqual(assistantModelParameters('openai',{thinking:'high'}),{reasoning:{effort:'high'}})
  assert.deepEqual(assistantModelParameters('claude',{thinking:'low'}),{output_config:{effort:'low'}})
  assert.deepEqual(assistantModelParameters('openai',{}),{})
})
test('Configuração antiga mantém modelo único; configurações inválidas são descartadas',()=>{
  assert.deepEqual(selectAssistantModel({openaiEnabled:true,openaiModel:'gpt-test'},'openai'),{model:'gpt-test',thinking:undefined})
  assert.equal(assistantModels({openaiEnabled:true,openaiModels:[{id:'bad model'},null,{id:'valid',thinking:['high','unknown','high']},{id:'valid'}]},'openai').length,1)
  assert.deepEqual(assistantModels(config,'unknown'),[])
})
