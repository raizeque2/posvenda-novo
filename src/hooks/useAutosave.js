/**
 * useAutosave.js — padrão de salvar-ao-editar-um-campo-isolado, com toast.
 * ─────────────────────────────────────────────────────────────────────────────
 * Extraído do fluxo original de Acesso.jsx (trocar nome/cargo/estado de um
 * usuário). Uso correto: um campo ISOLADO, fora de uma tabela em modo edição
 * (essas continuam usando SaveBar explícito — perder uma edição em lote sem
 * confirmação é o tipo de coisa que gera prejuízo real; um campo isolado, não).
 *
 * Uso:
 *   const autosave = useAutosave()
 *   async function trocarNome(u, novoNome) {
 *     await autosave(
 *       () => gerenciarUsuario({ acao: 'atualizarPerfil', uid: u.uid, nome: novoNome }),
 *       { onSucesso: () => setUsuarios(...), msgSucesso: 'Nome atualizado.', msgErro: 'Falha ao atualizar nome' }
 *     )
 *   }
 */
import { useToast } from './useToast.jsx'

export function useAutosave() {
  const toast = useToast()

  return async function autosave(salvar, { onSucesso, msgSucesso, msgErro = 'Falha ao salvar' } = {}) {
    try {
      await salvar()
      onSucesso?.()
      if (msgSucesso) toast?.(msgSucesso, 'success')
      return true
    } catch (e) {
      console.error(msgErro, e)
      toast?.(`${msgErro}: ${e.message}`, 'error')
      return false
    }
  }
}
