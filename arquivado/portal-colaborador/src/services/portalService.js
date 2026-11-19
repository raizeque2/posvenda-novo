import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'

// O portal fala só com funções do servidor: senha, bloqueio e redefinição
// nunca acontecem no navegador.
const portalPessoas = httpsCallable(functions, 'portalPessoas')
const portalEntrar = httpsCallable(functions, 'portalEntrar')
const portalListar = httpsCallable(functions, 'portalListar')
const portalRedefinir = httpsCallable(functions, 'portalRedefinir')
const portalPerfil = httpsCallable(functions, 'portalPerfil')
const lerDadosAutorizados = httpsCallable(functions, 'lerDadosAutorizados', { timeout: 60000 })

export async function listarPessoas(tipo) {
  const { data } = await portalPessoas({ tipo })
  return data?.pessoas || []
}

export async function entrarNoPortal({ tipo, id, senha, primeiro, turnstileToken }) {
  const { data } = await portalEntrar({ tipo, id, senha, primeiro, turnstileToken })
  return data
}

export async function listarContasPortal() {
  const { data } = await portalListar({})
  return data?.contas || []
}

export async function redefinirContaPortal(id) {
  await portalRedefinir({ id })
}

export async function salvarPerfilPortal(alteracoes) {
  const { data } = await portalPerfil(alteracoes)
  return data
}

/** Totais da empresa no mês — números agregados, sem nomes nem linhas. */
export async function carregarVisaoGeral(mes) {
  const { data } = await lerDadosAutorizados({ kind: 'overview', mes })
  return data
}
