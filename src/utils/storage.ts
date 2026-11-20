import { AppSettings, KeyStat, SessionRecord } from '../types/typing';

const SETTINGS_KEY = 'keycraft_settings_v1';
const HISTORY_KEY = 'keycraft_history_v1';
const KEY_STATS_KEY = 'keycraft_key_stats_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  themeId: 'retro-pbt',
  caretStyle: 'line',
  fontSize: 'md',
  showKeyboard: true,
  audio: {
    switchProfile: 'tactile',
    switchVolume: 0.72,
    masterMuted: false,
    ambientVolumes: {
      rain: 0,
      cafe: 0,
      brownNoise: 0,
    },
  },
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      audio: {
        ...DEFAULT_SETTINGS.audio,
        ...(parsed.audio ?? {}),
        ambientVolumes: {
          ...DEFAULT_SETTINGS.audio.ambientVolumes,
          ...(parsed.audio?.ambientVolumes ?? {}),
        },
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveSession(record: SessionRecord): SessionRecord[] {
  const existing = loadHistory();
  const updated = [record, ...existing].slice(0, 150);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function clearHistoryStorage(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(KEY_STATS_KEY);
  } catch {
    // Ignore
  }
}

export function loadKeyStats(): Record<string, KeyStat> {
  try {
    const raw = localStorage.getItem(KEY_STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, KeyStat>)
      : {};
  } catch {
    return {};
  }
}

export function mergeKeyStats(
  delta: Record<string, { presses: number; errors: number; totalLatencyMs: number }>
): Record<string, KeyStat> {
  const current = loadKeyStats();
  Object.entries(delta).forEach(([key, stats]) => {
    const existing = current[key] ?? {
      key,
      presses: 0,
      errors: 0,
      totalLatencyMs: 0,
    };
    current[key] = {
      key,
      presses: existing.presses + stats.presses,
      errors: existing.errors + stats.errors,
      totalLatencyMs: existing.totalLatencyMs + stats.totalLatencyMs,
    };
  });
  try {
    localStorage.setItem(KEY_STATS_KEY, JSON.stringify(current));
  } catch {
    // Ignore
  }
  return current;
}

export function calculateConsistency(rawValues: number[]): number {
  if (rawValues.length < 2) return 100;
  const valid = rawValues.filter((v) => v > 0);
  if (valid.length < 2) return 100;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  if (mean === 0) return 0;
  const variance =
    valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / valid.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
}
