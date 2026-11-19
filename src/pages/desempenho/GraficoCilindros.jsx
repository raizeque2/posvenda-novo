import { useId } from 'react'
import { fmtBRL } from '../../utils/formatacao.js'

/**
 * Cilindros 3D: o cilindro claro é a meta do dia/semana; o preenchimento é o
 * realizado. Acima da meta o cilindro cresce até o realizado. A barra do
 * período atual fica destacada. Dias futuros mostram só a meta.
 */
export default function GraficoCilindros({ barras, altura = 210 }) {
  const id = useId().replace(/:/g, '')
  const maior = Math.max(1, ...barras.map(b => Math.max(b.meta || 0, b.real || 0)))
  const n = barras.length
  const largura = 100 / n
  const elipse = 7 // altura da elipse (perspectiva)
  const topo = 14, base = altura - 26
  const util = base - topo
  const y = v => base - (v / maior) * util

  return (
    <figure className="cil" aria-label="Realizado comparado à meta">
      <svg viewBox={`0 0 ${n * 60} ${altura}`} className="cil-svg" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{barras.map(b => `${b.titulo || b.rotulo}: realizado ${b.real === null ? 'sem dados ainda' : fmtBRL(b.real)}, meta ${fmtBRL(b.meta)}`).join('; ')}</title>
        <defs>
          <linearGradient id={`${id}-trilho`} x1="0" x2="1"><stop offset="0" style={{ stopColor: 'var(--cil-trilho-a)' }} /><stop offset=".55" style={{ stopColor: 'var(--cil-trilho-b)' }} /><stop offset="1" style={{ stopColor: 'var(--cil-trilho-a)' }} /></linearGradient>
          <linearGradient id={`${id}-cheio`} x1="0" x2="1"><stop offset="0" style={{ stopColor: 'var(--cil-cheio-a)' }} /><stop offset=".55" style={{ stopColor: 'var(--cil-cheio-b)' }} /><stop offset="1" style={{ stopColor: 'var(--cil-cheio-a)' }} /></linearGradient>
          <linearGradient id={`${id}-atual`} x1="0" x2="1"><stop offset="0" style={{ stopColor: 'var(--cil-atual-a)' }} /><stop offset=".55" style={{ stopColor: 'var(--cil-atual-b)' }} /><stop offset="1" style={{ stopColor: 'var(--cil-atual-a)' }} /></linearGradient>
        </defs>
        {barras.map((b, i) => {
          const cx = i * 60 + 30, rx = 17
          const topoTrilho = y(Math.max(b.meta || 0, b.real || 0, maior * 0.04))
          const real = b.real ?? 0
          const topoCheio = y(real)
          const grad = b.atual ? `${id}-atual` : `${id}-cheio`
          return (
            <g key={i} className={b.atual ? 'is-atual' : undefined}>
              {/* trilho (meta) */}
              <rect x={cx - rx} y={topoTrilho} width={rx * 2} height={base - topoTrilho} fill={`url(#${id}-trilho)`} />
              <ellipse cx={cx} cy={base} rx={rx} ry={elipse} fill={`url(#${id}-trilho)`} />
              <ellipse cx={cx} cy={topoTrilho} rx={rx} ry={elipse} className="cil-tampa-trilho" />
              {/* realizado */}
              {real > 0 && <>
                <rect x={cx - rx} y={topoCheio} width={rx * 2} height={base - topoCheio} fill={`url(#${grad})`} className="cil-cheio" style={{ animationDelay: `${i * 50}ms` }} />
                <ellipse cx={cx} cy={base} rx={rx} ry={elipse} fill={`url(#${grad})`} />
                <ellipse cx={cx} cy={topoCheio} rx={rx} ry={elipse} className={b.atual ? 'cil-tampa-atual' : 'cil-tampa-cheio'} />
              </>}
              {/* marca da meta quando o realizado passou dela */}
              {real > (b.meta || 0) && b.meta > 0 && <ellipse cx={cx} cy={y(b.meta)} rx={rx} ry={elipse} className="cil-marca-meta" />}
            </g>
          )
        })}
      </svg>
      <div className="cil-rotulos" style={{ '--n': n }} aria-hidden="true">
        {barras.map((b, i) => <span key={i} className={b.atual ? 'is-atual' : undefined} title={b.titulo}>{b.rotulo}</span>)}
      </div>
      <figcaption className="cil-legenda"><span className="cil-l-cheio" />Realizado<span className="cil-l-trilho" />Meta<span className="cil-l-atual" />{barras.some(b => /^S\d/.test(b.rotulo)) ? 'Semana atual' : 'Hoje'}</figcaption>
      <table className="sr-only">
        <caption>Realizado e meta por período</caption>
        <thead><tr><th>Período</th><th>Realizado</th><th>Meta</th></tr></thead>
        <tbody>{barras.map((b, i) => <tr key={i}><td>{b.titulo || b.rotulo}</td><td>{b.real === null ? '—' : fmtBRL(b.real)}</td><td>{fmtBRL(b.meta)}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
