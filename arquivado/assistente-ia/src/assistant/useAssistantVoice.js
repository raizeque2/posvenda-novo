import { useEffect, useRef, useState } from 'react'
import { appendDictation, startDictation } from './speech.js'
import { monitorMicrophone } from './microphone.js'

export function useAssistantVoice({ open, pathname, prompt, setPrompt }) {
  const session = useRef(null), meter = useRef(null), base = useRef(''), sequence = useRef(0), hadChat = useRef(open)
  const [phase, setPhase] = useState('idle'), [levels, setLevels] = useState([])
  const [error, setError] = useState(''), [reading, setReading] = useState(null)
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const active = phase === 'starting' || phase === 'listening'
  function stopMeter() { meter.current?.stop(); meter.current = null; setLevels([]) }
  function cancelCapture() {
    sequence.current++
    const current = session.current; session.current = null
    current?.abort(); stopMeter(); setPhase('idle')
  }
  function cancelReading() { window.speechSynthesis?.cancel(); setReading(null) }
  useEffect(() => {
    return () => { cancelCapture(); cancelReading() }
  }, [pathname])
  useEffect(() => {
    if (hadChat.current && !open) { cancelCapture(); cancelReading() }
    hadChat.current = open
  }, [open])
  function start() {
    if (session.current || active) return
    setError('')
    if (!Recognition) { setError('Este navegador não oferece ditado. Abra o site no Chrome ou Edge com acesso ao microfone.'); return }
    base.current = prompt
    const run = ++sequence.current
    setPhase('starting'); cancelReading()
    try {
      session.current = startDictation(Recognition, {
        onStart: () => {
          if (run !== sequence.current) return
          setPhase('listening')
          meter.current = monitorMicrophone({ mediaDevices: navigator.mediaDevices, AudioContext: window.AudioContext || window.webkitAudioContext, onLevels: values => { if (run === sequence.current) setLevels(values) } })
        },
        onText: text => { if (run === sequence.current) setPrompt(appendDictation(base.current, text)) },
        onEnd: () => { if (run === sequence.current) { session.current = null; stopMeter(); setPhase('review') } },
        onError: message => { if (run === sequence.current) setError(message) },
      })
    } catch {
      session.current = null; stopMeter(); setPhase('idle')
      setError('Não foi possível iniciar o microfone. Confira a permissão do navegador e tente novamente.')
    }
  }
  function stop() {
    try { if (phase === 'starting') cancelCapture(); else session.current?.stop() }
    catch { cancelCapture() }
    stopMeter()
  }
  function discard() { cancelCapture(); setPrompt(base.current); setError('') }
  function keep() { cancelCapture(); setError('') }
  function read(text, id) {
    cancelCapture()
    if (reading === id) { cancelReading(); return }
    cancelReading()
    if (!window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    const voice = window.speechSynthesis.getVoices().find(v => v.localService && /^pt(-|_)/i.test(v.lang))
    if (voice) utterance.voice = voice
    utterance.onend = () => setReading(current => current === id ? null : current)
    utterance.onerror = () => { setReading(null); setError('A leitura de voz não está disponível. A resposta continua no chat.') }
    setReading(id); window.speechSynthesis.speak(utterance)
  }
  return { phase, active, levels, error, reading, supported: !!Recognition, canRead: !!window.speechSynthesis, start, stop, discard, keep, cancelCapture, cancelReading, read, toggle: () => active ? stop() : start() }
}
