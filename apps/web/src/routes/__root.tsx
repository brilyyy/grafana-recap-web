import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { BackgroundModeProvider } from '@/hooks/use-background-mode'
import { queryClient, trpc, trpcClient } from '@/router'
import '@/styles/app.css'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Setup Data Success Rate Grafana' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="system">
            <BackgroundModeProvider>
              <TooltipProvider>
                <Outlet />
                <Toaster richColors position="bottom-right" />
              </TooltipProvider>
            </BackgroundModeProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
