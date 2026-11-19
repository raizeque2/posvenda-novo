import { useEffect, useMemo, useRef, useState } from 'react'
import useStore from '../../store.js'
import { salvarConfig } from '../../services/firestoreService.js'
import { useToast } from '../../hooks/useToast.jsx'
import {
  MODULOS_CONFIGURAVEIS, CARGOS, SETORES, PERMISSOES_PADRAO,
  normalizePermissions, tetoDoCargo, agruparPorSecao,
} from '../../data/permissoes.js'
import './permissoes-editor.css'

const POR_PATH = Object.fromEntries(MODULOS_CONFIGURAVEIS.map(m => [m.path, m]))
const Icone = ({ nome, size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><use href={`/icons/iconoir.svg#${nome}`} /></svg>
const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Editor visual das abas por grupo. O administrador "monta" a sidebar do
 * grupo arrastando abas da paleta para o menu (ou usando os botões, que fazem
 * o mesmo pelo teclado). Cargo define abas e ordem; setor só restringe.
 */
export function PermissoesTab() {
  const permissoes = useStore(s => s.permissoes)
  const toast = useToast()
  const salvo = useMemo(() => normalizePermissions(permissoes || PERMISSOES_PADRAO), [permissoes])
  const [local, setLocal] = useState(salvo)
  const [grupo, setGrupo] = useState({ tipo: 'cargo', id: 'operacional' })
  const [arrastando, setArrastando] = useState(null) // { path, origem }
  const [alvo, setAlvo] = useState(null) // índice de inserção na sidebar
  const [fantasma, setFantasma] = useState(null) // posição do cartão que segue o ponteiro
  const [sobrePaleta, setSobrePaleta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  useEffect(() => { setLocal(salvo) }, [salvo])

  const ehSetor = grupo.tipo === 'setor'
  const restrito = ehSetor ? Array.isArray(local.setores[grupo.id]) : true
  const lista = ehSetor ? (local.setores[grupo.id] || []) : local[grupo.id]
  const teto = ehSetor ? MODULOS_CONFIGURAVEIS.map(m => m.path) : tetoDoCargo(grupo.id)
  const naSidebar = lista.map(p => POR_PATH[p]).filter(Boolean)
  const disponiveis = MODULOS_CONFIGURAVEIS.filter(m => !lista.includes(m.path))
  const alterado = !iguais(local, salvo)

  function atualizar(nova) {
    setErro('')
    setLocal(prev => ehSetor
      ? { ...prev, setores: { ...prev.setores, [grupo.id]: nova } }
      : { ...prev, [grupo.id]: nova })
  }
  const inserir = (path, indice = lista.length) => {
    if (!teto.includes(path)) return
    const semEle = lista.filter(p => p !== path)
    const pos = Math.max(0, Math.min(indice, semEle.length))
    atualizar([...semEle.slice(0, pos), path, ...semEle.slice(pos)])
  }
  const remover = path => atualizar(lista.filter(p => p !== path))
  const mover = (path, delta) => {
    const i = lista.indexOf(path)
    const j = i + delta
    if (i < 0 || j < 0 || j >= lista.length) return
    const nova = [...lista];[nova[i], nova[j]] = [nova[j], nova[i]]
    atualizar(nova)
  }
  function alternarRestricao() {
    setLocal(prev => {
      const setores = { ...prev.setores }
      if (Array.isArray(setores[grupo.id])) delete setores[grupo.id]
      else setores[grupo.id] = MODULOS_CONFIGURAVEIS.map(m => m.path)
      return { ...prev, setores }
    })
  }
  function restaurarPadrao() {
    if (ehSetor) { setLocal(prev => { const setores = { ...prev.setores }; delete setores[grupo.id]; return { ...prev, setores } }) }
    else atualizar([...PERMISSOES_PADRAO[grupo.id]])
  }

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const final = normalizePermissions(local)
      await salvarConfig('permissoes', final)
      useStore.setState({ permissoes: final })
      toast?.('Permissões salvas. O menu de cada pessoa muda no próximo carregamento.', 'success')
    } catch (e) {
      console.error('salvar permissoes:', e)
      setErro('Não foi possível salvar. Verifique a conexão e tente novamente.')
    } finally { setSalvando(false) }
  }

  // Arrastar com Pointer Events (mouse, caneta e — pela alça — toque). Teclado e
  // toque também têm os botões +, ↑, ↓ e × de cada item, que fazem o mesmo.
  const arrasto = useRef(null)
  function calcularAlvo(x, y) {
    const el = document.elementFromPoint(x, y)
    const nav = el?.closest('.perm-mock-nav')
    if (nav) {
      const itens = [...nav.querySelectorAll('.perm-mock-item')]
      let indice = lista.length
      for (const item of itens) {
        const r = item.getBoundingClientRect()
        if (y < r.top + r.height / 2) { indice = Number(item.dataset.indice); break }
      }
      return { zona: 'menu', indice }
    }
    if (el?.closest('.perm-paleta')) return { zona: 'paleta' }
    return null
  }
  function aoPressionar(e, path, origem) {
    if (e.button !== 0 || e.target.closest('button')) return
    if (e.pointerType === 'touch' && !e.target.closest('.perm-alca')) return
    arrasto.current = { path, origem, x0: e.clientX, y0: e.clientY, ativo: false, id: e.pointerId, alvo: e.currentTarget }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function aoMover(e) {
    const a = arrasto.current
    if (!a || a.id !== e.pointerId) return
    if (!a.ativo && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 6) return
    if (!a.ativo) { a.ativo = true; setArrastando({ path: a.path, origem: a.origem }) }
    e.preventDefault()
    setFantasma({ x: e.clientX, y: e.clientY })
    const destino = calcularAlvo(e.clientX, e.clientY)
    setAlvo(destino?.zona === 'menu' ? destino.indice : null)
    setSobrePaleta(destino?.zona === 'paleta')
  }
  function aoSoltar(e) {
    const a = arrasto.current
    if (!a || a.id !== e.pointerId) return
    arrasto.current = null
    if (a.ativo) {
      const destino = calcularAlvo(e.clientX, e.clientY)
      if (destino?.zona === 'menu') inserir(a.path, destino.indice > lista.indexOf(a.path) && lista.includes(a.path) ? destino.indice - 1 : destino.indice)
      else if (destino?.zona === 'paleta' && a.origem === 'sidebar') remover(a.path)
    }
    setArrastando(null); setAlvo(null); setFantasma(null); setSobrePaleta(false)
  }
  const arrastavel = (path, origem) => ({ onPointerDown: e => aoPressionar(e, path, origem), onPointerMove: aoMover, onPointerUp: aoSoltar, onPointerCancel: aoSoltar })
  const nomeGrupo = ehSetor ? `Setor ${grupo.id}` : CARGOS.find(c => c.value === grupo.id)?.label
  const grupos = agruparPorSecao(naSidebar)
  let indiceGlobal = -1

  return (
    <div className="perm-editor">
      <div className="perm-grupos" role="tablist" aria-label="Grupo a configurar">
        {CARGOS.map(c => (
          <button key={c.value} role="tab" aria-selected={!ehSetor && grupo.id === c.value} className={!ehSetor && grupo.id === c.value ? 'is-ativo' : ''} onClick={() => setGrupo({ tipo: 'cargo', id: c.value })}>{c.label}</button>
        ))}
        <label className={`perm-setor${ehSetor ? ' is-ativo' : ''}`}>
          <span>Setor</span>
          <select value={ehSetor ? grupo.id : ''} onChange={e => e.target.value && setGrupo({ tipo: 'setor', id: e.target.value })} aria-label="Configurar abas de um setor">
            <option value="">Escolher…</option>
            {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <p className="perm-ajuda">
        {ehSetor
          ? <>O setor <strong>restringe</strong> as abas do cargo: a pessoa vê só as abas que o cargo e o setor têm em comum, na ordem do cargo. Defina o setor de cada usuário na aba Usuários.</>
          : <>Arraste as abas para o menu e reordene como quer que <strong>{nomeGrupo?.toLowerCase()}</strong> vejam. As três primeiras também vão para a barra inferior do celular. Início e Acessos são exclusivos do administrador.</>}
      </p>

      {ehSetor && (
        <label className="perm-restricao">
          <input type="checkbox" checked={restrito} onChange={alternarRestricao} />
          <span>Restringir as abas de quem é do setor {grupo.id}</span>
        </label>
      )}

      {restrito ? (
        <div className="perm-palco">
          <section className={`perm-paleta${arrastando?.origem === 'sidebar' ? ' is-soltavel' : ''}${sobrePaleta ? ' is-sobre' : ''}`} aria-label="Abas disponíveis">
            <header><strong>Abas disponíveis</strong><small>{disponiveis.length ? 'Arraste para o menu ou use +' : 'Todas as abas já estão no menu'}</small></header>
            {agruparPorSecao(disponiveis).map(({ secao, abas }) => (
              <div key={secao} className="perm-paleta-secao">
                <span>{secao}</span>
                {abas.map(m => {
                  const bloqueada = !teto.includes(m.path)
                  return (
                    <div key={m.path} className={`perm-chip${bloqueada ? ' is-bloqueada' : ''}`} {...(bloqueada ? {} : arrastavel(m.path, 'paleta'))} title={bloqueada ? 'Não pode ser liberada para este cargo' : undefined}>
                      <Icone nome={m.icon} /><span>{m.label}</span>
                      {bloqueada
                        ? <span className="perm-cadeado" aria-label="Bloqueada para este cargo"><Icone nome="lock" size={15} /></span>
                        : <button type="button" className="perm-icone-btn" aria-label={`Adicionar ${m.label} ao menu`} onClick={() => inserir(m.path)}><Icone nome="plus" size={16} /></button>}
                    </div>
                  )
                })}
              </div>
            ))}
          </section>

          <section className="perm-mock" aria-label={`Menu de ${nomeGrupo}`}>
            <div className="perm-mock-topo"><img src="/icon.png" alt="" width="26" height="26" /><strong>Pós-Venda</strong><small>{nomeGrupo}</small></div>
            <div className={`perm-mock-nav${arrastando ? ' is-arrastando' : ''}`}>
              {!naSidebar.length && <p className="perm-mock-vazio">Menu vazio. Arraste abas para cá — sem nenhuma aba, a pessoa só acessa o próprio perfil.</p>}
              {grupos.map(({ secao, abas }) => (
                <div key={secao} className="perm-mock-secao">
                  <span className="perm-mock-rotulo">{secao}</span>
                  {abas.map(m => {
                    indiceGlobal = lista.indexOf(m.path)
                    const i = indiceGlobal
                    return (
                      <div key={m.path} className={`perm-mock-item${arrastando?.path === m.path ? ' is-fantasma' : ''}${alvo === i ? ' alvo-antes' : ''}${alvo === i + 1 && i === lista.length - 1 ? ' alvo-depois' : ''}`}
                        data-indice={i} {...arrastavel(m.path, 'sidebar')}>
                        <span className="perm-alca" aria-hidden="true"><Icone nome="drag" size={16} /></span>
                        <Icone nome={m.icon} /><span className="perm-mock-label">{m.label}</span>
                        {i < 3 && <span className="perm-tag" title="Aparece na barra inferior do celular">Celular</span>}
                        <span className="perm-acoes">
                          <button type="button" className="perm-icone-btn" aria-label={`Subir ${m.label}`} disabled={i === 0} onClick={() => mover(m.path, -1)}><Icone nome="arrow-up" size={15} /></button>
                          <button type="button" className="perm-icone-btn" aria-label={`Descer ${m.label}`} disabled={i === lista.length - 1} onClick={() => mover(m.path, 1)}><Icone nome="arrow-down" size={15} /></button>
                          <button type="button" className="perm-icone-btn" aria-label={`Remover ${m.label} do menu`} onClick={() => remover(m.path)}><Icone nome="xmark" size={15} /></button>
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="perm-mock-bb" aria-label="Prévia da barra inferior do celular">
              {naSidebar.slice(0, 2).map(m => <span key={m.path}><Icone nome={m.icon} size={16} /></span>)}
              <i aria-hidden="true" />
              {naSidebar.slice(2, 3).map(m => <span key={m.path}><Icone nome={m.icon} size={16} /></span>)}
              <span><Icone nome="more-horiz" size={16} /></span>
            </div>
          </section>
        </div>
      ) : (
        <p className="perm-livre">Sem restrição: quem é do setor {grupo.id} vê todas as abas liberadas para o próprio cargo.</p>
      )}

      {fantasma && arrastando && <div className="perm-fantasma" style={{ left: fantasma.x, top: fantasma.y }} aria-hidden="true"><Icone nome={POR_PATH[arrastando.path]?.icon} />{POR_PATH[arrastando.path]?.label}</div>}
      {erro && <p className="perm-erro" role="alert">{erro}</p>}
      <footer className="perm-rodape">
        <button type="button" className="btn btn-ghost" onClick={restaurarPadrao}>{ehSetor ? 'Remover restrição do setor' : 'Restaurar padrão do cargo'}</button>
        <span className="perm-status" role="status">{alterado ? 'Alterações não salvas' : 'Tudo salvo'}</span>
        <button type="button" className="btn btn-ghost" disabled={!alterado || salvando} onClick={() => setLocal(salvo)}>Descartar</button>
        <button type="button" className="btn btn-primary" disabled={!alterado || salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar permissões'}</button>
      </footer>
    </div>
  )
}
