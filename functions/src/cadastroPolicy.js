// Regras puras do cadastro (solicitar acesso). Usadas pelo servidor e pela tela.
import { SETORES } from './tabPolicy.js'

// Cargo é só um PEDIDO: quem decide é o administrador ao aprovar. Admin nunca pode ser pedido.
export const CARGOS_PEDIDO = [
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'operacional', label: 'Colaborador' },
]
export const SETORES_CADASTRO = SETORES

/** Senha: 8 a 128 caracteres, com pelo menos uma letra e um número. Devolve a mensagem do problema ou ''. */
export function problemaDaSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return 'Use pelo menos 8 caracteres.'
  if (senha.length > 128) return 'Use no máximo 128 caracteres.'
  if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) return 'Misture letras e números.'
  return ''
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CAMPOS = ['nome', 'email', 'setor', 'cargo', 'senha', 'turnstileToken']

/** Valida o pedido vindo da tela pública. Lança Error com mensagem amigável. */
export function validarCadastro(data) {
  if (!data || typeof data !== 'object' || Object.keys(data).some(k => !CAMPOS.includes(k))) throw Error('Pedido inválido.')
  const { nome, email, setor, cargo, senha } = data
  if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 100) throw Error('Informe seu nome completo.')
  if (typeof email !== 'string' || email.length > 254 || !EMAIL.test(email.trim())) throw Error('Informe um e-mail válido.')
  if (!SETORES_CADASTRO.includes(setor)) throw Error('Escolha o seu setor.')
  if (!CARGOS_PEDIDO.some(c => c.value === cargo)) throw Error('Escolha o seu cargo.')
  const senhaRuim = problemaDaSenha(senha)
  if (senhaRuim) throw Error(`Senha: ${senhaRuim}`)
  return { nome: nome.trim(), email: email.trim().toLowerCase(), setor, cargo, senha }
}

export const idSolicitacaoValido = id => typeof id === 'string' && /^[0-9a-f]{64}$/.test(id)
