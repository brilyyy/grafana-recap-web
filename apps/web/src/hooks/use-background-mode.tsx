import * as React from 'react'

export type BgMode = 'animated' | 'solid'

const BG_MODE_KEY = 'bg-mode'
const DEFAULT_BG_MODE: BgMode = 'animated'

interface BackgroundModeContextValue {
  bgMode: BgMode
  setBgMode: (mode: BgMode) => void
}

const BackgroundModeContext = React.createContext<BackgroundModeContextValue | null>(null)

export function BackgroundModeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)
  const [bgMode, setBgModeState] = React.useState<BgMode>(DEFAULT_BG_MODE)

  React.useEffect(() => {
    const stored = localStorage.getItem(BG_MODE_KEY) as BgMode | null
    if (stored === 'animated' || stored === 'solid') {
      setBgModeState(stored)
    }
    setMounted(true)
  }, [])

  const setBgMode = React.useCallback((mode: BgMode) => {
    setBgModeState(mode)
    localStorage.setItem(BG_MODE_KEY, mode)
  }, [])

  return (
    <BackgroundModeContext.Provider value={{ bgMode: mounted ? bgMode : DEFAULT_BG_MODE, setBgMode }}>
      {children}
    </BackgroundModeContext.Provider>
  )
}

export function useBackgroundMode(): BackgroundModeContextValue {
  const ctx = React.useContext(BackgroundModeContext)
  if (!ctx) {
    throw new Error('useBackgroundMode must be used within BackgroundModeProvider')
  }
  return ctx
}
