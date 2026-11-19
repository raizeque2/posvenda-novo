export async function gerarToken(chaveSecreta, estado, tipo) {
  const agora = new Date()
  const mes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', month: '2-digit', year: 'numeric' }).format(agora)
  const raw = `${chaveSecreta}::${estado}::${tipo}::${mes}`
  const encoder = new TextEncoder()
  const data = encoder.encode(raw)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export async function validarToken(chaveSecreta, estado, tipo, tokenRecebido) {
  const esperado = await gerarToken(chaveSecreta, estado, tipo)
  return tokenRecebido === esperado
}

export function dataExpiracao() {
  const agora = new Date()
  const exp = new Date(agora.getFullYear(), agora.getMonth() + 1, 1, 0, 0, 0)
  return exp.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function urlSnapshot(baseUrl, estado, tipo, token) {
  return `${baseUrl}/r/${estado.toLowerCase()}/${tipo}/${token}`
}
