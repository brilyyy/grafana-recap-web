import * as React from 'react'

import { cn } from '@/lib/utils'

interface AnimatedBackgroundProps {
  variant?: 'subtle' | 'prominent'
  className?: string
}

export function AnimatedBackground({ variant = 'subtle', className }: AnimatedBackgroundProps) {
  const gridOpacity = variant === 'prominent' ? 1 : 0.55
  const particleOpacity = variant === 'prominent' ? 1 : 0.65

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      {/* dotted grid with radial fade */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--grid-dot) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%)',
          opacity: gridOpacity,
        }}
      />

      {/* lavender orb — top-left */}
      <div
        className="bg-particle bg-particle-1"
        style={{
          background: 'var(--particle-lavender)',
          width: '42%',
          height: '42%',
          top: '4%',
          left: '8%',
          opacity: particleOpacity,
        }}
      />

      {/* mint orb — bottom-right */}
      <div
        className="bg-particle bg-particle-2"
        style={{
          background: 'var(--particle-mint)',
          width: '36%',
          height: '36%',
          bottom: '8%',
          right: '12%',
          opacity: particleOpacity * 0.85,
        }}
      />

      {/* sky orb — mid-right */}
      <div
        className="bg-particle bg-particle-3"
        style={{
          background: 'var(--particle-sky)',
          width: '30%',
          height: '30%',
          top: '32%',
          right: '4%',
          opacity: particleOpacity * 0.75,
        }}
      />

      {/* peach orb — mid-left lower */}
      <div
        className="bg-particle bg-particle-4"
        style={{
          background: 'var(--particle-peach)',
          width: '24%',
          height: '24%',
          bottom: '22%',
          left: '22%',
          opacity: particleOpacity * 0.7,
        }}
      />
    </div>
  )
}
