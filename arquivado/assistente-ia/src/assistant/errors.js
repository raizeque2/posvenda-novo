export function assistantFailure(error, now = Date.now()) {
  const code = error.details?.errorCode || error.code || 'unknown'
  const retry = Number(error.retryAfterSeconds ?? error.details?.retryAfterSeconds)
  const retryAt = Number.isFinite(retry) && retry > 0 ? now + Math.min(retry, 3600) * 1000 : null
  const reconnect = ['session-expired', 'credential-rejected', 'functions/unauthenticated'].includes(code)
  const text = code === 'provider-busy' ? 'O modelo está ocupado no Google. Aguarde um pouco e tente novamente, ou escolha outro modelo disponível.' : code === 'session-expired' ? 'A conexão do Gemini expirou. Abra Conexões e selecione sua chave novamente.' : code === 'credential-rejected' ? 'O Google recusou a chave. Confira a credencial em Conexões.' : code === 'network' ? 'Não foi possível alcançar o provedor. Confira sua conexão e tente novamente.' : code === 'timeout' ? 'O provedor demorou para responder. Tente novamente quando desejar.' : error.message || 'Não foi possível concluir a consulta. Tente novamente.'
  return { text, errorCode: code, retryAt, reconnect }
}
