import * as React from 'react'
import { cn } from '@/lib/utils'

interface AnimatedBackgroundProps {
  variant?: 'subtle' | 'prominent'
  className?: string
}

interface StarData {
  x: number
  y: number
  size: number
  delay: number
  duration: number
}

function generateStars(count: number): StarData[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.8 + 0.4,
    delay: Math.random() * 8,
    duration: Math.random() * 4 + 3,
  }))
}

export function AnimatedBackground({ variant = 'subtle', className }: AnimatedBackgroundProps) {
  const farRef = React.useRef<HTMLDivElement>(null)
  const midRef = React.useRef<HTMLDivElement>(null)
  const nearRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)

  const [farCount, midCount, nearCount] = variant === 'prominent' ? [70, 40, 18] : [40, 24, 10]

  const farStars = React.useMemo(() => generateStars(farCount), [farCount])
  const midStars = React.useMemo(() => generateStars(midCount), [midCount])
  const nearStars = React.useMemo(() => generateStars(nearCount), [nearCount])

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Mouse parallax — write transforms directly via refs, no re-render per frame
  React.useEffect(() => {
    if (!mounted) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    let rafId = 0
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let running = true

    const onMove = (e: PointerEvent) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      targetX = (e.clientX - cx) / cx
      targetY = (e.clientY - cy) / cy
    }

    const tick = () => {
      if (!running) return
      // smooth lerp
      currentX += (targetX - currentX) * 0.06
      currentY += (targetY - currentY) * 0.06

      if (farRef.current) {
        farRef.current.style.transform = `translate3d(${currentX * 5}px, ${currentY * 5}px, 0)`
      }
      if (midRef.current) {
        midRef.current.style.transform = `translate3d(${currentX * 12}px, ${currentY * 12}px, 0)`
      }
      if (nearRef.current) {
        nearRef.current.style.transform = `translate3d(${currentX * 22}px, ${currentY * 22}px, 0)`
      }

      rafId = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    rafId = requestAnimationFrame(tick)

    return () => {
      running = false
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(rafId)
    }
  }, [mounted])

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      {/* Nebula glows — large radial blurs for the "deep space" tint */}
      <div
        className="absolute -top-1/4 -left-1/4 h-3/4 w-3/4 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--nebula-1) 0%, transparent 70%)',
          filter: 'blur(48px)',
        }}
      />
      <div
        className="absolute -bottom-1/4 -right-1/4 h-2/3 w-2/3 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--nebula-2) 0%, transparent 70%)',
          filter: 'blur(48px)',
        }}
      />
      <div
        className="absolute top-1/3 right-1/3 h-1/2 w-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--nebula-1) 0%, transparent 60%)',
          filter: 'blur(60px)',
          opacity: 0.6,
        }}
      />

      {/* Stars — only after mount to avoid SSR hydration mismatch */}
      {mounted && (
        <>
          {/* Far layer — dim, tiny, subtle parallax */}
          <div ref={farRef} className="absolute inset-0 will-change-transform">
            {farStars.map((star, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: memoized star data, index is stable
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size * 0.7}px`,
                  height: `${star.size * 0.7}px`,
                  background: 'var(--star-dim)',
                  animation: `star-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
                }}
              />
            ))}
          </div>

          {/* Mid layer — medium brightness */}
          <div ref={midRef} className="absolute inset-0 will-change-transform">
            {midStars.map((star, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: memoized star data, index is stable
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  background: 'var(--star-mid)',
                  animation: `star-twinkle ${star.duration + 1.5}s ease-in-out ${star.delay + 1}s infinite`,
                }}
              />
            ))}
          </div>

          {/* Near layer — bright, largest, strongest parallax */}
          <div ref={nearRef} className="absolute inset-0 will-change-transform">
            {nearStars.map((star, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: memoized star data, index is stable
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size * 1.6 + 0.4}px`,
                  height: `${star.size * 1.6 + 0.4}px`,
                  background: 'var(--star-bright)',
                  boxShadow: `0 0 ${star.size * 3}px 0.5px var(--star-mid)`,
                  animation: `star-twinkle ${star.duration + 2}s ease-in-out ${star.delay * 0.7}s infinite`,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
