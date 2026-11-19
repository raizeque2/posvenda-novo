import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'

/** Valida o token do Turnstile no servidor antes de uma ação do Firebase Auth. */
export async function verificarTurnstile(action, turnstileToken) {
  await httpsCallable(functions, 'verificarTurnstile')({ action, turnstileToken })
}

const MENSAGENS = {
  'auth/invalid-credential': 'Usuário ou senha incorretos.',
  'auth/wrong-password': 'Usuário ou senha incorretos.',
  'auth/user-not-found': 'Usuário ou senha incorretos.',
  'auth/invalid-email': 'Confira o usuário ou e-mail digitado.',
  'auth/user-disabled': 'Esta conta está desativada. Procure o administrador.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com o servidor. Verifique a internet e tente novamente.',
  'auth/expired-action-code': 'Este link expirou. Peça um novo.',
  'auth/invalid-action-code': 'Este link é inválido ou já foi usado. Peça um novo.',
  'auth/weak-password': 'Escolha uma senha mais forte (mínimo de 8 caracteres).',
  'functions/failed-precondition': 'Não foi possível confirmar a verificação de segurança. Atualize a verificação e tente novamente.',
  'functions/resource-exhausted': 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  'functions/unavailable': 'Serviço indisponível no momento. Tente novamente em instantes.',
  'functions/internal': 'Serviço indisponível no momento. Tente novamente em instantes.',
}

export function mensagemDeErro(error, padrao = 'Não foi possível concluir. Tente novamente.') {
  return MENSAGENS[error?.code] || (import.meta.env.MODE === 'preview' && error?.message) || padrao
}

/** 0–4: comprimento, maiúsculas/minúsculas, número, símbolo. */
export function forcaSenha(senha) {
  if (!senha) return 0
  let pontos = senha.length >= 8 ? 1 : 0
  if (senha.length >= 12) pontos++
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++
  if (/\d/.test(senha) && /[^A-Za-z0-9]/.test(senha)) pontos++
  return Math.min(4, Math.max(pontos, senha.length >= 8 ? 1 : 0))
}

export function validarNovaSenha(senha, confirmacao) {
  if (senha.length < 8) return 'Use pelo menos 8 caracteres.'
  if (senha.length > 128) return 'Use no máximo 128 caracteres.'
  if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) return 'Combine letras e números.'
  if (senha !== confirmacao) return 'As senhas não conferem.'
  return ''
}
