import { RotateCcw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  generateWeakKeyDrill,
  generateWordList,
  pickRandomQuote,
} from '../data/wordsAndQuotes';
import {
  AppSettings,
  DailyStreakData,
  KeyStat,
  QuoteItem,
  QuoteLength,
  SecondSnapshot,
  SessionRecord,
  TimedDuration,
  TypingMode,
} from '../types/typing';
import { audioEngine } from '../utils/audioEngine';
import {
  calculateConsistency,
  getBestWpmForMode,
  getTopWeakKeys,
} from '../utils/storage';
import { ResultsSummary } from './ResultsSummary';
import { TactileKeyboard } from './TactileKeyboard';

type TestPhase = 'idle' | 'running' | 'finished';

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

export function PracticeView({
  settings,
  onUpdateSettings,
  isAudioPanelOpen,
  history,
  keyStats,
  dailyStreak,
  drillRequest,
  onSessionComplete,
  onRunningChange,
}: PracticeViewProps) {
  const [mode, setMode] = useState<TypingMode>('timed');
  const [duration, setDuration] = useState<TimedDuration>(30);
  const [quoteLength, setQuoteLength] = useState<QuoteLength>('medium');
  const [includePunctuation, setIncludePunctuation] = useState(false);
  const [includeNumbers, setIncludeNumbers] = useState(false);
  const [weakDrillKeys, setWeakDrillKeys] = useState<string[]>(() =>
    getTopWeakKeys(keyStats, 4)
  );

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
  const [streakMilestonePop, setStreakMilestonePop] = useState(false);
  const [settledWordIndex, setSettledWordIndex] = useState<number | null>(null);

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
  const keyPressTimerRef = useRef<number | null>(null);

  // Mutable telemetry refs so timers never read stale closures
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

  const currentModeLabel = useMemo(() => {
    if (mode === 'timed') return `Timed ${duration}s`;
    if (mode === 'quote') return `Quote · ${quoteLength}`;
    return 'Weak Keys';
  }, [mode, duration, quoteLength]);

  const modeBestWpm = useMemo(
    () => getBestWpmForMode(history, currentModeLabel),
    [history, currentModeLabel]
  );

  const overallBestWpm = useMemo(
    () => history.reduce((max, item) => Math.max(max, item.wpm), 0),
    [history]
  );

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

  const clearSessionState = useCallback(
    (nextDuration: number) => {
      setTypedWords(['']);
      typedWordsRef.current = [''];
      setWordIndex(0);
      wordIndexRef.current = 0;
      setPhase('idle');
      phaseRef.current = 'idle';
      setTimeLeft(nextDuration);
      setElapsedSec(0);
      setLiveWpm(0);
      setLiveAccuracy(100);
      setStreak(0);
      setSettledWordIndex(null);
      setGhostCharTarget(null);
      setGhostCaretPos(null);
      setScrollOffsetY(0);
      setCompletedSession(null);

      startTimeRef.current = 0;
      lastKeyTimeRef.current = 0;
      totalPressesRef.current = 0;
      correctPressesRef.current = 0;
      errorsInCurrentSecRef.current = 0;
      timelineRef.current = [];
      keyDeltaRef.current = {};
    },
    []
  );

  const launchWeakKeysDrill = useCallback(
    (keys: string[]) => {
      const target = keys.length > 0 ? keys : getTopWeakKeys(keyStats, 4);
      setMode('weak-keys');
      setWeakDrillKeys(target);
      const words = generateWeakKeyDrill(target, 35);
      setActiveQuote(null);
      setTargetWords(words);
      targetWordsRef.current = words;
      clearSessionState(duration);
      setTimeout(() => {
        hiddenInputRef.current?.focus({ preventScroll: true });
      }, 0);
    },
    [keyStats, clearSessionState, duration]
  );

  // Triggered externally from ResultsSummary or AnalyticsView
  useEffect(() => {
    if (!drillRequest) return;
    launchWeakKeysDrill(drillRequest.keys);
  }, [drillRequest, launchWeakKeysDrill]);

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
        } else if (mode === 'quote') {
          const q = pickRandomQuote(quoteLength, activeQuote?.id);
          const words = q.text.split(' ');
          setActiveQuote(q);
          setTargetWords(words);
          targetWordsRef.current = words;
        } else {
          const fallbackKeys =
            weakDrillKeys.length > 0
              ? weakDrillKeys
              : getTopWeakKeys(keyStats, 4);
          setWeakDrillKeys(fallbackKeys);
          const words = generateWeakKeyDrill(fallbackKeys, 35);
          setActiveQuote(null);
          setTargetWords(words);
          targetWordsRef.current = words;
        }
      }

      clearSessionState(duration);
      setTimeout(() => {
        hiddenInputRef.current?.focus({ preventScroll: true });
      }, 0);
    },
    [
      mode,
      duration,
      quoteLength,
      includePunctuation,
      includeNumbers,
      activeQuote?.id,
      weakDrillKeys,
      keyStats,
      clearSessionState,
    ]
  );

  const handleSelectMode = (nextMode: TypingMode) => {
    setMode(nextMode);
    if (nextMode === 'timed') {
      const words = generateWordList(90, includePunctuation, includeNumbers);
      setTargetWords(words);
      targetWordsRef.current = words;
      setActiveQuote(null);
    } else if (nextMode === 'quote') {
      const q = pickRandomQuote(quoteLength);
      const words = q.text.split(' ');
      setActiveQuote(q);
      setTargetWords(words);
      targetWordsRef.current = words;
    } else {
      const target = getTopWeakKeys(keyStats, 4);
      setWeakDrillKeys(target);
      const words = generateWeakKeyDrill(target, 35);
      setActiveQuote(null);
      setTargetWords(words);
      targetWordsRef.current = words;
    }
    clearSessionState(duration);
  };

  const handleSelectDuration = (nextDur: TimedDuration) => {
    setDuration(nextDur);
    if (mode === 'timed') {
      const words = generateWordList(90, includePunctuation, includeNumbers);
      setTargetWords(words);
      targetWordsRef.current = words;
    }
    clearSessionState(nextDur);
  };

  const handleSelectQuoteLength = (nextLen: QuoteLength) => {
    setQuoteLength(nextLen);
    const q = pickRandomQuote(nextLen);
    const words = q.text.split(' ');
    setActiveQuote(q);
    setTargetWords(words);
    targetWordsRef.current = words;
    clearSessionState(duration);
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

    const previousBestForCompare =
      modeBestWpm > 0 ? modeBestWpm : overallBestWpm;
    const isPersonalBest = netWpm > overallBestWpm && netWpm > 0;

    audioEngine.playCompletionChime(
      isPersonalBest,
      settings.audio.switchProfile,
      settings.audio.switchVolume
    );

    const record: SessionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      mode,
      modeLabel: currentModeLabel,
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
      previousBestWpm: previousBestForCompare,
      targetWeakKeys: mode === 'weak-keys' ? weakDrillKeys : undefined,
    };

    setCompletedSession(record);
    onSessionComplete(record, keyDeltaRef.current);
  }, [
    mode,
    duration,
    currentModeLabel,
    modeBestWpm,
    overallBestWpm,
    weakDrillKeys,
    settings.audio.switchProfile,
    settings.audio.switchVolume,
    computeCharTallies,
    onSessionComplete,
  ]);

  // 1-second telemetry sampling timer
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

  // Smooth Ghost Pace-Maker animation loop
  useEffect(() => {
    if (phase !== 'running' || !settings.ghostEnabled || modeBestWpm <= 0) {
      setGhostCharTarget(null);
      setGhostCaretPos(null);
      return;
    }

    let rafId = 0;
    const charsPerSec = (modeBestWpm * 5) / 60;

    const tick = () => {
      const elapsed = Math.max(0, (performance.now() - startTimeRef.current) / 1000);
      let remainingChars = Math.floor(elapsed * charsPerSec);
      const words = targetWordsRef.current;

      let wIdx = 0;
      let cIdx = 0;
      while (wIdx < words.length) {
        const len = words[wIdx].length;
        if (remainingChars <= len) {
          cIdx = remainingChars;
          break;
        }
        remainingChars -= len + 1; // +1 for space between words
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

      if (phaseRef.current === 'running') {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [phase, settings.ghostEnabled, modeBestWpm]);

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
    if (ghostEl && settings.ghostEnabled && phase === 'running') {
      setGhostCaretPos({
        x: ghostEl.offsetLeft,
        y: ghostEl.offsetTop,
        h: ghostEl.offsetHeight || 28,
      });
    } else {
      setGhostCaretPos(null);
    }
  }, [
    typedWords,
    wordIndex,
    targetWords,
    settings.fontSize,
    settings.ghostEnabled,
    ghostCharTarget,
    phase,
  ]);

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

  const triggerStreakCheck = (nextStreak: number) => {
    if (nextStreak > 0 && nextStreak % 25 === 0) {
      setStreakMilestonePop(true);
      window.setTimeout(() => setStreakMilestonePop(false), 260);
      audioEngine.playMilestoneTick(
        nextStreak,
        settings.audio.switchProfile,
        settings.audio.switchVolume
      );
    }
  };

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
      } else if (
        idx > 0 &&
        currentTyped[idx - 1] !== targetWordsRef.current[idx - 1]
      ) {
        currentTyped.pop();
        setTypedWords(currentTyped);
        setWordIndex(idx - 1);
      }
      return;
    }

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
        setSettledWordIndex(idx);
        window.setTimeout(() => {
          setSettledWordIndex((curr) => (curr === idx ? null : curr));
        }, 160);
        setStreak((s) => {
          const next = s + 1;
          triggerStreakCheck(next);
          return next;
        });
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

      if (
        (mode === 'quote' || mode === 'weak-keys') &&
        idx >= targetWordsRef.current.length - 1
      ) {
        finishTest();
        return;
      }

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
        setStreak((s) => {
          const next = s + 1;
          triggerStreakCheck(next);
          return next;
        });
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

      if (
        (mode === 'quote' || mode === 'weak-keys') &&
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
          dailyStreak={dailyStreak}
          onNextTest={() => resetSession(false)}
          onRetrySame={() => resetSession(true)}
          onDrillWeakKeys={(keys) => launchWeakKeysDrill(keys)}
        />
      </div>
    );
  }

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
          <button
            type="button"
            onClick={() => handleSelectMode('weak-keys')}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor:
                mode === 'weak-keys' ? 'var(--accent)' : 'transparent',
              color:
                mode === 'weak-keys'
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

          {mode === 'timed' && (
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
                  clearSessionState(duration);
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
                  clearSessionState(duration);
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
          )}

          {mode === 'quote' &&
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
            ))}

          {mode === 'weak-keys' && (
            <span
              className="font-mono-typing px-2 text-xs"
              style={{ color: 'var(--ink-muted)' }}
            >
              {weakDrillKeys.length > 0
                ? `Focus: ${weakDrillKeys.map((k) => k.toUpperCase()).join(' · ')}`
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
              {settings.ghostEnabled ? `Ghost: ${modeBestWpm} WPM` : 'Ghost: Off'}
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
      <div className="flex flex-wrap items-baseline justify-between gap-4 px-1">
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
              className={`font-mono-typing inline-block text-2xl font-bold tabular-nums ${
                streakMilestonePop ? 'streak-milestone-pop' : ''
              }`}
              style={{
                color: streak >= 25 ? 'var(--accent)' : 'var(--ink-primary)',
              }}
            >
              {streak}
            </span>
          </div>
        </div>

        <span
          className="font-mono-typing hidden text-xs tabular-nums sm:inline"
          style={{ color: 'var(--ink-muted)' }}
        >
          {phase === 'idle' ? streakLabel : 'Tab + Enter to reset'}
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
            {/* Ghost Pace-Maker Caret (Goal-Gradient Effect) */}
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

            {/* Hardware-accelerated Smooth User Caret */}
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

            {targetWords.map((word, wIdx) => {
              const typed = typedWords[wIdx] ?? '';
              const isPast = wIdx < wordIndex;
              const isCurrent = wIdx === wordIndex;
              const extraChars =
                typed.length > word.length ? typed.slice(word.length) : '';
              const hasWordError = isPast && typed !== word;
              const isJustSettled = settledWordIndex === wIdx;

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
