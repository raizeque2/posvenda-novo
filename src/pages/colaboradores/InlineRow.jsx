import { useState, useRef, useEffect } from 'react'
import { LOJAS } from '../../data/regras.js'
import { listaSupervisores } from '../../utils/normalizacao.js'
import { fmtSalario, stickyName, CellDropdown, CellSelect, CellMultiSelect, MetaInput } from './CellInputs.jsx'
import { CANAIS } from './RowComponents.jsx'
import { Foto } from '../../pv/org.js'

/**
 * Linha de colaborador com edição por clique direto — sem "Modo Edição"
 * separado. Cada célula mostra o valor como texto/badge (igual à leitura) e
 * só vira o editor de verdade quando clicada; ao clicar fora ou selecionar
 * um valor, volta pra leitura sozinha. Nome/Apelido pedem duplo clique (são
 * texto livre — clique simples é fácil demais de disparar por engano
 * enquanto só se está lendo a tabela); os demais campos, por já serem
 * seletores (loja/cargo/setor/supervisor/salário), abrem no primeiro clique.
 *
 * onSave(nome, campo, valor) — chamado a cada edição confirmada. Por ora só
 * loga no console (ver Colaboradores.jsx) — gravação real no Firestore
 * entra quando a estrutura nova (1 documento por pessoa) estiver pronta.
 */
export function InlineRow({ c, checked, onToggle, onSave, cargos, centros, supervisores, lojas, cols, editable }) {
  const [editingCell, setEditingCell] = useState(null) // null | 'colaborador' | 'apelido' | 'loja' | ...
  const cellRef = useRef(null)

  useEffect(() => {
    if (!editingCell) return
    function onDocDown(e) {
      if (cellRef.current && !cellRef.current.contains(e.target)) setEditingCell(null)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [editingCell])

  function commit(campo, valor, { keepOpen = false } = {}) {
    onSave(c.colaborador, campo, valor)
    if (!keepOpen) setEditingCell(null)
  }

  const uf = LOJAS[c.loja]?.uf || '–'
  const bg = checked ? 'rgba(99,102,241,0.05)' : 'var(--bg2)'

  // Envolve o conteúdo de leitura numa área clicável com o mesmo hover sutil
  // usado no resto do app (cards, linhas de tabela) — sinaliza "isso reage".
  function Clicavel({ campo, duplo, children }) {
    const ativo = editingCell === campo
    return (
      <span
        onClick={!editable ? undefined : duplo ? undefined : () => setEditingCell(campo)}
        onDoubleClick={!editable ? undefined : duplo ? () => setEditingCell(campo) : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', minHeight: 22, width: '100%',
          cursor: editable ? 'pointer' : 'default',
          borderRadius: 'var(--radius)', padding: '2px 5px', margin: '-2px -5px',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (editable && !ativo) e.currentTarget.style.background = 'var(--bg3)' }}
        onMouseLeave={e => { e.currentTarget.style.background = '' }}
        title={editable ? (duplo ? 'Clique duas vezes para editar' : 'Clique para editar') : undefined}
      >
        {children}
      </span>
    )
  }

  return (
    <tr style={checked ? { background: 'rgba(99,102,241,0.05)' } : undefined}>
      <td style={{ width: 36, textAlign: 'center', paddingLeft: 10, ...stickyName, background: bg }}>
        <input type="checkbox" checked={checked} onChange={() => onToggle(c.colaborador)}
          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--accent)' }} />
      </td>

      <td style={{ fontWeight: 'var(--weight-semibold)', ...stickyName, left: 36, background: bg }} ref={editingCell === 'colaborador' ? cellRef : undefined}>
        <div className="tp-pessoa"><Foto nome={c.colaborador} tamanho={34} /><div style={{ minWidth: 0 }}>
        {editingCell === 'colaborador' ? (
          <input className="form-input" autoFocus defaultValue={c.colaborador}
            style={{ fontSize: 'var(--text-sm)', height: 26, padding: '2px 6px' }}
            onBlur={e => commit('colaborador', e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingCell(null) }} />
        ) : (
          <Clicavel campo="colaborador" duplo>
            {c.colaborador}
          </Clicavel>
        )}
        {!cols.apelido ? null : editingCell === 'apelido' ? (
          <div ref={cellRef}>
            <input className="form-input" autoFocus defaultValue={c.apelido}
              placeholder="Nome nas vendas"
              style={{ fontSize: 'var(--text-xs)', height: 24, padding: '2px 6px', marginTop: 2 }}
              onBlur={e => commit('apelido', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingCell(null) }} />
          </div>
        ) : c.apelido ? (
          <div>
            <Clicavel campo="apelido" duplo>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', fontWeight: 'var(--weight-normal)' }}>{c.apelido}</span>
            </Clicavel>
          </div>
        ) : editable ? (
          <div>
            <Clicavel campo="apelido" duplo>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', opacity: 0.5 }}>+ nome nas vendas</span>
            </Clicavel>
          </div>
        ) : null}
        </div></div>
      </td>

      {cols.loja && (
        <td ref={editingCell === 'loja' ? cellRef : undefined}>
          {editingCell === 'loja' ? (
            <CellDropdown value={c.loja} startOpen
              onChange={v => commit('loja', v)}
              options={lojas.map(([k, vl]) => `${k} – ${vl.un}`)} placeholder="Loja..." />
          ) : (
            <Clicavel campo="loja"><span className="badge badge-blue">{c.loja}</span></Clicavel>
          )}
        </td>
      )}
      <td><span className={`badge ${uf === 'AL' ? 'badge-green' : 'badge-blue'}`}>{uf}</span></td>
      {cols.cargo && (
        <td ref={editingCell === 'cargo' ? cellRef : undefined}>
          {editingCell === 'cargo' ? (
            <CellSelect value={c.cargo} startOpen onChange={v => commit('cargo', v.toUpperCase())} options={cargos} upperCase />
          ) : (
            <Clicavel campo="cargo">
              <span style={{ fontSize: 'var(--text-sm2)' }}>{c.cargo || <span style={{ color: 'var(--text3)' }}>–</span>}</span>
            </Clicavel>
          )}
        </td>
      )}
      {cols.centro_custo && (
        <td ref={editingCell === 'centro_custo' ? cellRef : undefined}>
          {editingCell === 'centro_custo' ? (
            <CellSelect value={c.centro_custo} startOpen onChange={v => commit('centro_custo', v)} options={centros} />
          ) : (
            <Clicavel campo="centro_custo">
              <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text3)' }}>{c.centro_custo || '–'}</span>
            </Clicavel>
          )}
        </td>
      )}
      {cols.salario && (
        <td ref={editingCell === 'salario_base' ? cellRef : undefined}>
          {editingCell === 'salario_base' ? (
            <MetaInput value={c.salario_base} startOpen onChange={v => commit('salario_base', v)} col="salario_base_inline" />
          ) : (
            <Clicavel campo="salario_base">
              <span style={{ fontSize: 'var(--text-sm2)', fontVariantNumeric: 'tabular-nums', width: '100%', textAlign: 'right', paddingRight: 8 }}>
                {fmtSalario(c.salario_base)}
              </span>
            </Clicavel>
          )}
        </td>
      )}
      {cols.setor && (
        <td ref={editingCell === 'cargo_movimento' ? cellRef : undefined}>
          {editingCell === 'cargo_movimento' ? (
            <CellMultiSelect value={c.cargo_movimento} startOpen onChange={v => commit('cargo_movimento', v, { keepOpen: true })} options={CANAIS} />
          ) : (
            <Clicavel campo="cargo_movimento">
              {(c.cargo_movimento || '').split(';').map(s => s.trim()).filter(Boolean).map(s => (
                <span key={s} className="badge badge-gray" style={{ marginRight: 2, fontSize: 'var(--text-xs)' }}>{s}</span>
              ))}
              {!c.cargo_movimento && <span style={{ color: 'var(--text3)' }}>–</span>}
            </Clicavel>
          )}
        </td>
      )}
      {cols.supervisor && (
        <td ref={editingCell === 'supervisor' ? cellRef : undefined}>
          {editingCell === 'supervisor' ? (
            <CellMultiSelect value={c.supervisor} startOpen onChange={v => commit('supervisor', v, { keepOpen: true })} options={supervisores} />
          ) : (
            <Clicavel campo="supervisor">
              {c.supervisor
                ? listaSupervisores(c.supervisor).map(s => (
                    <span key={s} className="badge badge-gray" style={{ marginRight: 3, fontSize: 'var(--text-xs)' }}>{s.split(' ')[0]}</span>
                  ))
                : <span style={{ color: 'var(--text3)' }}>–</span>}
            </Clicavel>
          )}
        </td>
      )}
    </tr>
  )
}
