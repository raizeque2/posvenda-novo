/**
 * Regras do portal de colaboradores/supervisores — só funções puras.
 * Tela e efeitos ficam em usePortal.js, como nas outras páginas.
 */
import { fmtBRL2 as money } from '../../utils/formatacao.js'

export const ETAPAS = { INICIO: 'inicio', PESSOA: 'pessoa', SENHA: 'senha' }

export function iniciais(nome = '') {
  return String(nome)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0])
    .join('')
    .toUpperCase()
}

/** Opções do seletor: nome e loja apenas — nada de desempenho antes do login. */
export function pessoasParaOpcoes(pessoas = []) {
  return pessoas.map(pessoa => ({
    value: pessoa.id,
    label: pessoa.nome,
    description: pessoa.bloqueado ? `${pessoa.loja} · acesso bloqueado` : pessoa.loja,
  }))
}

/** Mesma política do servidor, checada antes de enviar (só para orientar). */
export function avaliarSenha(senha, confirmacao, primeiro) {
  if (!senha) return 'Digite a senha.'
  if (primeiro === true) {
    if (senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
    if (senha.length > 128) return 'A senha pode ter no máximo 128 caracteres.'
    if (!/[^\d]/.test(senha) || !/\d/.test(senha)) return 'Use pelo menos uma letra e um número.'
    if (new Set(senha).size < 3) return 'Use uma senha com pelo menos 3 caracteres diferentes.'
    if (confirmacao !== undefined && confirmacao !== senha) return 'As duas senhas precisam ser iguais.'
  }
  return null
}

export function limparMensagem(erro) {
  const bruta = String(erro?.message || '')
  return bruta.replace(/^functions\/[\w-]+:\s*/i, '').replace(/^[\w-]+\/\w+:\s*/i, '').trim()
}

/** Traduz o erro devolvido pela função do servidor para a tela. */
export function descreverErro(erro) {
  const codigo = String(erro?.code || '')
  const detalhes = erro?.details || {}
  if (detalhes.bloqueado) return 'Acesso bloqueado após tentativas incorretas. Peça ao administrador para redefinir a senha.'
  if (detalhes.primeiroAcesso) return 'Este é o primeiro acesso: crie sua senha.'
  if (detalhes.senhaExistente) return 'Esta pessoa já tem senha. Entre com ela.'
  if (codigo.includes('resource-exhausted')) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.'
  if (codigo.includes('unavailable')) return 'Não foi possível falar com o servidor. Verifique a conexão.'
  if (codigo.includes('not-found')) return limparMensagem(erro) || 'Cadastro não encontrado.'
  if (codigo.includes('unauthenticated')) return 'Sessão expirada. Entre novamente.'
  const limpa = limparMensagem(erro)
  return limpa || 'Não foi possível concluir. Tente novamente.'
}

export function rotuloPessoa(pessoa) {
  return pessoa ? `${pessoa.nome} · ${pessoa.loja}` : ''
}

export function nomeLoja(codigo, lojas) {
  const loja = lojas?.[codigo]
  return loja?.un || loja?.nome || codigo || 'Sem loja'
}

/**
 * Números da meta do mês, do jeito que o acompanhamento individual já calcula
 * (personMonth): realizado, quanto falta e o necessário por dia útil.
 */
export function resumoMeta(d) {
  const meta = Number(d?.target) || 0
  const real = Number(d?.real) || 0
  const pct = meta > 0 ? (real / meta) * 100 : null
  return {
    meta,
    real,
    falta: meta > 0 ? Math.max(0, meta - real) : 0,
    necessario: meta > 0 && Number.isFinite(d?.needed) ? d.needed : null,
    diasRestantes: Number(d?.remaining) || 0,
    pct,
    projecao: Number.isFinite(d?.projection) ? d.projection : null,
    temBase: !!d?.cutoff,
    textoFalta: meta > 0 ? money(Math.max(0, meta - real)) : 'Sem meta',
    textoNecessario: meta > 0 && d?.needed != null ? money(d.needed) : '—',
  }
}
