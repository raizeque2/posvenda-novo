import { forwardRef, type ButtonHTMLAttributes } from 'react'
import './rainbow-button.css'

export interface RainbowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Seen notifications return to the ordinary sidebar appearance. */
  animated?: boolean
}

export const RainbowButton = forwardRef<HTMLButtonElement, RainbowButtonProps>(
  function RainbowButton({ children, className = '', animated = true, type = 'button', ...props }, ref) {
    return <button ref={ref} type={type} className={`rainbow-button${animated ? '' : ' rainbow-button-quiet'} ${className}`} {...props}>
      <span className="rainbow-button-content">{children}</span>
    </button>
  },
)
