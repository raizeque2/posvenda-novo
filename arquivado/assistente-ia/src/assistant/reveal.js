export function revealText(text = '', startedAt, now = Date.now(), reduced = false) {
  if (!startedAt || reduced || !text) return {text,done:true}
  const tokens=text.match(/\S+\s*/g) || [], duration=Math.min(8000,Math.max(250,tokens.length*80))
  const count=Math.min(tokens.length,Math.max(1,Math.floor(tokens.length*Math.max(0,now-startedAt)/duration)))
  return {text:count>=tokens.length?text:tokens.slice(0,count).join(''),done:count>=tokens.length}
}
