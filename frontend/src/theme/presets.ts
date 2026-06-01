import { translate } from '@/i18n'
import { buildThemeTokens, type ThemeTokens } from './utils'

export type ThemeId =
  | 'light'
  | 'dark'
  | 'green'
  | 'business'
  | 'modern-blue'
  | 'violet'
  | 'warm-orange'
  | 'pink'
  | 'tech-cyan'
  | 'minimal-black'
  | 'arctic'
  | 'forest'
  | 'sunset'
  | 'morandi'
  | 'high-contrast'

export interface ThemePreset {
  id: ThemeId
  label: string
  description: string
  category: 'light' | 'dark' | 'seasonal' | 'focus'
  dark: boolean
  hero: string
  accent: string
  tokens: ThemeTokens
}

const THEME_LOCALE = 'zh-CN'

function tPreset(key: string) {
  return translate(key, THEME_LOCALE)
}

const presets: ThemePreset[] = [
  {
    id: 'light',
    label: tPreset('themePreset.light.label'),
    description: tPreset('themePreset.light.description'),
    category: 'light',
    dark: false,
    hero: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%)',
    accent: '#3b82f6',
    tokens: buildThemeTokens({
      bg: '#f1f5f9',
      bgElevated: '#ffffff',
      border: '#e2e8f0',
      fgPrimary: '#1e293b',
      fgSecondary: '#64748b',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primaryActive: '#1d4ed8',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      dark: false
    })
  },
  {
    id: 'green',
    label: tPreset('themePreset.green.label'),
    description: tPreset('themePreset.green.description'),
    category: 'focus',
    dark: false,
    hero: 'linear-gradient(135deg, #f5eddc 0%, #ddd0bc 100%)',
    accent: '#8b6914',
    tokens: buildThemeTokens({
      bg: '#e8dcc8',
      bgElevated: '#f5eddc',
      border: '#d8ccba',
      fgPrimary: '#4a3728',
      fgSecondary: '#6b5744',
      primary: '#8b6914',
      primaryHover: '#7a5c0f',
      primaryActive: '#69500a',
      success: '#6b8e5a',
      warning: '#c89030',
      danger: '#c0543c',
      info: '#7b8fa8',
      dark: false
    })
  },
  {
    id: 'dark',
    label: tPreset('themePreset.dark.label'),
    description: tPreset('themePreset.dark.description'),
    category: 'dark',
    dark: true,
    hero: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    accent: '#60a5fa',
    tokens: buildThemeTokens({
      bg: '#0f172a',
      bgElevated: '#1e293b',
      border: '#334155',
      fgPrimary: '#f1f5f9',
      fgSecondary: '#94a3b8',
      primary: '#60a5fa',
      primaryHover: '#3b82f6',
      primaryActive: '#2563eb',
      success: '#34d399',
      warning: '#fbbf24',
      danger: '#f87171',
      info: '#60a5fa',
      dark: true
    })
  },
  {
    id: 'arctic',
    label: tPreset('themePreset.arctic.label'),
    description: tPreset('themePreset.arctic.description'),
    category: 'light',
    dark: false,
    hero: 'linear-gradient(135deg, #f0f7ff 0%, #bdd0e7 100%)',
    accent: '#0284c7',
    tokens: buildThemeTokens({
      bg: '#e8f0fe',
      bgElevated: '#f0f7ff',
      border: '#c8d8e8',
      fgPrimary: '#1a365d',
      fgSecondary: '#2d5087',
      primary: '#0284c7',
      primaryHover: '#0369a1',
      primaryActive: '#075985',
      success: '#059669',
      warning: '#d97706',
      danger: '#dc2626',
      info: '#0284c7',
      dark: false
    })
  },
  {
    id: 'forest',
    label: tPreset('themePreset.forest.label'),
    description: tPreset('themePreset.forest.description'),
    category: 'focus',
    dark: false,
    hero: 'linear-gradient(135deg, #f1f8f2 0%, #b8d4ba 100%)',
    accent: '#2e7d32',
    tokens: buildThemeTokens({
      bg: '#e8f5e9',
      bgElevated: '#f1f8f2',
      border: '#c3dbc5',
      fgPrimary: '#1b3a1d',
      fgSecondary: '#3e6b42',
      primary: '#2e7d32',
      primaryHover: '#1b5e20',
      primaryActive: '#134b17',
      success: '#43a047',
      warning: '#f9a825',
      danger: '#e53935',
      info: '#1976d2',
      dark: false
    })
  },
  {
    id: 'violet',
    label: tPreset('themePreset.violet.label'),
    description: tPreset('themePreset.violet.description'),
    category: 'seasonal',
    dark: false,
    hero: 'linear-gradient(135deg, #f8f0ff 0%, #d0bbe5 100%)',
    accent: '#7c3aed',
    tokens: buildThemeTokens({
      bg: '#f0e8f5',
      bgElevated: '#f8f0ff',
      border: '#dcc8ec',
      fgPrimary: '#2d1b4e',
      fgSecondary: '#5b3e8a',
      primary: '#7c3aed',
      primaryHover: '#6d28d9',
      primaryActive: '#5b21b6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#8b5cf6',
      dark: false
    })
  },
  {
    id: 'business',
    label: tPreset('themePreset.business.label'),
    description: tPreset('themePreset.business.description'),
    category: 'light',
    dark: false,
    hero: 'linear-gradient(135deg, #f7f7f7 0%, #d0d8e0 100%)',
    accent: '#4a6fa5',
    tokens: buildThemeTokens({
      bg: '#ededed',
      bgElevated: '#f7f7f7',
      border: '#d4d4d4',
      fgPrimary: '#262626',
      fgSecondary: '#595959',
      primary: '#4a6fa5',
      primaryHover: '#3d5d8c',
      primaryActive: '#304b73',
      success: '#52c41a',
      warning: '#faad14',
      danger: '#ff4d4f',
      info: '#4a6fa5',
      dark: false
    })
  },
  {
    id: 'minimal-black',
    label: tPreset('themePreset.minimalBlack.label'),
    description: tPreset('themePreset.minimalBlack.description'),
    category: 'dark',
    dark: true,
    hero: 'linear-gradient(135deg, #1a1a1a 0%, #121212 100%)',
    accent: '#6cb6ff',
    tokens: buildThemeTokens({
      bg: '#121212',
      bgElevated: '#1a1a1a',
      border: '#2a2a2a',
      fgPrimary: '#e8e8e8',
      fgSecondary: '#a0a0a0',
      primary: '#6cb6ff',
      primaryHover: '#539bf5',
      primaryActive: '#4184e4',
      success: '#3fb950',
      warning: '#d29922',
      danger: '#f85149',
      info: '#6cb6ff',
      dark: true
    })
  },
  {
    id: 'modern-blue',
    label: tPreset('themePreset.modernBlue.label'),
    description: tPreset('themePreset.modernBlue.description'),
    category: 'dark',
    dark: true,
    hero: 'linear-gradient(135deg, #112240 0%, #0a1628 100%)',
    accent: '#1890ff',
    tokens: buildThemeTokens({
      bg: '#0a1628',
      bgElevated: '#112240',
      border: '#1e3a5f',
      fgPrimary: '#e2e8f0',
      fgSecondary: '#8892b0',
      primary: '#1890ff',
      primaryHover: '#40a9ff',
      primaryActive: '#096dd9',
      success: '#52c41a',
      warning: '#faad14',
      danger: '#ff4d4f',
      info: '#1890ff',
      dark: true
    })
  },
  {
    id: 'warm-orange',
    label: tPreset('themePreset.warmOrange.label'),
    description: tPreset('themePreset.warmOrange.description'),
    category: 'seasonal',
    dark: false,
    hero: 'linear-gradient(135deg, #fff7e6 0%, #ffe4c0 100%)',
    accent: '#e8780a',
    tokens: buildThemeTokens({
      bg: '#fff0e0',
      bgElevated: '#fff7e6',
      border: '#f5d8b8',
      fgPrimary: '#5c3a18',
      fgSecondary: '#8c6540',
      primary: '#e8780a',
      primaryHover: '#d06a05',
      primaryActive: '#b85c00',
      success: '#52c41a',
      warning: '#fa8c16',
      danger: '#f5222d',
      info: '#1890ff',
      dark: false
    })
  },
  {
    id: 'pink',
    label: tPreset('themePreset.pink.label'),
    description: tPreset('themePreset.pink.description'),
    category: 'seasonal',
    dark: false,
    hero: 'linear-gradient(135deg, #fff0f6 0%, #ffd6e5 100%)',
    accent: '#eb2f96',
    tokens: buildThemeTokens({
      bg: '#fde8ef',
      bgElevated: '#fff0f6',
      border: '#f5c8d8',
      fgPrimary: '#4a1030',
      fgSecondary: '#7a3055',
      primary: '#eb2f96',
      primaryHover: '#c41d7f',
      primaryActive: '#9e1068',
      success: '#52c41a',
      warning: '#faad14',
      danger: '#ff4d4f',
      info: '#1890ff',
      dark: false
    })
  },
  {
    id: 'tech-cyan',
    label: tPreset('themePreset.techCyan.label'),
    description: tPreset('themePreset.techCyan.description'),
    category: 'dark',
    dark: true,
    hero: 'linear-gradient(135deg, #0d2137 0%, #0a1929 100%)',
    accent: '#13c2c2',
    tokens: buildThemeTokens({
      bg: '#0a1929',
      bgElevated: '#0d2137',
      border: '#1a3a50',
      fgPrimary: '#e0f0f0',
      fgSecondary: '#88b0b8',
      primary: '#13c2c2',
      primaryHover: '#36cfc9',
      primaryActive: '#08979c',
      success: '#52c41a',
      warning: '#faad14',
      danger: '#ff4d4f',
      info: '#13c2c2',
      dark: true
    })
  },
  {
    id: 'sunset',
    label: tPreset('themePreset.sunset.label'),
    description: tPreset('themePreset.sunset.description'),
    category: 'seasonal',
    dark: false,
    hero: 'linear-gradient(135deg, #fff4ec 0%, #ffdfc8 100%)',
    accent: '#e85d26',
    tokens: buildThemeTokens({
      bg: '#fde8d8',
      bgElevated: '#fff4ec',
      border: '#f0d0c0',
      fgPrimary: '#5c2e18',
      fgSecondary: '#8c5a3c',
      primary: '#e85d26',
      primaryHover: '#d04e1a',
      primaryActive: '#b84010',
      success: '#52c41a',
      warning: '#fa8c16',
      danger: '#f5222d',
      info: '#1890ff',
      dark: false
    })
  },
  {
    id: 'morandi',
    label: tPreset('themePreset.morandi.label'),
    description: tPreset('themePreset.morandi.description'),
    category: 'focus',
    dark: false,
    hero: 'linear-gradient(135deg, #f5f4f2 0%, #d5d0ca 100%)',
    accent: '#7c9299',
    tokens: buildThemeTokens({
      bg: '#e8e4e0',
      bgElevated: '#f5f4f2',
      border: '#d0cbc5',
      fgPrimary: '#4a4845',
      fgSecondary: '#6b6865',
      primary: '#7c9299',
      primaryHover: '#6a8088',
      primaryActive: '#586e75',
      success: '#7ba67d',
      warning: '#c4a35a',
      danger: '#c07070',
      info: '#7c9299',
      dark: false
    })
  },
  {
    id: 'high-contrast',
    label: tPreset('themePreset.highContrast.label'),
    description: tPreset('themePreset.highContrast.description'),
    category: 'focus',
    dark: true,
    hero: 'linear-gradient(135deg, #000000 0%, #1f2937 100%)',
    accent: '#ffd400',
    tokens: buildThemeTokens({
      bg: '#000000',
      bgElevated: '#111111',
      border: '#f5f5f5',
      fgPrimary: '#ffffff',
      fgSecondary: '#f5f5f5',
      fgTertiary: '#d4d4d4',
      primary: '#ffd400',
      primaryHover: '#ffea70',
      primaryActive: '#f4b400',
      success: '#7dff9a',
      warning: '#ffd166',
      danger: '#ff7b7b',
      info: '#8ed6ff',
      selection: '#334155',
      hover: '#1f2937',
      active: '#334155',
      dark: true
    })
  }
]

export const THEME_PRESETS = presets

export const THEME_PRESET_MAP = Object.fromEntries(
  presets.map((preset) => [preset.id, preset])
) as Record<ThemeId, ThemePreset>
