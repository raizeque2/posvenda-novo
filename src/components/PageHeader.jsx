import { useNavigate } from 'react-router-dom'

export default function PageHeader({ title, sub, action, backTo, icon }) {
  const navigate = useNavigate()

  return (
    <div className="page-header">
      {backTo && (
        <button
          onClick={() => navigate(backTo)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', fontSize: 'var(--text-sm2)', fontFamily: 'var(--font)',
            fontWeight: 'var(--weight-medium)', marginBottom: 8, padding: 0,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--honda)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}
        >
          ← Voltar
        </button>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && (
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--honda-bg)',
              color: 'var(--honda)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-xl)', flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <div>
            <h1 className="page-title">{title}</h1>
            {sub && <div className="page-sub">{sub}</div>}
          </div>
        </div>
        {action && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{action}</div>}
      </div>
    </div>
  )
}
