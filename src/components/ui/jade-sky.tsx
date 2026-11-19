import './jade-sky.css'

type GradientBackgroundProps = { className?: string }

export function GradientBackground({ className = '' }: GradientBackgroundProps) {
  return <div aria-hidden="true" className={`jade-sky ${className}`}><div/></div>
}
