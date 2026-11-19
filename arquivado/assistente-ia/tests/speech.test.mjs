import test from 'node:test'
import assert from 'node:assert/strict'
import { startDictation, appendDictation } from '../src/assistant/speech.js'

function fixture() {
  let recognizer
  const texts = [], errors = []
  let ended = 0
  class Recognition {
    constructor() { recognizer = this }
    start() { this.started = true }
    stop() { this.stopped = true }
    abort() { this.aborted = true }
  }
  const session = startDictation(Recognition, { onText: t => texts.push(t), onError: e => errors.push(e), onEnd: () => ended++ })
  return { session, recognizer, texts, errors, ended: () => ended }
}
test('ditado contínuo entrega transcrição parcial e revisa sem duplicar palavras', () => {
  const f = fixture()
  assert.equal(f.recognizer.lang, 'pt-BR')
  assert.equal(f.recognizer.continuous, true)
  assert.equal(f.recognizer.interimResults, true)
  f.recognizer.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'parcial' }], { isFinal: false })] })
  assert.deepEqual(f.texts, ['parcial'])
  f.recognizer.onresult({ resultIndex: 1, results: [Object.assign([{ transcript: 'anterior' }], { isFinal: true }), Object.assign([{ transcript: 'Quem mais vendeu?' }], { isFinal: true })] })
  assert.deepEqual(f.texts, ['parcial', 'anterior Quem mais vendeu?'])
  f.recognizer.onresult({ resultIndex: 1, results: [Object.assign([{ transcript: 'anterior' }], { isFinal: true }), Object.assign([{ transcript: 'Quem mais vendeu neste mês?' }], { isFinal: false })] })
  assert.equal(f.texts.at(-1), 'anterior Quem mais vendeu neste mês?')
  f.session.stop()
  assert.equal(f.recognizer.stopped, true)
  const end = f.recognizer.onend
  end()
  end()
  assert.equal(f.ended(), 1)
})
test('fechar ou trocar de página cancela captura e ignora resultados atrasados', () => {
  const f = fixture(), lateResult = f.recognizer.onresult
  f.session.abort()
  lateResult({ resultIndex: 0, results: [Object.assign([{ transcript: 'altere a meta' }], { isFinal: true })] })
  assert.equal(f.recognizer.aborted, true)
  assert.deepEqual(f.texts, [])
  assert.equal(f.recognizer.onresult, null)
  assert.equal(f.ended(), 1)
})
test('permissão negada encerra a captura com orientação de alternativa por texto', () => {
  const f = fixture()
  const end = f.recognizer.onend
  f.recognizer.onerror({ error: 'not-allowed' })
  end()
  assert.match(f.errors[0], /negado.*texto/)
  assert.equal(f.recognizer.aborted, true)
  assert.equal(f.ended(), 1)
})
test('ditado preserva o rascunho e limita o campo a 2000 caracteres', () => {
  assert.equal(appendDictation('Resumo: ', ' vendas de hoje '), 'Resumo: vendas de hoje')
  assert.equal(appendDictation('x'.repeat(1998), 'uma pergunta').length, 2000)
})
