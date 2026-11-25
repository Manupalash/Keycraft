import { RotateCcw } from 'lucide-react';
import { DailyStreakData, SessionRecord } from '../types/typing';
import { WpmTimelineChart } from './WpmTimelineChart';

interface ResultsSummaryProps {
  session: SessionRecord;
  dailyStreak: DailyStreakData;
  onNextTest: () => void;
  onRetrySame: () => void;
  onDrillWeakKeys?: (keys: string[]) => void;
}

export function ResultsSummary({
  session,
  dailyStreak,
  onNextTest,
  onRetrySame,
  onDrillWeakKeys,
}: ResultsSummaryProps) {
  const prevBest = session.previousBestWpm ?? 0;
  const deltaVsBest = prevBest > 0 ? session.wpm - prevBest : null;

  const drillableWeakKeys = session.weakKeys
    .map((wk) => wk.key)
    .filter((k) => k.length === 1 && /[a-z0-9]/.test(k));

  return (
    <section
      className="mx-auto w-full max-w-4xl rounded-2xl p-7"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-hairline)',
      }}
    >
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-6">
          <div>
            <div
              className="text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              Net WPM
            </div>
            <div className="flex items-baseline gap-2.5">
              <span
                className="font-mono-typing text-5xl font-bold tracking-tight tabular-nums"
                style={{ color: 'var(--accent)' }}
              >
                {session.wpm}
              </span>
              {deltaVsBest !== null && (
                <span
                  className="font-mono-typing text-xs font-semibold tabular-nums"
                  style={{
                    color:
                      deltaVsBest >= 0
                        ? 'var(--success)'
                        : 'var(--ink-muted)',
                  }}
                >
                  {deltaVsBest >= 0 ? `+${deltaVsBest}` : deltaVsBest} vs PB
                </span>
              )}
            </div>
          </div>

          <div className="pl-2">
            <div
              className="text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              Accuracy
            </div>
            <div
              className="font-mono-typing text-3xl font-semibold tabular-nums"
              style={{ color: 'var(--ink-primary)' }}
            >
              {session.accuracy}%
            </div>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center gap-2 text-xs tabular-nums"
          style={{ color: 'var(--ink-muted)' }}
        >
          {session.isPersonalBest && (
            <>
              <span
                className="font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                New Personal Best
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{session.modeLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{session.durationSec}s</span>
          {dailyStreak.currentStreak > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ color: 'var(--ink-primary)' }}>
                {dailyStreak.currentStreak}-day streak
              </span>
            </>
          )}
        </div>
      </div>

      <div
        className="mb-6 border-y py-5"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <WpmTimelineChart data={session.timeline} />
      </div>

      <div className="mb-7 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Raw Speed
          </div>
          <div className="font-mono-typing mt-1 text-xl font-semibold tabular-nums">
            {session.rawWpm} WPM
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Consistency
          </div>
          <div className="font-mono-typing mt-1 text-xl font-semibold tabular-nums">
            {session.consistency}%
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Characters
          </div>
          <div className="font-mono-typing mt-1 text-xl font-semibold tabular-nums">
            {session.correctChars}
            <span style={{ color: 'var(--ink-muted)' }}> / </span>
            <span style={{ color: 'var(--error)' }}>
              {session.incorrectChars}
            </span>
            {session.extraChars > 0 && (
              <span style={{ color: 'var(--ink-muted)' }}>
                {' '}
                +{session.extraChars}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Missed Keys
          </div>
          <div className="font-mono-typing mt-1 text-sm font-medium tabular-nums">
            {session.weakKeys.length > 0
              ? session.weakKeys
                  .slice(0, 4)
                  .map(
                    (wk) =>
                      `${wk.key === ' ' ? 'SPC' : wk.key.toUpperCase()} (${wk.errors})`
                  )
                  .join(' · ')
              : 'Clean run'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onNextTest}
            className="keycap-accent cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0"
          >
            Next Test
          </button>
          <button
            type="button"
            onClick={onRetrySame}
            className="keycap-alpha flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Retry Same</span>
          </button>
          {drillableWeakKeys.length > 0 && onDrillWeakKeys && (
            <button
              type="button"
              onClick={() => onDrillWeakKeys(drillableWeakKeys.slice(0, 4))}
              className="keycap-mod cursor-pointer rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap shrink-0"
            >
              Practice Weak Keys
            </button>
          )}
        </div>

        <span
          className="font-mono-typing text-xs"
          style={{ color: 'var(--ink-muted)' }}
        >
          Tab + Enter for quick next test
        </span>
      </div>
    </section>
  );
}
