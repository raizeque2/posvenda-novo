import { getAuth, getFirestore, getStorage, getFunctions } from './firebase-sdk.js'
export const auth=getAuth(), db=getFirestore(), storage=getStorage(), functions=getFunctions()
export const getAuthSecundario=()=>getAuth()
