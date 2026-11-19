import { useState, useEffect } from 'react'
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../firebase.js'
import { useConfirm } from '../../hooks/useConfirm.jsx'
import { useToast } from '../../hooks/useToast.jsx'
import { useAutosave } from '../../hooks/useAutosave.js'

const gerenciarUsuario = httpsCallable(functions, 'gerenciarUsuario')

// Valor inicial da aprovação: o cargo e o setor que a pessoa pediu (nunca admin). Sem pedido,
// colaborador. Nada vale antes do administrador clicar em Aprovar.
const PEDIDOS = ['coordenador', 'supervisor', 'operacional']
export const aprovacaoPadrao = (s, atual) => atual || {
  role: PEDIDOS.includes(s.cargoPedido) ? s.cargoPedido : 'operacional',
  estados: ['PE'],
  setor: s.setor || null,
}

export function useAcesso() {
  const [usuarios, setUsuarios]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [erroCarregar, setErroCarregar] = useState('')
  const [form, setForm]                 = useState(null)
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState('')
  const [aba, setAba]                   = useState('usuarios')
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loadingSolic, setLoadingSolic] = useState(false)
  const [aprovacoes, setAprovacoes]     = useState({})
  const [aprovando, setAprovando]       = useState(null)
  const [erroSolic, setErroSolic]       = useState('')
  const [resetModal, setResetModal]     = useState(null) // { email, link }
  const { confirm, modal: confirmModal } = useConfirm()
  const toast = useToast()
  const autosave = useAutosave()

  async function carregar() {
    setLoading(true)
    setErroCarregar('')
    try {
      const snap = await getDocs(collection(db, 'usuarios'))
      const lista = snap.docs.map(d => {
        const data = d.data()
        // Normaliza legado: estado string → estados array
        const estados = data.estados?.length ? data.estados
                      : data.estado          ? [data.estado]
                      : null
        return { uid: d.id, ...data, estados }
      })
      setUsuarios(lista)
    } catch (e) {
      // Antes um erro aqui deixava "Carregando..." para sempre.
      console.error('carregar usuarios:', e)
      setErroCarregar('Verifique a conexão e tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  async function trocarSetor(u, setor) {
    await autosave(
      () => gerenciarUsuario({ acao: 'atualizarPerfil', uid: u.uid, setor }),
      {
        onSucesso: () => setUsuarios(us => us.map(x => x.uid === u.uid ? { ...x, setor } : x)),
        msgSucesso: 'Setor atualizado.',
        msgErro: 'Falha ao atualizar setor',
      }
    )
  }

  async function carregarSolicitacoes() {
    setLoadingSolic(true)
    try {
      const snap = await getDocs(collection(db, 'solicitacoes'))
      setSolicitacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (e) {
      console.error('Erro ao carregar solicitações:', e)
    } finally {
      setLoadingSolic(false)
    }
  }

  useEffect(() => { carregar(); carregarSolicitacoes() }, [])

  async function criarUsuario(e) {
    e.preventDefault()
    setSalvando(true); setErro('')
    try {
      await gerenciarUsuario({
        acao: 'criar',
        email: form.email,
        nome: form.nome,
        senha: form.senha,
        role: form.role,
        estados: form.role === 'admin' ? null : form.estados,
      })
      setForm(null)
      carregar()
      toast?.('Usuário criado com sucesso.', 'success')
    } catch (err) {
      const msgs = {
        'already-exists':   'E-mail já cadastrado.',
        'invalid-argument': err.message || 'Dados inválidos.',
        'permission-denied':'Sem permissão.',
      }
      setErro(msgs[err.code] ?? err.message ?? 'Erro ao criar usuário.')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(u) {
    const acao = u.ativo !== false ? 'desativar' : 'reativar'
    await autosave(
      () => gerenciarUsuario({ acao, uid: u.uid }),
      {
        onSucesso: () => setUsuarios(us => us.map(x => x.uid === u.uid ? { ...x, ativo: acao === 'reativar' } : x)),
        msgSucesso: acao === 'desativar' ? 'Usuário desativado.' : 'Usuário reativado.',
        msgErro: 'Falha',
      }
    )
  }

  async function trocarRole(u, novoRole) {
    await autosave(
      () => gerenciarUsuario({
        acao: 'atualizarPerfil',
        uid: u.uid,
        role: novoRole,
        estados: novoRole === 'admin' ? null : (u.estados || ['PE']),
      }),
      {
        onSucesso: () => setUsuarios(us => us.map(x => x.uid === u.uid
          ? { ...x, role: novoRole, estados: novoRole === 'admin' ? null : x.estados } : x)),
        msgErro: 'Falha ao trocar cargo',
      }
    )
  }

  async function trocarEstados(u, novosEstados) {
    await autosave(
      () => gerenciarUsuario({ acao: 'atualizarPerfil', uid: u.uid, role: u.role, estados: novosEstados }),
      {
        onSucesso: () => setUsuarios(us => us.map(x => x.uid === u.uid ? { ...x, estados: novosEstados } : x)),
        msgErro: 'Falha ao atualizar estados',
      }
    )
  }

  // O nome do login precisa bater (sem acento/caixa) com o nome usado no
  // cadastro de Colaboradores e no campo Supervisor de quem reporta a essa
  // pessoa — são 3 lugares digitados por gente diferente, sem vínculo
  // automático. Sem poder corrigir aqui, um nome de login diferente (ex.:
  // apelido curto) deixa supervisor sem ver o próprio time em Comissões.
  async function trocarNome(u, novoNome) {
    if (!novoNome.trim() || novoNome.trim() === u.nome) return
    await autosave(
      () => gerenciarUsuario({ acao: 'atualizarPerfil', uid: u.uid, nome: novoNome.trim() }),
      {
        onSucesso: () => setUsuarios(us => us.map(x => x.uid === u.uid ? { ...x, nome: novoNome.trim() } : x)),
        msgSucesso: 'Nome atualizado.',
        msgErro: 'Falha ao atualizar nome',
      }
    )
  }

  async function excluirUsuario(u) {
    if (!await confirm(
      `Excluir permanentemente "${u.nome || u.email}"?\n\nIsso remove a conta do Firebase Auth e todos os dados de acesso. Esta ação não pode ser desfeita.`,
    )) return
    try {
      await gerenciarUsuario({ acao: 'excluir', uid: u.uid })
      setUsuarios(us => us.filter(x => x.uid !== u.uid))
      toast?.('Usuário excluído.', 'success')
    } catch (e) {
      console.error('excluirUsuario:', e)
      toast?.(`Falha ao excluir: ${e.message}`, 'error')
    }
  }

  async function resetSenha(u) {
    try {
      const res = await gerenciarUsuario({ acao: 'resetSenha', email: u.email })
      setResetModal({ email: u.email, link: res.data.link })
    } catch (e) {
      console.error('resetSenha:', e)
      toast?.(`Falha ao gerar link: ${e.message}`, 'error')
    }
  }

  async function aprovarSolicitacao(s) {
    const ap = aprovacaoPadrao(s, aprovacoes[s.id])
    setAprovando(s.id); setErroSolic('')
    try {
      // O servidor ativa a conta criada no cadastro (com a senha da pessoa) ou, em pedidos
      // antigos sem senha, cria a conta e devolve o link para definir a senha.
      const result = await gerenciarUsuario({
        acao: 'aprovarCadastro',
        solicitacao: s.id,
        role: ap.role,
        estados: ap.role === 'admin' ? null : ap.estados,
        ...(ap.setor ? { setor: ap.setor } : {}),
      })
      setSolicitacoes(prev => prev.filter(x => x.id !== s.id))
      if (result.data.link) setResetModal({ email: s.email, link: result.data.link })
      carregar()
      toast?.('Solicitação aprovada.', 'success')
    } catch (err) {
      const msgs = {
        'already-exists':   'Este e-mail já possui uma conta. Verifique na aba Usuários.',
        'invalid-argument': err.message || 'Dados inválidos.',
      }
      setErroSolic(msgs[err.code] ?? (err.message || 'Erro ao aprovar. Tente novamente.'))
    } finally {
      setAprovando(null)
    }
  }

  async function rejeitarSolicitacao(s) {
    if (!await confirm(`Rejeitar solicitação de "${s.nome || s.email}"?`)) return
    try {
      await gerenciarUsuario({ acao: 'rejeitarCadastro', solicitacao: s.id })
      setSolicitacoes(prev => prev.filter(x => x.id !== s.id))
      toast?.('Solicitação rejeitada.', 'success')
    } catch (err) { setErroSolic(err.message || 'Não foi possível rejeitar agora.') }
  }

  const roleBadge = r => ({
    admin: 'badge-red', coordenador: 'badge-purple', supervisor: 'badge-blue',
    operacional: 'badge-green', varejo: 'badge-green', atacado: 'badge-amber', oficina: 'badge-gray',
  }[r] ?? 'badge-gray')

  return {
    usuarios, loading, erroCarregar, carregar, trocarSetor, form, setForm, salvando, erro, setErro,
    aba, setAba,
    solicitacoes, loadingSolic, erroSolic,
    aprovacoes, setAprovacoes, aprovando,
    criarUsuario, toggleAtivo, trocarRole, trocarEstados, trocarNome, excluirUsuario, resetSenha,
    aprovarSolicitacao, rejeitarSolicitacao,
    roleBadge, confirmModal,
    resetModal, setResetModal,
  }
}
