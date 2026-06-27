import type * as React from 'react'

import { AnimatedBackground } from '@/components/animated-background'
import { useBackgroundMode } from '@/hooks/use-background-mode'
import { cn } from '@/lib/utils'

interface AuthLayoutProps {
  children: React.ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  const { bgMode } = useBackgroundMode()

  return (
    <div className={cn('relative grid min-h-svh place-items-center overflow-hidden p-6', className)}>
      {bgMode === 'animated' && <AnimatedBackground variant="prominent" />}
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">{children}</div>
    </div>
  )
}
