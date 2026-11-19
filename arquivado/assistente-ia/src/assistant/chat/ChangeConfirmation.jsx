import { useEffect, useState } from 'react'
import { RainbowButton } from '../../components/ui/rainbow-button'
import { fmtBRL2 } from '../../utils/formatacao.js'
import { GESTAO_CANAIS } from '../../../functions/src/gestaoPolicy.js'

const pct = value => value === undefined ? '—' : `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`
// Linhas da regra de gestor, lado a lado (atual → nova). Só aparecem as linhas que existem em uma das duas.
export function ruleRows(old, next) {
  const describe = rule => rule ? {
    'Comissão': pct(rule.comissao ?? 0), 'Bonificação': pct(rule.bonificacao ?? 0),
    ...(rule.bonusMoPropria || rule.bonusPecasProprias ? { 'Bônus M.O própria': pct(rule.bonusMoPropria ?? 0), 'Bônus peças próprias': pct(rule.bonusPecasProprias ?? 0) } : {}),
    'Liberação de bônus': rule.bonusMinimo === undefined ? 'Sem mínimo' : `${pct(rule.bonusMinimo)} da meta`,
    'Faturamento base': `${rule.baseCalculo === 'equipe_mais_propria' ? 'Equipe + próprias' : 'Equipe'} · ${(rule.canaisBase || []).map(c => GESTAO_CANAIS[c] || c).join(', ')}`,
    ...Object.fromEntries(Object.entries(rule.metasCanais || {}).map(([canal, meta]) => [`Meta ${GESTAO_CANAIS[canal] || canal}`, fmtBRL2(meta)])),
    'Indicadores': (rule.indicadores || []).map(ind => `${ind.nome} (${pct(ind.pct)})`).join(', ') || 'Nenhum',
  } : {}
  const a = describe(old), b = describe(next)
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].map(label => ({ label, old: old ? a[label] ?? '—' : 'Sem regra', next: b[label] ?? '—', changed: a[label] !== b[label] }))
}
function RuleDiff({ old, next }) {
  return <table className="chat-rule-diff"><thead><tr><th scope="col">Item</th><th scope="col">Atual</th><th scope="col">Nova</th></tr></thead>
    <tbody>{ruleRows(old, next).map(row => <tr key={row.label} className={row.changed ? 'is-changed' : undefined}><th scope="row">{row.label}</th><td>{row.old}</td><td>{row.changed ? <strong>{row.next}</strong> : row.next}</td></tr>)}</tbody></table>
}

export default function ChangeConfirmation({ message, busy, canEdit, onConfirm, onCancel }) {
  const proposal = message.proposal, status = message.changeStatus || proposal.status || 'pending'
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (status !== 'pending') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [status])
  const expired = proposal.expiresAt <= now
  const format = value => proposal.unit === 'percent' ? `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%` : fmtBRL2(value)
  return <section className="chat-change-review" aria-label="Revisão da alteração">
    <header><strong>{proposal.label}</strong><span>{proposal.month}</span></header>
    <p>{proposal.person}{proposal.loja ? ` · ${proposal.loja}` : ''}{proposal.channel ? ` · ${proposal.channel}` : ''}</p>
    {proposal.unit === 'rule' ? <RuleDiff old={proposal.old} next={proposal.next}/> : <dl><div><dt>Valor atual</dt><dd>{format(proposal.old)}</dd></div><span aria-hidden="true">→</span><div><dt>Novo valor</dt><dd>{format(proposal.next)}</dd></div></dl>}
    <div role="status">{status === 'applied' ? 'Alteração salva.' : status === 'cancelled' ? 'Cancelada. Nenhum valor foi alterado.' : status === 'saving' ? 'Conferindo e salvando…' : expired ? 'Proposta expirada. Solicite uma nova revisão.' : 'Nada foi alterado. Confirme para salvar este valor.'}</div>
    {message.changeError && <p role="alert">{message.changeError}</p>}
    {['pending', 'saving'].includes(status) && canEdit && <footer>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onCancel?.(message.id)}>Cancelar</button>
      <RainbowButton disabled={busy || expired} onClick={() => onConfirm?.(message.id)}>Confirmar alteração</RainbowButton>
    </footer>}
  </section>
}
