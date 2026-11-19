import {key} from './model.js'
export const BRAZIL_BOUNDS=[-74,-34,-33,6]

// Agrupa os registros antes de ir para o worker: uma linha por cidade/UF/canal,
// não uma por venda. É o que mantém o custo baixo com o Brasil inteiro.
export function compactMapRows(rows){
  const groups=new Map()
  for(const row of rows){
    const source=row.source==='services'||row.channel==='SERVIÇOS'?'services':'pieces'
    const id=JSON.stringify([key(row.city),row.uf,key(row.region),source])
    const item=groups.get(id)||{city:row.city,uf:row.uf,region:row.region,source,value:0,recordCount:0}
    item.value+=row.value;item.recordCount+=row.recordCount??1;groups.set(id,item)
  }
  return [...groups.values()]
}

// Projeta coordenadas geográficas no viewport 640×370 usado pelo mapa.
// Sem malha municipal: recebe só pontos (lon/lat) e devolve x/y prontos,
// então o custo por cidade é uma multiplicação, não o desenho de um polígono.
export function mapProjection(points,fixedBounds){
  const bounds=fixedBounds?[...fixedBounds]:[180,90,-180,-90]
  if(!fixedBounds)for(const point of points){
    bounds[0]=Math.min(bounds[0],point.lon);bounds[1]=Math.min(bounds[1],point.lat)
    bounds[2]=Math.max(bounds[2],point.lon);bounds[3]=Math.max(bounds[3],point.lat)
  }
  const padX=Math.max(.25,(bounds[2]-bounds[0])*.18),padY=Math.max(.25,(bounds[3]-bounds[1])*.18)
  bounds[0]-=padX;bounds[2]+=padX;bounds[1]-=padY;bounds[3]+=padY
  const correction=Math.cos((bounds[1]+bounds[3])/2*Math.PI/180),dx=Math.max(.001,(bounds[2]-bounds[0])*correction),dy=Math.max(.001,bounds[3]-bounds[1]),scale=Math.min(600/dx,330/dy)
  const project=(lon,lat)=>[(640-dx*scale)/2+(lon-bounds[0])*correction*scale,(370-dy*scale)/2+(bounds[3]-lat)*scale]
  const context=fixedBounds?{x:0,y:0,width:640,height:370}:(()=>{
    const [x,y]=project(bounds[0],bounds[3]),[right,bottom]=project(bounds[2],bounds[1])
    return {x,y,width:right-x,height:bottom-y}
  })()
  return {project,context}
}
export function projectPoints(points,fixedBounds){
  if(!points.length)return {points:[],context:null}
  const {project,context}=mapProjection(points,fixedBounds)
  const projected=points.map(point=>{
    const [x,y]=project(point.lon,point.lat)
    return {...point,x:Math.round(x*10)/10,y:Math.round(y*10)/10}
  })
  return {points:projected,context}
}

// Contorno do país (anéis lon/lat simplificados) na mesma projeção dos pontos,
// para o fundo do mapa nunca sair de registro.
export function projectRings(rings,fixedBounds){
  if(!rings?.length)return []
  const {project}=mapProjection([],fixedBounds)
  return rings.map(ring=>ring.map(([lon,lat])=>{
    const [x,y]=project(lon,lat)
    return [Math.round(x*10)/10,Math.round(y*10)/10]
  }))
}

// Centro de uma geometria GeoJSON (bbox) — usado só no mapa próprio importado,
// que traz polígonos de até 500 KB e no máximo 1.000 regiões.
export function geometryCenter(geometry){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates
  for(const polygon of polygons)for(const ring of polygon)for(const [x,y] of ring){
    if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y
  }
  return Number.isFinite(minX)?[(minX+maxX)/2,(minY+maxY)/2]:[0,0]
}
