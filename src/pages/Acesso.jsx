import LinksAdmin from '../bi/LinksAdmin.jsx'
import { EmptyState, Modal, FormDropdown } from '../components/DS.jsx'
import { Users, CheckCircle2, Copy, Check, KeyRound } from '../icons/iconoir'
import { useState, useMemo } from 'react'
import { useAcesso, aprovacaoPadrao } from './acesso/useAcesso.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { SnapshotConfigTab } from './acesso/SnapshotConfigTab.jsx'
import { PermissoesTab } from './acesso/PermissoesTab.jsx'
import { SETORES } from '../data/permissoes.js'
import { Estado, Esqueleto } from '../components/Estados.jsx'
import { useSorter, Th } from '../components/tabela.jsx'
import { EditableText } from './regras/RegrasInputs.jsx'

const IS_PREVIEW = import.meta.env.MODE === 'preview'

const ROLES = [
  { value: 'admin',       label: 'Administrador' },
  { value: 'coordenador', label: 'Coordenador'   },
  { value: 'supervisor',  label: 'Supervisor'    },
  { value: 'operacional', label: 'Operacional'   },
]
const ESTADOS_OPTS = ['PE', 'AL']
const FORM_VAZIO = { nome: '', email: '', senha: '', role: 'coordenador', estados: ['PE'] }

// Chip de estado clicável — toggle individual
function EstadoChips({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {ESTADOS_OPTS.map(uf => {
        const ativo = value?.includes(uf)
        return (
          <button key={uf} type="button" disabled={disabled}
            onClick={() => {
              if (ativo) {
                if (value.length === 1) return // manter ao menos 1
                onChange(value.filter(e => e !== uf))
              } else {
                onChange([...value, uf].sort())
              }
            }}
            style={{
              padding: '2px 8px', borderRadius: 4, border: '1px solid',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
              cursor: disabled ? 'default' : 'pointer',
              background: ativo ? 'var(--accent)' : 'transparent',
              color: ativo ? '#fff' : 'var(--text3)',
              borderColor: ativo ? 'var(--accent)' : 'var(--border2)',
              transition: 'all 0.15s',
            }}>
            {uf}
          </button>
        )
      })}
    </div>
  )
}

// Modal de reset de senha
function ResetModal({ data, onClose }) {
  const [copiado, setCopiado] = useState(false)
  function copiar() {
    navigator.clipboard.writeText(data.link)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }
  return (
    <Modal
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><KeyRound size={18} color="var(--accent)" />Link de redefinição de senha</span>}
      onClose={onClose}
      maxWidth={460}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Fechar</button>
        <button className="btn btn-primary" onClick={copiar} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {copiado ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar link</>}
        </button>
      </>}
    >
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text2)', marginBottom: 14 }}>
        Compartilhe este link com <strong>{data.email}</strong> via WhatsApp ou e-mail. O link expira em 1 hora.
      </div>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 'var(--text-sm)', color: 'var(--text3)', wordBreak: 'break-all', lineHeight: 1.5 }}>
        {data.link}
      </div>
    </Modal>
  )
}

export default function Acesso() {
  const a = useAcesso()
  const { user } = useAuth()

  const roleLabel = r => ROLES.find(x => x.value === r)?.label || r

  const { sorted: usuariosSorted, sort: usersSort, toggle: usersToggle } = useSorter(
    a.usuarios,
    {
      nome:   u => (u.nome  || '').toLowerCase(),
      email:  u => (u.email || '').toLowerCase(),
      cargo:  u => roleLabel(u.role).toLowerCase(),
      status: u => u.ativo !== false ? 1 : 0,
    },
    [{ col: 'nome', dir: 'asc' }]
  )

  const { sorted: solicsSorted, sort: solicsSort, toggle: solicsToggle } = useSorter(
    a.solicitacoes,
    {
      nome:  s => (s.nome  || '').toLowerCase(),
      email: s => (s.email || '').toLowerCase(),
    },
    [{ col: 'nome', dir: 'asc' }]
  )

  return (
    <>
    <div className="page">
      <div className="filters-bar dash-top-bar">
        <button className={`tab-btn${a.aba === 'usuarios'     ? ' active' : ''}`} onClick={() => a.setAba('usuarios')}>Usuários</button>
        <button className={`tab-btn${a.aba === 'solicitacoes' ? ' active' : ''}`} onClick={() => a.setAba('solicitacoes')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Solicitações
          {a.solicitacoes.length > 0 && (
            <span style={{ background: 'var(--honda)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)' }}>
              {a.solicitacoes.length}
            </span>
          )}
        </button>
        <button className={`tab-btn${a.aba === 'links'      ? ' active' : ''}`} onClick={() => a.setAba('links')}>Links de Acesso</button>
        <button className={`tab-btn${a.aba === 'permissoes' ? ' active' : ''}`} onClick={() => a.setAba('permissoes')}>Permissões</button>
        {a.aba === 'usuarios' && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}
            disabled={IS_PREVIEW} title={IS_PREVIEW ? 'Disponível no aplicativo conectado' : undefined}
            onClick={() => { a.setForm(FORM_VAZIO); a.setErro('') }}>
            + Novo usuário
          </button>
        )}
      </div>

      {IS_PREVIEW && <p className="note" style={{ marginBottom: 16 }}>Contas fictícias: você pode testar nomes, cargos e estados. Criar logins, aprovar novos acessos e redefinir senhas exige o aplicativo conectado.</p>}

      {/* Modal: novo usuário */}
      {a.form && (
        <Modal title="Novo usuário" onClose={() => a.setForm(null)} maxWidth={420}>
          <form onSubmit={a.criarUsuario} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" placeholder="João Silva" value={a.form.nome}
                onChange={e => a.setForm(f => ({ ...f, nome: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input className="form-input" type="email" placeholder="joao@empresa.com" value={a.form.email}
                onChange={e => a.setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Senha inicial</label>
              <input className="form-input" type="password" placeholder="Mínimo 8 caracteres" value={a.form.senha}
                onChange={e => a.setForm(f => ({ ...f, senha: e.target.value }))} required minLength={8} />
            </div>
            <div className="form-group">
              <label className="form-label">Cargo</label>
              <FormDropdown value={a.form.role} options={ROLES} onChange={v => a.setForm(f => ({ ...f, role: v }))} />
            </div>
            {a.form.role !== 'admin' && (
              <div className="form-group">
                <label className="form-label">Estados</label>
                <EstadoChips value={a.form.estados} onChange={v => a.setForm(f => ({ ...f, estados: v }))} />
              </div>
            )}
            {a.erro && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, padding: '9px 13px', color: 'var(--red)', fontSize: 'var(--text-sm2)' }}>
                {a.erro}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn btn-ghost" onClick={() => a.setForm(null)} disabled={a.salvando}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={a.salvando}>
                {a.salvando ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Aba: usuários */}
      {a.aba === 'usuarios' && (
        <div className="card" style={{ marginTop: 8 }}>
          {a.loading ? <Esqueleto cards={0} rotulo="Carregando usuários" />
            : a.erroCarregar ? <Estado tipo="erro" titulo="Não foi possível carregar os usuários" texto={a.erroCarregar}><button className="btn btn-primary" onClick={a.carregar}>Tentar novamente</button></Estado>
            : a.usuarios.length === 0 ? <EmptyState icon={Users} title="Nenhum usuário cadastrado" />
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <Th col="nome"   label="Nome"    sort={usersSort} toggle={usersToggle} />
                      <Th col="email"  label="E-mail"  sort={usersSort} toggle={usersToggle} />
                      <Th col="cargo"  label="Cargo"   sort={usersSort} toggle={usersToggle} />
                      <th>Estados</th>
                      <th>Setor</th>
                      <Th col="status" label="Status"  sort={usersSort} toggle={usersToggle} />
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosSorted.map(u => {
                      const isMe = u.uid === user?.uid
                      return (
                      <tr key={u.uid}>
                        <td className="name-cell">
                          <EditableText value={u.nome || ''} onSave={v => a.trocarNome(u, v)} />
                          {isMe && (
                            <span style={{ marginLeft: 6, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--accent)', background: 'rgba(204,0,0,0.08)', borderRadius: 4, padding: '1px 5px' }}>
                              Você
                            </span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text3)', fontSize: 'var(--text-sm2)' }}>{u.email}</td>
                        <td>
                          <FormDropdown
                            className={`badge ${a.roleBadge(u.role)}`}
                            value={u.role}
                            onChange={v => a.trocarRole(u, v)}
                            disabled={isMe}
                            options={ROLES}
                            showArrow={false}
                            style={{ display: 'inline-block' }}
                            triggerStyle={{ border: 'none', width: 'auto' }}
                            labelStyle={{ color: 'inherit', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)' }}
                            panelStyle={{ left: 'auto', right: 'auto', minWidth: 150 }}
                          />
                        </td>
                        <td>
                          {u.role === 'admin'
                            ? <span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>Ambos</span>
                            : <EstadoChips value={u.estados || []} onChange={v => a.trocarEstados(u, v)} disabled={isMe} />
                          }
                        </td>
                        <td>
                          {u.role === 'admin'
                            ? <span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>Todos</span>
                            : <select className="form-input" aria-label={`Setor de ${u.nome || u.email}`} value={u.setor || ''} onChange={e => a.trocarSetor(u, e.target.value || null)} disabled={isMe} style={{ minWidth: 130 }}>
                                <option value="">Sem setor</option>
                                {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>}
                        </td>
                        <td>
                          <span className={`badge ${u.ativo !== false ? 'badge-green' : 'badge-gray'}`}>
                            {u.ativo !== false ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn-sm btn-ghost" title={IS_PREVIEW ? "Disponível no aplicativo conectado" : "Redefinir senha"} disabled={IS_PREVIEW}
                              onClick={() => a.resetSenha(u)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <KeyRound size={13} /> Reset
                            </button>
                            {!isMe && (
                              <>
                                <button className={`btn btn-sm ${u.ativo !== false ? 'btn-ghost' : 'btn-primary'}`}
                                  onClick={() => a.toggleAtivo(u)}>
                                  {u.ativo !== false ? 'Desativar' : 'Ativar'}
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => a.excluirUsuario(u)}>Excluir</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* Aba: solicitações */}
      {a.aba === 'solicitacoes' && (
        <div className="card" style={{ marginTop: 8 }}>
          {a.erroSolic && (
            <div style={{ background: 'rgba(204,0,0,0.07)', border: '1px solid rgba(204,0,0,0.2)', borderRadius: 8, padding: '10px 14px', color: 'var(--honda)', fontSize: 'var(--text-base)', margin: '0 0 12px' }}>
              {a.erroSolic}
            </div>
          )}
          {a.loadingSolic ? <div className="loading-state">Carregando...</div>
            : a.solicitacoes.length === 0 ? <EmptyState icon={CheckCircle2} title="Nenhuma solicitação pendente" />
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <Th col="nome"  label="Nome"   sort={solicsSort} toggle={solicsToggle} />
                      <Th col="email" label="E-mail" sort={solicsSort} toggle={solicsToggle} />
                      <th>Cargo</th>
                      <th>Setor</th>
                      <th>Estados</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicsSorted.map(s => {
                      const ap    = aprovacaoPadrao(s, a.aprovacoes[s.id])
                      const setAp = patch => a.setAprovacoes(prev => ({ ...prev, [s.id]: { ...ap, ...patch } }))
                      const pedido = ROLES.find(r => r.value === s.cargoPedido)?.label
                      return (
                        <tr key={s.id}>
                          <td className="name-cell">{s.nome || '—'}
                            <div style={{ color: 'var(--text3)', fontSize: 'var(--text-xs)', fontWeight: 400 }}>{s.comSenha ? 'Já criou a senha' : 'Recebe link para criar a senha'}</div>
                          </td>
                          <td style={{ color: 'var(--text3)', fontSize: 'var(--text-sm2)' }}>{s.email}</td>
                          <td title={pedido ? `Pediu: ${pedido}` : undefined}>
                            <FormDropdown
                              className="badge badge-gray"
                              value={ap.role}
                              onChange={v => setAp({ role: v })}
                              options={ROLES}
                              showArrow={false}
                              style={{ display: 'inline-block' }}
                              triggerStyle={{ border: 'none', width: 'auto' }}
                              labelStyle={{ color: 'inherit', fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-xs)' }}
                              panelStyle={{ left: 'auto', right: 'auto', minWidth: 150 }}
                            />
                            {pedido && <div style={{ color: 'var(--text3)', fontSize: 'var(--text-xs)' }}>Pediu: {pedido}</div>}
                          </td>
                          <td>
                            <select value={ap.setor || ''} onChange={e => setAp({ setor: e.target.value || null })} aria-label={`Setor de ${s.nome || s.email}`} style={{ minWidth: 130 }}>
                              <option value="">Sem setor</option>
                              {SETORES.map(x => <option key={x} value={x}>{x}</option>)}
                            </select>
                          </td>
                          <td>
                            {ap.role === 'admin'
                              ? <span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>Ambos</span>
                              : <EstadoChips value={ap.estados || ['PE']} onChange={v => setAp({ estados: v })} />
                            }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-sm btn-danger"
                                onClick={() => a.rejeitarSolicitacao(s)} disabled={IS_PREVIEW || a.aprovando === s.id}>
                                Rejeitar
                              </button>
                              <button className="btn btn-sm btn-primary"
                                onClick={() => a.aprovarSolicitacao(s)} disabled={IS_PREVIEW || a.aprovando === s.id}>
                                {a.aprovando === s.id ? 'Aprovando...' : 'Aprovar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {a.aba === 'links'      && <><LinksAdmin /><SnapshotConfigTab /></>}
      {a.aba === 'permissoes' && <div style={{ marginTop: 8 }}><PermissoesTab /></div>}
    </div>

    {a.confirmModal}
    {a.resetModal && <ResetModal data={a.resetModal} onClose={() => a.setResetModal(null)} />}
    </>
  )
}
