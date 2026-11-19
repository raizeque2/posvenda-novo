import {norm} from '../utils/normalizacao.js'
export const ehCargoExterno = cargo => /\bEXTERNO\b/.test(norm(cargo))
