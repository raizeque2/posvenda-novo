export function newConversation(now = Date.now(), id = crypto.randomUUID()) {
  return { id, title: 'Nova conversa', createdAt: now, updatedAt: now, messages: [] }
}

export function beginTurn(chats, id, question, pending, now = Date.now(), replaceFrom) {
  return chats.map(chat => {
    if (chat.id !== id) return chat
    const previous = Number.isInteger(replaceFrom) ? chat.messages.slice(0, Math.max(0, replaceFrom)) : chat.messages
    return { ...chat, title: previous.length || chat.renamed ? chat.title : question.text.trim().replace(/\s+/g, ' ').slice(0, 60), updatedAt: now, messages: [...previous, question, pending] }
  })
}

export function finishTurn(chats, id, messageId, reply, now = Date.now()) {
  return chats.map(chat => chat.id !== id ? chat : { ...chat, updatedAt: now, messages: chat.messages.map(message => message.id === messageId ? { ...message, ...reply, id: message.id, role: 'assistant', provider: message.provider } : message) })
}

// Editing and retrying only carry the branch before the replaced question.
export function conversationContext(messages, replaceFrom) {
  const branch = Number.isInteger(replaceFrom) ? messages.slice(0, replaceFrom) : messages
  const complete = branch.filter(message => message.role === 'user' || message.role === 'assistant' && message.status === 'complete')
  return { history: complete.slice(-8).map(message => ({ role: message.role, text: String(message.text || '').slice(0, 2000) })), previousQuery: complete.findLast(message => message.role === 'assistant' && message.query)?.query }
}

const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
function brazilDay(value) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = type => Number(parts.find(p => p.type === type).value)
  return Date.UTC(part('year'), part('month') - 1, part('day')) / 86400000
}
export function groupConversations(chats, query = '', now = Date.now()) {
  const today = brazilDay(now), search = normalize(query.trim())
  const groups = ['Hoje', 'Últimos 7 dias', 'Anteriores'].map(label => ({ label, items: [] }))
  chats.filter(chat => normalize(`${chat.title} ${chat.messages.map(m => m.text || '').join(' ')}`).includes(search)).sort((a, b) => b.updatedAt - a.updatedAt).forEach(chat => {
    const age = today - brazilDay(chat.updatedAt)
    groups[age <= 0 ? 0 : age < 7 ? 1 : 2].items.push(chat)
  })
  return groups.filter(group => group.items.length)
}

export function safeChatHref(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/.test(value)) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/') && !value.startsWith('//') || value.startsWith('#')) return value
  return ''
}

export function agentsOf(chat) {
  return [...new Set(chat.messages.filter(m => m.role === 'assistant').map(m => m.provider || 'local'))]
}
