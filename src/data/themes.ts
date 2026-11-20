import { ThemeConfig, ThemeId } from '../types/typing';

export const THEMES: ThemeConfig[] = [
  {
    id: 'retro-pbt',
    name: 'Retro PBT',
    isDark: false,
    tokens: {
      bgCanvas: '#EBE7DF',
      bgSurface: '#F7F4EC',
      bgSurfaceAlt: '#DDD7CA',
      borderHairline: '#C9C2B3',
      keycapLip: '#B5AEA0',
      keycapAccentLip: '#9E3315',
      inkPrimary: '#1F1D1A',
      inkMuted: '#6E685F',
      inkUpcoming: '#918A7F',
      accent: '#D94E28',
      accentInk: '#FFFFFF',
      error: '#B91C1C',
      errorBg: '#FEE2E2',
      success: '#15803D',
      heatLow: '#DCE6D8',
      heatMid: '#F5DEC0',
      heatHigh: '#F5C4C4',
    },
  },
  {
    id: 'olive-cream',
    name: 'Olive & Cream',
    isDark: false,
    tokens: {
      bgCanvas: '#E6EAE3',
      bgSurface: '#F4F6F1',
      bgSurfaceAlt: '#D2D9CC',
      borderHairline: '#BCC5B5',
      keycapLip: '#A5B09D',
      keycapAccentLip: '#244A31',
      inkPrimary: '#1C241B',
      inkMuted: '#586655',
      inkUpcoming: '#859382',
      accent: '#3B6E4C',
      accentInk: '#FFFFFF',
      error: '#B91C1C',
      errorBg: '#FEE2E2',
      success: '#15803D',
      heatLow: '#D9E8DC',
      heatMid: '#EFE1B8',
      heatHigh: '#F4C6C6',
    },
  },
  {
    id: 'carbon-slate',
    name: 'Carbon Slate',
    isDark: true,
    tokens: {
      bgCanvas: '#16181D',
      bgSurface: '#21242B',
      bgSurfaceAlt: '#2C303A',
      borderHairline: '#383D4A',
      keycapLip: '#0D0E12',
      keycapAccentLip: '#A84E1A',
      inkPrimary: '#F2F4F8',
      inkMuted: '#9BA3B2',
      inkUpcoming: '#646C7B',
      accent: '#E87D3E',
      accentInk: '#16181D',
      error: '#F87171',
      errorBg: '#451A1A',
      success: '#4ADE80',
      heatLow: '#1E3329',
      heatMid: '#3D2F1B',
      heatHigh: '#4B2121',
    },
  },
  {
    id: 'nordic-mist',
    name: 'Nordic Mist',
    isDark: false,
    tokens: {
      bgCanvas: '#E8EDF2',
      bgSurface: '#F6F9FC',
      bgSurfaceAlt: '#D5DFE9',
      borderHairline: '#C0CCD8',
      keycapLip: '#A5B5C5',
      keycapAccentLip: '#1945A8',
      inkPrimary: '#16202A',
      inkMuted: '#546576',
      inkUpcoming: '#8595A6',
      accent: '#2563EB',
      accentInk: '#FFFFFF',
      error: '#DC2626',
      errorBg: '#FEE2E2',
      success: '#16A34A',
      heatLow: '#D8EBE2',
      heatMid: '#F3E1BF',
      heatHigh: '#F7C6C6',
    },
  },
  {
    id: 'espresso-dark',
    name: 'Espresso Dark',
    isDark: true,
    tokens: {
      bgCanvas: '#1B1715',
      bgSurface: '#26211E',
      bgSurfaceAlt: '#332C28',
      borderHairline: '#453B35',
      keycapLip: '#100D0B',
      keycapAccentLip: '#8C5B28',
      inkPrimary: '#F4EDE4',
      inkMuted: '#A8998B',
      inkUpcoming: '#6D6055',
      accent: '#D19352',
      accentInk: '#1B1715',
      error: '#F87171',
      errorBg: '#471C1C',
      success: '#4ADE80',
      heatLow: '#213325',
      heatMid: '#3E2F1E',
      heatHigh: '#4D2323',
    },
  },
];

export function getThemeById(id: ThemeId): ThemeConfig {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyThemeTokens(theme: ThemeConfig): void {
  const root = document.documentElement;
  const { tokens } = theme;
  root.style.setProperty('--bg-canvas', tokens.bgCanvas);
  root.style.setProperty('--bg-surface', tokens.bgSurface);
  root.style.setProperty('--bg-surface-alt', tokens.bgSurfaceAlt);
  root.style.setProperty('--border-hairline', tokens.borderHairline);
  root.style.setProperty('--keycap-lip', tokens.keycapLip);
  root.style.setProperty('--keycap-accent-lip', tokens.keycapAccentLip);
  root.style.setProperty('--ink-primary', tokens.inkPrimary);
  root.style.setProperty('--ink-muted', tokens.inkMuted);
  root.style.setProperty('--ink-upcoming', tokens.inkUpcoming);
  root.style.setProperty('--accent', tokens.accent);
  root.style.setProperty('--accent-ink', tokens.accentInk);
  root.style.setProperty('--error', tokens.error);
  root.style.setProperty('--error-bg', tokens.errorBg);
  root.style.setProperty('--success', tokens.success);
}
