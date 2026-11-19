import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { newConversation, beginTurn, finishTurn, groupConversations, safeChatHref } from '../src/assistant/conversations.js'

test('Resposta atrasada fica na conversa de origem e mantém o agente real', () => {
  let chats = [newConversation(10, 'a'), newConversation(20, 'b')]
  chats = beginTurn(chats, 'a', { id: 'q', role: 'user', text: 'Resumo do dia' }, { id: 'r', role: 'assistant', provider: 'claude', status: 'pending' }, 30)
  chats = finishTurn(chats, 'a', 'r', { text: 'Receita do dia', provider: 'openai', status: 'complete' }, 40)
  assert.equal(chats[1].messages.length, 0)
  assert.equal(chats[0].messages[1].provider, 'claude')
  assert.equal(chats[0].title, 'Resumo do dia')
  assert.equal(finishTurn(chats.filter(c => c.id !== 'a'), 'a', 'r', { text: 'Tarde demais' }).length, 1)
})

test('Editar e reenviar remove somente o ramo posterior da conversa escolhida', () => {
  const chats = [{ ...newConversation(10, 'a'), messages: [{ id: 'q1', role: 'user', text: 'Original' }, { id: 'r1', role: 'assistant', provider: 'local' }] }, newConversation(20, 'b')]
  const changed = beginTurn(chats, 'a', { id: 'q2', role: 'user', text: 'Editada' }, { id: 'r2', role: 'assistant', provider: 'openai', status: 'pending' }, 30, 0)
  assert.deepEqual(changed[0].messages.map(m => m.id), ['q2', 'r2'])
  assert.deepEqual(chats[0].messages.map(m => m.id), ['q1', 'r1'])
  assert.equal(changed[1], chats[1])
})

test('Histórico agrupa pelo dia do Brasil e busca ignora acentos', () => {
  const now = Date.parse('2026-10-14T05:00:00Z')
  const chats = [newConversation(now, 'today'), { ...newConversation(Date.parse('2026-10-14T01:00:00Z'), 'yesterday'), title: 'Atenção às metas' }, newConversation(Date.parse('2026-10-01T12:00:00Z'), 'old')]
  assert.deepEqual(groupConversations(chats, '', now).map(g => [g.label, g.items.map(c => c.id)]), [['Hoje', ['today']], ['Últimos 7 dias', ['yesterday']], ['Anteriores', ['old']]])
  assert.equal(groupConversations(chats, 'atencao', now)[0].items[0].id, 'yesterday')
})

test('Markdown suporta tabela sem executar HTML, carregar imagens ou links inseguros', () => {
  const text = '| Pessoa | Receita |\n| --- | ---: |\n| Ana | R$ 100 |\n\n<script>alert(1)</script>\n\n[perigoso](javascript:alert%281%29) ![imagem](https://example.com/track)'
  const html = renderToStaticMarkup(React.createElement(Markdown, { remarkPlugins: [remarkGfm], skipHtml: true, disallowedElements: ['img'], urlTransform: safeChatHref }, text))
  assert.match(html, /<table>/)
  assert.doesNotMatch(html, /<script|<img|javascript:/)
  for (const url of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'data:text/html,x']) assert.equal(safeChatHref(url), '')
  assert.equal(safeChatHref('/metas'), '/metas')
  assert.equal(safeChatHref('https://example.com'), 'https://example.com')
})
