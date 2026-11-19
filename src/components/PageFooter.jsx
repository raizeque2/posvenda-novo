export default function PageFooter({ total, totalLabel = 'registros', extra }) {
  const agora = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="page-footer">
      <div className="page-footer-left">
        {total != null && (
          <span><strong style={{ color: 'var(--text2)' }}>{total}</strong> {totalLabel}</span>
        )}
        {extra && <><span className="page-footer-dot">·</span>{extra}</>}
      </div>
      <div className="page-footer-right">
        <span>Atualizado {agora}</span>
      </div>
    </div>
  )
}
