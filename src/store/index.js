import { create } from 'zustand'
import { createFiltrosSlice } from './filtrosSlice.js'
import { createConfigSlice }  from './configSlice.js'
import { createDadosSlice }   from './dadosSlice.js'

const useStore = create((set, get) => ({
  ...createFiltrosSlice(set, get),
  ...createConfigSlice(set, get),
  ...createDadosSlice(set, get),
}))

export default useStore
