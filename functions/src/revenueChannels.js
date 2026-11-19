export const DASHBOARD_CHANNELS=['VAREJO','WEB','TELEVENDAS','ATACADO','PEÇAS OS','TOTAL PEÇAS','MÃO DE OBRA']
const partsChannels=new Set(['VAREJO','WEB','TELEVENDAS','ATACADO','OFICINA','OFICINA_GAR','OFICINA_SEG'])
const osChannels=new Set(['OFICINA','OFICINA_GAR','OFICINA_SEG'])
export const isRevenueRecord=(row,service=false)=>service||!row.cat||partsChannels.has(row.cat)
export function mainChannel(row){return row.source==='services'||row.channel==='SERVIÇOS'?'MÃO DE OBRA':osChannels.has(row.channel)?'PEÇAS OS':row.channel}
export function matchesChannel(row,channel){
 if(!channel)return true
 if(channel==='TOTAL PEÇAS')return row.source!=='services'&&partsChannels.has(row.channel)
 return row.channel===channel||mainChannel(row)===channel
}
export function isVirtualAccount(name){return /\bMERCADO\s*LIVRE\b|\bMERCADOLIVRE\b|^(?:SHOPEE|AMAZON|MAGALU)(?:\b|$)|^SEM RESPONS[AÁ]VEL$/i.test(name)}
