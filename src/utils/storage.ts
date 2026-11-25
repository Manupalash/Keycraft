import {
  AppSettings,
  DailyStreakData,
  KeyStat,
  SessionRecord,
} from '../types/typing';

const SETTINGS_KEY = 'keycraft_settings_v1';
const HISTORY_KEY = 'keycraft_history_v1';
const KEY_STATS_KEY = 'keycraft_key_stats_v1';
const DAILY_STREAK_KEY = 'keycraft_daily_streak_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  themeId: 'retro-pbt',
  caretStyle: 'line',
  fontSize: 'md',
  showKeyboard: true,
  ghostEnabled: true,
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

export const DEFAULT_DAILY_STREAK: DailyStreakData = {
  lastPracticeDate: null,
  currentStreak: 0,
  longestStreak: 0,
  todaySessions: 0,
};

export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function clampUnit(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n)
    ? Math.min(1, Math.max(0, n))
    : fallback;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      audio: {
        ...DEFAULT_SETTINGS.audio,
        ...(parsed.audio ?? {}),
        switchVolume: clampUnit(
          parsed.audio?.switchVolume,
          DEFAULT_SETTINGS.audio.switchVolume
        ),
        ambientVolumes: {
          rain: clampUnit(parsed.audio?.ambientVolumes?.rain, 0),
          cafe: clampUnit(parsed.audio?.ambientVolumes?.cafe, 0),
          brownNoise: clampUnit(parsed.audio?.ambientVolumes?.brownNoise, 0),
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
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SessionRecord =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.wpm === 'number' &&
        typeof item.accuracy === 'number'
    );
  } catch {
    return [];
  }
}

export function saveSession(record: SessionRecord): SessionRecord[] {
  const existing = loadHistory();
  if (existing.some((item) => item.id === record.id)) {
    return existing;
  }
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
    localStorage.removeItem(DAILY_STREAK_KEY);
  } catch {
    // Ignore
  }
}

export function loadKeyStats(): Record<string, KeyStat> {
  try {
    const raw = localStorage.getItem(KEY_STATS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: Record<string, KeyStat> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
      if (
        v &&
        typeof v === 'object' &&
        typeof (v as KeyStat).presses === 'number' &&
        typeof (v as KeyStat).errors === 'number' &&
        typeof (v as KeyStat).totalLatencyMs === 'number'
      ) {
        clean[k] = v as KeyStat;
      }
    });
    return clean;
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

export function loadDailyStreak(): DailyStreakData {
  try {
    const raw = localStorage.getItem(DAILY_STREAK_KEY);
    if (!raw) return DEFAULT_DAILY_STREAK;
    const parsed = JSON.parse(raw) as Partial<DailyStreakData>;
    const today = getLocalDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getLocalDateString(yesterdayDate);

    const last = parsed.lastPracticeDate ?? null;
    let currentStreak =
      typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0;
    let todaySessions =
      typeof parsed.todaySessions === 'number' ? parsed.todaySessions : 0;

    if (last !== today) {
      todaySessions = 0;
      if (last !== yesterday) {
        currentStreak = 0;
      }
    }

    return {
      lastPracticeDate: last,
      currentStreak,
      longestStreak:
        typeof parsed.longestStreak === 'number'
          ? Math.max(parsed.longestStreak, currentStreak)
          : currentStreak,
      todaySessions,
    };
  } catch {
    return DEFAULT_DAILY_STREAK;
  }
}

export function recordPracticeDay(): DailyStreakData {
  const current = loadDailyStreak();
  const today = getLocalDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateString(yesterdayDate);

  let nextStreak = current.currentStreak;
  let nextTodaySessions = current.todaySessions;

  if (current.lastPracticeDate === today) {
    nextTodaySessions += 1;
  } else if (current.lastPracticeDate === yesterday) {
    nextStreak += 1;
    nextTodaySessions = 1;
  } else {
    nextStreak = 1;
    nextTodaySessions = 1;
  }

  const next: DailyStreakData = {
    lastPracticeDate: today,
    currentStreak: nextStreak,
    longestStreak: Math.max(current.longestStreak, nextStreak),
    todaySessions: nextTodaySessions,
  };

  try {
    localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function getBestWpmForMode(
  history: SessionRecord[],
  modeLabel: string
): number {
  let best = 0;
  for (const s of history) {
    if (s.modeLabel === modeLabel && s.wpm > best) {
      best = s.wpm;
    }
  }
  return best;
}

export function getTopWeakKeys(
  keyStats: Record<string, KeyStat>,
  limit = 4
): string[] {
  return Object.values(keyStats)
    .filter(
      (s) =>
        s.presses >= 3 &&
        s.errors > 0 &&
        s.key.length === 1 &&
        /[a-z0-9]/.test(s.key)
    )
    .sort((a, b) => b.errors / b.presses - a.errors / a.presses)
    .slice(0, limit)
    .map((s) => s.key);
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
