export interface ThemeTokens {
  bg: string
  bgElevated: string
  bgMuted: string
  bgOverlay: string
  border: string
  borderStrong: string
  fgPrimary: string
  fgSecondary: string
  fgTertiary: string
  fgInverse: string
  primary: string
  primaryHover: string
  primaryActive: string
  success: string
  warning: string
  danger: string
  info: string
  shadow: string
  selection: string
  hover: string
  active: string
}

export interface ThemeBuildOptions {
  bg: string
  bgElevated: string
  border: string
  fgPrimary: string
  fgSecondary: string
  fgTertiary?: string
  primary: string
  primaryHover: string
  primaryActive: string
  success: string
  warning: string
  danger: string
  info: string
  selection?: string
  hover?: string
  active?: string
  dark: boolean
}

export interface HolidayInfo {
  key: string
  label: string
  date: string
}

interface RgbColor {
  r: number
  g: number
  b: number
}

const FALLBACK_COLOR = '#3b82f6'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function padHex(value: number) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')
}

export function normalizeHex(input: string) {
  const value = input.trim()
  if (!value) return FALLBACK_COLOR
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [, a, b, c] = value
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase()
  }
  return FALLBACK_COLOR
}

export function hexToRgb(input: string): RgbColor {
  const hex = normalizeHex(input).slice(1)
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  }
}

export function rgbToHex(rgb: RgbColor) {
  return `#${padHex(rgb.r)}${padHex(rgb.g)}${padHex(rgb.b)}`
}

export function mixColors(base: string, target: string, weight: number) {
  const a = hexToRgb(base)
  const b = hexToRgb(target)
  const ratio = clamp(weight, 0, 1)
  return rgbToHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio
  })
}

function rgbToHsl(input: RgbColor) {
  const r = input.r / 255
  const g = input.g / 255
  const b = input.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    switch (max) {
      case r:
        h = 60 * (((g - b) / delta) % 6)
        break
      case g:
        h = 60 * ((b - r) / delta + 2)
        break
      default:
        h = 60 * ((r - g) / delta + 4)
        break
    }
  }

  if (h < 0) h += 360
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): RgbColor {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 1)
  const light = clamp(l, 0, 1)
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1))
  const m = light - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) {
    r = c
    g = x
  } else if (hue < 120) {
    r = x
    g = c
  } else if (hue < 180) {
    g = c
    b = x
  } else if (hue < 240) {
    g = x
    b = c
  } else if (hue < 300) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255
  }
}

export function shiftHue(color: string, degrees: number, saturationDelta = 0, lightnessDelta = 0) {
  const hsl = rgbToHsl(hexToRgb(color))
  return rgbToHex(hslToRgb(hsl.h + degrees, hsl.s + saturationDelta, hsl.l + lightnessDelta))
}

export function getRelativeLuminance(color: string) {
  const { r, g, b } = hexToRgb(color)
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

export function isDarkColor(color: string) {
  return getRelativeLuminance(color) < 0.42
}

export function buildThemeTokens(options: ThemeBuildOptions): ThemeTokens {
  const fgTertiary = options.fgTertiary ?? mixColors(options.fgSecondary, options.bg, 0.18)
  const hover = options.hover ?? mixColors(options.bgElevated, options.primary, options.dark ? 0.14 : 0.06)
  const active = options.active ?? mixColors(options.bgElevated, options.primary, options.dark ? 0.24 : 0.11)
  const selection = options.selection ?? mixColors(options.bgElevated, options.primary, options.dark ? 0.28 : 0.12)

  return {
    bg: options.bg,
    bgElevated: options.bgElevated,
    bgMuted: mixColors(options.bg, options.bgElevated, 0.55),
    bgOverlay: options.dark ? mixColors(options.bgElevated, '#000000', 0.08) : mixColors(options.bgElevated, '#ffffff', 0.1),
    border: options.border,
    borderStrong: mixColors(options.border, options.fgPrimary, options.dark ? 0.22 : 0.12),
    fgPrimary: options.fgPrimary,
    fgSecondary: options.fgSecondary,
    fgTertiary,
    fgInverse: options.dark ? '#020617' : '#ffffff',
    primary: options.primary,
    primaryHover: options.primaryHover,
    primaryActive: options.primaryActive,
    success: options.success,
    warning: options.warning,
    danger: options.danger,
    info: options.info,
    shadow: options.dark ? '0 24px 60px rgba(2, 6, 23, 0.42)' : '0 24px 60px rgba(15, 23, 42, 0.12)',
    selection,
    hover,
    active
  }
}

export function applyTokensToDocument(tokens: ThemeTokens, dark: boolean, themeId: string) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.themeId = themeId

  root.style.setProperty('--tm-bg', tokens.bg)
  root.style.setProperty('--tm-bg-elevated', tokens.bgElevated)
  root.style.setProperty('--tm-bg-muted', tokens.bgMuted)
  root.style.setProperty('--tm-bg-overlay', tokens.bgOverlay)
  root.style.setProperty('--tm-border', tokens.border)
  root.style.setProperty('--tm-border-strong', tokens.borderStrong)
  root.style.setProperty('--tm-fg-primary', tokens.fgPrimary)
  root.style.setProperty('--tm-fg-secondary', tokens.fgSecondary)
  root.style.setProperty('--tm-fg-tertiary', tokens.fgTertiary)
  root.style.setProperty('--tm-fg-inverse', tokens.fgInverse)
  root.style.setProperty('--tm-primary', tokens.primary)
  root.style.setProperty('--tm-primary-hover', tokens.primaryHover)
  root.style.setProperty('--tm-primary-active', tokens.primaryActive)
  root.style.setProperty('--tm-success', tokens.success)
  root.style.setProperty('--tm-warning', tokens.warning)
  root.style.setProperty('--tm-danger', tokens.danger)
  root.style.setProperty('--tm-info', tokens.info)
  root.style.setProperty('--tm-shadow', tokens.shadow)
  root.style.setProperty('--tm-selection', tokens.selection)
  root.style.setProperty('--tm-hover', tokens.hover)
  root.style.setProperty('--tm-active', tokens.active)

  root.style.setProperty('--el-bg-color', tokens.bg)
  root.style.setProperty('--el-bg-color-page', tokens.bg)
  root.style.setProperty('--el-bg-color-overlay', tokens.bgElevated)
  root.style.setProperty('--el-fill-color-blank', tokens.bgElevated)
  root.style.setProperty('--el-fill-color-light', tokens.bgMuted)
  root.style.setProperty('--el-text-color-primary', tokens.fgPrimary)
  root.style.setProperty('--el-text-color-regular', tokens.fgSecondary)
  root.style.setProperty('--el-text-color-secondary', tokens.fgTertiary)
  root.style.setProperty('--el-border-color', tokens.border)
  root.style.setProperty('--el-border-color-light', tokens.border)
  root.style.setProperty('--el-border-color-lighter', mixColors(tokens.border, tokens.bgElevated, 0.45))
  root.style.setProperty('--el-color-primary', tokens.primary)
  root.style.setProperty('--el-color-success', tokens.success)
  root.style.setProperty('--el-color-warning', tokens.warning)
  root.style.setProperty('--el-color-danger', tokens.danger)
  root.style.setProperty('--el-color-info', tokens.info)
  root.style.setProperty('color-scheme', dark ? 'dark' : 'light')

  const themeMeta = document.querySelector('meta[name="theme-color"]')
  if (themeMeta instanceof HTMLMetaElement) {
    themeMeta.content = tokens.bgElevated
  }
}

export function parseTimeString(value: string) {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!matched) return 0
  const hours = Number.parseInt(matched[1], 10)
  const minutes = Number.parseInt(matched[2], 10)
  return clamp(hours, 0, 23) * 60 + clamp(minutes, 0, 59)
}

export function minutesToTimeString(totalMinutes: number) {
  const safe = ((totalMinutes % 1440) + 1440) % 1440
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function calculateSunTimes(date: Date, latitude: number, longitude: number) {
  try {
    let year = date.getFullYear()
    let month = date.getMonth() + 1
    const day = date.getDate()

    if (month <= 2) {
      year -= 1
      month += 12
    }

    const a = Math.floor(year / 100)
    const b = 2 - a + Math.floor(a / 4)
    const julianDay =
      Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) +
      day +
      b -
      1524.5

    const t = (julianDay - 2451545.0) / 36525.0
    const l = (280.46646 + 36000.76983 * t + 0.0003032 * t * t) % 360
    const m = (357.52911 + 35999.05029 * t - 0.0001537 * t * t) % 360
    const c =
      (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin((m * Math.PI) / 180) +
      (0.019993 - 0.000101 * t) * Math.sin((2 * m * Math.PI) / 180) +
      0.000289 * Math.sin((3 * m * Math.PI) / 180)
    const trueLongitude = l + c
    const obliquity = 23.439 - 0.0000004 * t
    const declination =
      (Math.asin(
        Math.sin((obliquity * Math.PI) / 180) * Math.sin((trueLongitude * Math.PI) / 180)
      ) *
        180) /
      Math.PI

    const acosInput =
      (Math.cos((90.833 * Math.PI) / 180) -
        Math.sin((latitude * Math.PI) / 180) * Math.sin((declination * Math.PI) / 180)) /
      (Math.cos((latitude * Math.PI) / 180) * Math.cos((declination * Math.PI) / 180))

    const clampedAcos = clamp(acosInput, -1, 1)
    const hourAngle = (Math.acos(clampedAcos) * 180) / Math.PI
    let sunrise = 12 - hourAngle / 15 - longitude / 15
    let sunset = 12 + hourAngle / 15 - longitude / 15

    if (sunrise < 0 || sunrise > 12) sunrise = 6
    if (sunset < 12 || sunset > 24) sunset = 18

    return {
      sunrise: minutesToTimeString(Math.round(sunrise * 60)),
      sunset: minutesToTimeString(Math.round(sunset * 60))
    }
  } catch {
    return { sunrise: '06:00', sunset: '18:00' }
  }
}

export const HOLIDAY_OPTIONS: HolidayInfo[] = [
  { key: 'new-year-2024', label: 'New Year 2024', date: '2024-01-01' },
  { key: 'spring-festival-2024', label: 'Spring Festival 2024', date: '2024-02-10' },
  { key: 'qingming-2024', label: 'Qingming 2024', date: '2024-04-04' },
  { key: 'labour-day-2024', label: 'Labour Day 2024', date: '2024-05-01' },
  { key: 'dragon-boat-2024', label: 'Dragon Boat 2024', date: '2024-06-10' },
  { key: 'mid-autumn-2024', label: 'Mid-Autumn 2024', date: '2024-09-15' },
  { key: 'national-day-2024', label: 'National Day 2024', date: '2024-10-01' },
  { key: 'new-year-2025', label: 'New Year 2025', date: '2025-01-01' },
  { key: 'spring-festival-2025', label: 'Spring Festival 2025', date: '2025-01-28' },
  { key: 'qingming-2025', label: 'Qingming 2025', date: '2025-04-04' },
  { key: 'labour-day-2025', label: 'Labour Day 2025', date: '2025-05-01' },
  { key: 'dragon-boat-2025', label: 'Dragon Boat 2025', date: '2025-05-31' },
  { key: 'national-day-2025', label: 'National Day 2025', date: '2025-10-01' },
  { key: 'mid-autumn-2025', label: 'Mid-Autumn 2025', date: '2025-10-06' },
  { key: 'new-year', label: 'New Year', date: '01-01' },
  { key: 'valentines', label: 'Valentine Day', date: '02-14' },
  { key: 'labour-day', label: 'Labour Day', date: '05-01' },
  { key: 'children-day', label: 'Children Day', date: '06-01' },
  { key: 'national-day', label: 'National Day', date: '10-01' },
  { key: 'halloween', label: 'Halloween', date: '10-31' },
  { key: 'christmas-eve', label: 'Christmas Eve', date: '12-24' },
  { key: 'christmas', label: 'Christmas', date: '12-25' },
  { key: 'new-year-eve', label: 'New Year Eve', date: '12-31' }
]

export function getHolidayInfo(date: Date): HolidayInfo | null {
  const exactDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const matchedExact = HOLIDAY_OPTIONS.find((item) => item.date === exactDate)
  if (matchedExact) return matchedExact

  const monthDay = exactDate.slice(5)
  return HOLIDAY_OPTIONS.find((item) => item.date === monthDay) ?? null
}

export function getUpcomingHolidays(fromDate: Date, limit = 6) {
  const fromStamp = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-${String(fromDate.getDate()).padStart(2, '0')}`

  const dated = HOLIDAY_OPTIONS
    .filter((item) => item.date.length === 10)
    .filter((item) => item.date >= fromStamp)
    .slice(0, limit)

  if (dated.length >= limit) return dated

  const recurring = HOLIDAY_OPTIONS.filter((item) => item.date.length === 5)
    .map((item) => ({
      ...item,
      date: `${fromDate.getFullYear()}-${item.date}`
    }))
    .filter((item) => item.date >= fromStamp)

  return [...dated, ...recurring].slice(0, limit)
}

export async function extractDominantColorFromFile(file: File) {
  const imageUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Unable to decode image'))
      img.src = imageUrl
    })

    const canvas = document.createElement('canvas')
    const width = Math.min(120, image.naturalWidth || image.width)
    const height = Math.max(1, Math.round((width / (image.naturalWidth || width)) * (image.naturalHeight || image.height)))
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Canvas is not available')
    }

    context.drawImage(image, 0, 0, width, height)
    const { data } = context.getImageData(0, 0, width, height)

    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()
    for (let index = 0; index < data.length; index += 16) {
      const alpha = data[index + 3]
      if (alpha < 180) continue

      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }

      bucket.count += 1
      bucket.r += r
      bucket.g += g
      bucket.b += b
      buckets.set(key, bucket)
    }

    const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0]
    if (!dominant) return FALLBACK_COLOR

    return rgbToHex({
      r: dominant.r / dominant.count,
      g: dominant.g / dominant.count,
      b: dominant.b / dominant.count
    })
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}
