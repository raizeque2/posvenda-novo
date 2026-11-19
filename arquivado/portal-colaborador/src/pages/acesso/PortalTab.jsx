import { useEffect, useState } from 'react'
import { EmptyState } from '../../components/DS.jsx'
import { Users, KeyRound, RefreshCw } from '../../icons/iconoir'
import { useConfirm } from '../../hooks/useConfirm.jsx'
import { useToast } from '../../hooks/useToast.jsx'
import { listarContasPortal, redefinirContaPortal } from '../../services/portalService.js'

const TIPO_LABEL = { colaborador: 'Colaborador', supervisor: 'Supervisor' }
const dataBR = ms => (ms ? new Date(ms).toLocaleDateString('pt-BR') : '—')

/**
 * Aba do administrador para as contas do portal: quem já criou senha, quem
 * está bloqueado e o único botão que reabre o acesso (redefinir).
 */
export function PortalTab() {
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [trabalhando, setTrabalhando] = useState('')
  const { confirm, modal } = useConfirm()
  const toast = useToast()

  async function carregar() {
    setLoading(true)
    setErro('')
    try {
      setContas(await listarContasPortal())
    } catch (e) {
      setErro(e?.message?.replace(/^functions\/[\w-]+:\s*/i, '') || 'Não foi possível carregar as contas do portal.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  async function redefinir(conta) {
    if (!await confirm(`Redefinir o acesso de "${conta.nome}"?

A senha atual deixa de valer e o bloqueio é removido. A pessoa cria uma nova senha no próximo acesso.`)) return
    setTrabalhando(conta.id)
    try {
      await redefinirContaPortal(conta.id)
      setContas(lista => lista.map(item => item.id === conta.id ? { ...item, temSenha: false, bloqueado: false, tentativas: 0 } : item))
      toast?.('Acesso do portal redefinido.', 'success')
    } catch (e) {
      toast?.(`Falha ao redefinir: ${e?.message || e}`, 'error')
    } finally {
      setTrabalhando('')
    }
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      {modal}
      <div className="card-header">
        <span className="card-title">Contas do portal</span>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }} onClick={carregar} disabled={loading}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>
      <p className="note">Contas criadas sozinhas pelo portal, quando a pessoa define a primeira senha. Só o administrador reabre um acesso bloqueado.</p>
      {erro && (
        <p role="alert" style={{ background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '9px 13px', color: 'var(--red)', fontSize: 'var(--text-sm2)', margin: '0 0 10px' }}>
          {erro}
        </p>
      )}
      {loading ? (
        <div className="loading-state">Carregando…</div>
      ) : !contas.length ? (
        <EmptyState icon={Users} title="Nenhuma conta do portal ainda" sub="A conta aparece aqui depois que a pessoa cria a senha em /portal." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Loja</th>
                <th>Tipo</th>
                <th>Senha</th>
                <th>Tentativas</th>
                <th>Último acesso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contas.map(conta => (
                <tr key={conta.id}>
                  <td className="name-cell">{conta.nome}</td>
                  <td>{conta.loja}</td>
                  <td><span className="badge badge-gray">{TIPO_LABEL[conta.tipo] || conta.tipo}</span></td>
                  <td>
                    {conta.bloqueado
                      ? <span className="badge badge-red">Bloqueado</span>
                      : conta.temSenha
                        ? <span className="badge badge-green">Definida</span>
                        : <span className="badge badge-amber">Pendente</span>}
                  </td>
                  <td>{conta.tentativas || 0}</td>
                  <td>{dataBR(conta.ultimoAcesso)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-ghost" disabled={trabalhando === conta.id} onClick={() => redefinir(conta)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <KeyRound size={13} /> {trabalhando === conta.id ? 'Redefinindo…' : 'Redefinir acesso'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
