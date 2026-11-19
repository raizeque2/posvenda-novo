import { RainbowButton } from '../components/ui/rainbow-button'
import { useState, useCallback } from 'react'

export function useConfirm() {
  const [state, setState] = useState(null)

  const confirm = useCallback((msg) => new Promise(resolve => {
    setState({ msg, resolve })
  }), [])

  const handle = (result) => {
    state?.resolve(result)
    setState(null)
  }

  const modal = state ? (
    <div onClick={() => handle(false)} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '24px 28px', maxWidth: 400, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 'var(--text-md2)', color: 'var(--text)', marginBottom: 20, lineHeight: 1.5 }}>
          {state.msg}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => handle(false)}>Cancelar</button>
          <RainbowButton className="btn btn-sm"
            onClick={() => handle(true)}>Confirmar</RainbowButton>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, modal }
}
