import { cn } from '@/lib/utils'

interface DashboardBackgroundProps {
  className?: string
}

export function DashboardBackground({ className }: DashboardBackgroundProps) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      {/* lavender blob — top-left */}
      <div
        className="mesh-blob mesh-blob-1"
        style={{
          background: 'var(--particle-lavender)',
          width: '50%',
          height: '50%',
          top: '-5%',
          left: '-5%',
        }}
      />

      {/* mint blob — center-right */}
      <div
        className="mesh-blob mesh-blob-2"
        style={{
          background: 'var(--particle-mint)',
          width: '40%',
          height: '40%',
          top: '25%',
          right: '-8%',
        }}
      />

      {/* sky blob — bottom-left */}
      <div
        className="mesh-blob mesh-blob-3"
        style={{
          background: 'var(--particle-sky)',
          width: '35%',
          height: '35%',
          bottom: '-5%',
          left: '15%',
        }}
      />

      {/* peach blob — top-right */}
      <div
        className="mesh-blob mesh-blob-4"
        style={{
          background: 'var(--particle-peach)',
          width: '28%',
          height: '28%',
          top: '10%',
          right: '20%',
        }}
      />
    </div>
  )
}
