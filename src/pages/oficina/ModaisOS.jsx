import { useState, useMemo } from 'react'
import { Modal, Th, useSorter, Td, TrHover, Tag, SeletorMultiplo } from '../../components/AnalysisDS.jsx'
import { fmtBRL, fmtNum, fmtPct } from '../../utils/formatacao.js'
import { CRITICIDADE_META } from '../../services/processamento/processarOS.js'
import { tituloCaso } from './MonitorOSUI.jsx'

export const CAMPO_META = {
  servico:    { label: 'Serviço', sufixo: 'valor em serviço' },
  mercadoria: { label: 'Peças',   sufixo: 'valor em peças' },
  valorTotal: { label: 'Total',   sufixo: 'valor total' },
}

// Colunas da tabela única. `modo`: 'detalhe' (Detalhamento das ordens, como a
// ferramenta) ou 'valores' (modais de drill-down, com Serviço/Peças/Total).
const LinkOS = ({ o, onOpenOS }) => (
  <button className="btn btn-ghost btn-xs" onClick={() => onOpenOS?.(o)} title="Ver detalhes da O.S."
    style={{ padding: 0, color: 'var(--blue)', fontWeight: 'var(--weight-bold)', textDecoration: 'underline' }}>{o.nOS}</button>
)
const DiasTag = ({ o }) => {
  const meta = o.criticidade && o.criticidade !== 'normal' ? CRITICIDADE_META[o.criticidade] : null
  return o.dias == null ? '—' : meta ? <Tag cor={meta.tag}>{o.dias}d</Tag> : `${o.dias}d`
}
const COLUNAS = {
  detalhe: [
    { k: 'crit',      label: 'Criticidade', get: o => ['normal', 'moderado', 'critico', 'extremo', 'judicial'].indexOf(o.criticidade), render: o => <Tag cor={CRITICIDADE_META[o.criticidade]?.tag || 'gray'}>{CRITICIDADE_META[o.criticidade]?.label || '—'}</Tag> },
    { k: 'nos',       label: 'O.S.',        get: o => o.nOS, render: (o, onOpenOS) => <LinkOS o={o} onOpenOS={onOpenOS} /> },
    { k: 'dias',      label: 'Dias',        get: o => o.dias ?? -1, num: true, render: o => o.dias ?? '—' },
    { k: 'grupo',     label: 'Grupo',       get: o => o.grupoLabel, render: o => <span className="badge badge-gray">{o.grupoLabel}</span> },
    { k: 'tipo',      label: 'Tipo O.S.',   get: o => o.tipoOS, render: o => o.tipoOS },
    { k: 'cliente',   label: 'Cliente',     get: o => o.cliente, render: o => tituloCaso(o.cliente) },
    { k: 'placa',     label: 'Placa',       get: o => o.placa, render: o => o.placa },
    { k: 'consultor', label: 'Consultor',   get: o => o.consultor, render: o => tituloCaso(o.consultor) },
    { k: 'situacao',  label: 'Situação',    get: o => o.situacao, render: o => o.situacao },
    { k: 'solic',     label: 'Solicitação', get: o => o.solicitacao, render: o => <span title={o.solicitacao} style={{ display: 'inline-block', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom', color: 'var(--text2)' }}>{o.solicitacao || '—'}</span> },
  ],
  valores: [
    { k: 'nos',       label: 'Nº O.S.',   get: o => o.nOS, render: (o, onOpenOS) => <LinkOS o={o} onOpenOS={onOpenOS} /> },
    { k: 'loja',      label: 'Loja',      get: o => o.empresa, render: o => <span className="badge badge-blue">{o.empresa}</span> },
    { k: 'consultor', label: 'Consultor', get: o => o.consultor, render: o => tituloCaso(o.consultor) },
    { k: 'situacao',  label: 'Situação',  get: o => o.situacao, render: o => tituloCaso(o.situacao) },
    { k: 'dias',      label: 'Dias',      get: o => o.dias ?? -1, num: true, render: o => <DiasTag o={o} /> },
    { k: 'grupo',     label: 'Grupo',     get: o => o.grupoLabel, render: o => o.grupoLabel },
    { k: 'cliente',   label: 'Cliente',   get: o => o.cliente, render: o => tituloCaso(o.cliente) },
    { k: 'placa',     label: 'Placa',     get: o => o.placa, render: o => o.placa },
    { k: 'servico',   label: 'Serviço',   get: o => o.servico, num: true, render: o => fmtBRL(o.servico) },
    { k: 'pecas',     label: 'Peças',     get: o => o.mercadoria, num: true, render: o => fmtBRL(o.mercadoria) },
    { k: 'valor',     label: 'Total',     get: o => o.valorTotal, num: true, render: o => fmtBRL(o.valorTotal) },
  ],
}

/** Tabela única de O.S. — página e modais. Nº (ou +) abre o detalhe.
 *  `porPagina` > 0 liga a paginação ("Exibindo 1–50 de N"). */
export function TabelaOS({ rows, onOpenOS, maxHeight = 620, modo = 'valores', porPagina = 0 }) {
  const cols = COLUNAS[modo]
  const { sorted, sort, toggle } = useSorter(rows, Object.fromEntries(cols.map(c => [c.k, c.get])), { col: 'dias', dir: 'desc' })
  const [pagina, setPagina] = useState(0)
  const paginas = porPagina > 0 ? Math.max(1, Math.ceil(sorted.length / porPagina)) : 1
  const pag = Math.min(pagina, paginas - 1)
  const visiveis = porPagina > 0 ? sorted.slice(pag * porPagina, (pag + 1) * porPagina) : sorted

  return (
    <>
      <div className="table-wrap" style={{ maxHeight, overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {cols.map(c => <Th key={c.k} col={c.k} label={c.label} sort={sort} toggle={toggle} num={c.num} />)}
              {modo === 'detalhe' && <th />}
            </tr>
          </thead>
          <tbody>
            {visiveis.map(o => (
              <TrHover key={o.osId}>
                {cols.map(c => <Td key={c.k} num={c.num}>{c.render(o, onOpenOS)}</Td>)}
                {modo === 'detalhe' && <Td><button className="btn btn-ghost btn-xs" title="Ver detalhes da O.S." onClick={() => onOpenOS?.(o)}>+</button></Td>}
              </TrHover>
            ))}
          </tbody>
        </table>
      </div>
      {porPagina > 0 && sorted.length > porPagina && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px 0', fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>
          <span>Exibindo {fmtNum(pag * porPagina + 1)}–{fmtNum(Math.min((pag + 1) * porPagina, sorted.length))} de {fmtNum(sorted.length)}</span>
          <span style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <button className="btn btn-ghost btn-sm" disabled={pag === 0} onClick={() => setPagina(pag - 1)}>Anterior</button>
            <button className="btn btn-ghost btn-sm" disabled={pag >= paginas - 1} onClick={() => setPagina(pag + 1)}>Próxima</button>
          </span>
        </div>
      )}
    </>
  )
}

/**
 * Modal de lista de O.S. (drill-down) — serve para KPI, composição financeira,
 * loja e grupo. Mostra totais, chips por loja com participação (clicáveis para
 * recortar) e a tabela. `campo` (servico|mercadoria|valorTotal) = composição.
 */
export function ModalListaOS({ titulo, info, rows, campo, onClose, onOpenOS }) {
  const [lojasSel, setLojasSel] = useState([])
  const meta  = campo ? CAMPO_META[campo] : null
  const chave = campo || 'valorTotal'

  const base = useMemo(() => {
    const r = campo ? rows.filter(o => Math.abs(o[campo] || 0) > 0) : rows
    return campo ? [...r].sort((a, b) => (b[campo] || 0) - (a[campo] || 0)) : r
  }, [rows, campo])

  const porLoja = useMemo(() => {
    const m = new Map()
    base.forEach(o => { const l = o.empresa || 'SEM LOJA'; m.set(l, (m.get(l) || 0) + (o[chave] || 0)) })
    const total = [...m.values()].reduce((s, v) => s + v, 0)
    return [...m.entries()].map(([loja, valor]) => ({ loja, valor, pct: total > 0 ? valor / total : 0 })).sort((a, b) => b.valor - a.valor)
  }, [base, chave])

  const lista = lojasSel.length ? base.filter(o => lojasSel.includes(o.empresa || 'SEM LOJA')) : base
  const soma  = k => lista.reduce((s, o) => s + (o[k] || 0), 0)
  // Chips liga/desliga (SeletorMultiplo do DS): rótulo "LOJA R$ x · y%" ↔ loja.
  const rotuloLoja = l => `${l.loja}  ${fmtBRL(l.valor)} · ${fmtPct(l.pct, 1)}`

  return (
    <Modal onClose={onClose} maxWidth={1180} title={
      <div>
        <div>{titulo}</div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', color: 'var(--text2)', marginTop: 2 }}>
          Serviço {fmtBRL(soma('servico'))} · Peças {fmtBRL(soma('mercadoria'))} · Total {fmtBRL(soma('valorTotal'))}{info ? ` — ${info}` : ''}
        </div>
      </div>
    }>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: 'var(--space-sm)' }}>
        <span style={{ fontSize: 'var(--text-base)', color: 'var(--text2)' }}>{fmtNum(lista.length)} O.S.{meta ? ` com ${meta.sufixo}` : ''}</span>
        <strong style={{ fontSize: 'var(--text-md)' }}>{fmtBRL(soma(chave))}</strong>
      </div>

      {porLoja.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase' }}>{meta ? meta.label : 'Total'} por loja</span>
          <SeletorMultiplo
            options={porLoja.map(rotuloLoja)}
            value={porLoja.filter(l => lojasSel.includes(l.loja)).map(rotuloLoja)}
            onChange={labels => setLojasSel(porLoja.filter(l => labels.includes(rotuloLoja(l))).map(l => l.loja))}
          />
          {lojasSel.length > 0 && <button className="btn btn-ghost btn-xs" onClick={() => setLojasSel([])}>✕ todas</button>}
        </div>
      )}

      <TabelaOS rows={lista} onOpenOS={onOpenOS} maxHeight="55vh" />
    </Modal>
  )
}

/** Detalhes de uma O.S. */
export function ModalDetalheOS({ os, onClose }) {
  const crit = CRITICIDADE_META[os.criticidade]
  const data = os.emissao instanceof Date && !isNaN(os.emissao) ? os.emissao.toLocaleDateString('pt-BR') : '—'
  const itens = [
    ['Empresa', os.empresa], ['Dias em aberto', os.dias ?? '—'], ['Grupo / Tipo de O.S.', [os.grupoLabel, os.tipoOS].filter(Boolean).join(' · ') || '—'],
    ['Situação', tituloCaso(os.situacao) || '—'], ['Cliente', tituloCaso(os.cliente) || '—'], ['Placa', os.placa || '—'],
    ['Modelo', os.modelo || '—'], ['Cor', os.cor || '—'], ['Data de abertura', data],
    ['Consultor', tituloCaso(os.consultor) || '—'], ['Técnico', tituloCaso(os.tecnico) || '—'], ['Serviço aplicação', os.aplicacao || '—'],
    ['Valor serviço', fmtBRL(os.servico)], ['Valor peças', fmtBRL(os.mercadoria)], ['Valor total', fmtBRL(os.valorTotal)],
  ]

  return (
    <Modal onClose={onClose} maxWidth={760} title={
      <div>
        <div>O.S. {os.nOS}</div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', color: 'var(--text2)', marginTop: 2 }}>
          {os.empresa} · {crit?.label || '—'} · {os.dias ?? '—'} dias
        </div>
      </div>
    }>
      {os.prioridade && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', background: 'var(--bg3)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase' }}>Prioridade</span>
          <strong style={{ fontSize: 'var(--text-md)' }}>{os.prioridade.score}</strong>
          <Tag cor={os.prioridade.nivelTag}>{os.prioridade.nivelLabel}</Tag>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text3)' }}>{os.prioridade.motivos.join(' · ')}</span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-sm)' }}>
        {itens.map(([k, v]) => (
          <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase' }}>{k}</div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--text)', marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
      {os.solicitacao && (
        <div style={{ marginTop: 'var(--space-md)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--text3)', textTransform: 'uppercase' }}>Solicitação do cliente</div>
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--text2)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{os.solicitacao}</div>
        </div>
      )}
    </Modal>
  )
}

