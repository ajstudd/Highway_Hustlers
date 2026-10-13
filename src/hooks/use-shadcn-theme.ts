import * as React from "react"
import { Color } from "three"

export type ShadcnThemeColors = {
  primaryColor: Color
  primaryForegroundColor: Color
  bgColor: Color
  foregroundColor: Color
  borderColor: Color
  mutedColor: Color
  accentColor: Color
  isDark: boolean
}

const CSS_VARS = {
  primaryColor: "--primary-hex",
  primaryForegroundColor: "--primary-foreground-hex",
  bgColor: "--bg-hex",
  foregroundColor: "--fg-hex",
  borderColor: "--border-hex",
  mutedColor: "--muted-hex",
  accentColor: "--accent-hex",
} as const

function createDefaults(): ShadcnThemeColors {
  return {
    primaryColor: new Color("#ff5a1f"),
    primaryForegroundColor: new Color("#090b0e"),
    bgColor: new Color("#080a0c"),
    foregroundColor: new Color("#e4e8ec"),
    borderColor: new Color("#1d232a"),
    mutedColor: new Color("#6e7882"),
    accentColor: new Color("#ff8a4c"),
    isDark: true,
  }
}

function parseHexOrFallback(raw: string, fallback: Color): Color {
  const val = raw.trim()
  if (!val) return fallback
  try {
    return new Color(val)
  } catch {
    return fallback
  }
}

function readColors(previous?: ShadcnThemeColors): ShadcnThemeColors {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return previous ?? createDefaults()
  }
  const root = document.documentElement
  const styles = getComputedStyle(root)
  const base = previous ?? createDefaults()

  return {
    primaryColor: parseHexOrFallback(
      styles.getPropertyValue(CSS_VARS.primaryColor),
      base.primaryColor.clone()
    ),
    primaryForegroundColor: parseHexOrFallback(
      styles.getPropertyValue(CSS_VARS.primaryForegroundColor),
      base.primaryForegroundColor.clone()
    ),
    bgColor: parseHexOrFallback(
      styles.getPropertyValue(CSS_VARS.bgColor),
      base.bgColor.clone()
    ),
    foregroundColor: parseHexOrFallback(
      styles.getPropertyValue(CSS_VARS.foregroundColor),
      base.foregroundColor.clone()
    ),
    borderColor: parseHexOrFallback(
      styles.getPropertyValue(CSS_VARS.borderColor),
      base.borderColor.clone()
    ),
    mutedColor: parseHexOrFallback(
      styles.getPropertyValue(CSS_VARS.mutedColor),
      base.mutedColor.clone()
    ),
    accentColor: parseHexOrFallback(
      styles.getPropertyValue(CSS_VARS.accentColor),
      base.accentColor.clone()
    ),
    isDark: true,
  }
}

export type ThemeMode = "auto" | "light" | "dark"

export function useShadcnTheme(mode: ThemeMode = "auto"): ShadcnThemeColors {
  const [colors, setColors] = React.useState<ShadcnThemeColors>(() =>
    createDefaults()
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return
    setColors((prev) => readColors(prev))

    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setColors((prev) => readColors(prev))
    })
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class", "style", "data-bike-theme"],
    })
    return () => observer.disconnect()
  }, [mode])

  return colors
}
