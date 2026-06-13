import * as React from 'react'

import { AnimatedBackground } from '@/components/animated-background'
import { cn } from '@/lib/utils'

interface AuthLayoutProps {
  children: React.ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn('relative grid min-h-svh place-items-center overflow-hidden p-6', className)}>
      <AnimatedBackground variant="prominent" />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6">{children}</div>
    </div>
  )
}
