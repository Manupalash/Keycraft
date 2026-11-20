import { RotateCcw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { generateWordList, pickRandomQuote } from '../data/wordsAndQuotes';
import {
  AppSettings,
  QuoteItem,
  QuoteLength,
  SecondSnapshot,
  SessionRecord,
  TimedDuration,
  TypingMode,
} from '../types/typing';
import { audioEngine } from '../utils/audioEngine';
import { calculateConsistency } from '../utils/storage';
import { ResultsSummary } from './ResultsSummary';
import { TactileKeyboard } from './TactileKeyboard';

type TestPhase = 'idle' | 'running' | 'finished';

interface PracticeViewProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  isAudioPanelOpen: boolean;
  bestWpm: number;
  onSessionComplete: (
    session: SessionRecord,
    keyDelta: Record<string, { presses: number; errors: number; totalLatencyMs: number }>
  ) => void;
  onRunningChange: (isRunning: boolean) => void;
}

const TIMED_OPTIONS: TimedDuration[] = [15, 30, 60, 120];
const QUOTE_LENGTHS: QuoteLength[] = ['short', 'medium', 'long'];

export function PracticeView({
  settings,
  onUpdateSettings,
  isAudioPanelOpen,
  bestWpm,
  onSessionComplete,
  onRunningChange,
}: PracticeViewProps) {
  const [mode, setMode] = useState<TypingMode>('timed');
  const [duration, setDuration] = useState<TimedDuration>(30);
  const [quoteLength, setQuoteLength] = useState<QuoteLength>('medium');
  const [includePunctuation, setIncludePunctuation] = useState(false);
  const [includeNumbers, setIncludeNumbers] = useState(false);

  const [targetWords, setTargetWords] = useState<string[]>(() =>
    generateWordList(90, false, false)
  );
  const [activeQuote, setActiveQuote] = useState<QuoteItem | null>(null);
  const [typedWords, setTypedWords] = useState<string[]>(['']);
  const [wordIndex, setWordIndex] = useState(0);

  const [phase, setPhase] = useState<TestPhase>('idle');
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [liveWpm, setLiveWpm] = useState<number>(0);
  const [liveAccuracy, setLiveAccuracy] = useState<number>(100);
  const [streak, setStreak] = useState<number>(0);

  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [lastErrorKey, setLastErrorKey] = useState<string | null>(null);
  const [completedSession, setCompletedSession] =
    useState<SessionRecord | null>(null);
  const [tabArmed, setTabArmed] = useState(false);

  const [caretPos, setCaretPos] = useState<{ x: number; y: number; h: number }>({
    x: 0,
    y: 0,
    h: 28,
  });
  const [scrollOffsetY, setScrollOffsetY] = useState(0);

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const wordsContainerRef = useRef<HTMLDivElement>(null);
  const activeCharRef = useRef<HTMLSpanElement | null>(null);
  const keyPressTimerRef = useRef<number | null>(null);

  // Mutable telemetry refs so timers never read stale React closures
  const startTimeRef = useRef<number>(0);
  const lastKeyTimeRef = useRef<number>(0);
  const totalPressesRef = useRef<number>(0);
  const correctPressesRef = useRef<number>(0);
  const errorsInCurrentSecRef = useRef<number>(0);
  const timelineRef = useRef<SecondSnapshot[]>([]);
  const keyDeltaRef = useRef<
    Record<string, { presses: number; errors: number; totalLatencyMs: number }>
  >({});
  const typedWordsRef = useRef<string[]>(['']);
  const targetWordsRef = useRef<string[]>(targetWords);
  const wordIndexRef = useRef<number>(0);
  const phaseRef = useRef<TestPhase>('idle');

  typedWordsRef.current = typedWords;
  targetWordsRef.current = targetWords;
  wordIndexRef.current = wordIndex;
  phaseRef.current = phase;

  useEffect(() => {
    onRunningChange(phase === 'running');
  }, [phase, onRunningChange]);

  const focusCanvas = useCallback(() => {
    if (!isAudioPanelOpen && phaseRef.current !== 'finished') {
      hiddenInputRef.current?.focus({ preventScroll: true });
    }
  }, [isAudioPanelOpen]);

  useEffect(() => {
    focusCanvas();
  }, [focusCanvas, mode, duration, quoteLength, phase]);

  const resetSession = useCallback(
    (keepSamePrompt = false) => {
      if (!keepSamePrompt) {
        if (mode === 'timed') {
          const nextWords = generateWordList(
            90,
            includePunctuation,
            includeNumbers
          );
          setTargetWords(nextWords);
          targetWordsRef.current = nextWords;
          setActiveQuote(null);
        } else {
          const q = pickRandomQuote(quoteLength, activeQuote?.id);
          const words = q.text.split(' ');
          setActiveQuote(q);
          setTargetWords(words);
          targetWordsRef.current = words;
        }
      }

      setTypedWords(['']);
      typedWordsRef.current = [''];
      setWordIndex(0);
      wordIndexRef.current = 0;
      setPhase('idle');
      phaseRef.current = 'idle';
      setTimeLeft(duration);
      setElapsedSec(0);
      setLiveWpm(0);
      setLiveAccuracy(100);
      setStreak(0);
      setScrollOffsetY(0);
      setCompletedSession(null);

      startTimeRef.current = 0;
      lastKeyTimeRef.current = 0;
      totalPressesRef.current = 0;
      correctPressesRef.current = 0;
      errorsInCurrentSecRef.current = 0;
      timelineRef.current = [];
      keyDeltaRef.current = {};

      setTimeout(() => {
        hiddenInputRef.current?.focus({ preventScroll: true });
      }, 0);
    },
    [mode, duration, quoteLength, includePunctuation, includeNumbers, activeQuote?.id]
  );

  // Re-initialize prompt when mode/options change while not finished
  const handleSelectMode = (nextMode: TypingMode) => {
    setMode(nextMode);
    if (nextMode === 'timed') {
      const words = generateWordList(90, includePunctuation, includeNumbers);
      setTargetWords(words);
      targetWordsRef.current = words;
      setActiveQuote(null);
    } else {
      const q = pickRandomQuote(quoteLength);
      const words = q.text.split(' ');
      setActiveQuote(q);
      setTargetWords(words);
      targetWordsRef.current = words;
    }
    setTypedWords(['']);
    typedWordsRef.current = [''];
    setWordIndex(0);
    wordIndexRef.current = 0;
    setPhase('idle');
    phaseRef.current = 'idle';
    setTimeLeft(duration);
    setElapsedSec(0);
    setLiveWpm(0);
    setLiveAccuracy(100);
    setStreak(0);
    setScrollOffsetY(0);
    setCompletedSession(null);
    startTimeRef.current = 0;
    lastKeyTimeRef.current = 0;
    totalPressesRef.current = 0;
    correctPressesRef.current = 0;
    errorsInCurrentSecRef.current = 0;
    timelineRef.current = [];
    keyDeltaRef.current = {};
  };

  const handleSelectDuration = (nextDur: TimedDuration) => {
    setDuration(nextDur);
    setTimeLeft(nextDur);
    if (mode === 'timed') {
      const words = generateWordList(90, includePunctuation, includeNumbers);
      setTargetWords(words);
      targetWordsRef.current = words;
    }
    setTypedWords(['']);
    typedWordsRef.current = [''];
    setWordIndex(0);
    wordIndexRef.current = 0;
    setPhase('idle');
    phaseRef.current = 'idle';
    setElapsedSec(0);
    setLiveWpm(0);
    setLiveAccuracy(100);
    setStreak(0);
    setScrollOffsetY(0);
    setCompletedSession(null);
    startTimeRef.current = 0;
    totalPressesRef.current = 0;
    correctPressesRef.current = 0;
    errorsInCurrentSecRef.current = 0;
    timelineRef.current = [];
    keyDeltaRef.current = {};
  };

  const handleSelectQuoteLength = (nextLen: QuoteLength) => {
    setQuoteLength(nextLen);
    const q = pickRandomQuote(nextLen);
    const words = q.text.split(' ');
    setActiveQuote(q);
    setTargetWords(words);
    targetWordsRef.current = words;
    setTypedWords(['']);
    typedWordsRef.current = [''];
    setWordIndex(0);
    wordIndexRef.current = 0;
    setPhase('idle');
    phaseRef.current = 'idle';
    setElapsedSec(0);
    setLiveWpm(0);
    setLiveAccuracy(100);
    setStreak(0);
    setScrollOffsetY(0);
    setCompletedSession(null);
    startTimeRef.current = 0;
    totalPressesRef.current = 0;
    correctPressesRef.current = 0;
    errorsInCurrentSecRef.current = 0;
    timelineRef.current = [];
    keyDeltaRef.current = {};
  };

  const computeCharTallies = useCallback(() => {
    const tWords = targetWordsRef.current;
    const uWords = typedWordsRef.current;
    let correct = 0;
    let incorrect = 0;
    let extra = 0;

    for (let w = 0; w < uWords.length; w++) {
      const target = tWords[w] ?? '';
      const typed = uWords[w] ?? '';
      const maxLen = Math.max(target.length, typed.length);

      for (let c = 0; c < maxLen; c++) {
        if (c < typed.length && c < target.length) {
          if (typed[c] === target[c]) {
            correct++;
          } else {
            incorrect++;
          }
        } else if (c >= target.length && c < typed.length) {
          extra++;
        }
      }
      // Count space between completed words if previous word was typed cleanly
      if (w < uWords.length - 1) {
        if (typed === target) {
          correct++;
        } else {
          incorrect++;
        }
      }
    }

    return { correct, incorrect, extra };
  }, []);

  const finishTest = useCallback(() => {
    if (phaseRef.current === 'finished') return;
    setPhase('finished');
    phaseRef.current = 'finished';

    const now = performance.now();
    const actualElapsedSec =
      mode === 'timed'
        ? duration
        : Math.max(1, Math.round((now - startTimeRef.current) / 1000));

    const { correct, incorrect, extra } = computeCharTallies();
    const minutes = Math.max(actualElapsedSec / 60, 1 / 60);
    const netWpm = Math.max(0, Math.round(correct / 5 / minutes));
    const rawWpm = Math.max(
      netWpm,
      Math.round(totalPressesRef.current / 5 / minutes)
    );
    const accuracy =
      totalPressesRef.current > 0
        ? Math.round((correctPressesRef.current / totalPressesRef.current) * 100)
        : 100;

    // Ensure at least one final snapshot exists for very fast short quotes
    const snapshots = [...timelineRef.current];
    if (
      snapshots.length === 0 ||
      snapshots[snapshots.length - 1].second < actualElapsedSec
    ) {
      snapshots.push({
        second: actualElapsedSec,
        wpm: netWpm,
        rawWpm,
        errors: errorsInCurrentSecRef.current,
      });
    }

    const consistency = calculateConsistency(snapshots.map((s) => s.rawWpm));
    const weakKeys = Object.entries(keyDeltaRef.current)
      .filter(([, s]) => s.errors > 0)
      .map(([k, s]) => ({ key: k, errors: s.errors, presses: s.presses }))
      .sort((a, b) => b.errors - a.errors);

    const isPersonalBest = netWpm > bestWpm && netWpm > 0;
    const modeLabel =
      mode === 'timed' ? `Timed ${duration}s` : `Quote · ${quoteLength}`;

    const record: SessionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      mode,
      modeLabel,
      durationSec: actualElapsedSec,
      wpm: netWpm,
      rawWpm,
      accuracy,
      consistency,
      correctChars: correct,
      incorrectChars: incorrect,
      extraChars: extra,
      timeline: snapshots,
      weakKeys,
      isPersonalBest,
    };

    setCompletedSession(record);
    onSessionComplete(record, keyDeltaRef.current);
  }, [
    mode,
    duration,
    quoteLength,
    bestWpm,
    computeCharTallies,
    onSessionComplete,
  ]);

  // 1-second precision timer loop during running state
  useEffect(() => {
    if (phase !== 'running') return;

    const interval = window.setInterval(() => {
      const now = performance.now();
      const elapsedMs = now - startTimeRef.current;
      const sec = Math.max(1, Math.floor(elapsedMs / 1000));
      setElapsedSec(sec);

      const { correct } = computeCharTallies();
      const minutes = Math.max(elapsedMs / 60000, 1 / 60);
      const currentNetWpm = Math.max(0, Math.round(correct / 5 / minutes));
      const currentRawWpm = Math.max(
        currentNetWpm,
        Math.round(totalPressesRef.current / 5 / minutes)
      );

      setLiveWpm(currentNetWpm);

      if (
        timelineRef.current.length === 0 ||
        timelineRef.current[timelineRef.current.length - 1].second < sec
      ) {
        timelineRef.current.push({
          second: sec,
          wpm: currentNetWpm,
          rawWpm: currentRawWpm,
          errors: errorsInCurrentSecRef.current,
        });
        errorsInCurrentSecRef.current = 0;
      }

      if (mode === 'timed') {
        const remaining = Math.max(0, duration - sec);
        setTimeLeft(remaining);
        if (remaining <= 0) {
          finishTest();
        }
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [phase, mode, duration, computeCharTallies, finishTest]);

  // Smooth caret position and 3-line auto-scroll measurement
  useLayoutEffect(() => {
    const targetEl = activeCharRef.current;
    const containerEl = wordsContainerRef.current;
    if (!targetEl || !containerEl) return;

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
  }, [typedWords, wordIndex, targetWords, settings.fontSize, phase]);

  const flashKeycap = (key: string, isError: boolean) => {
    setPressedKey(key);
    setLastErrorKey(isError ? key : null);
    if (keyPressTimerRef.current) {
      window.clearTimeout(keyPressTimerRef.current);
    }
    keyPressTimerRef.current = window.setTimeout(() => {
      setPressedKey(null);
      setLastErrorKey(null);
    }, 115);
  };

  // Global keyboard shortcuts (Tab + Enter quick restart, Esc reset)
  useEffect(() => {
    const onWindowKeyDown = (e: KeyboardEvent) => {
      if (isAudioPanelOpen) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        setTabArmed(true);
        window.setTimeout(() => setTabArmed(false), 1500);
        return;
      }

      if (e.key === 'Enter' && tabArmed) {
        e.preventDefault();
        setTabArmed(false);
        resetSession(false);
        return;
      }

      if (e.key === 'Escape' && phaseRef.current !== 'finished') {
        e.preventDefault();
        resetSession(false);
      }
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => window.removeEventListener('keydown', onWindowKeyDown);
  }, [isAudioPanelOpen, tabArmed, resetSession]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isAudioPanelOpen || phaseRef.current === 'finished') return;
    if (e.metaKey || e.altKey) return;

    const now = performance.now();

    if (e.key === 'Backspace') {
      e.preventDefault();
      audioEngine.playKeyClick(
        'Backspace',
        settings.audio.switchProfile,
        settings.audio.switchVolume,
        false
      );
      flashKeycap('Backspace', false);

      const currentTyped = [...typedWordsRef.current];
      const idx = wordIndexRef.current;
      const currWord = currentTyped[idx] ?? '';

      if (e.ctrlKey) {
        currentTyped[idx] = '';
        setTypedWords(currentTyped);
        return;
      }

      if (currWord.length > 0) {
        currentTyped[idx] = currWord.slice(0, -1);
        setTypedWords(currentTyped);
      } else if (idx > 0 && currentTyped[idx - 1] !== targetWordsRef.current[idx - 1]) {
        // Step back only into mistyped previous words
        currentTyped.pop();
        setTypedWords(currentTyped);
        setWordIndex(idx - 1);
      }
      return;
    }

    // Spacebar advances to next word
    if (e.key === ' ') {
      e.preventDefault();
      const idx = wordIndexRef.current;
      const currentTyped = [...typedWordsRef.current];
      const currWord = currentTyped[idx] ?? '';
      if (currWord.length === 0) return;

      if (phaseRef.current === 'idle') {
        setPhase('running');
        phaseRef.current = 'running';
        startTimeRef.current = now;
        lastKeyTimeRef.current = now;
      }

      const targetWord = targetWordsRef.current[idx] ?? '';
      const isSpaceClean = currWord === targetWord;

      totalPressesRef.current += 1;
      if (isSpaceClean) {
        correctPressesRef.current += 1;
        setStreak((s) => s + 1);
      } else {
        errorsInCurrentSecRef.current += 1;
        setStreak(0);
      }

      const latency = lastKeyTimeRef.current
        ? Math.min(1800, Math.round(now - lastKeyTimeRef.current))
        : 120;
      lastKeyTimeRef.current = now;
      const spaceStat = keyDeltaRef.current[' '] ?? {
        presses: 0,
        errors: 0,
        totalLatencyMs: 0,
      };
      keyDeltaRef.current[' '] = {
        presses: spaceStat.presses + 1,
        errors: spaceStat.errors + (isSpaceClean ? 0 : 1),
        totalLatencyMs: spaceStat.totalLatencyMs + latency,
      };

      audioEngine.playKeyClick(
        ' ',
        settings.audio.switchProfile,
        settings.audio.switchVolume,
        false
      );
      flashKeycap(' ', false);

      setLiveAccuracy(
        Math.round((correctPressesRef.current / totalPressesRef.current) * 100)
      );

      // Quote ends when completing last word
      if (mode === 'quote' && idx >= targetWordsRef.current.length - 1) {
        finishTest();
        return;
      }

      // Timed mode appends fresh words smoothly as you near the buffer end
      if (mode === 'timed' && idx > targetWordsRef.current.length - 30) {
        const extra = generateWordList(60, includePunctuation, includeNumbers);
        const merged = [...targetWordsRef.current, ...extra];
        setTargetWords(merged);
        targetWordsRef.current = merged;
      }

      currentTyped.push('');
      setTypedWords(currentTyped);
      setWordIndex(idx + 1);
      return;
    }

    // Printable single character
    if (e.key.length === 1 && !e.ctrlKey) {
      e.preventDefault();

      if (phaseRef.current === 'idle') {
        setPhase('running');
        phaseRef.current = 'running';
        startTimeRef.current = now;
        lastKeyTimeRef.current = now;
      }

      const idx = wordIndexRef.current;
      const currentTyped = [...typedWordsRef.current];
      const currWord = currentTyped[idx] ?? '';
      const targetWord = targetWordsRef.current[idx] ?? '';

      if (currWord.length >= targetWord.length + 8) return;

      const expectedChar = targetWord[currWord.length];
      const isCorrect = expectedChar !== undefined && e.key === expectedChar;

      const nextWordVal = currWord + e.key;
      currentTyped[idx] = nextWordVal;
      typedWordsRef.current = currentTyped;
      setTypedWords(currentTyped);

      totalPressesRef.current += 1;
      if (isCorrect) {
        correctPressesRef.current += 1;
        setStreak((s) => s + 1);
      } else {
        errorsInCurrentSecRef.current += 1;
        setStreak(0);
      }

      const latency = lastKeyTimeRef.current
        ? Math.min(1800, Math.round(now - lastKeyTimeRef.current))
        : 120;
      lastKeyTimeRef.current = now;

      const statKey = (expectedChar ?? e.key).toLowerCase();
      const existingStat = keyDeltaRef.current[statKey] ?? {
        presses: 0,
        errors: 0,
        totalLatencyMs: 0,
      };
      keyDeltaRef.current[statKey] = {
        presses: existingStat.presses + 1,
        errors: existingStat.errors + (isCorrect ? 0 : 1),
        totalLatencyMs: existingStat.totalLatencyMs + latency,
      };

      setLiveAccuracy(
        Math.round((correctPressesRef.current / totalPressesRef.current) * 100)
      );

      audioEngine.playKeyClick(
        e.key,
        settings.audio.switchProfile,
        settings.audio.switchVolume,
        !isCorrect
      );
      flashKeycap(e.key, !isCorrect);

      // Immediate finish on final matching character of a quote
      if (
        mode === 'quote' &&
        idx === targetWordsRef.current.length - 1 &&
        nextWordVal === targetWord
      ) {
        finishTest();
      }
    }
  };

  const fontSizeClass = useMemo(() => {
    if (settings.fontSize === 'sm') return 'text-xl leading-[2.3rem]';
    if (settings.fontSize === 'lg') return 'text-[1.7rem] leading-[2.9rem]';
    return 'text-2xl leading-[2.6rem]';
  }, [settings.fontSize]);

  const caretBoxHeight =
    settings.fontSize === 'sm' ? 24 : settings.fontSize === 'lg' ? 34 : 28;

  if (phase === 'finished' && completedSession) {
    return (
      <div className="py-6">
        <ResultsSummary
          session={completedSession}
          onNextTest={() => resetSession(false)}
          onRetrySame={() => resetSession(true)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 py-4">
      {/* Compact Workspace Config Strip */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 transition-opacity duration-200 ${
          phase === 'running' ? 'opacity-35 hover:opacity-100' : 'opacity-100'
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
            onClick={() => handleSelectMode('timed')}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor:
                mode === 'timed' ? 'var(--accent)' : 'transparent',
              color:
                mode === 'timed' ? 'var(--accent-ink)' : 'var(--ink-muted)',
            }}
          >
            Timed
          </button>
          <button
            type="button"
            onClick={() => handleSelectMode('quote')}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor:
                mode === 'quote' ? 'var(--accent)' : 'transparent',
              color:
                mode === 'quote' ? 'var(--accent-ink)' : 'var(--ink-muted)',
            }}
          >
            Quotes
          </button>

          <span
            className="mx-1 h-4 w-px"
            style={{ backgroundColor: 'var(--border-hairline)' }}
            aria-hidden="true"
          />

          {mode === 'timed' ? (
            <>
              {TIMED_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleSelectDuration(sec)}
                  className="font-mono-typing cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap tabular-nums"
                  style={{
                    backgroundColor:
                      duration === sec ? 'var(--bg-surface-alt)' : 'transparent',
                    color:
                      duration === sec
                        ? 'var(--ink-primary)'
                        : 'var(--ink-muted)',
                  }}
                >
                  {sec}s
                </button>
              ))}
              <span
                className="mx-1 h-4 w-px"
                style={{ backgroundColor: 'var(--border-hairline)' }}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => {
                  const next = !includePunctuation;
                  setIncludePunctuation(next);
                  const words = generateWordList(90, next, includeNumbers);
                  setTargetWords(words);
                  targetWordsRef.current = words;
                  setTypedWords(['']);
                  setWordIndex(0);
                  setPhase('idle');
                  setTimeLeft(duration);
                }}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: includePunctuation
                    ? 'var(--bg-surface-alt)'
                    : 'transparent',
                  color: includePunctuation
                    ? 'var(--ink-primary)'
                    : 'var(--ink-muted)',
                }}
              >
                Punctuation
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !includeNumbers;
                  setIncludeNumbers(next);
                  const words = generateWordList(90, includePunctuation, next);
                  setTargetWords(words);
                  targetWordsRef.current = words;
                  setTypedWords(['']);
                  setWordIndex(0);
                  setPhase('idle');
                  setTimeLeft(duration);
                }}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: includeNumbers
                    ? 'var(--bg-surface-alt)'
                    : 'transparent',
                  color: includeNumbers
                    ? 'var(--ink-primary)'
                    : 'var(--ink-muted)',
                }}
              >
                Numbers
              </button>
            </>
          ) : (
            QUOTE_LENGTHS.map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => handleSelectQuoteLength(len)}
                className="cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize whitespace-nowrap"
                style={{
                  backgroundColor:
                    quoteLength === len
                      ? 'var(--bg-surface-alt)'
                      : 'transparent',
                  color:
                    quoteLength === len
                      ? 'var(--ink-primary)'
                      : 'var(--ink-muted)',
                }}
              >
                {len}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-2">
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
            onClick={() => resetSession(false)}
            aria-label="Restart test"
            className="keycap-alpha flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Live Telemetry HUD */}
      <div className="flex items-baseline justify-between px-1">
        <div className="flex items-baseline gap-8">
          <div>
            <span
              className="mr-2 text-xs font-medium"
              style={{ color: 'var(--ink-muted)' }}
            >
              {mode === 'timed' ? 'Time' : 'Elapsed'}
            </span>
            <span
              className="font-mono-typing text-2xl font-bold tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {mode === 'timed' ? `${timeLeft}s` : `${elapsedSec}s`}
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
              {liveWpm}
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
              {liveAccuracy}%
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
              className="font-mono-typing text-2xl font-bold tabular-nums"
              style={{
                color: streak >= 25 ? 'var(--accent)' : 'var(--ink-primary)',
              }}
            >
              {streak}
            </span>
          </div>
        </div>

        <span
          className="font-mono-typing hidden text-xs sm:inline"
          style={{ color: 'var(--ink-muted)' }}
        >
          {phase === 'idle' ? 'Type to begin' : 'Tab + Enter to reset'}
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
            mode === 'timed' ? 'h-[8.2rem]' : 'min-h-[8.2rem]'
          }`}
        >
          <div
            ref={wordsContainerRef}
            className={`font-mono-typing relative flex flex-wrap gap-x-[0.65ch] gap-y-3 select-none transition-transform duration-150 ${fontSizeClass}`}
            style={{
              transform: `translate3d(0, -${scrollOffsetY}px, 0)`,
            }}
          >
            {/* Hardware-accelerated Smooth Caret */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 z-10 transition-transform duration-75 ease-out"
              style={{
                transform: `translate3d(${caretPos.x}px, ${caretPos.y + 3}px, 0)`,
                width:
                  settings.caretStyle === 'line'
                    ? '2.5px'
                    : settings.caretStyle === 'block'
                      ? '0.62ch'
                      : '0.62ch',
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

            {targetWords.map((word, wIdx) => {
              const typed = typedWords[wIdx] ?? '';
              const isPast = wIdx < wordIndex;
              const isCurrent = wIdx === wordIndex;
              const extraChars =
                typed.length > word.length ? typed.slice(word.length) : '';
              const hasWordError = isPast && typed !== word;

              return (
                <span
                  key={`${wIdx}-${word}`}
                  className="inline-flex items-center"
                  style={{
                    textDecoration: hasWordError ? 'underline' : 'none',
                    textDecorationColor: 'var(--error)',
                    textUnderlineOffset: '5px',
                  }}
                >
                  {word.split('').map((char, cIdx) => {
                    const typedChar = typed[cIdx];
                    const isCaretTarget = isCurrent && cIdx === typed.length;

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
                        ref={isCaretTarget ? activeCharRef : undefined}
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

                  {isCurrent && typed.length >= word.length && (
                    <span
                      ref={activeCharRef}
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

        {mode === 'quote' && activeQuote && (
          <div
            className="mt-4 border-t pt-3 text-right text-xs font-medium"
            style={{
              borderColor: 'var(--border-hairline)',
              color: 'var(--ink-muted)',
            }}
          >
            — {activeQuote.author}
          </div>
        )}
      </div>

      {/* Collapsible On-Screen Mechanical Keyboard */}
      {settings.showKeyboard && (
        <div
          className={`pt-1 transition-opacity duration-200 ${
            phase === 'running' ? 'opacity-90' : 'opacity-100'
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
              flashKeycap(keyId, false);
              focusCanvas();
            }}
          />
        </div>
      )}
    </div>
  );
}
