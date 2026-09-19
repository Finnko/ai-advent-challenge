import { useEffect, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/Button'

type ThemeMode = 'light' | 'dark' | 'auto'

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'auto',
  auto: 'light',
}

const MODE_LABELS: Record<ThemeMode, string> = {
  auto: 'System',
  dark: 'Dark',
  light: 'Light',
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'auto'
  }
  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored
  }
  return 'auto'
}

function getServerMode(): ThemeMode {
  return 'auto'
}

function autoTheme(prefersDark: boolean): ThemeMode {
  return prefersDark ? 'dark' : 'light'
}

function applyThemeMode(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = mode === 'auto' ? autoTheme(prefersDark) : mode

  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(resolved)

  if (mode === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', mode)
  }

  document.documentElement.style.colorScheme = resolved
}

function setStoredMode(mode: ThemeMode) {
  window.localStorage.setItem('theme', mode)
  applyThemeMode(mode)
  for (const listener of listeners) {
    listener()
  }
}

export default function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, readStoredMode, getServerMode)

  useEffect(() => {
    if (mode !== 'auto') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeMode('auto')

    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [mode])

  function toggleMode() {
    setStoredMode(NEXT_MODE[mode])
  }

  const modeName = mode === 'auto' ? 'system' : mode

  const label =
    mode === 'auto'
      ? 'Theme mode: system. Click to switch to light mode.'
      : `Theme mode: ${modeName}. Click to switch mode.`

  return (
    <Button
      variant="secondary"
      onClick={toggleMode}
      aria-label={label}
      title={label}
      className="rounded-full px-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
    >
      {MODE_LABELS[mode]}
    </Button>
  )
}
