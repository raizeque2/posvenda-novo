import { buildApelidoMap } from '../utils/normalizacao.js'
import { REGRA_PECAS, REGRA_OFICINA, LOJAS, COMISSAO_OPERACIONAL, COMISSAO_GESTAO } from '../data/regras.js'
import { salvarConfig, salvarBonificacoesLote as salvarBonificacoesLoteApi } from '../services/firestoreService.js'
import { mesCalendarioAtual as mesAtualFormatado, proximoMes as proximoMesFormatado, cmpMes } from '../utils/mesCalendario.js'

// Monta o registro cadastral de UM colaborador — evita repetir o mesmo objeto
// de campos nas 5 funções que gravam colaboradores (substituir/upsert/remove/
// setAtivo/preencherSupervisores).
function montarRegistroColaborador(mes, c) {
  return {
    colaborador:     c.colaborador,
    apelido:         c.apelido         ?? '',
    loja:            c.loja            ?? '',
    cargo:           c.cargo           ?? '',
    cargo_movimento: c.cargo_movimento ?? '',
    centro_custo:    c.centro_custo    ?? '',
    salario_base:    c.salario_base    ?? '',
    supervisor:      c.supervisor      ?? '',
    ativo:           c.ativo !== false,
    mes,
  }
}

export const IHS_LINHAS_OFICINA = {
  rev_entrega:           'Rev. Entrega',
  rev_gratuita:          'Rev. Gratuita',
  rev_periodica:         'Rev. Periódica',
  mecanica:              'Mecânica',
  serv_expresso:         'Serviço Expresso',
  serv_exp_rev_gratuita: 'Serviço Expresso Rev. Gratuita',
  serv_exp_rev_periodica:'Serviço Expresso Rev. Periódica',
  serv_exp_mecanica:     'Serviço Expresso Mecânica',
  serv_exp_garantia:     'Serviço Expresso Garantia',
  garantia:              'Garantia',
  acessorios:            'Acessórios',
  os_internas:           'OS Internas',
  ignorar:               '— Ignorar —',
}

export const IHS_CANAIS_PECAS = {
  oficina:      'Oficina',
  serv_expresso:'Serviço Expresso',
  balcao:       'Balcão',
  garantia:     'Garantia',
  externa:      'Externa',
  seguradora:   'Seguradora',
  compra_honda: 'Compra Honda',
  compra_outra: 'Compra Outra Conc.',
  ignorar:      '— Ignorar —',
}

export const IHS_CARGOS = {
  consultor_servicos:    'Consultor de Serviços',
  garantista:            'Garantista',
  administrativos:       'Administrativos',
  gerente_servicos:      'Gerente de Serviços',
  chefe_oficina:         'Chefe de Oficina',
  tecnicos_auxiliares:   'Técnicos / Auxiliares',
  lavador:               'Lavador',
  consultor_exp:         'Consultor Serv. Expresso',
  tecnico_exp:           'Técnico Serv. Expresso',
  vendedor_interno:      'Vendedor Interno (Peças)',
  vendedor_externo:      'Vendedor Externo (Peças)',
  telemarketing:         'Telemarketing (Peças)',
  chefe_pecas:           'Chefe de Peças / Encarregado',
  gerente_pecas:         'Gerente de Peças',
  ignorar:               '— Ignorar —',
}

const IHS_MAPEAMENTO_DEFAULT = {
  oficina: {
    '1ª REVISÃO GRATUITA EXPRESSO':      'serv_exp_rev_gratuita',
    '2ª REVISÃO GRATUITA EXPRESSO':      'serv_exp_rev_gratuita',
    'EXTERNO EXPRESSO':                  'serv_expresso',
    '00 - GARANTIA':                     'garantia',
    '00 - RECALL':                       'garantia',
    'REVISÃO PERIÓDICA':                 'rev_periodica',
    'DIAGNÓSTICO':                       'mecanica',
    'DIAGNÓSTICO EXTERNO':               'mecanica',
    'EXTERNO':                           'mecanica',
    'PROTEÇÃO VEÍCULAR':                 'mecanica',
    'PROTEÇÃO VEÍCULAR - FRANQUIA':      'mecanica',
    'RETRABALHO':                        'mecanica',
    'SEGURADORA':                        'mecanica',
    'SEGURADORA - FRANQUIA':             'mecanica',
    'SEGURADORA - PAD':                  'mecanica',
    'PROCESSO JUDICIAL':                 'os_internas',
    'INTERNO - PEÇAS':                   'os_internas',
    'INTERNO - OFICINA':                 'os_internas',
    'INTERNO - NOVOS':                   'os_internas',
    'INTERNO - SEMINOVOS':               'os_internas',
    'INTERNO - SEMINOVOS EM ESTOQUE':    'os_internas',
    'INTERNO - RETRABALHO - SEMINOVOS':  'os_internas',
    'INTERNO - ADMINISTRATIVO':          'os_internas',
    'INTERNO - LOGISTICA':               'os_internas',
    'OLEO GRÁTIS - 7 REVISÕES':          'os_internas',
    'OLEO GRÁTIS - 7 REVISÕES ':         'os_internas',
    'Z - PROTEÇÃO VEÍCULAR':             'mecanica',
  },
  pecas_canal: {
    'VENDA POR O.S.':               'oficina',
    'DEVOLUÇÃO VENDAS POR O.S':     'oficina',
    'VENDA SEGURADORA POR O.S.':    'seguradora',
    'SAÍDA SEGURADORA PAD':         'seguradora',
    'VENDA GARANTIA POR O.S.':      'garantia',
    'VENDA ATACADO':                'externa',
    'DEVOLUÇÃO VENDA ATACADO':      'externa',
    'VENDA VAREJO':                 'balcao',
    'VENDA WEB':                    'balcao',
    'VENDA TELEVENDAS':             'balcao',
    'VENDA ENTRE GRUPO':            'balcao',
    'DEVOLUÇÃO DE VENDA':           'balcao',
    'DEVOLUÇÃO VENDA WEB':          'balcao',
    'COMPRA DA FÁBRICA':            'compra_honda',
    'COMPRA DE OUTRA CONCESSIONÁRIA':'compra_outra',
    'COMPRA DE OUTRO FORNECEDOR':   'compra_outra',
    'ENTRADA POR TRANSFERÊNCIA':    'compra_outra',
  },
  pecas_filtro: {},
  cargos: {},
}

// ── localStorage ──────────────────────────────────────────────────────────────
const LS_KEY = import.meta.env?.MODE === 'preview' ? 'posvenda_preview_regras_v2' : 'posvenda_regras_v2'

export function salvarLS(regras) {
  if (import.meta.env?.MODE !== 'preview') { try { localStorage.removeItem('posvenda_regras_v2') } catch {} return }
  try { localStorage.setItem(LS_KEY, JSON.stringify(regras)) } catch {}
}
function carregarLS() {
  if (import.meta.env?.MODE !== 'preview') return null
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}

// ── Helpers de regras por mês ─────────────────────────────────────────────────
const ESTADOS = ['AL', 'PE']

function buildPorEstado(base) {
  const por = {}
  ESTADOS.forEach(uf => { por[uf] = { ...base } })
  return por
}

function criarMes() {
  return {
    pecas:    buildPorEstado(REGRA_PECAS),
    oficina:  buildPorEstado(REGRA_OFICINA),
    lojas:    { ...LOJAS },
    comissao: COMISSAO_OPERACIONAL.map(r => ({ ...r })),
    gestao:   COMISSAO_GESTAO.map(r => ({ ...r })),
  }
}

function futuros(regras, mes) {
  return Object.keys(regras).filter(m => cmpMes(m, mes) > 0).sort(cmpMes)
}

// Mediana do número de entradas de comissao entre todos os meses que a têm.
// Serve como referência de integridade: meses com contagem abaixo da mediana
// são tratados como corrompidos.
function medianaEntradas(regras) {
  const counts = Object.values(regras)
    .map(m => m?.comissao)
    .filter(c => Array.isArray(c) && c.length > 0)
    .map(c => c.length)
    .sort((a, b) => a - b)
  if (!counts.length) return 0
  const mid = Math.floor(counts.length / 2)
  return counts.length % 2 !== 0 ? counts[mid] : Math.floor((counts[mid - 1] + counts[mid]) / 2)
}

// Retorna o mês mais recente antes de `ateMes` cuja comissao.length >= minEntradas.
function donorIntegro(regras, ateMes, minEntradas) {
  const candidatos = Object.keys(regras)
    .filter(m => cmpMes(m, ateMes) < 0)
    .filter(m => Array.isArray(regras[m]?.comissao) && regras[m].comissao.length >= minEntradas)
    .sort(cmpMes)
  return candidatos[candidatos.length - 1] || null
}

// Varre todos os meses e corrige os que têm comissao.length < mediana.
// dryRun=true: retorna o plano de correção sem modificar nada.
// dryRun=false: aplica as correções em cascata (mês recém-corrigido pode ser
//   donor do mês seguinte), e retorna { atualizado, correcoes, mudouAC }.
export function autocorrigirComissao(regras, mediana, dryRun = false) {
  const porOrdem  = Object.keys(regras).sort(cmpMes)
  let simulado    = { ...regras }
  const correcoes = []
  let mudouAC     = false

  for (const mes of porOrdem) {
    const nAtual = Array.isArray(simulado[mes]?.comissao) ? simulado[mes].comissao.length : 0
    if (nAtual >= mediana) continue

    const donorMes = donorIntegro(simulado, mes, mediana)
    const nDonor   = donorMes ? simulado[donorMes].comissao.length : 0
    correcoes.push({ mes, nAntes: nAtual, donor: donorMes || '(nenhum)', nDepois: nDonor })
    mudouAC = true

    // Aplica no simulado (mesmo em dry-run de log) para que meses seguintes
    // vejam a correção e possam usá-la como donor na mesma rodada.
    if (donorMes) {
      simulado = {
        ...simulado,
        [mes]: { ...simulado[mes], comissao: JSON.parse(JSON.stringify(simulado[donorMes].comissao)) },
      }
    }
  }

  return {
    atualizado: dryRun ? regras : simulado,
    correcoes,
    mudouAC: dryRun ? false : mudouAC,
  }
}

export function limparMesesFuturos(obj) {
  const atual = mesAtualFormatado()
  const limite = proximoMesFormatado(atual)
  const [ml, al] = limite.split('/').map(Number)
  let mudou = false
  const limpo = {}
  Object.keys(obj).forEach(k => {
    const [mk, ak] = k.split('/').map(Number)
    if (ak < al || (ak === al && mk <= ml)) { limpo[k] = obj[k] } else { mudou = true }
  })
  return { obj: limpo, mudou }
}

export function inicializarMesesAutomaticos(regras) {
  const atual   = mesAtualFormatado()
  let atualizado = { ...regras }
  let mudou = false

  // Mediana calculada ANTES de criar meses novos, usando apenas dados existentes.
  const mediana = medianaEntradas(atualizado)

  // ── Cria mês atual se ausente ─────────────────────────────────────────────
  if (!atualizado[atual]) {
    const meses    = Object.keys(atualizado).sort(cmpMes)
    const anterior = [...meses].reverse().find(m => cmpMes(m, atual) < 0)

    if (anterior) {
      const base     = JSON.parse(JSON.stringify(atualizado[anterior]))
      const nComBase = Array.isArray(base.comissao) ? base.comissao.length : 0

      if (mediana > 0 && nComBase < mediana) {
        // Donor imediato corrompido — sobe a cadeia até achar um íntegro.
        console.warn(`[regras] donor ${anterior} corrompido (${nComBase}/${mediana} entr.) ao criar ${atual}`)
        const sano = donorIntegro(atualizado, atual, mediana)
        if (sano) {
          console.warn(`[regras] donor íntegro encontrado: ${sano}`)
          base.comissao = JSON.parse(JSON.stringify(atualizado[sano].comissao))
        } else {
          console.warn(`[regras] nenhum donor íntegro — usando template para ${atual}`)
          base.comissao = COMISSAO_OPERACIONAL.map(r => ({ ...r }))
        }
      }
      atualizado[atual] = base
    } else {
      atualizado[atual] = criarMes()
    }
    mudou = true
  }

  // Não cria mais o mês SEGUINTE de antemão — só o atual. Pré-criar o próximo
  // mês gerava uma cópia congelada no dia 1º que nunca se atualizava se
  // alguém editasse o mês de origem depois (comissão/imposto ficava
  // desatualizado em silêncio, sem ninguém perceber). Cada mês nasce só
  // quando o calendário chega nele de verdade, sempre a partir do estado
  // final/editado do mês anterior — sem janela de defasagem. Quem quiser
  // preparar um mês futuro com antecedência ainda pode, manualmente, via
  // addMesRegras — aí é uma decisão deliberada, não um padrão silencioso.

  // ── Rehydratação: preenche campos ausentes (undefined) em meses existentes ─
  // Cobre campos adicionados ao criarMes() depois que o mês foi gravado.
  const template = criarMes()
  const camposObrigatorios = Object.keys(template)
  const porOrdem = Object.keys(atualizado).sort(cmpMes)

  porOrdem.forEach((mes, idx) => {
    const obj = atualizado[mes]
    camposObrigatorios.forEach(campo => {
      if (obj[campo] !== undefined) return
      const donorM = porOrdem.slice(0, idx).reverse()
        .find(m => atualizado[m]?.[campo] !== undefined)
      atualizado = {
        ...atualizado,
        [mes]: {
          ...atualizado[mes],
          [campo]: JSON.parse(JSON.stringify(
            donorM ? atualizado[donorM][campo] : template[campo]
          )),
        },
      }
      mudou = true
    })
  })

  // ── Autocorreção: comissao com entradas abaixo da mediana ─────────────────
  // Dry-run primeiro (log), depois aplica.
  if (mediana > 0) {
    const { correcoes } = autocorrigirComissao(atualizado, mediana, true)
    if (correcoes.length > 0) {
      console.warn('[regras] autocorrigirComissao — dry-run (o que será corrigido):')
      correcoes.forEach(c =>
        console.warn(`  ${c.mes}: ${c.nAntes} entr. → ${c.nDepois} entr. (donor: ${c.donor})`)
      )
      const { atualizado: corrigido, mudouAC } = autocorrigirComissao(atualizado, mediana, false)
      if (mudouAC) { atualizado = corrigido; mudou = true }
    }
  }

  return { regras: atualizado, mudou }
}

// Mesma ideia de inicializarMesesAutomaticos, mas para o quadro de colaboradores:
// se o mês atual ainda não existe em colaboradoresPorMes, copia o quadro
// COMPLETO (supervisor, cargo, tudo) do mês anterior mais próximo — sem
// depender de ninguém visitar a tela Colaboradores e clicar Salvar. Metas
// nascem zeradas para o mês novo (convenção já usada antes em espelharMes —
// metas se definem de novo a cada mês, cadastro não).
// Só cria o mês ATUAL, não o seguinte de antemão — mesmo motivo de
// inicializarMesesAutomaticos: pré-criar o mês seguinte gerava uma cópia
// congelada que não acompanhava edições feitas no mês de origem depois (ex:
// trocar o supervisor de alguém em setembro não refletia em outubro, se
// outubro já tivesse sido criado no dia 1º).
export function inicializarColaboradoresAutomatico(colaboradoresPorMes, metasPorMes) {
  const atual   = mesAtualFormatado()
  const colabs  = { ...(colaboradoresPorMes || {}) }
  const metas   = { ...(metasPorMes || {}) }
  let mudou = false

  function copiarSeAusente(mesDestino) {
    if (colabs[mesDestino]) return
    const meses    = Object.keys(colabs).sort(cmpMes)
    const anterior = [...meses].reverse().find(m => cmpMes(m, mesDestino) < 0)
    if (!anterior) return // nada existe ainda para copiar — primeiro uso do sistema

    const base = colabs[anterior]
    colabs[mesDestino] = {}
    if (!metas[mesDestino]) metas[mesDestino] = {}
    Object.values(base).forEach(c => {
      colabs[mesDestino][c.colaborador] = { ...c, mes: mesDestino }
      if (!metas[mesDestino][c.colaborador]) {
        metas[mesDestino][c.colaborador] = { colaborador: c.colaborador, mp: 0, mo: 0, mpo: 0, metas: {}, mes: mesDestino }
      }
    })
    mudou = true
  }

  copiarSeAusente(atual)

  return { colaboradores: colabs, metas, mudou }
}

function createRegrasInicial() {
  const { regras } = inicializarMesesAutomaticos({})
  return regras
}

function initRegras() {
  const saved = carregarLS()
  const base = saved && Object.keys(saved).length > 0 ? saved : {}
  const { regras, mudou } = inicializarMesesAutomaticos(base)
  if (mudou) salvarLS(regras)
  return regras
}

export async function salvarConfigSeguro(chave, dados) {
  await salvarConfig(chave, dados)
}

export function createConfigSlice(set, get) {
  return {
    regras: initRegras(),
    metasPorMes: {},
    colaboradoresPorMes: {},
    apelidoMap: buildApelidoMap({}),
    bonificacoes: {},
    bonAudit: {},
    bonProposta: {},
    gestaoManual: {},
    snapshotConfig: {
      chaveSecreta: '',
      configs: {
        'PE-pecas':   { ativo: true },
        'PE-oficina': { ativo: true },
        'AL-pecas':   { ativo: true },
        'AL-oficina': { ativo: true },
      },
    },
    regraPecas:          REGRA_PECAS,
    regraOficina:        REGRA_OFICINA,
    lojas:               LOJAS,
    comissaoOperacional: COMISSAO_OPERACIONAL,
    comissaoGestao:      COMISSAO_GESTAO,
    ihsMapeamento:       IHS_MAPEAMENTO_DEFAULT,

    // ── Regras por mês ───────────────────────────────────────────────────────
    addMesRegras(mes) {
      set(s => {
        if (s.regras[mes]) return s
        const meses = Object.keys(s.regras).sort(cmpMes)
        const ultimo = meses[meses.length - 1]
        const base = ultimo ? JSON.parse(JSON.stringify(s.regras[ultimo])) : criarMes()
        const regras = { ...s.regras, [mes]: base }
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    removeMesRegras(mes) {
      set(s => {
        const { [mes]: _, ...regras } = s.regras
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    updateRegraPeca(mes, uf, tipo, campo, valor) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.pecas?.[uf]?.[tipo]) return s
        regras[mes].pecas[uf][tipo][campo] = valor
        futuros(regras, mes).forEach(m => {
          if (regras[m]?.pecas?.[uf]?.[tipo]) regras[m].pecas[uf][tipo][campo] = valor
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    addRegraPeca(mes, uf, tipo, dados) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.pecas) return s
        if (!regras[mes].pecas[uf]) regras[mes].pecas[uf] = {}
        regras[mes].pecas[uf][tipo] = { cat: dados.cat || '', meta: dados.meta ?? false, com: dados.com ?? false }
        futuros(regras, mes).forEach(m => {
          if (!regras[m]?.pecas) return
          if (!regras[m].pecas[uf]) regras[m].pecas[uf] = {}
          regras[m].pecas[uf][tipo] = { cat: dados.cat || '', meta: dados.meta ?? false, com: dados.com ?? false }
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    removeRegraPeca(mes, uf, tipo) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.pecas?.[uf]) return s
        delete regras[mes].pecas[uf][tipo]
        futuros(regras, mes).forEach(m => {
          if (regras[m]?.pecas?.[uf]) delete regras[m].pecas[uf][tipo]
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    renameRegraPeca(mes, uf, tipoAntigo, tipoNovo) {
      const chave = tipoNovo.trim().toUpperCase()
      if (!chave || chave === tipoAntigo) return
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        const ufData = regras[mes]?.pecas?.[uf]
        if (!ufData || !ufData[tipoAntigo]) return s
        ufData[chave] = { ...ufData[tipoAntigo] }
        delete ufData[tipoAntigo]
        futuros(regras, mes).forEach(m => {
          const fd = regras[m]?.pecas?.[uf]
          if (!fd || !fd[tipoAntigo]) return
          fd[chave] = { ...fd[tipoAntigo] }
          delete fd[tipoAntigo]
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    updateRegraOficina(mes, uf, tipo, campo, valor) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.oficina?.[uf]?.[tipo]) return s
        regras[mes].oficina[uf][tipo][campo] = valor
        futuros(regras, mes).forEach(m => {
          if (regras[m]?.oficina?.[uf]?.[tipo]) regras[m].oficina[uf][tipo][campo] = valor
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    addRegraOficina(mes, uf, tipo, dados) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.oficina) return s
        if (!regras[mes].oficina[uf]) regras[mes].oficina[uf] = {}
        regras[mes].oficina[uf][tipo] = { cat: dados.cat || '', meta: dados.meta ?? false, com: dados.com ?? false }
        futuros(regras, mes).forEach(m => {
          if (!regras[m]?.oficina) return
          if (!regras[m].oficina[uf]) regras[m].oficina[uf] = {}
          regras[m].oficina[uf][tipo] = { cat: dados.cat || '', meta: dados.meta ?? false, com: dados.com ?? false }
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    removeRegraOficina(mes, uf, tipo) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.oficina?.[uf]) return s
        delete regras[mes].oficina[uf][tipo]
        futuros(regras, mes).forEach(m => {
          if (regras[m]?.oficina?.[uf]) delete regras[m].oficina[uf][tipo]
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    renameRegraOficina(mes, uf, tipoAntigo, tipoNovo) {
      const chave = tipoNovo.trim().toUpperCase()
      if (!chave || chave === tipoAntigo) return
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        const ufData = regras[mes]?.oficina?.[uf]
        if (!ufData || !ufData[tipoAntigo]) return s
        ufData[chave] = { ...ufData[tipoAntigo] }
        delete ufData[tipoAntigo]
        futuros(regras, mes).forEach(m => {
          const fd = regras[m]?.oficina?.[uf]
          if (!fd || !fd[tipoAntigo]) return
          fd[chave] = { ...fd[tipoAntigo] }
          delete fd[tipoAntigo]
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    updateLoja(mes, sigla, campo, valor) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]) return s
        if (!regras[mes].lojas[sigla]) regras[mes].lojas[sigla] = {}
        regras[mes].lojas[sigla][campo] = valor
        futuros(regras, mes).forEach(m => {
          if (!regras[m]) return
          if (!regras[m].lojas[sigla]) regras[m].lojas[sigla] = {}
          regras[m].lojas[sigla][campo] = valor
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    addLoja(mes, sigla, dados) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]) return s
        regras[mes].lojas[sigla] = { uf: dados.uf, estado: dados.estado, un: dados.un }
        futuros(regras, mes).forEach(m => {
          if (regras[m]) regras[m].lojas[sigla] = { uf: dados.uf, estado: dados.estado, un: dados.un }
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    updateComissaoOp(mes, idx, campo, valor) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.comissao?.[idx]) return s
        const entry = regras[mes].comissao[idx]
        regras[mes].comissao[idx][campo] = typeof valor === 'string' ? valor : Number(valor) || 0
        futuros(regras, mes).forEach(m => {
          const arr = regras[m]?.comissao
          if (!arr) return
          const fi = arr.findIndex(e => e.uf === entry.uf && e.cargo === entry.cargo)
          if (fi >= 0) arr[fi][campo] = typeof valor === 'string' ? valor : Number(valor) || 0
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    addComissaoOp(mes, dados) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]) return s
        if (!regras[mes].comissao) regras[mes].comissao = []
        regras[mes].comissao.push({ ...dados })
        futuros(regras, mes).forEach(m => {
          if (!regras[m]) return
          if (!regras[m].comissao) regras[m].comissao = []
          const existe = regras[m].comissao.some(e => e.uf === dados.uf && e.cargo === dados.cargo)
          if (!existe) regras[m].comissao.push({ ...dados })
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    removeComissaoOp(mes, idx) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.comissao) return s
        const entry = regras[mes].comissao[idx]
        regras[mes].comissao.splice(idx, 1)
        if (entry) {
          futuros(regras, mes).forEach(m => {
            const arr = regras[m]?.comissao
            if (!arr) return
            const fi = arr.findIndex(e => e.uf === entry.uf && e.cargo === entry.cargo)
            if (fi >= 0) arr.splice(fi, 1)
          })
        }
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    updateComissaoGestao(mes, idx, campo, valor) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.gestao?.[idx]) return s
        const entry = regras[mes].gestao[idx]
        regras[mes].gestao[idx][campo] = typeof valor === 'string' ? valor : Number(valor) || 0
        futuros(regras, mes).forEach(m => {
          const arr = regras[m]?.gestao
          if (!arr) return
          const fi = arr.findIndex(e => e.uf === entry.uf && e.cargo === entry.cargo)
          if (fi >= 0) arr[fi][campo] = typeof valor === 'string' ? valor : Number(valor) || 0
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    addComissaoGestao(mes, entry) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]) return s
        if (!regras[mes].gestao) regras[mes].gestao = []
        regras[mes].gestao.push(entry)
        futuros(regras, mes).forEach(m => {
          if (!regras[m]) return
          if (!regras[m].gestao) regras[m].gestao = []
          const existe = regras[m].gestao.some(e => e.uf === entry.uf && e.cargo === entry.cargo)
          if (!existe) regras[m].gestao.push({ ...entry })
        })
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    removeComissaoGestao(mes, idx) {
      set(s => {
        const regras = JSON.parse(JSON.stringify(s.regras))
        if (!regras[mes]?.gestao) return s
        const entry = regras[mes].gestao[idx]
        regras[mes].gestao.splice(idx, 1)
        if (entry) {
          futuros(regras, mes).forEach(m => {
            const arr = regras[m]?.gestao
            if (!arr) return
            const fi = arr.findIndex(e => e.uf === entry.uf && e.cargo === entry.cargo)
            if (fi >= 0) arr.splice(fi, 1)
          })
        }
        salvarLS(regras)
        return { regras }
      })
      salvarConfigSeguro('regras', get().regras)
    },

    // ── IHS Mapeamento ───────────────────────────────────────────────────────
    setIhsMapeamento(dados) {
      set({ ihsMapeamento: dados })
      salvarConfigSeguro('ihs_mapeamento', dados)
    },

    updateIhs(secao, chave, valor) {
      set(s => {
        const m = JSON.parse(JSON.stringify({ ...IHS_MAPEAMENTO_DEFAULT, ...s.ihsMapeamento }))
        if (!m[secao]) m[secao] = {}
        m[secao][chave] = valor
        return { ihsMapeamento: m }
      })
      salvarConfigSeguro('ihs_mapeamento', get().ihsMapeamento)
    },

    addIhs(secao, chave, valor) {
      set(s => {
        const m = JSON.parse(JSON.stringify({ ...IHS_MAPEAMENTO_DEFAULT, ...s.ihsMapeamento }))
        if (!m[secao]) m[secao] = {}
        m[secao][chave.trim().toUpperCase()] = valor
        return { ihsMapeamento: m }
      })
      salvarConfigSeguro('ihs_mapeamento', get().ihsMapeamento)
    },

    removeIhs(secao, chave) {
      set(s => {
        const m = JSON.parse(JSON.stringify({ ...IHS_MAPEAMENTO_DEFAULT, ...s.ihsMapeamento }))
        if (m[secao]) delete m[secao][chave]
        return { ihsMapeamento: m }
      })
      salvarConfigSeguro('ihs_mapeamento', get().ihsMapeamento)
    },

    resetRegras() {
      const regras = createRegrasInicial()
      salvarLS(regras)
      set({ regras })
      salvarConfigSeguro('regras', regras)
    },

    // ── Bonificações e gestão manual ─────────────────────────────────────────
    // bonAudit[chave] guarda a edição MAIS RECENTE (compat. com quem já lê
    // .por/.em/.obs direto) + um .historico[] append-only com as edições
    // anteriores (nunca sobrescrito) — zerar um bônus não apaga o rastro.
    // Grava um LOTE de bônus (1 ou várias pessoas de uma vez) — desde
    // 02/09/2026, cada pessoa é o PRÓPRIO documento (coleção "bonificacoes"),
    // não mais um blob único compartilhado por todo mundo. Ver o comentário
    // em salvarBonificacoesLote (firestoreService.js) pro porquê. Atualiza o
    // local otimisticamente pra resposta imediata, e reconcilia com o que o
    // servidor de fato gravou.
    async salvarBonificacoesLote(alteracoes, usuario) {
      set(s => {
        const bonificacoes = { ...s.bonificacoes }
        alteracoes.forEach(({ nome, mes, valor }) => { bonificacoes[`${nome}||${mes}`] = Number(valor) || 0 })
        return { bonificacoes }
      })
      const { bonificacoes, bonAudit } = await salvarBonificacoesLoteApi(alteracoes, usuario)
      set(s => ({
        bonificacoes: { ...s.bonificacoes, ...bonificacoes },
        bonAudit:     { ...s.bonAudit,     ...bonAudit },
      }))
    },

    // Mescla uma atualização ao vivo (onSnapshot escopado a 1 mês, ver
    // Comissoes.jsx) no estado global — só substitui as chaves daquele mês,
    // preserva o resto do histórico já carregado.
    mesclarBonificacoesMes(bonificacoesMes, bonAuditMes) {
      set(s => ({
        bonificacoes: { ...s.bonificacoes, ...bonificacoesMes },
        bonAudit:     { ...s.bonAudit,     ...bonAuditMes },
      }))
    },

    proporBonificacao(nome, mes, valor, obs, usuario) {
      if (cmpMes(mes, mesAtualFormatado()) < 0) return
      const chave = `${nome}||${mes}`
      set(s => {
        const atual = s.bonProposta[chave]
        const historico = atual
          ? [...(atual.historico || []), { valor: atual.valor, obs: atual.obs, por: atual.por, em: atual.em }].slice(-5)
          : []
        return {
          bonProposta: {
            ...s.bonProposta,
            [chave]: { valor: Number(valor) || 0, obs: obs || '', por: usuario || '', em: Date.now(), status: 'pendente', historico },
          },
        }
      })
      salvarConfigSeguro('bonProposta', get().bonProposta)
    },

    aprovarProposta(nome, mes, usuario) {
      if (cmpMes(mes, mesAtualFormatado()) < 0) return
      const chave = `${nome}||${mes}`
      set(s => {
        const prop = s.bonProposta[chave]
        if (!prop || prop.status !== 'pendente') return s
        const atual = s.bonAudit[chave]
        const historico = atual
          ? [...(atual.historico || []), { valor: s.bonificacoes[chave] ?? 0, por: atual.por, em: atual.em, obs: atual.obs }]
          : []
        return {
          bonificacoes: { ...s.bonificacoes, [chave]: prop.valor },
          bonAudit:     { ...s.bonAudit,     [chave]: { por: usuario || '', em: Date.now(), obs: prop.obs, historico } },
          bonProposta:  { ...s.bonProposta,  [chave]: { ...prop, status: 'aprovado', aprovadoPor: usuario, aprovadoEm: Date.now() } },
        }
      })
      salvarConfigSeguro('bonificacoes', get().bonificacoes)
      salvarConfigSeguro('bonAudit',     get().bonAudit)
      salvarConfigSeguro('bonProposta',  get().bonProposta)
    },

    rejeitarProposta(nome, mes, motivo, usuario) {
      if (cmpMes(mes, mesAtualFormatado()) < 0) return
      const chave = `${nome}||${mes}`
      set(s => {
        const prop = s.bonProposta[chave]
        if (!prop || prop.status !== 'pendente') return s
        return {
          bonProposta: {
            ...s.bonProposta,
            [chave]: { ...prop, status: 'rejeitado', rejeicaoPor: usuario, rejeicaoEm: Date.now(), rejeicaoMotivo: motivo || '' },
          },
        }
      })
      salvarConfigSeguro('bonProposta', get().bonProposta)
    },

    setIndicadorGestao(mes, nomeNorm, chave, val) {
      set(s => {
        const gm = JSON.parse(JSON.stringify(s.gestaoManual))
        if (!gm[mes]) gm[mes] = {}
        if (!gm[mes][nomeNorm]) gm[mes][nomeNorm] = {}
        gm[mes][nomeNorm][chave] = val
        return { gestaoManual: gm }
      })
      salvarConfigSeguro('gestaoManual', get().gestaoManual)
    },

    setBonusExtraGestao(mes, nomeNorm, val) {
      set(s => {
        const gm = JSON.parse(JSON.stringify(s.gestaoManual))
        if (!gm[mes]) gm[mes] = {}
        if (!gm[mes][nomeNorm]) gm[mes][nomeNorm] = {}
        gm[mes][nomeNorm].bonusExtra = Number(val) || 0
        return { gestaoManual: gm }
      })
      salvarConfigSeguro('gestaoManual', get().gestaoManual)
    },

    // ── Metas e colaboradores ────────────────────────────────────────────────
    addMesMetas(mes) {
      set(s => {
        const changes = {}
        if (!s.metasPorMes[mes])        changes.metasPorMes        = { ...s.metasPorMes,        [mes]: {} }
        if (!s.colaboradoresPorMes[mes]) changes.colaboradoresPorMes = { ...s.colaboradoresPorMes, [mes]: {} }
        if (Object.keys(changes).length === 0) return s
        return changes
      })
    },

    espelharMes(mesOrigem, mesDestino) {
      set(s => {
        const colabs = { ...s.colaboradoresPorMes }
        const metas  = { ...s.metasPorMes }
        if (!colabs[mesDestino]) colabs[mesDestino] = {}
        if (!metas[mesDestino])  metas[mesDestino]  = {}
        Object.values(colabs[mesOrigem] || {}).forEach(c => {
          colabs[mesDestino][c.colaborador] = { ...c, mes: mesDestino }
          metas[mesDestino][c.colaborador]  = { colaborador: c.colaborador, mp: 0, mo: 0, mpo: 0, metas: {}, mes: mesDestino }
        })
        return {
          colaboradoresPorMes: colabs,
          metasPorMes: metas,
          apelidoMap: buildApelidoMap(colabs),
        }
      })
      // Não grava no Firestore: espelharMes é inicialização LOCAL.
      // O commit vai ao Firestore somente quando o usuário salva explicitamente.
      // Gravar aqui sobrescrevia o Firestore com dados zerados de abas que ainda
      // não tinham carregado o mês correto.
    },

    // Grava apenas campos de meta (mp/mo/mpo/metas) em config/metas.
    // Usado exclusivamente pela página de Metas.
    substituirMetasMes(mes, lista) {
      set(s => {
        const metas = JSON.parse(JSON.stringify(s.metasPorMes))
        const anteriores = metas[mes] || {}
        metas[mes] = {}
        lista.forEach(c => {
          metas[mes][c.colaborador] = {
            ...anteriores[c.colaborador],
            colaborador: c.colaborador,
            mp:          Number(c.mp)  || 0,
            mo:          Number(c.mo)  || 0,
            mpo:         Number(c.mpo) || 0,
            metas:       c.metas || {},
            mes,
          }
        })
        return { metasPorMes: metas }
      })
      get().publicarSnapshots().catch(() => {})
      return salvarConfigSeguro('metas', get().metasPorMes)
    },

    // ── Colaboradores ─────────────────────────────────────────────────────
    // ── Colaboradores ─────────────────────────────────────────────────────
    // Grava apenas campos cadastrais em config/colaboradores (ainda um blob
    // único — migração pra 1 documento por pessoa é um projeto à parte).
    // Usado pelas páginas Colaboradores e Upload.
    substituirColaboradoresCadastrais(mes, lista) {
      set(s => {
        const colabs = JSON.parse(JSON.stringify(s.colaboradoresPorMes))
        colabs[mes] = {}
        lista.forEach(c => { colabs[mes][c.colaborador] = montarRegistroColaborador(mes, c) })
        return { colaboradoresPorMes: colabs, apelidoMap: buildApelidoMap(colabs) }
      })
      return salvarConfigSeguro('colaboradores', get().colaboradoresPorMes)
    },

    // Mudanças já gravadas pelo servidor (gestaoEquipe): só atualizam o estado local.
    aplicarColaboradoresRemotos(alterados) {
      set(s => {
        const colabs = { ...s.colaboradoresPorMes }
        for (const { mes, registro } of alterados) colabs[mes] = { ...colabs[mes], [registro.colaborador]: registro }
        return { colaboradoresPorMes: colabs, apelidoMap: buildApelidoMap(colabs) }
      })
    },
    aplicarMetasRemotas(mes, lista) {
      set(s => ({ metasPorMes: { ...s.metasPorMes, [mes]: { ...s.metasPorMes[mes], ...Object.fromEntries(lista.map(m => [m.colaborador, m])) } } }))
    },

    upsertColaborador(mes, dados) {
      set(s => {
        const colabs = { ...s.colaboradoresPorMes }
        if (!colabs[mes]) colabs[mes] = {}
        colabs[mes][dados.colaborador] = montarRegistroColaborador(mes, dados)
        return { colaboradoresPorMes: colabs, apelidoMap: buildApelidoMap(colabs) }
      })
      salvarConfigSeguro('colaboradores', get().colaboradoresPorMes)
    },

    removeColaborador(mes, nome) {
      set(s => {
        const colabs = { ...s.colaboradoresPorMes }
        if (colabs[mes]) {
          const { [nome]: _, ...rest } = colabs[mes]
          colabs[mes] = rest
        }
        return { colaboradoresPorMes: colabs, apelidoMap: buildApelidoMap(colabs) }
      })
      salvarConfigSeguro('colaboradores', get().colaboradoresPorMes)
    },

    setAtivoColaborador(mes, nome, ativo) {
      set(s => {
        const colabs = JSON.parse(JSON.stringify(s.colaboradoresPorMes))
        if (colabs[mes]?.[nome]) colabs[mes][nome].ativo = ativo
        return { colaboradoresPorMes: colabs, apelidoMap: buildApelidoMap(colabs) }
      })
      salvarConfigSeguro('colaboradores', get().colaboradoresPorMes)
    },

    preencherSupervisores(inferirFn) {
      set(s => {
        const colabs = JSON.parse(JSON.stringify(s.colaboradoresPorMes))
        Object.values(colabs).forEach(mesDados => {
          Object.values(mesDados).forEach(c => {
            const sup = inferirFn(c)
            if (sup) c.supervisor = sup
          })
        })
        return { colaboradoresPorMes: colabs, apelidoMap: buildApelidoMap(colabs) }
      })
      salvarConfigSeguro('colaboradores', get().colaboradoresPorMes)
    },

    // ── Snapshot config ──────────────────────────────────────────────────────
    async salvarSnapshotConfig(config) {
      set({ snapshotConfig: config })
      await salvarConfigSeguro('snapshotConfig', config)
    },
  }
}
