import { useState, useEffect } from 'react'
import { StatusBadge } from '../../components/DS.jsx'
import { fmtBRL, fmtBRL2, fmtPct } from '../../utils/formatacao.js'
import { CANAL_LABEL } from './comissoes.logic.js'
import { GestaoPolicyEditor,indicadorCondicao } from './GestaoPolicyEditor.jsx'

function IndicatorValue({indicator,onChange}){
  const [value,setValue]=useState(typeof indicator.valor==='number'?indicator.valor:'')
  useEffect(()=>setValue(typeof indicator.valor==='number'?indicator.valor:''),[indicator.valor])
  return <input className="form-input" type="number" min="0" max="1000000000000" step="0.01" aria-label={`Valor de ${indicator.nome}`} placeholder="Valor" value={value} style={{width:75,padding:'4px 6px',fontSize:12}} onChange={e=>setValue(e.target.value)} onBlur={()=>{const numeric=Number(value);if(value!==''&&Number.isFinite(numeric)&&numeric>=0&&numeric<=1e12&&numeric!==indicator.valor)onChange(numeric)}}/>
}

function GestaoLinha({ label, valor, cor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 'var(--text-sm2)' }}>
      <span style={{ color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums', color: cor || 'var(--text)' }}>{fmtBRL2(valor)}</span>
    </div>
  )
}

function BonusExtraInput({ value, onChange }) {
  const [local, setLocal] = useState(value || '')
  const [saved, setSaved] = useState(false)

  useEffect(() => { setLocal(value || '') }, [value])

  function save() {
    onChange(parseFloat(local) || 0)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        className="form-input"
        value={local}
        placeholder="0"
        onChange={e => setLocal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        onBlur={save}
        style={{ width: 80, textAlign: 'right', padding: '3px 7px', fontSize: 'var(--text-sm2)' }}
      />
      {saved && <span style={{ color: 'var(--green)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>✓</span>}
    </div>
  )
}

export function GestorCard({ gestor, mes, onToggle, onBonusExtra }) {
  const canais = Object.keys(gestor.realPorCanal)

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', color: 'var(--text)' }}>{gestor.colaborador}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>{gestor.cargo}</span>
          {gestor.equipeSize > 0 && (
            <span className="badge badge-gray" style={{ fontSize: 'var(--text-xs)' }}>{gestor.equipeSize} na equipe</span>
          )}
          {gestor.lojas.map(l => <span key={l} className="badge badge-blue" style={{ fontSize: 'var(--text-xs)' }}>{l}</span>)}
        </div>
        <GestaoPolicyEditor gestor={gestor} mes={mes}/>
      </div>

      <div style={{ padding: '10px 14px 12px' }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Faturamento Base</div>
          {canais.map(c => {
            const real = gestor.realPorCanal[c]
            const meta = gestor.metaPorCanal[c]
            const pct  = meta > 0 ? real / meta : null
            return (
              <div key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: 'var(--text-sm2)' }}>
                <span style={{ color: 'var(--text3)' }}>{CANAL_LABEL[c] || c}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {meta > 0 && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(meta)}</span>}
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(real)}</strong>
                  {pct !== null && <StatusBadge pct={pct} />}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 10 }}>
          {gestor.bonusMinimo!==undefined&&<p className={`gestao-bonus-condition${gestor.bonusLiberado?'':' is-blocked'}`}>{gestor.bonusLiberado?'Bônus liberados':'Bônus bloqueados'} · mínimo {fmtPct(gestor.bonusMinimo)} do faturamento. Atingido: {gestor.pctFaturamento===null?'sem meta definida':fmtPct(gestor.pctFaturamento)}. Comissão mantida.</p>}
          <GestaoLinha label={`Comissão (${fmtPct(gestor.comissaoPct, 2)})`} valor={gestor.comissao} />
          {gestor.bonificacaoPct > 0 && (
            <GestaoLinha label={`Bonificação (${fmtPct(gestor.bonificacaoPct, 2)})`} valor={gestor.bonificacao} cor="var(--amber)" />
          )}
          {gestor.bonusMoPropria > 0 && (
            <GestaoLinha label={`Bônus MO Própria (${fmtPct(gestor.bonusMoPropriaPct, 2)})`} valor={gestor.bonusMoPropria} />
          )}
          {gestor.bonusPecasProprias > 0 && (
            <GestaoLinha label={`Bônus Peças Próprias (${fmtPct(gestor.bonusPecasPropriaPct, 2)})`} valor={gestor.bonusPecasProprias} />
          )}
        </div>

        {gestor.indicadores.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Indicadores</div>
            {gestor.indicadores.map(ind => (
              <div key={ind.chave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 'var(--text-sm2)' }}>
                <span style={{ flex: 1, color: 'var(--text2)', lineHeight: 1.3 }}>{ind.nome}<small style={{display:'block',fontSize:10,color:'var(--text3)',marginTop:3}}>{indicadorCondicao(ind)} · bônus {fmtPct(ind.pct||0,2)}</small></span>
                {ind.tipo === 'valor' ? <IndicatorValue indicator={ind} onChange={val=>onToggle(gestor.nomeNorm,ind.chave,val)}/> : ind.tipo === 'auto' ? (
                  <span style={{
                    padding: '1px 7px', borderRadius: 4, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)',
                    background: ind.atingido ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)',
                    color: ind.atingido ? 'var(--green)' : 'var(--red)',
                  }}>
                    {ind.atingido ? '✓ Auto' : '✗ Auto'}
                  </span>
                ) : (
                  <button
                    onClick={() => onToggle(gestor.nomeNorm, ind.chave, !ind.atingido)}
                    style={{
                      padding: '2px 8px', borderRadius: 5, border: '1px solid',
                      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', cursor: 'pointer',
                      background: ind.atingido ? 'var(--honda-bg)' : 'var(--bg3)',
                      borderColor: ind.atingido ? 'var(--honda)' : 'var(--border2)',
                      color: ind.atingido ? 'var(--honda)' : 'var(--text3)',
                      fontFamily: 'var(--font)',
                    }}
                  >{ind.atingido ? 'SIM' : 'NÃO'}</button>
                )}
                <span style={{ width: 72, textAlign: 'right', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums', color: ind.atingido ? 'var(--text)' : 'var(--text3)' }}>
                  {ind.atingido && gestor.bonusLiberado ? fmtBRL2(ind.bonus) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 'var(--text-sm2)', color: 'var(--text2)' }}>Bônus Extra</span>
          <BonusExtraInput value={gestor.bonusExtraInformado} onChange={val => onBonusExtra(gestor.nomeNorm, val)} />
        </div>

        <div style={{ borderTop: '2px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-base)' }}>TOTAL</span>
          <span style={{ fontWeight: 800, fontSize: 'var(--text-md2)', color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{fmtBRL(gestor.total)}</span>
        </div>
      </div>
    </div>
  )
}
