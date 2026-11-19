import {loadMunicipalityIndex,loadCityCenters,loadBrazilOutline,aggregateCityPoints,aggregateCustomPoints} from './territory.js'
import {BRAZIL_BOUNDS,mapProjection,projectRings} from './mapGeometry.js'
self.onmessage=async({data:{rows,geo}})=>{
  try{
    if(geo){
      self.postMessage({result:projectResult(aggregateCustomPoints(rows,geo.features),null)})
      return
    }
    const [index,centers,outline]=await Promise.all([loadMunicipalityIndex(),loadCityCenters(),loadBrazilOutline()])
    const points=aggregateCityPoints(rows,index,centers).filter(point=>point.records)
    self.postMessage({result:projectResult(points,outline)})
  }catch(error){self.postMessage({error:error.message||'Não foi possível preparar o mapa.'})}
}
// O contorno do país e os pontos de calor usam a mesma projeção, então os
// pontos sempre caem sobre o mapa. O contorno só existe no mapa do IBGE.
function projectResult(points,outline){
  const fixed=outline?BRAZIL_BOUNDS:null
  const {project,context}=mapProjection(points,fixed)
  return {
    context,
    points:points.map(point=>{
      const [x,y]=project(point.lon,point.lat)
      return {...point,x:Math.round(x*10)/10,y:Math.round(y*10)/10}
    }),
    outline:outline?projectRings(outline,BRAZIL_BOUNDS):[],
  }
}
