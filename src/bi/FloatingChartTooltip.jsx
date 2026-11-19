import {useLayoutEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useChart} from '../components/bklit/charts/chart-context'
import {tooltipPosition} from './tooltipPosition.js'

export default function FloatingChartTooltip({format,compare,label}){
  const {tooltipData,containerRef,margin}=useChart(),panel=useRef(null)
  const [position,setPosition]=useState(null)
  useLayoutEffect(()=>{
    if(!tooltipData||!panel.current||!containerRef.current){setPosition(null);return}
    const update=()=>{
      const box=containerRef.current?.getBoundingClientRect(),tooltip=panel.current?.getBoundingClientRect()
      if(!box||!tooltip)return
      setPosition(tooltipPosition(box.left+margin.left+tooltipData.x,box.top+margin.top,tooltip.width,tooltip.height,window.innerWidth,window.innerHeight))
    }
    update();window.addEventListener('scroll',update,true);window.addEventListener('resize',update)
    return()=>{window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update)}
  },[tooltipData,containerRef,margin.left,margin.top])
  if(!tooltipData||typeof document==='undefined')return null
  const point=tooltipData.point
  return createPortal(<div ref={panel} role="tooltip" className="bi-floating-tooltip" style={{...position,visibility:position?'visible':'hidden'}}><strong>{label(point.name)}</strong><div>Realizado: {format(point.value)}</div>{compare&&<div>Meta: {format(point.meta||0)}</div>}</div>,document.body)
}
FloatingChartTooltip.__isPostOverlay=true
