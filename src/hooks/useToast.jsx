import { useState, useCallback, useEffect, createContext, useContext } from 'react'

const ToastCtx = createContext(null)
let _globalToast = null
export const toast = { show: (msg, type, dur) => _globalToast?.(msg, type, dur) }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((msg, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  useEffect(() => { _globalToast = show; return () => { _globalToast = null } }, [show])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? 'var(--red)' : 'var(--green)',
            color: 'var(--bg2)', borderRadius: 'var(--radius-md)', padding: '10px 16px',
            fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            maxWidth: 360, animation: 'fadeInUp 0.2s ease',
          }}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
