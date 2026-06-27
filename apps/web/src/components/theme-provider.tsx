import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'system' | 'latte' | 'frappe' | 'macchiato' | 'mocha' | 'kanagawa' | 'gruvbox' | 'github-dark' | 'github-light'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ALL_THEMES = ['latte', 'frappe', 'macchiato', 'mocha', 'kanagawa', 'gruvbox', 'github-dark', 'github-light'] as const
const DARK_THEMES = ['frappe', 'macchiato', 'mocha', 'kanagawa', 'gruvbox', 'github-dark'] as const

function getResolved(theme: Theme): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return (DARK_THEMES as readonly string[]).includes(theme) ? 'dark' : 'light'
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  resolvedTheme: 'dark',
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme
  })

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove(...ALL_THEMES)

    const resolved = theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'mocha' : 'latte')
      : theme

    root.classList.add(resolved)
  }, [theme])

  const value: ThemeProviderState = {
    theme,
    resolvedTheme: getResolved(theme),
    setTheme: (theme: Theme) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, theme)
      }
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
