export function tooltipPosition(x,y,width,height,viewportWidth,viewportHeight){
  const gap=10,pad=8
  const left=x+gap+width<=viewportWidth-pad?x+gap:x-width-gap
  return {left:Math.max(pad,Math.min(left,viewportWidth-width-pad)),top:Math.max(pad,Math.min(y,viewportHeight-height-pad))}
}
