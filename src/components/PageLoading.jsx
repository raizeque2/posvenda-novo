export default function PageLoading({ fullPage = false }) {
  return <section className={`page-loading${fullPage ? ' page-loading-full' : ''}`} role="status" aria-live="polite" aria-label="Carregando página">
    <span className="sr-only">Carregando página…</span>
    <div aria-hidden="true"><div className="skeleton skeleton-title"/><div className="skeleton skeleton-toolbar"/><div className="skeleton-cards">{[0, 1, 2].map(index => <div key={index} className="skeleton skeleton-card"/>)}</div><div className="skeleton skeleton-panel"/></div>
  </section>
}
