import { CssBaseline, ThemeProvider } from '@mui/material'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { buildTheme } from '../theme'

const STORAGE_KEY = 'project-registration-theme'

function readPreferredMode() {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const ThemeModeContext = createContext({ mode: 'light', toggleMode: () => {} })

export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(readPreferredMode)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggleMode = useCallback(() => {
    setMode((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  const theme = useMemo(() => buildTheme(mode), [mode])
  const value = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode])

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode() {
  return useContext(ThemeModeContext)
}
