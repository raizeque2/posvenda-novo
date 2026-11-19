import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const firebase = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'))
const csp = firebase.hosting.headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value
const diretiva = nome => csp.split(';').map(s => s.trim()).find(s => s.startsWith(nome + ' ')) || ''

test('CSP libera o script de tema embutido por hash (sem unsafe-inline) e o Turnstile', () => {
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])
  for (const script of inline) {
    const hash = `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`
    assert.ok(diretiva('script-src').includes(hash), `index.html mudou: atualize o hash ${hash} na CSP do firebase.json`)
  }
  assert.ok(!diretiva('script-src').includes("'unsafe-inline'"))
  assert.ok(diretiva('script-src').includes('https://challenges.cloudflare.com'))
  assert.ok(diretiva('frame-src').includes('https://challenges.cloudflare.com'))
})

test('Segredo do Turnstile não aparece no frontend nem em arquivos versionados', () => {
  for (const file of ['../src/components/auth/Turnstile.jsx', '../src/services/authService.js', '../functions/src/turnstile.js']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(!/0x4AAAAAA[\w-]{10,}_[\w-]{20,}/.test(src), `${file} parece conter uma chave secreta`)
    assert.ok(!/TURNSTILE_SECRET\s*=\s*['"]/.test(src), `${file} não deve atribuir o segredo em código`)
  }
})
