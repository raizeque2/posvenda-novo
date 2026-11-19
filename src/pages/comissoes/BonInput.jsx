import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fmtBRL, fmtBRL2, fmtPct, parseBR } from '../../utils/formatacao.js'
import { LojaTags } from '../../components/DS.jsx'
import { Th } from '../../components/tabela.jsx'
import { abrevCargo, MIN_MOTIVO } from './comissoes.logic.js'

// Formata pra exibição no campo de edição: "100" digitado → "100,00" ao sair
// do campo. Sem "R$" (o campo já é claramente um valor, e fica compacto).
const fmtValorEdicao = n => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtTs(em) {
  return em ? new Date(em).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : null
}

// ── Tooltip de auditoria — valor atual + histórico anterior (nunca sobrescrito) ─
// Via portal, igual ao MotivoPopover: nunca cortado pelo overflow/scroll da tabela.
function AuditTooltip({ anchorRef, audit }) {
  const [pos, setPos] = useState(null)
  const hist = audit.historico || []

  useEffect(() => {
    function place() {
      const r = anchorRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [anchorRef])

  if (!pos) return null
  return createPortal(
    <div style={{
      position: 'absolute', top: pos.top, left: pos.left, zIndex: 300, maxWidth: 280,
      background: '#1e293b', color: '#f1f5f9', borderRadius: 8,
      padding: '8px 12px', fontSize: 'var(--text-sm)', lineHeight: 1.6,
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)', pointerEvents: 'none',
    }}>
      <div><strong>{fmtBRL2(audit._valor ?? 0)}</strong> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>atual</span></div>
      <div>{audit.por || '?'} · {fmtTs(audit.em)}</div>
      {audit.obs && <div style={{ color: 'var(--text3)' }}>"{audit.obs}"</div>}
      {hist.length > 0 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #334155' }}>
          <div style={{ color: 'var(--text3)', fontSize: 'var(--text-xs)', marginBottom: 2 }}>Histórico anterior</div>
          {[...hist].reverse().slice(0, 4).map((h, i) => (
            <div key={i} style={{ fontSize: 'var(--text-xs)', color: '#cbd5e1', marginBottom: 2 }}>
              {fmtBRL2(h.valor)} · {h.por || '?'} · {fmtTs(h.em)}
              {h.obs && <div style={{ color: 'var(--text3)' }}>"{h.obs}"</div>}
            </div>
          ))}
          {hist.length > 4 && <div style={{ color: '#64748b', fontSize: 'var(--text-xs)' }}>+{hist.length - 4} mais antiga(s)</div>}
        </div>
      )}
    </div>,
    document.body
  )
}

// ── Campo de motivo com contador — reaproveitado nos 3 fluxos (admin/proposta/rejeição) ─
function MotivoTextarea({ value, onChange, erro, placeholder = 'Motivo…', autoFocus, style }) {
  const len = (value || '').trim().length
  const ok  = len >= MIN_MOTIVO
  return (
    <div style={style}>
      <textarea
        className="form-input" rows={3} autoFocus={autoFocus}
        value={value || ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', resize: 'vertical', fontSize: 'var(--text-sm)', borderColor: erro ? 'var(--red)' : undefined }}
      />
      <div style={{ fontSize: 'var(--text-xs)', color: ok ? 'var(--green)' : erro ? 'var(--red)' : 'var(--text3)', marginTop: 2 }}>
        {ok ? '✓ motivo válido' : `mín. ${MIN_MOTIVO} caracteres (${len}/${MIN_MOTIVO})`}
      </div>
    </div>
  )
}

// ── Painel flutuante de motivo — via portal, nunca cortado pelo scroll da tabela ─
function MotivoPopover({ anchorRef, value, onChange, erro, onClose }) {
  const [pos, setPos] = useState(null)
  const boxRef = useRef(null)

  useEffect(() => {
    function place() {
      const r = anchorRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [anchorRef])

  useEffect(() => {
    function onDocDown(e) {
      if (boxRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return
      onClose?.()
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [anchorRef, onClose])

  if (!pos) return null
  return createPortal(
    <div ref={boxRef} style={{
      position: 'absolute', top: pos.top, left: pos.left, zIndex: 300, width: 240,
      background: 'var(--bg2)', border: `1px solid ${erro ? 'var(--red)' : 'var(--border2)'}`,
      borderRadius: 10, padding: 10, boxShadow: '0 10px 28px rgba(15,23,42,0.18)',
    }}>
      <MotivoTextarea value={value} onChange={onChange} erro={erro} placeholder="Motivo do bônus…" autoFocus />
    </div>,
    document.body
  )
}

// ── BonInput ──────────────────────────────────────────────────────────────────
// Props:
//   value          – valor atual (number, de bonificacoes)
//   onChange       – draft callback (val: string) — sem save imediato; null = só leitura
//   audit          – entrada de bonAudit para esta chave
//   isDraft        – true quando há valor de rascunho diferente do salvo (destaque visual)
//   motivoValue    – motivo do rascunho atual (aparece junto do valor, ao editar)
//   onMotivoChange – callback do motivo (val: string)
//   motivoErro     – true quando tentou salvar com motivo curto demais (destaca em vermelho)
//
// Edição direta pra admin/coordenador/supervisor — sem fluxo de propor→aprovar
// (existiu até 01/09/2026; removido porque supervisor passou a enxergar só o
// próprio time, então não fazia mais sentido coordenador — que tem escopo
// MAIOR — ter menos poder que supervisor de editar direto).
export function BonInput({ value, onChange, audit, isDraft, motivoValue, onMotivoChange, motivoErro }) {
  const [localVal, setLocalVal] = useState(value ? fmtValorEdicao(value) : '')
  const [hover,      setHover]      = useState(false)
  const [showMotivo, setShowMotivo] = useState(false)
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)

  // Só sincroniza do valor vindo de fora quando o campo NÃO está focado —
  // senão a vírgula que a pessoa acabou de digitar seria apagada a cada
  // tecla pelo vai-e-volta número→string (mesmo padrão de guarda usado em
  // EditableMultiplier/EditablePct, RegrasInputs.jsx).
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setLocalVal(value ? fmtValorEdicao(value) : '')
  }, [value])

  // Fecha o painel de motivo se o rascunho for descartado por fora. NÃO abre
  // mais sozinho no primeiro dígito — só ao sair do campo (ver onBlur do
  // input) ou se a tentativa de salvar acusar motivo curto demais.
  useEffect(() => { if (!isDraft) setShowMotivo(false) }, [isDraft])
  useEffect(() => { if (motivoErro) setShowMotivo(true) }, [motivoErro])

  // Monta objeto enriquecido p/ tooltip (inclui valor salvo)
  const auditTooltip = audit?.em ? { ...audit, _valor: value } : null

  // ── READ-ONLY ─────────────────────────────────────────────
  if (!onChange) {
    return (
      <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => auditTooltip && setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span style={{ fontSize: 'var(--text-sm2)', fontVariantNumeric: 'tabular-nums', color: value > 0 ? 'var(--amber)' : 'var(--text3)' }}>
          {value > 0 ? fmtBRL2(value) : '—'}
        </span>
        {auditTooltip && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginLeft: 4 }}>ⓘ</span>}
        {hover && auditTooltip && <AuditTooltip anchorRef={wrapRef} audit={auditTooltip} />}
      </div>
    )
  }

  // ── EDIÇÃO — motivo abre num painel flutuante (portal), nunca empurra a
  //     linha da tabela ────────────────────────────────────────────────
  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', minWidth: 90 }}
      onMouseEnter={() => auditTooltip && !isDraft && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <input
        ref={inputRef}
        type="text" inputMode="decimal" className="form-input"
        value={localVal}
        placeholder="0,00"
        onChange={e => {
          const raw = e.target.value.replace(/[^0-9,]/g, '')
          setLocalVal(raw)
          onChange(String(parseBR(raw)))
        }}
        onBlur={() => {
          const n = parseBR(localVal)
          setLocalVal(n ? fmtValorEdicao(n) : '')
          // Só pede motivo ao SAIR do campo (tab / clicar em outro lugar) —
          // nunca no meio da digitação.
          if (isDraft && (motivoValue || '').trim().length < MIN_MOTIVO) setShowMotivo(true)
        }}
        style={{
          width: 80, textAlign: 'right', padding: '4px 8px',
          borderColor: isDraft ? 'var(--amber)' : undefined,
          background: isDraft ? 'rgba(245,158,11,0.06)' : undefined,
          transition: 'border-color .15s, background .15s',
        }}
      />
      {!isDraft && auditTooltip && (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginLeft: 4, cursor: 'default' }}>ⓘ</span>
      )}
      {isDraft && (
        <button
          type="button" onClick={() => setShowMotivo(v => !v)} title="Motivo do bônus"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--amber)', marginLeft: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >●</button>
      )}
      {hover && auditTooltip && <AuditTooltip anchorRef={wrapRef} audit={auditTooltip} />}
      {isDraft && showMotivo && onMotivoChange && (
        <MotivoPopover
          anchorRef={wrapRef}
          value={motivoValue}
          onChange={onMotivoChange}
          erro={motivoErro}
          onClose={() => setShowMotivo(false)}
        />
      )}
    </div>
  )
}

// ── Estilos sticky ────────────────────────────────────────────────────────────
const stickyL0   = { position: 'sticky', left:  0,  zIndex: 2, background: 'var(--bg2)', boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }
const stickyL70  = { position: 'sticky', left:  70, zIndex: 2, background: 'var(--bg2)', boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }
const stickyR    = { position: 'sticky', right: 0,  zIndex: 2, background: 'var(--bg2)', boxShadow: '-2px 0 4px rgba(0,0,0,0.04)' }
const stickyL0H  = { ...stickyL0,  background: 'var(--bg3)' }
const stickyL70H = { ...stickyL70, background: 'var(--bg3)' }
const stickyRH   = { ...stickyR,   background: 'var(--bg3)' }

// ── Cabeçalho de coluna com total ─────────────────────────────────────────────
function ThTotal({ col, label, total, sort, toggle, style, color }) {
  return (
    <Th col={col} sort={sort} toggle={toggle} style={style}
      label={
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, lineHeight: 1.2 }}>
          <span>{label}</span>
          <span style={{ fontSize: 'var(--text-2xs)', fontWeight: 600, color: color || 'var(--text2)', letterSpacing: 0, textTransform: 'none', fontVariantNumeric: 'tabular-nums' }}>
            {fmtBRL2(total)}
          </span>
        </span>
      }
    />
  )
}

// ── Definição de colunas ocultáveis ──────────────────────────────────────────
export const COLS_DEFS = [
  { k: 'comMO',        l: 'Com. M.O' },
  { k: 'comPecasOS',   l: 'Com. Peças O.S' },
  { k: 'comPecas',     l: 'Com. Peças' },
  { k: 'totCom',       l: 'Total Com.' },
  { k: 'bonifMO',      l: 'Bonif. M.O' },
  { k: 'bonifPecasOS', l: 'Bonif. Peças O.S' },
  { k: 'bonifPecas',   l: 'Bonif. Peças' },
  { k: 'bonManual',    l: 'Bônus Manual' },
  { k: 'totBonif',     l: 'Total Bonif.' },
]
export const COLS_PADRAO = Object.fromEntries(COLS_DEFS.map(d => [d.k, true]))

// ── ComissaoTabela ────────────────────────────────────────────────────────────
export function ComissaoTabela({
  rows, sort, toggle,
  mesAtivo,
  onBonDraft, rascunhoBon, errosMotivo, bonAudit,
  cols,
}) {
  const valorDraft = nome => rascunhoBon?.[nome] !== undefined ? Number(rascunhoBon[nome].valor) || 0 : null

  // Totais calculados dos rows visíveis (incluindo rascunho no bônus manual)
  const t = {
    comMO:        rows.reduce((s, c) => s + c.comValMO, 0),
    comPecasOS:   rows.reduce((s, c) => s + c.comValPO, 0),
    comPecas:     rows.reduce((s, c) => s + c.comValP,  0),
    totCom:       rows.reduce((s, c) => s + c.comTotal, 0),
    bonifMO:      rows.reduce((s, c) => s + c.bonValMO, 0),
    bonifPecasOS: rows.reduce((s, c) => s + c.bonValPO, 0),
    bonifPecas:   rows.reduce((s, c) => s + c.bonValP,  0),
    bonManual:    rows.reduce((s, c) => s + (valorDraft(c.nome) ?? c.bon), 0),
    // Total Bonif. = calculado (meta batida) + manual — as duas colunas
    // anteriores somadas, não só a calculada (senão o bônus manual lançado
    // não aparece refletido em nenhum "total" antes do Total Geral).
    totBonif:     rows.reduce((s, c) => s + c.bonCalc + (valorDraft(c.nome) ?? c.bon), 0),
    totGeral:     rows.reduce((s, c) => s + c.comTotal + c.bonCalc + (valorDraft(c.nome) ?? c.bon), 0),
  }

  const comCell = (comVal, pct, vendas) => (
    <td style={{ verticalAlign: 'top' }}>
      {pct > 0 && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--honda)', fontWeight: 'var(--weight-bold)' }}>{fmtPct(pct, 1)}</div>}
      <div style={{ fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL2(comVal)}</div>
      {vendas > 0 && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(vendas)}</div>}
    </td>
  )

  const bonCell = (bonVal, pct) => (
    <td style={{ verticalAlign: 'top', background: 'rgba(245,158,11,0.06)' }}>
      {pct > 0 && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--amber)', fontWeight: 'var(--weight-bold)' }}>{fmtPct(pct, 1)}</div>}
      <div style={{ fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums', color: bonVal > 0 ? 'var(--amber)' : undefined }}>{fmtBRL2(bonVal)}</div>
    </td>
  )

  return (
    <table>
      <thead>
        <tr>
          {/* Fixas: Loja, Nome/cargo, Total Geral */}
          <Th col="loja" label="Loja" sort={sort} toggle={toggle} style={{ ...stickyL0H, minWidth: 70 }} />
          <Th col="nome" label="Colaborador" sort={sort} toggle={toggle} style={{ ...stickyL70H, minWidth: 180 }} />

          {cols.comMO        && <ThTotal col="comValMO"    label="Com. M.O"         total={t.comMO}        sort={sort} toggle={toggle} />}
          {cols.comPecasOS   && <ThTotal col="comValPO"    label="Com. Peças O.S"   total={t.comPecasOS}   sort={sort} toggle={toggle} />}
          {cols.comPecas     && <ThTotal col="comValP"     label="Com. Peças"       total={t.comPecas}     sort={sort} toggle={toggle} />}
          {cols.totCom       && <ThTotal col="comTotal"    label="Total Com."       total={t.totCom}       sort={sort} toggle={toggle} />}
          {cols.bonifMO      && <ThTotal col="bonValMO"    label="Bonif. M.O"       total={t.bonifMO}      sort={sort} toggle={toggle} color="var(--amber)" />}
          {cols.bonifPecasOS && <ThTotal col="bonValPO"    label="Bonif. Peças O.S" total={t.bonifPecasOS} sort={sort} toggle={toggle} color="var(--amber)" />}
          {cols.bonifPecas   && <ThTotal col="bonValP"     label="Bonif. Peças"     total={t.bonifPecas}   sort={sort} toggle={toggle} color="var(--amber)" />}
          {cols.bonManual    && <ThTotal col="bon"         label="Bônus Manual"     total={t.bonManual}    sort={sort} toggle={toggle} color="var(--amber)" />}
          {cols.totBonif     && <ThTotal col="bonCalc"     label="Total Bonif."     total={t.totBonif}     sort={sort} toggle={toggle} color="var(--amber)" />}

          <ThTotal col="totalComBon" label="Total Geral" total={t.totGeral} sort={sort} toggle={toggle} style={stickyRH} color="var(--green)" />
        </tr>
      </thead>
      <tbody>
        {rows.map(c => {
          const chave      = `${c.nome}||${mesAtivo}`
          const draft      = rascunhoBon?.[c.nome]
          const isDraft    = draft !== undefined
          const displayBon = isDraft ? (Number(draft.valor) || 0) : c.bon
          const totalGeral = c.comTotal + c.bonCalc + displayBon

          return (
            <tr key={c.nome}>
              {/* LOJA — sticky esquerda */}
              <td style={{ verticalAlign: 'top', ...stickyL0, minWidth: 70 }}>
                <LojaTags lojas={c.lojas} max={1} />
              </td>

              {/* NOME + cargo abaixo (padrão Metas) */}
              <td style={{ verticalAlign: 'top', fontWeight: 'var(--weight-semibold)', ...stickyL70, minWidth: 180 }}>
                {c.nome}
                {!c.temMeta && <span style={{ color: 'var(--amber)', marginLeft: 4 }}>*</span>}
                {c.cargo && (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontWeight: 'var(--weight-normal)', marginTop: 1 }}>
                    {abrevCargo(c.cargo)}
                  </div>
                )}
              </td>

              {cols.comMO        && comCell(c.comValMO, c.comCmo,  c.moreal)}
              {cols.comPecasOS   && comCell(c.comValPO, c.comCpo,  c.pocoficina - (c.devPocoficina || 0))}
              {cols.comPecas     && comCell(c.comValP,  c.comCp,   c.tp)}
              {cols.totCom       && <td style={{ fontWeight: 'var(--weight-bold)', verticalAlign: 'top' }}>{fmtBRL2(c.comTotal)}</td>}
              {cols.bonifMO      && bonCell(c.bonValMO, c.comCbmo)}
              {cols.bonifPecasOS && bonCell(c.bonValPO, c.comCbpo)}
              {cols.bonifPecas   && bonCell(c.bonValP,  c.comCbp)}

              {cols.bonManual && (
                <td style={{ verticalAlign: 'top' }}>
                  <BonInput
                    value={displayBon}
                    onChange={onBonDraft ? (val) => onBonDraft(c.nome, 'valor', val) : null}
                    audit={bonAudit?.[chave]}
                    isDraft={isDraft}
                    motivoValue={draft?.motivo}
                    onMotivoChange={onBonDraft ? (val) => onBonDraft(c.nome, 'motivo', val) : null}
                    motivoErro={errosMotivo?.has(c.nome)}
                  />
                </td>
              )}

              {cols.totBonif && (
                <td style={{ fontWeight: 'var(--weight-bold)', verticalAlign: 'top', color: (c.bonCalc + displayBon) > 0 ? 'var(--amber)' : undefined }}>
                  {fmtBRL2(c.bonCalc + displayBon)}
                </td>
              )}

              <td style={{ fontWeight: 800, color: 'var(--green)', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums', ...stickyR }}>
                {fmtBRL2(totalGeral)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
