// ─── PREMIUM DUAL-MODE THEME (AMOLED dark + glass light) ───
// Accent presets: merged per `accentId` so dashboard, charts, gradients, and UI chrome stay coherent.

export const THEME_ACCENT_KEY = 'erp_theme_accent';
export const DEFAULT_ACCENT_ID = 'sapphire';

/** Curated palettes: primary accent, secondary (charts / gradients), tertiary series, mesh & glow. */
const ACCENT_PRESETS = {
  sapphire: {
    dark: {
      accent: '#8EAEFF',
      accentMuted: 'rgba(142, 174, 255, 0.26)',
      chartA: '#8EAEFF',
      chartB: '#D8B4FF',
      chartC: '#5EEAD4',
      chartD: '#FF7AB8',
      avatarGradientA: '#8EAEFF',
      avatarGradientB: '#D8B4FF',
      glow: 'rgba(142, 174, 255, 0.2)',
      meshAccent: 'rgba(142, 174, 255, 0.11)',
      meshSecondary: 'rgba(216, 180, 255, 0.09)',
      bgSidebarActive: 'rgba(142, 174, 255, 0.15)',
      sky: '#5EC8FF',
    },
    light: {
      accent: '#4F6EE6',
      accentMuted: 'rgba(79, 110, 230, 0.14)',
      chartA: '#4F6EE6',
      chartB: '#A855F7',
      chartC: '#0D9488',
      chartD: '#DB2777',
      avatarGradientA: '#4F6EE6',
      avatarGradientB: '#A855F7',
      glow: 'rgba(79, 110, 230, 0.1)',
      meshAccent: 'rgba(79, 110, 230, 0.12)',
      meshSecondary: 'rgba(168, 85, 247, 0.08)',
      bgSidebarActive: 'rgba(79, 110, 230, 0.16)',
      sky: '#0EA5E9',
    },
  },
  violet: {
    dark: {
      accent: '#B8A0FF',
      accentMuted: 'rgba(184, 160, 255, 0.26)',
      chartA: '#B8A0FF',
      chartB: '#FF7BC0',
      chartC: '#5CF0FF',
      chartD: '#D8C8FF',
      avatarGradientA: '#B8A0FF',
      avatarGradientB: '#FF7BC0',
      glow: 'rgba(184, 160, 255, 0.2)',
      meshAccent: 'rgba(184, 160, 255, 0.11)',
      meshSecondary: 'rgba(255, 123, 192, 0.09)',
      bgSidebarActive: 'rgba(184, 160, 255, 0.15)',
      sky: '#5CEFFF',
    },
    light: {
      accent: '#7C3AED',
      accentMuted: 'rgba(124, 58, 237, 0.15)',
      chartA: '#7C3AED',
      chartB: '#DB2777',
      chartC: '#0891B2',
      chartD: '#9333EA',
      avatarGradientA: '#7C3AED',
      avatarGradientB: '#DB2777',
      glow: 'rgba(124, 58, 237, 0.11)',
      meshAccent: 'rgba(124, 58, 237, 0.11)',
      meshSecondary: 'rgba(219, 39, 119, 0.08)',
      bgSidebarActive: 'rgba(124, 58, 237, 0.14)',
      sky: '#0284c7',
    },
  },
  cyan: {
    dark: {
      accent: '#2FE8FF',
      accentMuted: 'rgba(47, 232, 255, 0.24)',
      chartA: '#2FE8FF',
      chartB: '#9AA7FF',
      chartC: '#5CF88A',
      chartD: '#F0A8FF',
      avatarGradientA: '#2FE8FF',
      avatarGradientB: '#9AA7FF',
      glow: 'rgba(47, 232, 255, 0.2)',
      meshAccent: 'rgba(47, 232, 255, 0.11)',
      meshSecondary: 'rgba(154, 167, 255, 0.09)',
      bgSidebarActive: 'rgba(47, 232, 255, 0.15)',
      sky: '#7DFBFF',
    },
    light: {
      accent: '#0891B2',
      accentMuted: 'rgba(8, 145, 178, 0.14)',
      chartA: '#0891B2',
      chartB: '#4F46E5',
      chartC: '#16A34A',
      chartD: '#C026D3',
      avatarGradientA: '#0891B2',
      avatarGradientB: '#4F46E5',
      glow: 'rgba(8, 145, 178, 0.1)',
      meshAccent: 'rgba(8, 145, 178, 0.11)',
      meshSecondary: 'rgba(79, 70, 229, 0.08)',
      bgSidebarActive: 'rgba(8, 145, 178, 0.14)',
      sky: '#0369a1',
    },
  },
  emerald: {
    dark: {
      accent: '#4CF0B0',
      accentMuted: 'rgba(76, 240, 176, 0.24)',
      chartA: '#4CF0B0',
      chartB: '#40F0E0',
      chartC: '#34D399',
      chartD: '#FFD060',
      avatarGradientA: '#4CF0B0',
      avatarGradientB: '#40F0E0',
      glow: 'rgba(76, 240, 176, 0.2)',
      meshAccent: 'rgba(76, 240, 176, 0.11)',
      meshSecondary: 'rgba(64, 240, 224, 0.09)',
      bgSidebarActive: 'rgba(76, 240, 176, 0.15)',
      sky: '#5CFFE8',
    },
    light: {
      accent: '#059669',
      accentMuted: 'rgba(5, 150, 105, 0.14)',
      chartA: '#059669',
      chartB: '#0D9488',
      chartC: '#22C55E',
      chartD: '#A3E635',
      avatarGradientA: '#059669',
      avatarGradientB: '#0D9488',
      glow: 'rgba(5, 150, 105, 0.1)',
      meshAccent: 'rgba(5, 150, 105, 0.11)',
      meshSecondary: 'rgba(13, 148, 136, 0.08)',
      bgSidebarActive: 'rgba(5, 150, 105, 0.15)',
      sky: '#0f766e',
    },
  },
  rose: {
    dark: {
      accent: '#FF8A9E',
      accentMuted: 'rgba(255, 138, 158, 0.24)',
      chartA: '#FF8A9E',
      chartB: '#F8C0FF',
      chartC: '#6CFFC8',
      chartD: '#FFD478',
      avatarGradientA: '#FF8A9E',
      avatarGradientB: '#F8C0FF',
      glow: 'rgba(255, 138, 158, 0.2)',
      meshAccent: 'rgba(255, 138, 158, 0.11)',
      meshSecondary: 'rgba(248, 192, 255, 0.09)',
      bgSidebarActive: 'rgba(255, 138, 158, 0.15)',
      sky: '#FFB8C8',
    },
    light: {
      accent: '#E11D48',
      accentMuted: 'rgba(225, 29, 72, 0.14)',
      chartA: '#E11D48',
      chartB: '#C026D3',
      chartC: '#059669',
      chartD: '#D97706',
      avatarGradientA: '#E11D48',
      avatarGradientB: '#C026D3',
      glow: 'rgba(225, 29, 72, 0.1)',
      meshAccent: 'rgba(225, 29, 72, 0.1)',
      meshSecondary: 'rgba(192, 38, 211, 0.08)',
      bgSidebarActive: 'rgba(225, 29, 72, 0.14)',
      sky: '#be123c',
    },
  },
  sunset: {
    dark: {
      accent: '#FF9F4A',
      accentMuted: 'rgba(255, 159, 74, 0.24)',
      chartA: '#FF9F4A',
      chartB: '#FF7EB8',
      chartC: '#5CF090',
      chartD: '#FFE060',
      avatarGradientA: '#FF9F4A',
      avatarGradientB: '#FF7EB8',
      glow: 'rgba(255, 159, 74, 0.2)',
      meshAccent: 'rgba(255, 159, 74, 0.11)',
      meshSecondary: 'rgba(255, 126, 184, 0.09)',
      bgSidebarActive: 'rgba(255, 159, 74, 0.15)',
      sky: '#FFC878',
    },
    light: {
      accent: '#EA580C',
      accentMuted: 'rgba(234, 88, 12, 0.14)',
      chartA: '#EA580C',
      chartB: '#DB2777',
      chartC: '#16A34A',
      chartD: '#CA8A04',
      avatarGradientA: '#EA580C',
      avatarGradientB: '#DB2777',
      glow: 'rgba(234, 88, 12, 0.1)',
      meshAccent: 'rgba(234, 88, 12, 0.1)',
      meshSecondary: 'rgba(219, 39, 119, 0.08)',
      bgSidebarActive: 'rgba(234, 88, 12, 0.14)',
      sky: '#c2410c',
    },
  },
  indigo: {
    dark: {
      accent: '#98A4FF',
      accentMuted: 'rgba(152, 164, 255, 0.26)',
      chartA: '#98A4FF',
      chartB: '#D0A0FF',
      chartC: '#40F0E0',
      chartD: '#FF7EB8',
      avatarGradientA: '#98A4FF',
      avatarGradientB: '#D0A0FF',
      glow: 'rgba(152, 164, 255, 0.2)',
      meshAccent: 'rgba(152, 164, 255, 0.11)',
      meshSecondary: 'rgba(208, 160, 255, 0.09)',
      bgSidebarActive: 'rgba(152, 164, 255, 0.15)',
      sky: '#8CD8FF',
    },
    light: {
      accent: '#4F46E5',
      accentMuted: 'rgba(79, 70, 229, 0.14)',
      chartA: '#4F46E5',
      chartB: '#9333EA',
      chartC: '#0D9488',
      chartD: '#DB2777',
      avatarGradientA: '#4F46E5',
      avatarGradientB: '#9333EA',
      glow: 'rgba(79, 70, 229, 0.1)',
      meshAccent: 'rgba(79, 70, 229, 0.11)',
      meshSecondary: 'rgba(147, 51, 234, 0.08)',
      bgSidebarActive: 'rgba(79, 70, 229, 0.15)',
      sky: '#2563eb',
    },
  },
};

export const ACCENT_OPTIONS = [
  { id: 'sapphire', label: 'Sapphire', hint: 'Cool blue & violet', swatch: ['#4F6EE6', '#A855F7'] },
  { id: 'indigo', label: 'Indigo', hint: 'Deep indigo', swatch: ['#4F46E5', '#9333EA'] },
  { id: 'violet', label: 'Violet', hint: 'Purple & pink', swatch: ['#7C3AED', '#DB2777'] },
  { id: 'cyan', label: 'Cyan', hint: 'Electric teal', swatch: ['#0891B2', '#4F46E5'] },
  { id: 'emerald', label: 'Emerald', hint: 'Fresh green', swatch: ['#059669', '#0D9488'] },
  { id: 'rose', label: 'Rose', hint: 'Warm pink', swatch: ['#E11D48', '#C026D3'] },
  { id: 'sunset', label: 'Sunset', hint: 'Orange & coral', swatch: ['#EA580C', '#DB2777'] },
];

export function normalizeAccentId(id) {
  const key = String(id ?? '').trim().toLowerCase();
  return ACCENT_PRESETS[key] ? key : DEFAULT_ACCENT_ID;
}

export const darkTheme = {
  bg: '#000000',
  bgCard: 'rgba(10, 12, 22, 0.52)',
  bgCardSoft: 'rgba(12, 14, 24, 0.38)',
  bgSidebar: '#000000',
  bgSidebarActive: 'rgba(99, 138, 255, 0.12)',
  /** Cool edge — avoids white “frost” spreading on OLED */
  border: 'rgba(90, 115, 175, 0.1)',
  glassBorder: 'rgba(105, 130, 195, 0.13)',
  glassHighlight: 'rgba(124, 156, 255, 0.04)',

  accent: '#7C9CFF',
  accentMuted: 'rgba(124, 156, 255, 0.22)',
  green: '#34D399',
  amber: '#FBBF24',
  red: '#FB7185',

  text: '#F4F6FB',
  textSecondary: '#8B9AB8',
  textOnAccent: '#FFFFFF',

  sidebarText: '#E8ECF4',
  sidebarMuted: '#5C6B8A',
  inputBg: 'rgba(70, 100, 170, 0.07)',

  avatarGradientA: '#7C9CFF',
  avatarGradientB: '#C084FC',

  glow: 'rgba(124, 156, 255, 0.12)',
  cardShadow: 'rgba(0, 0, 0, 0.65)',
  cardShine: 'rgba(124, 156, 255, 0.04)',

  chartA: '#7C9CFF',
  chartB: '#C084FC',
  chartC: '#5EEAD4',
  chartD: '#F472B6',

  meshAccent: 'rgba(124, 156, 255, 0.07)',
  meshSecondary: 'rgba(192, 132, 252, 0.06)',
  sky: '#38bdf8',
};

export const lightTheme = {
  bg: '#F3F6FC',
  bgCard: 'rgba(255, 255, 255, 0.82)',
  bgCardSoft: 'rgba(255, 255, 255, 0.58)',
  bgSidebar: '#0B1220',
  bgSidebarActive: 'rgba(79, 110, 230, 0.16)',
  border: 'rgba(15, 23, 42, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.65)',
  glassHighlight: 'rgba(255, 255, 255, 0.95)',

  accent: '#4F6EE6',
  accentMuted: 'rgba(79, 110, 230, 0.14)',
  green: '#059669',
  amber: '#D97706',
  red: '#DC2626',

  text: '#0B1220',
  textSecondary: '#5C6B82',
  textOnAccent: '#FFFFFF',

  sidebarText: '#E8ECF4',
  sidebarMuted: '#94A3B8',
  inputBg: 'rgba(15, 23, 42, 0.035)',

  avatarGradientA: '#4F6EE6',
  avatarGradientB: '#A855F7',

  glow: 'rgba(79, 110, 230, 0.1)',
  cardShadow: 'rgba(15, 23, 42, 0.06)',
  cardShine: 'rgba(255, 255, 255, 0.9)',

  chartA: '#4F6EE6',
  chartB: '#A855F7',
  chartC: '#059669',
  chartD: '#DB2777',

  meshAccent: 'rgba(79, 110, 230, 0.12)',
  meshSecondary: 'rgba(168, 85, 247, 0.08)',
  sky: '#0EA5E9',
};

export function getTheme(darkMode, accentId = DEFAULT_ACCENT_ID) {
  const base = darkMode ? { ...darkTheme } : { ...lightTheme };
  const id = normalizeAccentId(accentId);
  const patch = ACCENT_PRESETS[id][darkMode ? 'dark' : 'light'];
  return { ...base, ...patch };
}

/** Maps theme tokens to the CSS custom properties used by `index.css` utilities. */
export function themeToCssVars(t, darkMode) {
  return {
    '--bg': t.bg,
    '--bg-card': t.bgCard,
    '--bg-card-soft': t.bgCardSoft,
    '--fg': t.text,
    '--muted': t.textSecondary,
    '--divider': t.border,
    '--glass-border': t.glassBorder,
    '--glass-highlight': darkMode
      ? `color-mix(in srgb, ${t.accent} 10%, transparent)`
      : t.glassHighlight,
    '--subtle': t.inputBg,
    '--subtle-strong': darkMode ? 'rgba(70, 95, 155, 0.1)' : 'rgba(15,23,42,0.055)',
    '--accent': t.accent,
    '--accent-muted': t.accentMuted,
    '--emerald': t.green,
    '--amber': t.amber,
    '--rose': t.red,
    '--cyan': t.chartA,
    '--sky': t.sky ?? '#38bdf8',
    '--indigo': t.chartB,
    '--pink': t.chartD,
    '--card-shadow': t.cardShadow,
    '--card-shine': darkMode
      ? `color-mix(in srgb, ${t.accent} 6%, transparent)`
      : t.cardShine,
    '--glow-accent': t.glow,
    '--mesh-accent': t.meshAccent,
    '--mesh-secondary': t.meshSecondary,
  };
}
