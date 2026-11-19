import {DASHBOARD_CHANNELS,mainChannel,matchesChannel} from '../../functions/src/revenueChannels.js'
export {DASHBOARD_CHANNELS,mainChannel,matchesChannel,isVirtualAccount,isRevenueRecord} from '../../functions/src/revenueChannels.js'
export function kpiSummary(rows,targets=[]){
 const totals=Object.fromEntries(DASHBOARD_CHANNELS.map(c=>[c,{value:0,quantity:0,records:0,target:0,hasQuantity:false}]))
 for(const row of rows){const channel=mainChannel(row),t=totals[channel];if(!t||channel==='TOTAL PEÇAS')continue;t.value+=row.value;t.records++;if(row.quantity!=null){t.quantity+=row.quantity;t.hasQuantity=true}}
 for(const target of targets){const t=totals[mainChannel(target)];if(t&&target.channel!=='TOTAL PEÇAS')t.target+=Number(target.meta)||0}
 const total=totals['TOTAL PEÇAS']
 for(const channel of ['VAREJO','WEB','TELEVENDAS','ATACADO','PEÇAS OS']){const t=totals[channel];for(const field of ['value','quantity','records','target'])total[field]+=t[field];total.hasQuantity ||=t.hasQuantity}
 return totals
}
export function kpiBreakdown(rows,channel){
 const groups=new Map(),osLabels={OFICINA:'O.S. externas',OFICINA_GAR:'Garantia',OFICINA_SEG:'Seguradora'}
 for(const row of rows){if(!matchesChannel(row,channel))continue;const name=channel==='TOTAL PEÇAS'?mainChannel(row):channel==='PEÇAS OS'?osLabels[row.channel]||row.channel:channel==='MÃO DE OBRA'?row.category||'Serviços':row.store;const item=groups.get(name)||{name,value:0,records:0};item.value+=row.value;item.records++;groups.set(name,item)}
 return [...groups.values()].sort((a,b)=>b.value-a.value)
}
export function dailyRevenueRows(rows){
 const days=new Map()
 for(const row of rows){const id=`${row.channel}:${row.date}`,day=days.get(id)||{channel:row.channel,source:row.source,date:row.date,value:0,quantity:null,recordCount:0};day.value+=row.value;day.recordCount+=row.recordCount??1;if(row.quantity!=null)day.quantity=(day.quantity??0)+row.quantity;days.set(id,day)}
 return [...days.values()]
}
