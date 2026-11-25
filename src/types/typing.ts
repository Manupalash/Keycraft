export type NavTab = 'practice' | 'analytics' | 'themes';

export type ThemeId =
  | 'retro-pbt'
  | 'olive-cream'
  | 'carbon-slate'
  | 'nordic-mist'
  | 'espresso-dark';

export type SwitchProfile = 'tactile' | 'clicky' | 'thocky' | 'muted';

export type AmbientTrack = 'rain' | 'cafe' | 'brownNoise';

export type TypingMode = 'timed' | 'quote' | 'weak-keys';

export type TimedDuration = 15 | 30 | 60 | 120;

export type QuoteLength = 'short' | 'medium' | 'long';

export type CaretStyle = 'line' | 'block' | 'underline';

export type FontSizeOption = 'sm' | 'md' | 'lg';

export interface ThemeTokens {
  bgCanvas: string;
  bgSurface: string;
  bgSurfaceAlt: string;
  borderHairline: string;
  keycapLip: string;
  keycapAccentLip: string;
  inkPrimary: string;
  inkMuted: string;
  inkUpcoming: string;
  accent: string;
  accentInk: string;
  error: string;
  errorBg: string;
  success: string;
  heatLow: string;
  heatMid: string;
  heatHigh: string;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  isDark: boolean;
  tokens: ThemeTokens;
}

export interface AudioSettings {
  switchProfile: SwitchProfile;
  switchVolume: number;
  masterMuted: boolean;
  ambientVolumes: Record<AmbientTrack, number>;
}

export interface AppSettings {
  themeId: ThemeId;
  caretStyle: CaretStyle;
  fontSize: FontSizeOption;
  showKeyboard: boolean;
  ghostEnabled: boolean;
  audio: AudioSettings;
}

export interface QuoteItem {
  id: string;
  text: string;
  author: string;
  length: QuoteLength;
}

export interface SecondSnapshot {
  second: number;
  wpm: number;
  rawWpm: number;
  errors: number;
}

export interface KeyStat {
  key: string;
  presses: number;
  errors: number;
  totalLatencyMs: number;
}

export interface DailyStreakData {
  lastPracticeDate: string | null;
  currentStreak: number;
  longestStreak: number;
  todaySessions: number;
}

export interface SessionRecord {
  id: string;
  timestamp: number;
  mode: TypingMode;
  modeLabel: string;
  durationSec: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  correctChars: number;
  incorrectChars: number;
  extraChars: number;
  timeline: SecondSnapshot[];
  weakKeys: { key: string; errors: number; presses: number }[];
  isPersonalBest?: boolean;
  previousBestWpm?: number;
  targetWeakKeys?: string[];
}
