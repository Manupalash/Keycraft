import { RotateCcw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { pickRandomQuote } from '../data/wordsAndQuotes';
import {
  createInitialTypingState,
  getModeLabel,
  ModeConfig,
  typingReducer,
} from '../state/typingMachine';
import {
  AppSettings,
  DailyStreakData,
  KeyStat,
  QuoteLength,
  SessionRecord,
  TimedDuration,
} from '../types/typing';
import { audioEngine } from '../utils/audioEngine';
import { getBestWpmForMode, getTopWeakKeys } from '../utils/storage';
import { ResultsSummary } from './ResultsSummary';
import { TactileKeyboard } from './TactileKeyboard';

type ChordState = 'idle' | 'tab_armed';

export interface DrillRequest {
  keys: string[];
  nonce: number;
}

interface PracticeViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  isAudioPanelOpen: boolean;
  history: SessionRecord[];
  keyStats: Record<string, KeyStat>;
  dailyStreak: DailyStreakData;
  drillRequest: DrillRequest | null;
  onConsumeDrillRequest: () => void;
  onSessionComplete: (
    session: SessionRecord,
    keyDelta: Record<
      string,
      { presses: number; errors: number; totalLatencyMs: number }
    >
  ) => void;
  onRunningChange: (isRunning: boolean) => void;
}

const TIMED_OPTIONS: TimedDuration[] = [15, 30, 60, 120];
const QUOTE_LENGTHS: QuoteLength[] = ['short', 'medium', 'long'];

const DEFAULT_CONFIG: ModeConfig = {
  mode: 'timed',
  duration: 30,
  punctuation: false,
  numbers: false,
};

export function PracticeView({
  settings,
  onUpdateSettings,
  isAudioPanelOpen,
  history,
  keyStats,
  dailyStreak,
  drillRequest,
  onConsumeDrillRequest,
  onSessionComplete,
  onRunningChange,
}: PracticeViewProps) {
  const [state, dispatch] = useReducer(
    typingReducer,
    DEFAULT_CONFIG,
    createInitialTypingState
  );

  const [chordState, setChordState] = useState<ChordState>('idle');
  const [streakMilestonePop, setStreakMilestonePop] = useState(false);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [lastErrorKey, setLastErrorKey] = useState<string | null>(null);

  const [caretPos, setCaretPos] = useState<{ x: number; y: number; h: number }>({
    x: 0,
    y: 0,
    h: 28,
  });
  const [ghostCharTarget, setGhostCharTarget] = useState<{
    wordIdx: number;
    charIdx: number;
  } | null>(null);
  const [ghostCaretPos, setGhostCaretPos] = useState<{
    x: number;
    y: number;
    h: number;
  } | null>(null);
  const [scrollOffsetY, setScrollOffsetY] = useState(0);

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const activeCharRef = useRef<HTMLSpanElement | null>(null);
  const ghostCharRef = useRef<HTMLSpanElement | null>(null);
  const lastSavedSessionIdRef = useRef<string | null>(null);
  const lastMilestoneStreakRef = useRef<number>(0);

  const currentModeLabel = useMemo(
    () => getModeLabel(state.config),
    [state.config]
  );

  const modeBestWpm = useMemo(
    () => getBestWpmForMode(history, currentModeLabel),
    [history, currentModeLabel]
  );

  const overallBestWpm = useMemo(
    () => history.reduce((max, item) => Math.max(max, item.wpm), 0),
    [history]
  );

  const focusCanvas = useCallback(() => {
    if (!isAudioPanelOpen && state.phase.status !== 'finished') {
      hiddenInputRef.current?.focus({ preventScroll: true });
    }
  }, [isAudioPanelOpen, state.phase.status]);

  useEffect(() => {
    onRunningChange(state.phase.status === 'running');
  }, [state.phase.status, onRunningChange]);

  useEffect(() => {
    focusCanvas();
  }, [focusCanvas, state.config, state.phase.status]);

  // Consume external weak-key drill request once
  useEffect(() => {
    if (!drillRequest) return;
    const keys =
      drillRequest.keys.length > 0
        ? drillRequest.keys
        : getTopWeakKeys(keyStats, 4);
    dispatch({
      type: 'CONFIGURE',
      config: { mode: 'weak-keys', targetKeys: keys },
    });
    onConsumeDrillRequest();
  }, [drillRequest, keyStats, onConsumeDrillRequest]);

  // Single-execution completion side effect (persists session + plays chime once per session id)
  useEffect(() => {
    if (state.phase.status !== 'finished') return;
    const { result } = state.phase;
    if (lastSavedSessionIdRef.current === result.id) return;
    lastSavedSessionIdRef.current = result.id;

    audioEngine.playCompletionChime(
      Boolean(result.isPersonalBest),
      settings.audio.switchProfile,
      settings.audio.switchVolume
    );
    onSessionComplete(result, state.keyDelta);
  }, [
    state.phase,
    state.keyDelta,
    settings.audio.switchProfile,
    settings.audio.switchVolume,
    onSessionComplete,
  ]);

  // Cleanly expire word-settle animation
  useEffect(() => {
    if (state.settledWordIndex === null) return;
    const idx = state.settledWordIndex;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'CLEAR_SETTLED_WORD', wordIdx: idx });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [state.settledWordIndex]);

  // Streak milestone pop & harmonic audio cue
  useEffect(() => {
    if (state.streak === 0) {
      lastMilestoneStreakRef.current = 0;
      return;
    }
    if (
      state.streak % 25 === 0 &&
      state.streak !== lastMilestoneStreakRef.current
    ) {
      lastMilestoneStreakRef.current = state.streak;
      setStreakMilestonePop(true);
      audioEngine.playMilestoneTick(
        state.streak,
        settings.audio.switchProfile,
        settings.audio.switchVolume
      );
      const timer = window.setTimeout(() => setStreakMilestonePop(false), 240);
      return () => window.clearTimeout(timer);
    }
  }, [
    state.streak,
    settings.audio.switchProfile,
    settings.audio.switchVolume,
  ]);

  // Cleanly expire keycap flash
  useEffect(() => {
    if (!pressedKey) return;
    const timer = window.setTimeout(() => {
      setPressedKey(null);
      setLastErrorKey(null);
    }, 115);
    return () => window.clearTimeout(timer);
  }, [pressedKey]);

  // Cleanly expire Tab+Enter chord state
  useEffect(() => {
    if (chordState !== 'tab_armed') return;
    const timer = window.setTimeout(() => setChordState('idle'), 1500);
    return () => window.clearTimeout(timer);
  }, [chordState]);

  // 250ms session ticker while running
  useEffect(() => {
    if (state.phase.status !== 'running') return;
    const interval = window.setInterval(() => {
      dispatch({
        type: 'TICK',
        nowMs: performance.now(),
        modeBestWpm,
        overallBestWpm,
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [state.phase.status, modeBestWpm, overallBestWpm]);

  // Smooth Ghost Pace-Maker animation loop
  useEffect(() => {
    if (
      state.phase.status !== 'running' ||
      !settings.ghostEnabled ||
      modeBestWpm <= 0
    ) {
      setGhostCharTarget(null);
      setGhostCaretPos(null);
      return;
    }

    let rafId = 0;
    const startedAt = state.phase.startedAtMs;
    const words = state.targetWords;
    const charsPerSec = (modeBestWpm * 5) / 60;

    const tick = () => {
      const elapsed = Math.max(0, (performance.now() - startedAt) / 1000);
      let remainingChars = Math.floor(elapsed * charsPerSec);

      let wIdx = 0;
      let cIdx = 0;
      while (wIdx < words.length) {
        const len = words[wIdx].length;
        if (remainingChars <= len) {
          cIdx = remainingChars;
          break;
        }
        remainingChars -= len + 1;
        wIdx++;
      }

      if (wIdx >= words.length) {
        wIdx = words.length - 1;
        cIdx = words[wIdx]?.length ?? 0;
      }

      setGhostCharTarget((prev) =>
        prev && prev.wordIdx === wIdx && prev.charIdx === cIdx
          ? prev
          : { wordIdx: wIdx, charIdx: cIdx }
      );

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [
    state.phase,
    state.targetWords,
    settings.ghostEnabled,
    modeBestWpm,
  ]);

  // Measure active user caret & ghost caret coordinates
  useLayoutEffect(() => {
    const targetEl = activeCharRef.current;
    const containerEl = wordsContainerRef.current;
    if (targetEl && containerEl) {
      const x = targetEl.offsetLeft;
      const y = targetEl.offsetTop;
      const h = targetEl.offsetHeight || 28;
      setCaretPos({ x, y, h });

      const lineHeight = h + 12;
      if (y > lineHeight * 1.4) {
        setScrollOffsetY(y - lineHeight);
      } else {
        setScrollOffsetY(0);
      }
    }

    const ghostEl = ghostCharRef.current;
    if (
      ghostEl &&
      settings.ghostEnabled &&
      state.phase.status === 'running'
    ) {
      setGhostCaretPos({
        x: ghostEl.offsetLeft,
        y: ghostEl.offsetTop,
        h: ghostEl.offsetHeight || 28,
      });
    } else {
      setGhostCaretPos(null);
    }
  }, [
    state.typedWords,
    state.wordIndex,
    state.targetWords,
    state.phase.status,
    settings.fontSize,
    settings.ghostEnabled,
    ghostCharTarget,
  ]);

  // Global keyboard shortcuts (Tab + Enter quick restart, Esc reset)
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (isAudioPanelOpen) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        setChordState('tab_armed');
        return;
      }

      if (e.key === 'Enter' && chordState === 'tab_armed') {
        e.preventDefault();
        setChordState('idle');
        dispatch({ type: 'RESET', keepSamePrompt: false });
        return;
      }

      if (e.key === 'Escape' && state.phase.status !== 'finished') {
        e.preventDefault();
        setChordState('idle');
        dispatch({ type: 'RESET', keepSamePrompt: false });
      }
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [isAudioPanelOpen, chordState, state.phase.status]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isAudioPanelOpen || state.phase.status === 'finished') return;
    if (e.metaKey || e.altKey) return;

    const nowMs = performance.now();

    if (e.key === 'Backspace') {
      e.preventDefault();
      audioEngine.playKeyClick(
        'Backspace',
        settings.audio.switchProfile,
        settings.audio.switchVolume,
        false
      );
      setPressedKey('Backspace');
      setLastErrorKey(null);
      dispatch({ type: 'INPUT_BACKSPACE', clearWord: e.ctrlKey });
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      const currWord = state.typedWords[state.wordIndex] ?? '';
      if (currWord.length === 0) return;

      audioEngine.playKeyClick(
        ' ',
        settings.audio.switchProfile,
        settings.audio.switchVolume,
        false
      );
      setPressedKey(' ');
      setLastErrorKey(null);
      dispatch({
        type: 'INPUT_SPACE',
        nowMs,
        modeBestWpm,
        overallBestWpm,
      });
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey) {
      e.preventDefault();
      const currWord = state.typedWords[state.wordIndex] ?? '';
      const targetWord = state.targetWords[state.wordIndex] ?? '';
      if (currWord.length >= targetWord.length + 8) return;

      const expectedChar = targetWord[currWord.length];
      const isCorrect = expectedChar !== undefined && e.key === expectedChar;

      audioEngine.playKeyClick(
        e.key,
        settings.audio.switchProfile,
        settings.audio.switchVolume,
        !isCorrect
      );
      setPressedKey(e.key);
      setLastErrorKey(isCorrect ? null : e.key);
      dispatch({
        type: 'INPUT_CHAR',
        char: e.key,
        nowMs,
        modeBestWpm,
        overallBestWpm,
      });
    }
  };

  const fontSizeClass = useMemo(() => {
    if (settings.fontSize === 'sm') return 'text-xl leading-[2.3rem]';
    if (settings.fontSize === 'lg') return 'text-[1.7rem] leading-[2.9rem]';
    return 'text-2xl leading-[2.6rem]';
  }, [settings.fontSize]);

  const caretBoxHeight =
    settings.fontSize === 'sm' ? 24 : settings.fontSize === 'lg' ? 34 : 28;

  if (state.phase.status === 'finished') {
    return (
      <div className="py-6">
        <ResultsSummary
          session={state.phase.result}
          dailyStreak={dailyStreak}
          onNextTest={() => dispatch({ type: 'RESET', keepSamePrompt: false })}
          onRetrySame={() => dispatch({ type: 'RESET', keepSamePrompt: true })}
          onDrillWeakKeys={(keys) =>
            dispatch({
              type: 'CONFIGURE',
              config: { mode: 'weak-keys', targetKeys: keys },
            })
          }
        />
      </div>
    );
  }

  const timerDisplay =
    state.config.mode === 'timed'
      ? state.phase.status === 'running'
        ? `${state.phase.timeLeft}s`
        : `${state.config.duration}s`
      : state.phase.status === 'running'
        ? `${state.phase.elapsedSec}s`
        : '0s';

  const streakLabel =
    dailyStreak.currentStreak > 0
      ? dailyStreak.todaySessions > 0
        ? `${dailyStreak.currentStreak}-day streak · Today complete`
        : `${dailyStreak.currentStreak}-day streak`
      : 'Start daily streak today';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-4">
      {/* Compact Workspace Config Strip */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 transition-opacity duration-200 ${
          state.phase.status === 'running'
            ? 'opacity-35 hover:opacity-100'
            : 'opacity-100'
        }`}
      >
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-xl p-1.5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'CONFIGURE',
                config: {
                  mode: 'timed',
                  duration:
                    state.config.mode === 'timed' ? state.config.duration : 30,
                  punctuation:
                    state.config.mode === 'timed'
                      ? state.config.punctuation
                      : false,
                  numbers:
                    state.config.mode === 'timed'
                      ? state.config.numbers
                      : false,
                },
              })
            }
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor:
                state.config.mode === 'timed' ? 'var(--accent)' : 'transparent',
              color:
                state.config.mode === 'timed'
                  ? 'var(--accent-ink)'
                  : 'var(--ink-muted)',
            }}
          >
            Timed
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'CONFIGURE',
                config: {
                  mode: 'quote',
                  length:
                    state.config.mode === 'quote'
                      ? state.config.length
                      : 'medium',
                  quote: pickRandomQuote(
                    state.config.mode === 'quote'
                      ? state.config.length
                      : 'medium'
                  ),
                },
              })
            }
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor:
                state.config.mode === 'quote' ? 'var(--accent)' : 'transparent',
              color:
                state.config.mode === 'quote'
                  ? 'var(--accent-ink)'
                  : 'var(--ink-muted)',
            }}
          >
            Quotes
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'CONFIGURE',
                config: {
                  mode: 'weak-keys',
                  targetKeys: getTopWeakKeys(keyStats, 4),
                },
              })
            }
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor:
                state.config.mode === 'weak-keys'
                  ? 'var(--accent)'
                  : 'transparent',
              color:
                state.config.mode === 'weak-keys'
                  ? 'var(--accent-ink)'
                  : 'var(--ink-muted)',
            }}
          >
            Weak Keys
          </button>

          <span
            className="mx-1 h-4 w-px"
            style={{ backgroundColor: 'var(--border-hairline)' }}
            aria-hidden="true"
          />

          {state.config.mode === 'timed' && (
            <>
              {TIMED_OPTIONS.map((sec) => {
                const isSelected =
                  state.config.mode === 'timed' && state.config.duration === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: 'CONFIGURE',
                        config: {
                          mode: 'timed',
                          duration: sec,
                          punctuation:
                            state.config.mode === 'timed'
                              ? state.config.punctuation
                              : false,
                          numbers:
                            state.config.mode === 'timed'
                              ? state.config.numbers
                              : false,
                        },
                      })
                    }
                    className="font-mono-typing cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap tabular-nums"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--bg-surface-alt)'
                        : 'transparent',
                      color: isSelected
                        ? 'var(--ink-primary)'
                        : 'var(--ink-muted)',
                    }}
                  >
                    {sec}s
                  </button>
                );
              })}
              <span
                className="mx-1 h-4 w-px"
                style={{ backgroundColor: 'var(--border-hairline)' }}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => {
                  if (state.config.mode !== 'timed') return;
                  dispatch({
                    type: 'CONFIGURE',
                    config: {
                      ...state.config,
                      punctuation: !state.config.punctuation,
                    },
                  });
                }}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: state.config.punctuation
                    ? 'var(--bg-surface-alt)'
                    : 'transparent',
                  color: state.config.punctuation
                    ? 'var(--ink-primary)'
                    : 'var(--ink-muted)',
                }}
              >
                Punctuation
              </button>
              <button
                type="button"
                onClick={() => {
                  if (state.config.mode !== 'timed') return;
                  dispatch({
                    type: 'CONFIGURE',
                    config: {
                      ...state.config,
                      numbers: !state.config.numbers,
                    },
                  });
                }}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: state.config.numbers
                    ? 'var(--bg-surface-alt)'
                    : 'transparent',
                  color: state.config.numbers
                    ? 'var(--ink-primary)'
                    : 'var(--ink-muted)',
                }}
              >
                Numbers
              </button>
            </>
          )}

          {state.config.mode === 'quote' &&
            QUOTE_LENGTHS.map((len) => (
              <button
                key={len}
                type="button"
                onClick={() =>
                  dispatch({
                    type: 'CONFIGURE',
                    config: {
                      mode: 'quote',
                      length: len,
                      quote: pickRandomQuote(len),
                    },
                  })
                }
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize whitespace-nowrap"
                style={{
                  backgroundColor:
                    state.config.mode === 'quote' && state.config.length === len
                      ? 'var(--bg-surface-alt)'
                      : 'transparent',
                  color:
                    state.config.mode === 'quote' && state.config.length === len
                      ? 'var(--ink-primary)'
                      : 'var(--ink-muted)',
                }}
              >
                {len}
              </button>
            ))}

          {state.config.mode === 'weak-keys' && (
            <span
              className="font-mono-typing px-2 text-xs"
              style={{ color: 'var(--ink-muted)' }}
            >
              {state.config.targetKeys.length > 0
                ? `Focus: ${state.config.targetKeys
                    .map((k) => k.toUpperCase())
                    .join(' · ')}`
                : 'Balanced Drill'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {modeBestWpm > 0 && (
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  ghostEnabled: !settings.ghostEnabled,
                })
              }
              className="font-mono-typing cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap tabular-nums"
              style={{
                backgroundColor: settings.ghostEnabled
                  ? 'var(--bg-surface-alt)'
                  : 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)',
                color: settings.ghostEnabled
                  ? 'var(--ink-primary)'
                  : 'var(--ink-muted)',
              }}
            >
              {settings.ghostEnabled
                ? `Ghost: ${modeBestWpm} WPM`
                : 'Ghost: Off'}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                showKeyboard: !settings.showKeyboard,
              })
            }
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-hairline)',
              color: 'var(--ink-muted)',
            }}
          >
            {settings.showKeyboard ? 'Hide Keys' : 'Show Keys'}
          </button>

          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET', keepSamePrompt: false })}
            aria-label="Restart test"
            className="keycap-alpha flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Live Telemetry HUD */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 px-1">
        <div className="flex items-baseline gap-8">
          <div>
            <span
              className="mr-2 text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              {state.config.mode === 'timed' ? 'Time' : 'Elapsed'}
            </span>
            <span
              className="font-mono-typing text-2xl font-bold tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {timerDisplay}
            </span>
          </div>

          <div>
            <span
              className="mr-2 text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              WPM
            </span>
            <span className="font-mono-typing text-2xl font-bold tabular-nums">
              {state.liveWpm}
            </span>
          </div>

          <div>
            <span
              className="mr-2 text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              Accuracy
            </span>
            <span className="font-mono-typing text-2xl font-bold tabular-nums">
              {state.liveAccuracy}%
            </span>
          </div>

          <div>
            <span
              className="mr-2 text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              Streak
            </span>
            <span
              className={`font-mono-typing inline-block text-2xl font-bold tabular-nums ${
                streakMilestonePop ? 'streak-milestone-pop' : ''
              }`}
              style={{
                color: state.streak >= 25 ? 'var(--accent)' : 'var(--ink-primary)',
              }}
            >
              {state.streak}
            </span>
          </div>
        </div>

        <span
          className="font-mono-typing hidden text-xs tabular-nums sm:inline"
          style={{ color: 'var(--ink-muted)' }}
        >
          {state.phase.status === 'idle' ? streakLabel : 'Tab + Enter to reset'}
        </span>
      </div>

      {/* Main Tactile Typing Canvas */}
      <div
        onClick={focusCanvas}
        className="relative cursor-text rounded-2xl px-8 py-7"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        <input
          ref={hiddenInputRef}
          type="text"
          aria-label="Typing input"
          value=""
          onChange={() => {}}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="pointer-events-none absolute top-0 left-0 h-0 w-0 opacity-0"
        />

        <div
          className={`relative overflow-hidden ${
            state.config.mode === 'timed' ? 'h-[8.2rem]' : 'min-h-[8.2rem]'
          }`}
        >
          <div
            ref={wordsContainerRef}
            className={`font-mono-typing relative flex flex-wrap gap-x-[0.65ch] gap-y-3 select-none transition-transform duration-150 ${fontSizeClass}`}
            style={{
              transform: `translate3d(0, -${scrollOffsetY}px, 0)`,
            }}
          >
            {ghostCaretPos && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 z-10 transition-transform duration-100 ease-linear"
                style={{
                  transform: `translate3d(${ghostCaretPos.x}px, ${ghostCaretPos.y + 3}px, 0)`,
                  width: '2px',
                  height: `${caretBoxHeight}px`,
                  backgroundColor: 'var(--ink-muted)',
                  opacity: 0.45,
                }}
              >
                <span
                  className="font-mono-typing absolute -top-3.5 -left-1.5 text-[9px] font-semibold tracking-tight"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  PB
                </span>
              </span>
            )}

            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 z-20 transition-transform duration-75 ease-out"
              style={{
                transform: `translate3d(${caretPos.x}px, ${caretPos.y + 3}px, 0)`,
                width: settings.caretStyle === 'line' ? '2.5px' : '0.62ch',
                height:
                  settings.caretStyle === 'underline'
                    ? '3px'
                    : `${caretBoxHeight}px`,
                marginTop:
                  settings.caretStyle === 'underline'
                    ? `${caretBoxHeight - 2}px`
                    : '0px',
                backgroundColor: 'var(--accent)',
                opacity: settings.caretStyle === 'block' ? 0.28 : 1,
                borderRadius: '1px',
              }}
            />

            {state.targetWords.map((word, wIdx) => {
              const typed = state.typedWords[wIdx] ?? '';
              const isPast = wIdx < state.wordIndex;
              const isCurrent = wIdx === state.wordIndex;
              const extraChars =
                typed.length > word.length ? typed.slice(word.length) : '';
              const hasWordError = isPast && typed !== word;
              const isJustSettled = state.settledWordIndex === wIdx;

              return (
                <span
                  key={`${wIdx}-${word}`}
                  className={`inline-flex items-center ${
                    isJustSettled ? 'word-settled' : ''
                  }`}
                  style={{
                    textDecoration: hasWordError ? 'underline' : 'none',
                    textDecorationColor: 'var(--error)',
                    textUnderlineOffset: '5px',
                  }}
                >
                  {word.split('').map((char, cIdx) => {
                    const typedChar = typed[cIdx];
                    const isCaretTarget = isCurrent && cIdx === typed.length;
                    const isGhostTarget =
                      ghostCharTarget?.wordIdx === wIdx &&
                      ghostCharTarget?.charIdx === cIdx;

                    let charColor = 'var(--ink-upcoming)';
                    let bg = 'transparent';
                    if (typedChar !== undefined) {
                      if (typedChar === char) {
                        charColor = 'var(--ink-primary)';
                      } else {
                        charColor = 'var(--error)';
                        bg = 'var(--error-bg)';
                      }
                    }

                    return (
                      <span
                        key={cIdx}
                        ref={(el) => {
                          if (isCaretTarget) activeCharRef.current = el;
                          if (isGhostTarget) ghostCharRef.current = el;
                        }}
                        className="inline-block rounded-[2px]"
                        style={{ color: charColor, backgroundColor: bg }}
                      >
                        {char}
                      </span>
                    );
                  })}

                  {extraChars.split('').map((exChar, eIdx) => (
                    <span
                      key={`ex-${eIdx}`}
                      className="inline-block rounded-[2px]"
                      style={{
                        color: 'var(--error)',
                        backgroundColor: 'var(--error-bg)',
                      }}
                    >
                      {exChar}
                    </span>
                  ))}

                  {((isCurrent && typed.length >= word.length) ||
                    (ghostCharTarget?.wordIdx === wIdx &&
                      ghostCharTarget?.charIdx >= word.length)) && (
                    <span
                      ref={(el) => {
                        if (isCurrent && typed.length >= word.length) {
                          activeCharRef.current = el;
                        }
                        if (
                          ghostCharTarget?.wordIdx === wIdx &&
                          ghostCharTarget?.charIdx >= word.length
                        ) {
                          ghostCharRef.current = el;
                        }
                      }}
                      className="inline-block w-[0.01px]"
                      aria-hidden="true"
                    >
                      &#8203;
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {state.config.mode === 'quote' && (
          <div
            className="mt-4 border-t pt-3 text-right text-xs font-medium"
            style={{
              borderColor: 'var(--border-hairline)',
              color: 'var(--ink-muted)',
            }}
          >
            — {state.config.quote.author}
          </div>
        )}
      </div>

      {/* Collapsible On-Screen Mechanical Keyboard */}
      {settings.showKeyboard && (
        <div
          className={`pt-1 transition-opacity duration-200 ${
            state.phase.status === 'running' ? 'opacity-90' : 'opacity-100'
          }`}
        >
          <TactileKeyboard
            pressedKey={pressedKey}
            lastErrorKey={lastErrorKey}
            onKeyClick={(keyId) => {
              audioEngine.playKeyClick(
                keyId,
                settings.audio.switchProfile,
                settings.audio.switchVolume,
                false
              );
              setPressedKey(keyId);
              setLastErrorKey(null);
              focusCanvas();
            }}
          />
        </div>
      )}
    </div>
  );
}
