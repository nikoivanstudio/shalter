"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type Theme = "light" | "dark" | "system"
type ResolvedTheme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
const STORAGE_KEY = "theme"

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light"
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyThemeClass(theme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "system"
    }

    const storedTheme = localStorage.getItem(STORAGE_KEY)
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      return storedTheme
    }

    return "system"
  })
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light")

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const syncTheme = () => {
      const nextResolved = theme === "system" ? getSystemTheme() : theme
      setResolvedTheme(nextResolved)
      applyThemeClass(nextResolved)
    }

    syncTheme()

    const onChange = () => {
      if (theme === "system") {
        syncTheme()
      }
    }

    mediaQuery.addEventListener("change", onChange)
    return () => {
      mediaQuery.removeEventListener("change", onChange)
    }
  }, [theme])

  const setTheme = (nextTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, nextTheme)
    setThemeState(nextTheme)
  }

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
