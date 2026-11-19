import { mesAtualStr } from '../utils/datas.js'

const SESSION_KEY_MES = import.meta.env?.MODE === 'preview' ? 'pv_preview_filtro_mes' : 'pv_filtro_mes'

// Lê o mês salvo NESTA aba (sessionStorage — some ao fechar a aba, então uma
// sessão nova sempre volta pro mês atual sozinha, sem precisar de lógica
// extra pra isso). Falha de storage (modo privado, quota) nunca derruba o
// app — só cai no padrão de sempre.
function lerMesSalvo() {
  try {
    return sessionStorage.getItem(SESSION_KEY_MES) || mesAtualStr()
  } catch {
    return mesAtualStr()
  }
}

// Fonte única de filtros compartilhados entre TODAS as páginas com seletor de
// mês (Dashboard, Comissões, Colaboradores, Equipes, Metas, Regras, Estoque,
// Resumo Mensal). Antes desta unificação existiam 4 objetos quase-idênticos
// (filtrosDashboard/filtrosComissoes/filtrosColaboradores/filtrosRegras) que
// se copiavam manualmente a cada mudança — Estoque e Resumo Mensal ficavam de
// fora, cada um com seu próprio estado isolado.
//
// O MÊS (só ele, por ora — os demais filtros continuam voláteis) sobrevive a
// um F5 via sessionStorage (02/09/2026): antes, como nada persistia, recarregar
// a página pra ver dado atualizado de outra pessoa também resetava o filtro
// de mês sem querer.
export function createFiltrosSlice(set) {
  return {
    filtrosGlobais: {
      mes: lerMesSalvo(), estado: '', lojas: [],
      cargo: [], supervisor: '', setor: [], busca: '',
    },
    setFiltrosGlobais: (patch) => set(s => {
      const next = { ...s.filtrosGlobais, ...patch }
      // Trocar de estado sem especificar lojas explicitamente limpa a seleção
      // de lojas (evita ficar com loja de outro estado marcada, invisível no filtro).
      if ('estado' in patch && !('lojas' in patch)) next.lojas = []
      if ('mes' in patch) {
        try { sessionStorage.setItem(SESSION_KEY_MES, next.mes) } catch {}
      }
      return { filtrosGlobais: next }
    }),

    // Só a tela Regras usa — "loja" é seletor de qual loja está sendo
    // configurada (uma só por vez), diferente de "lojas" (lista, filtro de
    // visualização) do filtro global. "aba" é a aba interna peças/oficina.
    filtrosRegras: { loja: '', aba: 'pecas' },
    setFiltrosRegras: (patch) => set(s => ({ filtrosRegras: { ...s.filtrosRegras, ...patch } })),
  }
}
