const errors = {
  'not-allowed': 'O acesso ao microfone foi negado. Permita nas configurações do navegador ou use texto.',
  'service-not-allowed': 'O reconhecimento de voz não está disponível neste navegador. Use texto.',
  'audio-capture': 'Não foi possível acessar um microfone. Confira o dispositivo ou use texto.',
  'no-speech': 'Nenhuma fala foi reconhecida. Tente novamente ou digite sua pergunta.',
  network: 'O serviço de voz não respondeu. Confira a conexão ou use texto.',
}

// Recebe o construtor do navegador para permitir testes sem capturar áudio real.
export function startDictation(Recognition, { onText, onEnd, onError, onStart = () => {} }) {
  const recognition = new Recognition()
  let active = true
  recognition.lang = 'pt-BR'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  recognition.onstart = () => { if (active) onStart() }
  recognition.onresult = event => {
    if (!active) return
    const parts = []
    // Results contain the cumulative final segments and the current hypothesis.
    // Replace the previous hypothesis rather than appending it on every event.
    for (let i = 0; i < event.results.length; i++) parts.push(event.results[i][0].transcript)
    onText(parts.join(' ').trim())
  }
  recognition.onerror = event => {
    if (!active) return
    if (event.error !== 'aborted') onError(errors[event.error] || 'Não foi possível reconhecer a fala. Use texto ou tente novamente.')
    finish()
    try { recognition.abort() } catch { /* The browser may already have closed it. */ }
  }
  recognition.onend = finish
  function finish() {
    if (!active) return
    active = false
    recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null
    onEnd()
  }
  recognition.start()
  return {
    stop() { if (active) recognition.stop() },
    abort() {
      if (!active) return
      active = false
      recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null
      recognition.abort()
      onEnd()
    },
  }
}

export function appendDictation(draft, transcript) {
  return [draft.trimEnd(), transcript.trim()].filter(Boolean).join(' ').slice(0, 2000)
}
