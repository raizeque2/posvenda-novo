// Local analyser only: no recording, upload or retained audio buffer.
export function monitorMicrophone({ mediaDevices, AudioContext, onLevels, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
  let active = true, stream, context, frame, previous = 0
  const stop = () => {
    active = false
    if (frame != null) cancelFrame(frame)
    stream?.getTracks().forEach(track => track.stop())
    if (context && context.state !== 'closed') context.close().catch(() => {})
  }
  if (!mediaDevices?.getUserMedia || !AudioContext) return { stop }
  mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(async acquired => {
    stream = acquired
    if (!active) { stop(); return }
    context = new AudioContext()
    await context.resume()
    if (!active) { stop(); return }
    const analyser = context.createAnalyser()
    analyser.fftSize = 256
    context.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)
    function draw(time) {
      if (!active) return
      if (time - previous >= 80) {
        previous = time
        analyser.getByteTimeDomainData(samples)
        onLevels(Array.from({ length: 20 }, (_, index) => {
          const start = Math.floor(index * samples.length / 20), end = Math.floor((index + 1) * samples.length / 20)
          let sum = 0
          for (let i = start; i < end; i++) sum += ((samples[i] - 128) / 128) ** 2
          return Math.min(1, Math.sqrt(sum / (end - start)) * 5)
        }))
      }
      frame = requestFrame(draw)
    }
    frame = requestFrame(draw)
  }).catch(stop)
  return { stop }
}
