import { create } from 'zustand'
// Session-only task metadata. CSV contents and credentials never enter this store.
export const useUploadTasks = create(set=>({
  tasks:[],
  clear(){set({tasks:[]})},
  start(label,detail){const id=crypto.randomUUID();set(state=>({tasks:[...state.tasks,{id,label,detail,status:'running'}]}));return id},
  update(id,changes){set(state=>({tasks:state.tasks.map(task=>task.id===id?{...task,...changes}:task)}))},
  dismiss(id){set(state=>({tasks:state.tasks.filter(task=>task.id!==id)}))},
}))
