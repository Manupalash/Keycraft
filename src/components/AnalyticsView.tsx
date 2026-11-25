import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getThemeById } from '../data/themes';
import {
  DailyStreakData,
  KeyStat,
  SessionRecord,
  ThemeId,
} from '../types/typing';
import { getTopWeakKeys } from '../utils/storage';
import { KeyHeatData, TactileKeyboard } from './TactileKeyboard';

interface AnalyticsViewProps {
  history: SessionRecord[];
  keyStats: Record<string, KeyStat>;
  dailyStreak: DailyStreakData;
  themeId: ThemeId;
  onClearHistory: () => void;
  onGoToPractice: () => void;
  onDrillKeys: (keys: string[]) => void;
}

type HeatmapMetric = 'errorRate' | 'latency';

export function AnalyticsView({
  history,
  keyStats,
  dailyStreak,
  themeId,
  onClearHistory,
  onGoToPractice,
  onDrillKeys,
}: AnalyticsViewProps) {
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('errorRate');
  const [selectedKey, setSelectedKey] = useState<string>('e');
  const [confirmClear, setConfirmClear] = useState(false);

  const theme = getThemeById(themeId);
  const topWeakKeys = useMemo(() => getTopWeakKeys(keyStats, 4), [keyStats]);

  const summary = useMemo(() => {
    if (history.length === 0) {
      return {
        totalTests: 0,
        bestWpm: 0,
        avgWpm: 0,
        avgAccuracy: 0,
        totalSeconds: 0,
      };
    }
    const bestWpm = Math.max(...history.map((s) => s.wpm));
    const avgWpm = Math.round(
      history.reduce((sum, s) => sum + s.wpm, 0) / history.length
    );
    const avgAccuracy = Math.round(
      history.reduce((sum, s) => sum + s.accuracy, 0) / history.length
    );
    const totalSeconds = history.reduce((sum, s) => sum + s.durationSec, 0);
    return {
      totalTests: history.length,
      bestWpm,
      avgWpm,
      avgAccuracy,
      totalSeconds,
    };
  }, [history]);

  const heatMapData = useMemo(() => {
    const map: Record<string, KeyHeatData> = {};
    Object.entries(keyStats).forEach(([k, stat]) => {
      if (stat.presses === 0) return;
      const errRate = (stat.errors / stat.presses) * 100;
      const avgMs = Math.round(stat.totalLatencyMs / stat.presses);

      let bg: string | undefined;
      if (heatmapMetric === 'errorRate') {
        if (errRate >= 8) bg = theme.tokens.heatHigh;
        else if (errRate >= 3) bg = theme.tokens.heatMid;
        else bg = theme.tokens.heatLow;
      } else {
        if (avgMs >= 220) bg = theme.tokens.heatHigh;
        else if (avgMs >= 145) bg = theme.tokens.heatMid;
        else bg = theme.tokens.heatLow;
      }

      map[k] = {
        backgroundColor: bg,
        textColor: theme.tokens.inkPrimary,
        subLabel:
          heatmapMetric === 'errorRate'
            ? `${Math.round(errRate)}%`
            : `${avgMs}`,
        isSelected: selectedKey === k,
      };
    });

    if (!map[selectedKey]) {
      map[selectedKey] = { isSelected: true };
    }
    return map;
  }, [keyStats, heatmapMetric, selectedKey, theme]);

  const selectedStat = keyStats[selectedKey];
  const canDrillSelected =
    selectedKey.length === 1 && /[a-z0-9]/i.test(selectedKey);
  const recentTrend = useMemo(
    () => [...history].slice(0, 20).reverse(),
    [history]
  );

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return mins > 0 ? `${mins}m ${rem}s` : `${rem}s`;
  };

  if (history.length === 0) {
    return (
      <div className="mx-auto max-w-4xl py-16">
        <div
          className="rounded-2xl p-10 text-center"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p
            className="mx-auto mt-2 max-w-md text-sm"
            style={{ color: 'var(--ink-muted)' }}
          >
            Complete your first typing session to unlock historical WPM trends,
            session records, and your keystroke accuracy heatmap.
          </p>
          <button
            type="button"
            onClick={onGoToPractice}
            className="keycap-accent mt-6 cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold"
          >
            Start Typing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <span
            className="font-mono-typing text-xs tabular-nums"
            style={{ color: 'var(--ink-muted)' }}
          >
            {formatDuration(summary.totalSeconds)} typed
          </span>
        </div>

        <div className="flex items-center gap-3">
          {topWeakKeys.length > 0 && (
            <button
              type="button"
              onClick={() => onDrillKeys(topWeakKeys)}
              className="keycap-accent cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
            >
              Practice Weak Keys ({topWeakKeys.map((k) => k.toUpperCase()).join(' ')})
            </button>
          )}

          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                Clear all local history?
              </span>
              <button
                type="button"
                onClick={() => {
                  onClearHistory();
                  setConfirmClear(false);
                }}
                className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--error)',
                  color: '#FFFFFF',
                }}
              >
                Confirm Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-surface-alt)',
                  color: 'var(--ink-primary)',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)',
                color: 'var(--ink-muted)',
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-6 rounded-2xl p-6 sm:grid-cols-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Tests Completed
          </div>
          <div className="font-mono-typing mt-1 text-2xl font-bold tabular-nums">
            {summary.totalTests}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Best WPM
          </div>
          <div
            className="font-mono-typing mt-1 text-2xl font-bold tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {summary.bestWpm}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Average WPM
          </div>
          <div className="font-mono-typing mt-1 text-2xl font-bold tabular-nums">
            {summary.avgWpm}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Avg Accuracy
          </div>
          <div className="font-mono-typing mt-1 text-2xl font-bold tabular-nums">
            {summary.avgAccuracy}%
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Daily Streak
          </div>
          <div className="font-mono-typing mt-1 text-2xl font-bold tabular-nums">
            {dailyStreak.currentStreak}{' '}
            <span
              className="font-ui text-xs font-normal"
              style={{ color: 'var(--ink-muted)' }}
            >
              {dailyStreak.currentStreak === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>
      </div>

      {recentTrend.length >= 2 && (
        <section
          className="rounded-2xl p-6"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">
              Recent Speed Trend
            </h2>
            <span
              className="font-mono-typing text-xs tabular-nums"
              style={{ color: 'var(--ink-muted)' }}
            >
              Last {recentTrend.length} sessions
            </span>
          </div>
          <RecentTrendChart sessions={recentTrend} />
        </section>
      )}

      <section
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight">
            Keystroke Heatmap
          </h2>

          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex items-center gap-3 text-xs"
              style={{ color: 'var(--ink-muted)' }}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{
                    backgroundColor: theme.tokens.heatLow,
                    borderColor: 'var(--border-hairline)',
                  }}
                />
                {heatmapMetric === 'errorRate' ? '<3% err' : '<145ms'}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{
                    backgroundColor: theme.tokens.heatMid,
                    borderColor: 'var(--border-hairline)',
                  }}
                />
                {heatmapMetric === 'errorRate' ? '3–7% err' : '145–219ms'}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm border"
                  style={{
                    backgroundColor: theme.tokens.heatHigh,
                    borderColor: 'var(--border-hairline)',
                  }}
                />
                {heatmapMetric === 'errorRate' ? '8%+ err' : '220ms+'}
              </span>
            </div>

            <div
              className="flex items-center gap-1 rounded-lg p-1"
              style={{ backgroundColor: 'var(--bg-surface-alt)' }}
            >
              <button
                type="button"
                onClick={() => setHeatmapMetric('errorRate')}
                className="cursor-pointer rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor:
                    heatmapMetric === 'errorRate'
                      ? 'var(--bg-surface)'
                      : 'transparent',
                  color:
                    heatmapMetric === 'errorRate'
                      ? 'var(--ink-primary)'
                      : 'var(--ink-muted)',
                }}
              >
                Error Rate
              </button>
              <button
                type="button"
                onClick={() => setHeatmapMetric('latency')}
                className="cursor-pointer rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor:
                    heatmapMetric === 'latency'
                      ? 'var(--bg-surface)'
                      : 'transparent',
                  color:
                    heatmapMetric === 'latency'
                      ? 'var(--ink-primary)'
                      : 'var(--ink-muted)',
                }}
              >
                Key Latency (ms)
              </button>
            </div>
          </div>
        </div>

        <TactileKeyboard
          heatMap={heatMapData}
          onKeyClick={(k) => setSelectedKey(k)}
          compact
        />

        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t pt-4 text-xs tabular-nums"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div className="flex items-center gap-3">
            <span style={{ color: 'var(--ink-muted)' }}>Selected Key:</span>
            <span className="font-mono-typing font-bold">
              {selectedKey === ' ' ? 'SPACE' : selectedKey.toUpperCase()}
            </span>
            {canDrillSelected && (
              <button
                type="button"
                onClick={() => onDrillKeys([selectedKey.toLowerCase()])}
                className="keycap-mod cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap"
              >
                Drill Key
              </button>
            )}
          </div>

          {selectedStat && selectedStat.presses > 0 ? (
            <div className="font-mono-typing flex flex-wrap items-center gap-5">
              <span>Presses: {selectedStat.presses}</span>
              <span>
                Accuracy:{' '}
                {Math.round(
                  ((selectedStat.presses - selectedStat.errors) /
                    selectedStat.presses) *
                    100
                )}
                %
              </span>
              <span>Errors: {selectedStat.errors}</span>
              <span>
                Avg Latency:{' '}
                {Math.round(selectedStat.totalLatencyMs / selectedStat.presses)}ms
              </span>
            </div>
          ) : (
            <span style={{ color: 'var(--ink-muted)' }}>
              No presses recorded for this key yet.
            </span>
          )}
        </div>
      </section>

      <section
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        <h2 className="mb-4 text-base font-semibold tracking-tight">
          Session History
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr
                className="border-b text-xs"
                style={{
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--ink-muted)',
                }}
              >
                <th className="py-2.5 pr-4 font-medium">Mode</th>
                <th className="py-2.5 px-4 text-right font-medium">Net WPM</th>
                <th className="py-2.5 px-4 text-right font-medium">Raw</th>
                <th className="py-2.5 px-4 text-right font-medium">Accuracy</th>
                <th className="py-2.5 px-4 text-right font-medium">Consistency</th>
                <th className="py-2.5 pl-4 text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="font-mono-typing text-xs tabular-nums">
              {history.slice(0, 25).map((item) => (
                <tr
                  key={item.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: 'var(--border-hairline)' }}
                >
                  <td className="font-ui py-3 pr-4 font-medium">
                    {item.modeLabel}
                    {item.isPersonalBest && (
                      <span
                        className="ml-2 text-xs font-semibold"
                        style={{ color: 'var(--accent)' }}
                      >
                        PB
                      </span>
                    )}
                  </td>
                  <td
                    className="py-3 px-4 text-right font-semibold"
                    style={{ color: 'var(--accent)' }}
                  >
                    {item.wpm}
                  </td>
                  <td
                    className="py-3 px-4 text-right"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    {item.rawWpm}
                  </td>
                  <td className="py-3 px-4 text-right">{item.accuracy}%</td>
                  <td
                    className="py-3 px-4 text-right"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    {item.consistency}%
                  </td>
                  <td
                    className="font-ui py-3 pl-4 text-right"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    {new Date(item.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function RecentTrendChart({ sessions }: { sessions: SessionRecord[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 760;
  const height = 160;
  const padLeft = 36;
  const padRight = 16;
  const padTop = 14;
  const padBottom = 22;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxWpm = Math.max(50, ...sessions.map((s) => s.wpm));
  const yMax = Math.ceil(maxWpm / 20) * 20;

  const xFor = (i: number) =>
    sessions.length === 1
      ? padLeft + plotW / 2
      : padLeft + (i / (sessions.length - 1)) * plotW;
  const yFor = (wpm: number) => padTop + plotH - (wpm / yMax) * plotH;

  const path = sessions
    .map(
      (s, i) =>
        `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(s.wpm).toFixed(1)}`
    )
    .join(' ');

  const hovered = hoverIdx !== null ? sessions[hoverIdx] : null;

  return (
    <div>
      <div
        className="mb-1 h-4 text-right font-mono-typing text-xs tabular-nums"
        style={{ color: 'var(--ink-muted)' }}
      >
        {hovered
          ? `${hovered.modeLabel} · ${hovered.wpm} WPM · ${hovered.accuracy}% acc`
          : ''}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0, Math.round(yMax / 2), yMax].map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--border-hairline)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--ink-muted)"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {tick}
              </text>
            </g>
          );
        })}

        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {sessions.map((s, i) => {
          const cx = xFor(i);
          const cy = yFor(s.wpm);
          return (
            <g key={s.id}>
              <circle
                cx={cx}
                cy={cy}
                r={hoverIdx === i ? 5 : 3.5}
                fill={hoverIdx === i ? 'var(--accent)' : 'var(--bg-surface)'}
                stroke="var(--accent)"
                strokeWidth="2"
              />
              <rect
                x={cx - 12}
                y={padTop}
                width={24}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
