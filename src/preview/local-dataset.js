import {configureLocalRepository} from './repository.js'
export async function initializeLocalDataset(){
 const response=await fetch('/__preview/local-data',{cache:'no-store'})
 if(response.status===404)return
 if(!response.ok)throw Error('Não foi possível abrir a base local. Confira o servidor.')
 if(!response.headers.get('content-type')?.includes('application/json'))return
 configureLocalRepository(await response.json())
 const {invalidarCacheMeses}=await import('../services/cloudLoader.js')
 await invalidarCacheMeses()
}
