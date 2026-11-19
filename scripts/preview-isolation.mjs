import path from 'node:path'
export function previewIsolation(){
 const root=path.resolve('src'),sdk=path.join(root,'preview/firebase-sdk.js')
 return {
  name:'isolate-preview-backend',enforce:'pre',
  resolveId(source,importer){
   if(/^(@firebase\/|firebase(?:\/|$)|firebase-admin|firebase-functions)/.test(source))return sdk
   if(source.endsWith('firebase.js'))return path.join(root,'preview/connection.js')
  },
  generateBundle(){
   for(const id of this.getModuleIds()){
    const normalized=id.replaceAll('\\','/')
    if(normalized.includes('/node_modules/')&&/\/(?:@firebase|firebase|firebase-admin|firebase-functions)(?:\/|@)/.test(normalized))this.error('O SDK real do Firebase entrou na prévia: '+id)
    if(normalized===path.join(root,'firebase.js').replaceAll('\\','/'))this.error('A configuração real do Firebase entrou na prévia.')
   }
  },
 }
}
