// Pesquisa NPS (totem da loja + comentário pelo celular + painel).
// Funções puras, sem SDK: usadas pela Cloud Function (npsCallable.js), pela
// prévia local e pelo navegador (perguntas e validação do totem).
// Origem: projeto "Pesquisa NPS — Alagoas Motos" (Next.js), portado para cá.

export const SETORES_NPS = [
  { id: 1, nome: 'Balcão de peças' },
  { id: 3, nome: 'Motos novas/entrega' },
  { id: 5, nome: 'Consórcios' },
  { id: 2, nome: 'Oficina/garantia' },
  { id: 4, nome: 'Seminovos' },
  { id: 6, nome: 'CNH' },
  { id: 7, nome: 'Outros' },
]

export const CORES_NOTA = ['#ee4141', '#ef4b4b', '#f4634b', '#fb8750', '#ffa54c', '#ffc34a', '#e4c936', '#bfd038', '#99cd35', '#70c936', '#39b52e']

export const NOTAS_CAIXA = [
  { valor: 1, rotulo: 'Muito ruim', imagem: '/nps/emoji-baixa.png' },
  { valor: 2, rotulo: 'Ruim', imagem: '/nps/emoji-ruim.png' },
  { valor: 3, rotulo: 'Regular', imagem: '/nps/emoji-neutro.png' },
  { valor: 4, rotulo: 'Boa', imagem: '/nps/emoji-bom.png' },
  { valor: 5, rotulo: 'Excelente', imagem: '/nps/emoji-alta.png' },
]

export const MOTIVOS_CAIXA = ['Demora no caixa', 'Atendimento no caixa', 'Problema no pagamento', 'Erro na cobrança', 'Outro motivo']

export const perguntaCaixa = setorId => setorId === 3 || setorId === 4
  ? 'Como foi sua experiência de finalização da compra?'
  : 'Como foi sua experiência no caixa de pagamento?'

const PERGUNTA_SETOR = {
  1: { titulo: 'De 0 a 10, como você avalia o atendimento no balcão de peças?', positivo: 'Excelente!' },
  2: { titulo: 'De 0 a 10, como você avalia o atendimento na oficina ou garantia?', positivo: 'Excelente!' },
  3: { titulo: 'De 0 a 10, como você avalia a experiência e o atendimento na entrega da sua moto?', positivo: 'Foi maravilhosa!' },
  4: { titulo: 'De 0 a 10, como você avalia a experiência e o atendimento na entrega da sua moto seminova?', positivo: 'Foi maravilhosa!' },
  5: { titulo: 'De 0 a 10, como você avalia seu atendimento no consórcio?', positivo: 'Entendi tudo!' },
  6: { titulo: 'De 0 a 10, como você avalia o atendimento de CNH?', positivo: 'Excelente!' },
  7: { titulo: 'De 0 a 10, como você avalia o atendimento recebido?', positivo: 'Excelente!' },
}
export const perguntaSetor = setorId => PERGUNTA_SETOR[setorId]

export const NADA_A_MELHORAR = 'Nada a melhorar agora'
export const perguntarMelhoria = nota => nota < 8

const MELHORIAS = {
  1: { titulo: 'O que podemos melhorar no balcão de peças?', opcoes: ['Mais agilidade', 'Mais opções de produtos', 'Melhor atendimento', 'Preços ou condições', 'Peças a pronta-entrega'] },
  2: { titulo: 'O que podemos melhorar na oficina ou garantia?', opcoes: ['Mais agilidade', 'Prazos concretos', 'Melhor atendimento', 'Preços ou condições', 'Qualidade do serviço'] },
  3: { titulo: 'O que podemos melhorar em motos novas ou na entrega?', opcoes: ['Prazo de entrega', 'Explicações sobre a moto', 'Melhor atendimento', 'Preços ou condições', 'Preparação da moto'] },
  4: { titulo: 'O que podemos melhorar em seminovos?', opcoes: ['Condição da moto', 'Informações sobre o histórico', 'Melhor atendimento', 'Preços ou condições', 'Prazo de entrega'] },
  5: { titulo: 'O que podemos melhorar em consórcios?', opcoes: ['Clareza sobre parcelas', 'Informações sobre contemplação', 'Melhor atendimento', 'Menos burocracia', 'Acompanhamento do processo'] },
  6: { titulo: 'O que podemos melhorar no atendimento de CNH?', opcoes: ['Mais agilidade', 'Melhor comunicação', 'Acompanhamento do processo', 'Menos burocracia'] },
  7: { titulo: 'O que podemos fazer para melhorar sua experiência?', opcoes: ['Mais agilidade', 'Melhor atendimento', 'Melhor comunicação', 'Preços ou condições', 'Estrutura da loja'] },
}
export const melhoriaDoSetor = setorId => MELHORIAS[setorId] && { ...MELHORIAS[setorId], opcoes: [...MELHORIAS[setorId].opcoes, NADA_A_MELHORAR] }

export function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const d = [...cpf].map(Number)
  for (let n = 9; n <= 10; n++) {
    const resto = d.slice(0, n).reduce((soma, x, i) => soma + x * (n + 1 - i), 0) % 11
    if (d[n] !== (resto < 2 ? 0 : 11 - resto)) return false
  }
  return true
}

export const idValido = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

export class ErroNps extends Error {
  constructor(code, message) { super(message); this.code = code }
}
const recusar = msg => { throw new ErroNps('invalid-argument', msg) }
const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max

/** Valida o que veio do totem e devolve o documento a gravar em nps/{id}. */
export function prepararAvaliacao(v, agora = new Date().toISOString()) {
  if (!v || typeof v !== 'object') recusar('Avaliação inválida.')
  if (!idValido(v.id)) recusar('Identificador inválido.')
  const setor = SETORES_NPS.find(s => s.id === v.setorId)
  if (!setor) recusar('Setor inválido.')
  if (!inteiro(v.nota, 0, 10) || !inteiro(v.notaSetor, 0, 10)) recusar('Nota inválida.')
  const motivos = v.motivos
  if (!Array.isArray(motivos) || motivos.length > 12 || new Set(motivos).size !== motivos.length) recusar('Motivos inválidos.')
  if (!motivos.every(m => melhoriaDoSetor(setor.id).opcoes.includes(m))) recusar('Motivo fora da lista.')
  if (motivos.includes(NADA_A_MELHORAR) && motivos.length !== 1) recusar('Motivos inválidos.')
  if (!perguntarMelhoria(v.notaSetor) && motivos.length) recusar('Motivos inválidos.')
  if (!inteiro(v.notaCaixa, 0, 5)) recusar('Nota do caixa inválida.')
  const motivosCaixa = v.motivosCaixa
  if (!Array.isArray(motivosCaixa) || new Set(motivosCaixa).size !== motivosCaixa.length || !motivosCaixa.every(m => MOTIVOS_CAIXA.includes(m))) recusar('Motivos do caixa inválidos.')
  if ((v.notaCaixa >= 1 && v.notaCaixa <= 3) !== motivosCaixa.length > 0) recusar('Motivos do caixa inválidos.')
  if (typeof v.cpf !== 'string' || (v.cpf !== '' && !cpfValido(v.cpf))) recusar('CPF inválido.')
  return {
    id: v.id, criadoEm: agora, nota: v.nota, notaSetor: v.notaSetor, setorId: setor.id, setor: setor.nome,
    motivos, notaCaixa: v.notaCaixa, motivosCaixa, cpf: v.cpf, comentario: '', comentadoEm: null,
  }
}

// O QR do totem vale por um dia: depois disso o comentário não é mais aceito.
export const PRAZO_COMENTARIO_MS = 24 * 60 * 60 * 1000

/** Situação do comentário de uma avaliação: 'aberto' | 'comentado' | 'expirado'. */
export function situacaoComentario(doc, agora = Date.now()) {
  if (doc.comentario?.trim()) return 'comentado'
  return agora - Date.parse(doc.criadoEm) > PRAZO_COMENTARIO_MS ? 'expirado' : 'aberto'
}

export function prepararComentario(doc, texto, agora = new Date()) {
  if (typeof texto !== 'string' || !texto.trim() || texto.length > 1200) recusar('Escreva um comentário de até 1200 caracteres.')
  const situacao = situacaoComentario(doc, agora.getTime())
  if (situacao === 'comentado') throw new ErroNps('already-exists', 'Esta avaliação já recebeu um comentário.')
  if (situacao === 'expirado') throw new ErroNps('failed-precondition', 'O prazo para comentar esta avaliação terminou.')
  return { ...doc, comentario: texto.trim(), comentadoEm: agora.toISOString() }
}

/** O que o painel recebe: CPF nunca sai, só se foi informado. */
export const paraPainel = doc => {
  const { cpf, ...resto } = doc
  return { ...resto, cpfInformado: !!cpf }
}

function celula(valor) {
  let texto = String(valor ?? '').replace(/\r?\n/g, ' ').trim()
  if (/^[=+@-]/.test(texto)) texto = "'" + texto
  return `"${texto.replaceAll('"', '""')}"`
}

/** Planilha da base. CPF só entra quando comCpf (administrador). */
export function paraCsv(docs, { comCpf = false } = {}) {
  const colunas = ['ID', 'Data', 'Nota NPS', 'Setor', 'Motivos', 'Comentário', 'Nota caixa', ...(comCpf ? ['CPF'] : ['CPF informado']), 'Motivos caixa', 'Nota setor']
  const linhas = [...docs].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).map(d => [
    d.id, d.criadoEm, d.nota, d.setor, d.motivos.join(' | '), d.comentario,
    d.notaCaixa === 0 ? 'Não passei pelo caixa' : d.notaCaixa ?? '',
    comCpf ? d.cpf || '' : (d.cpf || d.cpfInformado ? 'Sim' : 'Não'),
    (d.motivosCaixa || []).join(' | '), d.notaSetor ?? '',
  ])
  return '﻿' + [colunas, ...linhas].map(l => l.map(celula).join(',')).join('\n') + '\n'
}
