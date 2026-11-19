import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {gzipSync} from 'node:zlib'

// Dev-server only: the dataset stays outside the repository and never enters a build.
export function localDatasetPlugin(seedFile){
 return {name:'private-local-dataset',async configureServer(server){
  if(!seedFile)return
  const seedPath=path.resolve(seedFile),root=path.dirname(seedPath),seed=JSON.parse(await readFile(seedPath,'utf8'))
  if(!seed.localDataset?.id)throw Error('Base local inválida.')
  const files=new Map(Object.values(seed.files).map(file=>[file.localUrl,path.join(root,path.basename(file.localUrl))]))
  const responses=new Map()
  responses.set('/__preview/local-data',gzipSync(JSON.stringify(seed)))
  server.middlewares.use(async(req,res,next)=>{
   const url=(req.url||'').split('?')[0]
   if(!url.startsWith('/__preview/local-data'))return next()
   const host=req.headers.host||'',address=req.socket.remoteAddress||'',origin=req.headers.origin
   if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)||(origin&&origin!==`http://${host}`)||req.headers['sec-fetch-site']==='cross-site'){res.statusCode=403;return res.end('Acesso local obrigatório.')}
   if(req.method!=='GET'){res.statusCode=405;return res.end()}
   if(!responses.has(url)&&!files.has(url)){res.statusCode=404;return res.end()}
   try{
    if(!responses.has(url))responses.set(url,gzipSync(await readFile(files.get(url))))
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Vary','Accept-Encoding')
    const body=responses.get(url)
    if((req.headers['accept-encoding']||'').includes('gzip')){res.setHeader('Content-Encoding','gzip');res.end(body)}else{const {gunzipSync}=await import('node:zlib');res.end(gunzipSync(body))}
   }catch{res.statusCode=500;res.end('Não foi possível carregar a base local.')}
  })
 }}
}
