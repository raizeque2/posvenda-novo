// Gestão de equipe sem depender do administrador: supervisores e coordenadores gravam metas e
// mudanças de equipe dentro do próprio escopo. Módulo puro (sem Firebase): o servidor
// (gestaoEquipeCallable.js) e a prévia local passam um adaptador { get(path), set(path, data) }.
//
// Escopo de cada perfil:
//  - admin: tudo.
//  - coordenador: pessoas cujo supervisor responde a ele (equipe/org → coordenadorDe) e esses
//    supervisores. Muda pessoas entre os próprios supervisores direto, sem pedido.
//  - supervisor: metas da própria equipe. Mudar pessoa de equipe vira pedido, aprovado por quem
//    hoje responde por ela (o supervisor atual ou o coordenador dele).
//  - operacional: só a própria foto.
// Ninguém grava a própria meta.

export const chave = valor => String(valor || '').normalize('NFD').replace(/[̀-ͯ\[\]]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
const lista = valor => String(valor || '').split(';').map(v => v.trim()).filter(Boolean)
const mesmo = (a, b) => !!a && chave(a) === chave(b)
const MES = /^(0[1-9]|1[0-2])\/\d{4}$/
const DIA = /^\d{4}-\d{2}-\d{2}$/
const FOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/
const LIMITE_SOLICITACOES = 300
const LIMITE_AUDITORIA = 500

export class ErroEquipe extends Error {
  constructor(code, message) { super(message); this.code = code }
}
const negar = msg => { throw new ErroEquipe('permission-denied', msg) }
const invalido = msg => { throw new ErroEquipe('invalid-argument', msg) }

const lerPayload = (doc, padrao) => {
  if (!doc) return padrao
  if (typeof doc.payload !== 'string') return padrao
  try { return JSON.parse(doc.payload) ?? padrao } catch { return padrao }
}
const docId = nome => chave(nome).replace(/[^A-Z0-9]+/g, '_').slice(0, 120) || '_'

async function carregar(store) {
  const [colab, metas, org, solic, audit, regras, lojas] = await Promise.all(
    ['config/colaboradores', 'config/metas', 'equipe/org', 'equipe/solicitacoes', 'equipe/auditoria', 'config/regras', 'config/lojas'].map(p => store.get(p)))
  const regrasMes = lerPayload(regras, {})
  return {
    docs: { colab, metas },
    colaboradores: lerPayload(colab, {}),
    metas: lerPayload(metas, {}),
    org: { coordenadores: [], coordenadorUf: {}, coordenadorDe: {}, lotacoes: {}, ...lerPayload(org, {}) },
    solicitacoes: lerPayload(solic, []),
    auditoria: lerPayload(audit, []),
    lojas: Object.assign({}, ...Object.values(regrasMes).map(m => m?.lojas || {}), lerPayload(lojas, {})),
  }
}

const coordDe = (org, supervisor) => Object.entries(org.coordenadorDe || {}).find(([s]) => mesmo(s, supervisor))?.[1] || ''
const registroDe = (colaboradores, mes, nome) => Object.entries(colaboradores[mes] || {}).find(([k, p]) => mesmo(p?.colaborador || k, nome)) || null
const estadosDe = profile => profile.estados?.length ? profile.estados : profile.estado ? [profile.estado] : null
const noEstado = (profile, lojas, pessoa) => { const e = estadosDe(profile); return !e || e.includes(lojas[pessoa?.loja]?.uf) }

function supervisoresConhecidos(colaboradores, mes) {
  const nomes = new Map()
  for (const p of Object.values(colaboradores[mes] || {})) {
    for (const s of lista(p?.supervisor)) nomes.set(chave(s), s)
    if (/SUPERVISOR/i.test(p?.cargo || '') && p?.colaborador) nomes.set(chave(p.colaborador), p.colaborador)
  }
  return nomes
}

// Pode gravar metas / períodos desta pessoa?
function gerencia(profile, s, mes, pessoa) {
  if (profile.role === 'admin') return true
  const eu = profile.nome
  if (!eu || mesmo(pessoa.colaborador, eu) || !noEstado(profile, s.lojas, pessoa)) return false
  const sups = lista(pessoa.supervisor)
  if (profile.role === 'supervisor') return sups.some(x => mesmo(x, eu))
  if (profile.role === 'coordenador') {
    const ehSupervisorMeu = mesmo(coordDe(s.org, pessoa.colaborador), eu)
    return ehSupervisorMeu || sups.some(x => mesmo(coordDe(s.org, x), eu))
  }
  return false
}

function quemAprova(s, pedido) {
  const nomes = []
  if (pedido.tipo === 'pessoa') {
    const de = lista(pedido.de)
    if (de.length) for (const x of de) nomes.push(x, coordDe(s.org, x))
    else if (pedido.para) nomes.push(coordDe(s.org, pedido.para))
  } else {
    nomes.push(pedido.de || pedido.para)
  }
  return nomes.filter(Boolean)
}
const aprova = (profile, s, pedido) => profile.role === 'admin' || (!!profile.nome && quemAprova(s, pedido).some(n => mesmo(n, profile.nome)))
function envolvido(profile, s, pedido) {
  if (profile.role === 'admin') return true
  const nomes = [pedido.pessoa, pedido.para, ...lista(pedido.de), coordDe(s.org, pedido.para), ...lista(pedido.de).map(x => coordDe(s.org, x))]
  return nomes.some(n => mesmo(n, profile.nome))
}

function auditar(s, profile, acao, detalhe, agora) {
  s.auditoria = [...s.auditoria, { quando: agora, por: profile.nome || profile.email || 'sem nome', papel: profile.role, acao, detalhe }].slice(-LIMITE_AUDITORIA)
  s.mudou.add('auditoria')
}

function aplicar(s, pedido, agora) {
  if (pedido.tipo === 'pessoa') {
    const achado = registroDe(s.colaboradores, pedido.mes, pedido.pessoa)
    if (!achado) throw new ErroEquipe('not-found', 'Pessoa não encontrada no cadastro do mês.')
    const [k, p] = achado
    s.colaboradores = { ...s.colaboradores, [pedido.mes]: { ...s.colaboradores[pedido.mes], [k]: { ...p, supervisor: pedido.para || '' } } }
    const lotacoes = { ...s.org.lotacoes }
    for (const nome of Object.keys(lotacoes)) if (mesmo(nome, p.colaborador || k)) delete lotacoes[nome]
    s.org = { ...s.org, lotacoes }
    s.mudou.add('colaboradores').add('org')
    s.alterados.push({ mes: pedido.mes, registro: s.colaboradores[pedido.mes][k] })
  } else {
    const coordenadorDe = Object.fromEntries(Object.entries(s.org.coordenadorDe || {}).filter(([sup]) => !mesmo(sup, pedido.pessoa)))
    if (pedido.para) coordenadorDe[pedido.pessoa] = pedido.para
    s.org = { ...s.org, coordenadorDe }
    s.mudou.add('org')
  }
  s.ts = agora
}

function validarMetas(entrada) {
  if (!Array.isArray(entrada) || !entrada.length || entrada.length > 400) invalido('Lista de metas inválida.')
  return entrada.map(item => {
    if (!item || typeof item.colaborador !== 'string' || !item.colaborador.trim()) invalido('Meta sem colaborador.')
    const numero = v => { const n = Number(v ?? 0); if (!Number.isFinite(n) || n < 0 || n > 1e9) invalido(`Valor de meta inválido para ${item.colaborador}.`); return n }
    const metas = {}
    const canais = Object.entries(item.metas || {})
    if (canais.length > 12) invalido('Canais demais.')
    for (const [canal, v] of canais) {
      if (!/^[A-Z_ ]{2,30}$/.test(canal)) invalido(`Canal inválido: ${canal}`)
      metas[canal] = { mp: numero(v?.mp), mo: numero(v?.mo), mpo: numero(v?.mpo) }
    }
    return { colaborador: item.colaborador.trim(), mp: numero(item.mp), mo: numero(item.mo), mpo: numero(item.mpo), metas }
  })
}

function validarPeriodos(periodos, supervisores) {
  if (!Array.isArray(periodos) || periodos.length > 12) invalido('Períodos inválidos.')
  return periodos.map(p => {
    if (!p || !DIA.test(p.de) || !DIA.test(p.ate) || p.de > p.ate) invalido('Período com datas inválidas.')
    if (!supervisores.has(chave(p.supervisor))) invalido(`${p.supervisor} não é supervisor cadastrado.`)
    return { supervisor: supervisores.get(chave(p.supervisor)), de: p.de, ate: p.ate }
  })
}

function orgVisivel(profile, s) {
  if (['admin', 'coordenador'].includes(profile.role)) return s.org
  const eu = profile.nome
  const meus = new Set()
  for (const registros of Object.values(s.colaboradores)) for (const [k, p] of Object.entries(registros || {})) {
    const nome = p?.colaborador || k
    if (mesmo(nome, eu) || (profile.role === 'supervisor' && lista(p?.supervisor).some(x => mesmo(x, eu)))) meus.add(chave(nome))
  }
  return {
    coordenadores: s.org.coordenadores || [],
    coordenadorUf: s.org.coordenadorUf || {},
    coordenadorDe: Object.fromEntries(Object.entries(s.org.coordenadorDe || {}).filter(([sup]) => mesmo(sup, eu))),
    lotacoes: Object.fromEntries(Object.entries(s.org.lotacoes || {}).filter(([nome]) => meus.has(chave(nome)))),
  }
}

export async function executarGestaoEquipe(profile, dados, store, { agora = Date.now(), novoId = () => crypto.randomUUID() } = {}) {
  if (!profile || !['admin', 'coordenador', 'supervisor', 'operacional'].includes(profile.role)) negar('Acesso indisponível.')
  const acao = dados?.acao
  const s = { ...(await carregar(store)), mudou: new Set(), alterados: [], ts: agora }
  let resposta = { ok: true }

  if (acao === 'ler') {
    const visiveis = s.solicitacoes
      .filter(p => profile.role === 'admin' || envolvido(profile, s, p))
      .map(p => ({ ...p, podeDecidir: p.status === 'pendente' && aprova(profile, s, p) }))
    return { org: orgVisivel(profile, s), solicitacoes: visiveis }
  }

  if (acao === 'metas') {
    if (!['admin', 'coordenador', 'supervisor'].includes(profile.role)) negar('Seu perfil não grava metas.')
    if (!MES.test(dados.mes || '')) invalido('Mês inválido.')
    const entrada = validarMetas(dados.lista)
    const doMes = { ...(s.metas[dados.mes] || {}) }
    const gravadas = []
    for (const item of entrada) {
      const achado = registroDe(s.colaboradores, dados.mes, item.colaborador)
      if (!achado) invalido(`${item.colaborador} não está no cadastro de ${dados.mes}.`)
      const pessoa = { ...achado[1], colaborador: achado[1].colaborador || achado[0] }
      if (!gerencia(profile, s, dados.mes, pessoa)) negar(`Você não pode definir a meta de ${pessoa.colaborador}.`)
      const anterior = doMes[pessoa.colaborador] || {}
      doMes[pessoa.colaborador] = { ...anterior, colaborador: pessoa.colaborador, mp: item.mp, mo: item.mo, mpo: item.mpo, metas: item.metas, mes: dados.mes }
      gravadas.push(doMes[pessoa.colaborador])
    }
    s.metas = { ...s.metas, [dados.mes]: doMes }
    s.mudou.add('metas')
    auditar(s, profile, 'metas', `${gravadas.length} meta(s) de ${dados.mes}: ${gravadas.map(g => g.colaborador).join(', ')}`.slice(0, 500), agora)
    resposta = { ok: true, mes: dados.mes, metas: gravadas }
  } else if (acao === 'solicitar') {
    if (!['admin', 'coordenador', 'supervisor'].includes(profile.role)) negar('Seu perfil não altera equipes.')
    const { tipo, pessoa, mes } = dados
    const para = typeof dados.para === 'string' ? dados.para.trim() : ''
    if (!['pessoa', 'supervisor'].includes(tipo) || typeof pessoa !== 'string' || !pessoa.trim()) invalido('Pedido inválido.')
    let pedido
    if (tipo === 'pessoa') {
      if (!MES.test(mes || '')) invalido('Mês inválido.')
      const achado = registroDe(s.colaboradores, mes, pessoa)
      if (!achado) invalido('Pessoa não encontrada no cadastro do mês.')
      const supervisores = supervisoresConhecidos(s.colaboradores, mes)
      if (para && !supervisores.has(chave(para))) invalido(`${para} não é supervisor cadastrado.`)
      if (!noEstado(profile, s.lojas, achado[1])) negar('Pessoa fora dos seus estados.')
      const de = achado[1].supervisor || ''
      if (lista(de).length === 1 && mesmo(de, para)) invalido('A pessoa já está nessa equipe.')
      pedido = { tipo, pessoa: achado[1].colaborador || achado[0], de, para: para ? supervisores.get(chave(para)) : '', mes, uf: s.lojas[achado[1].loja]?.uf || '' }
    } else {
      if (para && !(s.org.coordenadores || []).some(c => mesmo(c, para))) invalido(`${para} não é coordenador cadastrado.`)
      const de = coordDe(s.org, pessoa)
      if (mesmo(de, para)) invalido('O supervisor já responde a esse coordenador.')
      pedido = { tipo, pessoa: pessoa.trim(), de, para, mes: MES.test(mes || '') ? mes : '', uf: '' }
    }
    if (!envolvido(profile, s, pedido)) negar('Você só pode pedir mudanças que envolvem você ou sua equipe.')
    if (!pedido.de && !pedido.para) invalido('Pedido sem origem nem destino.')
    if (aprova(profile, s, pedido)) {
      aplicar(s, pedido, agora)
      s.solicitacoes = [...s.solicitacoes, { ...pedido, id: novoId(), por: profile.nome || 'Administrador', quando: agora, status: 'aprovada', decididoPor: profile.nome || 'Administrador', decididoEm: agora }]
      s.mudou.add('solicitacoes')
      auditar(s, profile, 'equipe', `${pedido.pessoa}: ${pedido.de || 'sem responsável'} → ${pedido.para || 'sem responsável'}`, agora)
      resposta = { ok: true, aplicada: true, alterados: s.alterados }
    } else {
      const repetido = s.solicitacoes.some(p => p.status === 'pendente' && p.tipo === pedido.tipo && mesmo(p.pessoa, pedido.pessoa) && mesmo(p.para || '-', pedido.para || '-'))
      if (repetido) return { ok: true, aplicada: false, repetida: true }
      s.solicitacoes = [...s.solicitacoes, { ...pedido, id: novoId(), por: profile.nome, quando: agora, status: 'pendente' }]
      s.mudou.add('solicitacoes')
      resposta = { ok: true, aplicada: false, aprovadores: quemAprova(s, pedido) }
    }
  } else if (acao === 'decidir') {
    const pedido = s.solicitacoes.find(p => p.id === dados.id)
    if (!pedido) throw new ErroEquipe('not-found', 'Pedido não encontrado.')
    if (pedido.status !== 'pendente') return { ok: true, jaDecidida: true }
    if (!['aprovada', 'recusada'].includes(dados.status)) invalido('Decisão inválida.')
    if (!aprova(profile, s, pedido)) negar('Este pedido precisa ser decidido por quem responde pela pessoa.')
    let status = dados.status
    if (status === 'aprovada') {
      const atual = pedido.tipo === 'pessoa' ? registroDe(s.colaboradores, pedido.mes, pedido.pessoa)?.[1]?.supervisor || '' : coordDe(s.org, pedido.pessoa)
      if (chave(atual) !== chave(pedido.de)) status = 'expirada'
      else aplicar(s, pedido, agora)
    }
    s.solicitacoes = s.solicitacoes.map(p => p.id === pedido.id ? { ...p, status, decididoPor: profile.nome || 'Administrador', decididoEm: agora } : p)
    s.mudou.add('solicitacoes')
    auditar(s, profile, 'decisao', `${status}: ${pedido.pessoa} → ${pedido.para || 'sem responsável'}`, agora)
    resposta = { ok: true, status, alterados: s.alterados }
  } else if (acao === 'periodos') {
    if (!['admin', 'coordenador'].includes(profile.role)) negar('Só coordenador ou administrador divide a pessoa entre equipes.')
    if (!MES.test(dados.mes || '')) invalido('Mês inválido.')
    const achado = registroDe(s.colaboradores, dados.mes, dados.pessoa)
    if (!achado) invalido('Pessoa não encontrada no cadastro do mês.')
    const pessoa = { ...achado[1], colaborador: achado[1].colaborador || achado[0] }
    const periodos = validarPeriodos(dados.periodos, supervisoresConhecidos(s.colaboradores, dados.mes))
    if (profile.role === 'coordenador') {
      if (!gerencia(profile, s, dados.mes, pessoa)) negar(`${pessoa.colaborador} não é da sua coordenação.`)
      if (periodos.some(p => !mesmo(coordDe(s.org, p.supervisor), profile.nome))) negar('Todos os responsáveis do período precisam ser da sua coordenação.')
    }
    const lotacoes = Object.fromEntries(Object.entries(s.org.lotacoes || {}).filter(([n]) => !mesmo(n, pessoa.colaborador)))
    if (periodos.length) lotacoes[pessoa.colaborador] = periodos
    s.org = { ...s.org, lotacoes }
    s.mudou.add('org')
    auditar(s, profile, 'periodos', `${pessoa.colaborador}: ${periodos.map(p => `${p.supervisor} ${p.de}→${p.ate}`).join('; ') || 'sem divisão'}`, agora)
    resposta = { ok: true, lotacoes: periodos }
  } else if (acao === 'estrutura') {
    if (profile.role !== 'admin') negar('Só o administrador cria ou remove coordenadores.')
    const { coordenadores, coordenadorUf, coordenadorDe, lotacoes } = dados
    const nomes = v => Array.isArray(v) && v.length <= 60 && v.every(n => typeof n === 'string' && n.length <= 120)
    const mapa = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length <= 500 && Object.values(v).every(n => typeof n === 'string' && n.length <= 120)
    if (!nomes(coordenadores) || !mapa(coordenadorUf || {}) || !mapa(coordenadorDe || {})) invalido('Estrutura inválida.')
    s.org = { ...s.org, coordenadores, coordenadorUf: coordenadorUf || {}, coordenadorDe: coordenadorDe || {} }
    // Só para trazer o que estava no navegador do administrador antes desta versão.
    if (lotacoes && typeof lotacoes === 'object' && !Object.keys(s.org.lotacoes || {}).length) s.org.lotacoes = lotacoes
    s.mudou.add('org')
    auditar(s, profile, 'estrutura', `${coordenadores.length} coordenador(es)`, agora)
  } else if (acao === 'foto') {
    const nome = typeof dados.nome === 'string' ? dados.nome.trim() : ''
    if (!nome) invalido('Pessoa não informada.')
    if (dados.foto !== null && (typeof dados.foto !== 'string' || dados.foto.length > 400000 || !FOTO.test(dados.foto))) invalido('A foto precisa ser JPG, PNG ou WebP com até 300 KB.')
    const propria = mesmo(nome, profile.nome)
    const daEquipe = Object.keys(s.colaboradores).some(mes => { const r = registroDe(s.colaboradores, mes, nome); return r && gerencia(profile, s, mes, { ...r[1], colaborador: r[1].colaborador || r[0] }) })
    if (!propria && !daEquipe) negar('Você só pode trocar a sua foto ou a de alguém da sua equipe.')
    await store.set(`equipeFotos/${docId(nome)}`, { nome, foto: dados.foto, por: profile.nome || '', em: agora })
    return { ok: true }
  } else {
    invalido('Ação desconhecida.')
  }

  const gravar = { colaboradores: () => store.set('config/colaboradores', { ...(s.docs.colab || {}), payload: JSON.stringify(s.colaboradores), ts: s.ts }),
    metas: () => store.set('config/metas', { ...(s.docs.metas || {}), payload: JSON.stringify(s.metas), ts: s.ts }),
    org: () => store.set('equipe/org', { payload: JSON.stringify(s.org), ts: agora }),
    solicitacoes: () => store.set('equipe/solicitacoes', { payload: JSON.stringify(s.solicitacoes.slice(-LIMITE_SOLICITACOES)), ts: agora }),
    auditoria: () => store.set('equipe/auditoria', { payload: JSON.stringify(s.auditoria), ts: agora }) }
  for (const nome of s.mudou) await gravar[nome]()
  return { ...resposta, versoes: Object.fromEntries([...s.mudou].filter(n => ['colaboradores', 'metas'].includes(n)).map(n => [n, s.ts])) }
}
