import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { isActiveProfile } from './securityPolicy.js'
import { dataScope } from './dataScope.js'
import { scopedOSSnapshot } from './osPolicy.js'
import { podeAcessar } from './tabPolicy.js'
import { rankingDoSetor, rankingPublico } from './rankingSetor.js'

const salesFields = new Set(['dt','mes','empresa','tipoMov','tipoMercadoria','cat','comissao','responsavel','tecnico','valor','custo','eDevolucao','nrReq','tipoOS','consultor','mo','totalServico','totalRevisao','totalCortesia','osId','contaPassagem','cidade','Cidade','Município','Municipio','bairro','Bairro','Bairro Cliente','regiao','Região','uf','UF','Estado','produto','Descrição Produto','Descrição','Produto','Código Produto','quantidade','Quantidade'])
const configKeys = new Set(['colaboradores', 'metas', 'regras', 'lojas', 'regra_pecas', 'regra_oficina', 'comissao_operacional', 'comissao_gestao', 'permissoes', 'estoqueControle', 'gestaoManual', 'ihs_mapeamento','regrasOS','atacadoConfig'])
const filePattern = /^(?:Dados\/(?:Pecas|Oficina)\/(?:\d{2}-\d{4}|\d{4}-\d{2})|dados\/(?:pecas|oficina)\/\d{2}-\d{4}|Dados\/Estoque\/(?:[a-z_]+\/)?[\w.-]{1,120}|obsoleto\/[\w.-]{1,120})\.json$/
// Capacidade: até 10 instâncias × 8 pedidos = 80 consultas simultâneas (antes 3 × 2 = 6, pouco para
// a equipe abrindo o sistema de manhã: cada pessoa faz várias consultas no boot). 1 GiB porque cada
// pedido pode ler e filtrar uma base mensal de até 15 MB. Só cobra quando há uso.
export const lerDadosAutorizados = onCall({ region: 'southamerica-east1', cors: ['https://posvenda-bi.web.app', 'https://posvenda-bi.firebaseapp.com', /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/], maxInstances: 10, concurrency: 8, timeoutSeconds: 90, memory: '1GiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre no sistema.')
  const db = getFirestore(), profile = (await db.doc(`usuarios/${request.auth.uid}`).get()).data()
  if (!isActiveProfile(profile)) throw new HttpsError('permission-denied', 'Acesso indisponível.')
  const { kind, key, path } = request.data || {}
  if (!['config', 'configs', 'file', 'bonuses', 'stockIndex','os','wholesale','overview','rankingSetor'].includes(kind) || kind === 'config' && (typeof key !== 'string' || !configKeys.has(key)) || ['file','wholesale'].includes(kind) && (typeof path !== 'string' || !filePattern.test(path))) throw new HttpsError('invalid-argument', 'Consulta inválida.')
  const readConfig = async name => { const snap = await db.doc(`config/${name}`).get(); return snap.exists ? (typeof snap.data().payload === 'string' ? JSON.parse(snap.data().payload) : snap.data()) : {} }
  const [collaborators, rules, savedStores] = await Promise.all([readConfig('colaboradores'), readConfig('regras'), readConfig('lojas')])
  const stores = Object.assign({}, ...Object.values(rules).map(month => month.lojas || {}), savedStores)
  const scope = dataScope(profile, collaborators, stores)
  if(['os','wholesale'].includes(kind)){
    if(!['admin','coordenador','supervisor'].includes(profile.role))throw new HttpsError('permission-denied','Consulta exige acesso de gestão.')
    // Mesma política de abas do app (cargo + setor). Antes, sem config salva, o módulo ficava liberado.
    const permissions=await readConfig('permissoes'),path=kind==='os'?'/monitor-os':'/atacado'
    if(!podeAcessar(profile.role,path,permissions,profile.setor))throw new HttpsError('permission-denied','Módulo não autorizado para este perfil.')
    if(kind==='os'){
      try{
        const file=getStorage().bucket('posvenda-bi.firebasestorage.app').file('Dados/OS/monitor.json'),[meta]=await file.getMetadata()
        if(Number(meta.size)>15000000)throw Error('size')
        const [bytes]=await file.download()
        return scopedOSSnapshot(JSON.parse(bytes.toString()),scope)
      }catch(error){if(error.code===404)return {foto:null,anterior:null,historico:[]};throw new HttpsError('unavailable','Não foi possível consultar as O.S. autorizadas.')}
    }
  }
  // Uma chave ou várias: o cliente não-admin busca toda a configuração em uma
  // única chamada (antes eram 11 chamadas, cada uma relendo colaboradores,
  // regras e lojas).
  const scopedConfig = async key => {
    const value = key === 'colaboradores' ? collaborators : key === 'regras' ? rules : key === 'lojas' ? stores : await readConfig(key)
    if (key === 'comissao_gestao') return Array.isArray(value) ? value.filter(row => scope.nameAllowed(row.colaborador)) : {}
    if (['colaboradores', 'metas', 'gestaoManual'].includes(key)) {
      const scoped = scope.namedConfig(value)
      if (key === 'colaboradores') for (const records of Object.values(scoped)) for (const person of Object.values(records)) delete person.salario_base
      return scoped
    }
    if (key === 'lojas') return Object.fromEntries(Object.entries(value).filter(([code]) => scope.storeAllowed(code)))
    if (key === 'regras') return Object.fromEntries(Object.entries(value).map(([month, rule]) => [month, { ...rule, gestao: (rule.gestao || []).filter(row => !row.colaborador || dataScope(profile, collaborators, stores, month).nameAllowed(row.colaborador)), lojas: Object.fromEntries(Object.entries(rule.lojas || {}).filter(([code]) => scope.storeAllowed(code))) }]))
    return value
  }
  if (kind === 'config') return scopedConfig(key)
  if (kind === 'configs') {
    const keys = request.data?.keys
    if (!Array.isArray(keys) || !keys.length || keys.length > 20 || keys.some(name => typeof name !== 'string' || !configKeys.has(name))) throw new HttpsError('invalid-argument', 'Consulta inválida.')
    const entries = await Promise.all([...new Set(keys)].map(async name => [name, await scopedConfig(name)]))
    return Object.fromEntries(entries)
  }
  if (kind === 'bonuses') {
    const snap = await db.collection('bonificacoes').limit(3000).get()
    return snap.docs.map(doc => doc.data()).filter(row => dataScope(profile, collaborators, stores, row.mes).nameAllowed(row.nome))
  }
  // Visão geral do portal: só números somados do mês (nenhum nome, nenhuma linha
  // de venda). É o que permite colaborador e supervisor verem o andamento da
  // empresa em modo leitura sem ampliar o acesso aos registros em si.
  const mesDoPedido = () => {
    const mes = request.data?.mes
    if (typeof mes !== 'string' || !/^(0[1-9]|1[0-2])\/\d{4}$/.test(mes)) throw new HttpsError('invalid-argument', 'Mês inválido.')
    return mes
  }
  const lerBaseDoMes = async (pasta, mes) => {
    try {
      const file = getStorage().bucket('posvenda-bi.firebasestorage.app').file(`Dados/${pasta}/${mes.replace('/', '-')}.json`), [meta] = await file.getMetadata()
      if (Number(meta.size) > 15000000) throw new HttpsError('resource-exhausted', 'Base do mês acima do limite para consulta.')
      const [bytes] = await file.download()
      const rows = JSON.parse(bytes.toString())
      return Array.isArray(rows) ? rows : []
    } catch (error) {
      if (error.code === 404 || error.code === 'ENOENT') return []
      throw error
    }
  }
  // Ranking do setor em "Meu desempenho": nome e % da meta dos colegas do mesmo
  // cargo_movimento; R$ e meta só da própria pessoa (rankingPublico).
  if (kind === 'rankingSetor') {
    const mes = mesDoPedido(), metrica = request.data?.metrica
    if (!['mp', 'mo', 'mpo'].includes(metrica)) throw new HttpsError('invalid-argument', 'Métrica inválida.')
    if (!podeAcessar(profile.role, '/desempenho', await readConfig('permissoes'), profile.setor)) throw new HttpsError('permission-denied', 'Módulo não autorizado para este perfil.')
    const [pecas, oficina, metas] = await Promise.all([lerBaseDoMes('Pecas', mes), lerBaseDoMes('Oficina', mes), readConfig('metas')])
    return rankingPublico(rankingDoSetor({ pecas, oficina, colaboradores: collaborators, metas, mes, meuNome: profile.nome, metrica }))
  }
  if (kind === 'overview') {
    const mes = mesDoPedido()
    const [pecas, oficina] = await Promise.all([lerBaseDoMes('Pecas', mes), lerBaseDoMes('Oficina', mes)])
    const porLoja = (rows, value) => {
      const map = {}
      for (const row of rows) {
        const store = row.empresa || row.loja
        if (!store) continue
        map[store] = (map[store] || 0) + value(row)
      }
      return map
    }
    const pessoas = new Set()
    const personKey = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
    for (const row of pecas) if (row.responsavel) pessoas.add(personKey(row.responsavel))
    for (const row of oficina) for (const nome of [row.consultor, row.tecnico]) if (nome) pessoas.add(personKey(nome))
    const somar = map => Object.values(map).reduce((total, value) => total + value, 0)
    const lojasPecas = porLoja(pecas, row => Number(row.valor) || 0)
    const lojasMO = porLoja(oficina, row => Number(row.mo) || 0)
    const lojasOS = porLoja(oficina, row => Number(row.pocoficina) || 0)
    return {
      mes,
      pecas: { total: somar(lojasPecas), registros: pecas.length, lojas: lojasPecas },
      oficina: { maoObra: somar(lojasMO), pecasOS: somar(lojasOS), registros: oficina.length, lojas: lojasMO },
      pessoas: pessoas.size,
    }
  }
  const bucket = getStorage().bucket('posvenda-bi.firebasestorage.app')
  // Posições de estoque só para quem tem a aba Estoque liberada.
  if ((kind === 'stockIndex' || (kind === 'file' && /^(Dados\/Estoque|obsoleto)\//.test(path))) && !podeAcessar(profile.role, '/estoque', await readConfig('permissoes'), profile.setor)) throw new HttpsError('permission-denied', 'Módulo não autorizado para este perfil.')
  if (kind === 'stockIndex') {
    const lists = await Promise.all(['Dados/Estoque/', 'obsoleto/'].map(prefix => bucket.getFiles({ prefix, maxResults: 1000, autoPaginate: false })))
    return [...new Set(lists.flatMap(([files]) => files.map(file => file.name).filter(name => /^(Dados\/Estoque|obsoleto)\/[\w.-]+\.json$/.test(name)).map(name => name.split('/').at(-1).slice(0, -5))))].sort().reverse()
  }
  try {
    const file = bucket.file(path), [metadata] = await file.getMetadata()
    if (Number(metadata.size) > 15000000) throw new HttpsError('resource-exhausted', 'Arquivo muito grande para consultar.')
    const [bytes] = await file.download(), value = JSON.parse(bytes.toString())
    if (Array.isArray(value)) {
      const stem = path.split('/').at(-1).slice(0, -5)
      const fileMonth = /^\d{2}-\d{4}$/.test(stem) ? stem.replace('-', '/') : /^\d{4}-\d{2}$/.test(stem) ? stem.slice(5) + '/' + stem.slice(0, 4) : null
      const fileScope = fileMonth ? dataScope(profile, collaborators, stores, fileMonth) : scope
      return value.filter(row=>fileScope.rowAllowed(row)&&(kind!=='wholesale'||row.cat==='ATACADO')).map(row => Object.fromEntries(Object.entries(row).filter(([key]) => salesFields.has(key)||(kind==='wholesale'&&['Pessoa','Número','Mercadoria','Código Mercadoria','Tipo Movimento','tipoMovimento','vendedor','Vendedor'].includes(key)))))
    }
    const { resumo, ...safe } = value
    return { ...safe, itens: (value.itens || []).filter(row => scope.storeAllowed(row.loja || row.empresa)) }
  } catch (error) { if (error.code === 404) return null; throw new HttpsError('unavailable', 'Não foi possível consultar a base autorizada.') }
})
