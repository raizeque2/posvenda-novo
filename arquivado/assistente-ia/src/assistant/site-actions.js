import { MODULOS, podeAcessar } from '../data/permissoes.js'
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
const aliases = {
  '/atacado': ['vendas atacado','clientes atacado','carteira','inativos'], '/monitor-os': ['ordens de servico','os','oficina','criticidade'],
  '/': ['inicio','home'], '/dashboard': ['bi','vendas','resultados','graficos'],
  '/desempenho': ['meu resultado','meu perfil','minhas metas','desempenho'],
  '/estoque': ['produtos','pecas paradas'], '/equipes': ['equipe','gestores'],
  '/metas': ['meta','objetivos'], '/comissoes': ['comissao','bonificacao','bonus'],
  '/resumo-mensal': ['resumo'], '/upload': ['csv','importar','arquivos'],
  '/colaboradores': ['pessoas','funcionarios'], '/regras': ['configuracoes','regras'], '/acesso': ['acessos','usuarios'],
}
export function siteActions(role, permissions, setor) {
  return MODULOS.filter(action => podeAcessar(role,action.path,permissions,setor))
    .map(action => ({...action,id:action.path,keywords:aliases[action.path] || []}))
}
export function searchActions(actions, query) {
  const q = normalize(query).replace(/^(abrir|ir para|acessar|pagina de|pagina) /,'')
  if (!q) return actions.slice(0,5)
  return actions.map(action => {
    const terms=[action.label,...(action.keywords || [])].map(normalize)
    const score=terms.some(term=>term===q)?3:terms.some(term=>term.startsWith(q))?2:terms.some(term=>term.includes(q))?1:0
    return {action,score}
  }).filter(row=>row.score).sort((a,b)=>b.score-a.score).slice(0,5).map(row=>row.action)
}
