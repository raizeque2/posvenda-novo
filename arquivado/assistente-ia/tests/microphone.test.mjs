import test from 'node:test'
import assert from 'node:assert/strict'
import { monitorMicrophone } from '../src/assistant/microphone.js'

test('cancelar antes da permissão resolver libera o microfone e não inicia o analisador', async () => {
  let resolve, stopped = 0, created = 0
  const capture = monitorMicrophone({ mediaDevices: { getUserMedia: () => new Promise(done => { resolve = done }) }, AudioContext: class { constructor() { created++ } }, onLevels: () => assert.fail('Sessão cancelada'), requestFrame: () => assert.fail('Sessão cancelada'), cancelFrame: () => {} })
  capture.stop()
  resolve({ getTracks: () => [{ stop: () => stopped++ }] })
  await new Promise(done => setImmediate(done))
  assert.equal(stopped, 1); assert.equal(created, 0)
})

test('ondas refletem amostras do microfone e parar libera áudio e frames', async () => {
  let draw, stopped = 0, closed = 0, cancelled, loud = false
  const levels = []
  class AudioContext {
    state = 'running'
    async resume() {}
    createMediaStreamSource() { return { connect() {} } }
    createAnalyser() { return { fftSize: 256, getByteTimeDomainData(samples) { samples.fill(loud ? 160 : 128) } } }
    async close() { closed++; this.state = 'closed' }
  }
  const capture = monitorMicrophone({ mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stopped++ }] }) }, AudioContext, onLevels: value => levels.push(value), requestFrame: callback => { draw = callback; return 42 }, cancelFrame: id => { cancelled = id } })
  await new Promise(done => setImmediate(done))
  draw(100); loud = true; draw(200)
  assert.ok(levels[0].every(value => value === 0))
  assert.ok(levels[1].every(value => value > 0))
  capture.stop(); draw(300)
  assert.equal(levels.length, 2); assert.equal(stopped, 1); assert.equal(closed, 1); assert.equal(cancelled, 42)
})
