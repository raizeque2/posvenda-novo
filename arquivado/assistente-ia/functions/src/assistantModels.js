const modelId = /^[a-zA-Z0-9._:-]{1,100}$/
const efforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])

// Model access and supported efforts are set by the administrator, never by the client.
export function assistantModels(config, provider) {
  if (!['openai', 'claude', 'gemini'].includes(provider) || config[`${provider}Enabled`] !== true) return []
  const configured = config[`${provider}Models`]
  const source = Array.isArray(configured) ? configured : [{ id: config[`${provider}Model`] }]
  const result = []
  for (const item of source.slice(0, 20)) {
    const model = typeof item === 'string' ? { id: item } : item
    if (!model || typeof model.id !== 'string' || !modelId.test(model.id) || result.some(m => m.id === model.id)) continue
    const allowed = provider === 'gemini' ? new Set(model.id.startsWith('gemini-3') ? ['minimal', 'low', 'medium', 'high'] : []) : efforts
    const thinking = [...new Set(Array.isArray(model.thinking) ? model.thinking.filter(value => allowed.has(value)) : [])]
    result.push({ id: model.id, name: typeof model.name === 'string' ? model.name.slice(0, 100) : model.id, thinking, defaultThinking: thinking.includes(model.defaultThinking) ? model.defaultThinking : thinking.includes('medium') ? 'medium' : thinking[0] })
  }
  return result
}

export function selectAssistantModel(config, provider, data = {}) {
  const available = assistantModels(config, provider)
  const model = data.model === undefined ? available[0] : available.find(item => item.id === data.model)
  if (!model) throw Error('Modelo indisponível. Atualize as conexões e escolha um modelo autorizado.')
  const thinking = data.thinking ?? model.defaultThinking
  if (thinking !== undefined && !model.thinking.includes(thinking)) throw Error('Esforço indisponível para esse modelo.')
  return { model: model.id, thinking }
}

export function assistantModelParameters(provider, selected) {
  if (selected.thinking === undefined) return {}
  if (provider === 'gemini') return { thinkingConfig: { thinkingLevel: selected.thinking.toUpperCase() } }
  return provider === 'openai' ? { reasoning: { effort: selected.thinking } } : { output_config: { effort: selected.thinking } }
}
