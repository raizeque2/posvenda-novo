const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : 'Sem data registrada'
const time = value => { const date = new Date(value); return !value || Number.isNaN(+date) ? 'não informado' : date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) }

export default function AnalysisSources({ provenance, query, onInspect }) {
  if (!provenance) return null
  return <details className="chat-analysis-sources"><summary>Fontes e recorte desta resposta</summary>
    <dl><div><dt>Período</dt><dd>{provenance.periods.join(' × ')}</dd></div><div><dt>Filtros</dt><dd>{provenance.scope}</dd></div><div><dt>Último registro</dt><dd>{day(provenance.lastRecordDate)}</dd></div><div><dt>Consulta</dt><dd>{time(provenance.generatedAt)}</dd></div></dl>
    <ul>{provenance.sources.map((source, index) => <li key={`${source.month}:${source.kind}:${index}`}><strong>{source.kind} · {source.month}</strong><span>{source.records} registro(s) no recorte · carga: {time(source.updatedAt)}</span></li>)}</ul>
    {provenance.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
    {onInspect && query && <button type="button" onClick={() => onInspect(query)}>Consultar {query.months.at(-1)} na base atual do BI ↗</button>}
  </details>
}
