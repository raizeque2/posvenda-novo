// Política de abas — fonte única usada pelo navegador (menu, bottom bar e
// rotas) e pelo servidor (lerDadosAutorizados). Funções puras, sem SDK.
//
// Modelo (config/permissoes no Firestore):
//   { coordenador: [paths], supervisor: [paths], operacional: [paths],
//     setores: { 'Peças': [paths], ... } }
// A lista do cargo define o que a pessoa vê e em que ordem. Se o setor da
// pessoa tiver lista própria, ela RESTRINGE a do cargo (interseção): o setor
// nunca concede uma aba que o cargo não tenha. Administrador vê tudo; "Início"
// e "Acessos" são exclusivos do administrador e não são configuráveis.

export const MODULOS = [
  { path: '/', label: 'Início', section: 'Operacional', icon: 'home-simple', adminOnly: true },
  { path: '/crm', label: 'CRM & Clientes', section: 'Operacional', icon: 'group' },
  { path: '/dashboard', label: 'Faturamento', section: 'Operacional', icon: 'reports' },
  { path: '/desempenho', label: 'Meu Desempenho', section: 'Operacional', icon: 'star' },
  { path: '/estoque', label: 'Estoque', section: 'Operacional', icon: 'box' },
  { path: '/painel', label: 'Meu Painel', section: 'Operacional', icon: 'trophy' },
  { path: '/canais', label: 'Canais', section: 'Operacional', icon: 'shopping-bag' },
  { path: '/geografico', label: 'Análise Geográfica', section: 'Operacional', icon: 'map-pin' },
  { path: '/monitor-os', label: 'Monitor de O.S.', section: 'Conferências', icon: 'wrench' },
  { path: '/monitor-requisicoes', label: 'Monitor de Requisições', section: 'Conferências', icon: 'clipboard-check' },
  { path: '/monitor-reservas', label: 'Monitor de Reservas', section: 'Conferências', icon: 'packages' },
  { path: '/organograma', label: 'Organograma', section: 'Gestão', icon: 'group' },
  { path: '/atacado', label: 'Atacado', section: 'Gestão', icon: 'building' },
  { path: '/equipes', label: 'Equipes', section: 'Gestão', icon: 'group' },
  { path: '/metas', label: 'Metas', section: 'Gestão', icon: 'medal' },
  { path: '/comissoes', label: 'Comissão', section: 'Gestão', icon: 'percentage-circle' },
  { path: '/resumo-mensal', label: 'Fechamento', section: 'Gestão', icon: 'page' },
  { path: '/nps', label: 'NPS', section: 'Gestão', icon: 'thumbs-up' },
  { path: '/upload', label: 'Importação', section: 'Administração', icon: 'upload' },
  { path: '/colaboradores', label: 'Colaboradores', section: 'Administração', icon: 'user' },
  { path: '/regras', label: 'Configurações', section: 'Administração', icon: 'settings-profiles' },
  { path: '/acesso', label: 'Acessos', section: 'Administração', icon: 'shield-check', adminOnly: true },
]
export const MODULOS_CONFIGURAVEIS = MODULOS.filter(m => !m.adminOnly)
const CONFIGURAVEIS = new Set(MODULOS_CONFIGURAVEIS.map(m => m.path))

export const CARGOS = [
  { value: 'coordenador', label: 'Coordenadores' },
  { value: 'supervisor', label: 'Supervisores' },
  { value: 'operacional', label: 'Colaboradores' },
]
export const SETORES = ['Peças', 'Oficina', 'Atacado', 'Administrativo']

// Padrão quando não há config salva: as mesmas abas que cada cargo já via no
// menu antes desta mudança, sem ampliar nenhum acesso.
export const PERMISSOES_PADRAO = {
  coordenador: ['/crm', '/dashboard', '/desempenho', '/estoque', '/painel', '/canais', '/geografico', '/monitor-os', '/monitor-requisicoes', '/monitor-reservas', '/organograma', '/atacado', '/equipes', '/metas', '/comissoes', '/resumo-mensal', '/upload', '/colaboradores', '/regras'],
  supervisor: ['/crm', '/dashboard', '/desempenho', '/estoque', '/painel', '/canais', '/geografico', '/monitor-os', '/monitor-requisicoes', '/monitor-reservas', '/organograma', '/atacado', '/comissoes'],
  operacional: ['/crm', '/desempenho', '/painel'],
  setores: {},
}

// Teto por cargo: o que o administrador PODE liberar. Equivale ao que as rotas
// já permitiam antes (listas fixas de cargos); uma config salva mais ampla é
// ignorada fora do teto. Coordenador não tem teto além de Início/Acessos.
// NPS (12/11/2026) não entra em nenhum padrão: o administrador libera em Permissões.
const TETO = {
  supervisor: new Set([...PERMISSOES_PADRAO.supervisor, '/equipes', '/metas', '/colaboradores', '/nps']),
  operacional: new Set(['/crm', '/dashboard', '/desempenho', '/painel', '/canais', '/geografico', '/monitor-os', '/monitor-requisicoes', '/monitor-reservas', '/organograma', '/atacado']),
}
export const tetoDoCargo = cargo => TETO[cargo] ? [...TETO[cargo]] : MODULOS_CONFIGURAVEIS.map(m => m.path)

const ALIAS = { '/obsoleto': '/estoque', '/': '/dashboard' }
const limpar = lista => [...new Set((Array.isArray(lista) ? lista : []).map(p => ALIAS[p] || p).filter(p => CONFIGURAVEIS.has(p)))]

/** Normaliza o que veio do Firestore (aliases antigos, chaves desconhecidas). */
export function normalizePermissions(value) {
  const src = value && typeof value === 'object' ? value : {}
  const out = { setores: {} }
  for (const { value: cargo } of CARGOS) out[cargo] = Array.isArray(src[cargo]) ? limpar(src[cargo]) : [...PERMISSOES_PADRAO[cargo]]
  for (const setor of SETORES) if (Array.isArray(src.setores?.[setor])) out.setores[setor] = limpar(src.setores[setor])
  return out
}

// Início (12/11/2026): além do admin, coordenador e supervisor abrem o Início, que mostra
// o resultado do próprio recorte (coordenação / equipe). Os dados já vêm filtrados pelo
// servidor; a página só resume o que o Meu Painel já mostra. Colaborador continua sem.
const INICIO_GESTAO = new Set(['coordenador', 'supervisor'])

/** Abas visíveis, na ordem configurada. */
export function abasPermitidas(role, permissoes, setor) {
  if (role === 'admin') return MODULOS.map(m => m.path)
  if (!CARGOS.some(c => c.value === role)) return []
  const efetivo = normalizePermissions(permissoes || PERMISSOES_PADRAO)
  let lista = efetivo[role]
  if (TETO[role]) lista = lista.filter(p => TETO[role].has(p))
  const doSetor = setor && efetivo.setores[setor]
  if (doSetor) lista = lista.filter(p => doSetor.includes(p))
  return lista
}
/** Mostra o Início no menu? (fora de abasPermitidas, que é a lista configurável). */
export const temInicio = role => role === 'admin' || INICIO_GESTAO.has(role)

export function podeAcessar(role, path, permissoes, setor) {
  if (!role) return false
  if (role === 'admin') return true
  const base = '/' + String(path || '').split('/').filter(Boolean)[0]
  if (path === '/') return INICIO_GESTAO.has(role)
  if (base === '/acesso') return false
  if (base === '/perfil') return abasPermitidas(role, permissoes, setor).includes('/desempenho')
  if (base === '/conta') return true
  return abasPermitidas(role, permissoes, setor).includes(ALIAS[base] || base)
}

/** Primeira área válida para a pessoa (destino padrão e da página 404). */
export function rotaInicial(role, permissoes, setor) {
  if (temInicio(role)) return '/'
  return abasPermitidas(role, permissoes, setor)[0] || '/conta'
}
