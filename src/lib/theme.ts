import type { ThemePreference } from '@/types'

const STORAGE_KEY = 'finance-tracker-theme'

export function getStoredThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export function storeThemePreference(pref: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, pref)
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark')
}
