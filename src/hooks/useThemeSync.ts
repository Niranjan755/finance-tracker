import { useEffect } from 'react'
import { applyTheme, storeThemePreference } from '@/lib/theme'
import { useFinanceStore } from '@/store/financeStore'

export function useThemeSync(): void {
  const theme = useFinanceStore((s) => s.settings.theme)
  const status = useFinanceStore((s) => s.status)

  useEffect(() => {
    if (status !== 'ready') return
    applyTheme(theme)
    storeThemePreference(theme)
  }, [theme, status])

  useEffect(() => {
    if (theme !== 'system') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyTheme('system')
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [theme])
}
