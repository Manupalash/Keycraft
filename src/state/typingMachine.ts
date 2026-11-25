import {
  generateWeakKeyDrill,
  generateWordList,
  pickRandomQuote,
} from '../data/wordsAndQuotes';
import {
  QuoteItem,
  QuoteLength,
  SecondSnapshot,
  SessionRecord,
  TimedDuration,
} from '../types/typing';
import { calculateConsistency } from '../utils/storage';

export type ModeConfig =
  | {
      mode: 'timed';
      duration: TimedDuration;
      punctuation: boolean;
      numbers: boolean;
    }
  | {
      mode: 'quote';
      length: QuoteLength;
      quote: QuoteItem;
    }
  | {
      mode: 'weak-keys';
      targetKeys: string[];
    };

export type SessionPhase =
  | { status: 'idle' }
  | {
      status: 'running';
      startedAtMs: number;
      lastKeyAtMs: number;
      elapsedSec: number;
      timeLeft: number;
    }
  | {
      status: 'finished';
      result: SessionRecord;
    };

export interface KeyDelta {
  presses: number;
  errors: number;
  totalLatencyMs: number;
}

export interface TypingState {
  config: ModeConfig;
  phase: SessionPhase;
  targetWords: string[];
  typedWords: string[];
  wordIndex: number;
  liveWpm: number;
  liveAccuracy: number;
  streak: number;
  totalPresses: number;
  correctPresses: number;
  errorsInCurrentSec: number;
  timeline: SecondSnapshot[];
  keyDelta: Record<string, KeyDelta>;
  settledWordIndex: number | null;
}

export type TypingAction =
  | { type: 'CONFIGURE'; config: ModeConfig }
  | { type: 'RESET'; keepSamePrompt?: boolean }
  | {
      type: 'INPUT_CHAR';
      char: string;
      nowMs: number;
      modeBestWpm: number;
      overallBestWpm: number;
    }
  | {
      type: 'INPUT_SPACE';
      nowMs: number;
      modeBestWpm: number;
      overallBestWpm: number;
    }
  | { type: 'INPUT_BACKSPACE'; clearWord: boolean }
  | {
      type: 'TICK';
      nowMs: number;
      modeBestWpm: number;
      overallBestWpm: number;
    }
  | { type: 'CLEAR_SETTLED_WORD'; wordIdx: number };

export function getModeLabel(config: ModeConfig): string {
  if (config.mode === 'timed') return `Timed ${config.duration}s`;
  if (config.mode === 'quote') return `Quote · ${config.length}`;
  return 'Weak Keys';
}

export function buildTargetWords(config: ModeConfig): string[] {
  if (config.mode === 'timed') {
    return generateWordList(90, config.punctuation, config.numbers);
  }
  if (config.mode === 'quote') {
    return config.quote.text.split(' ');
  }
  return generateWeakKeyDrill(config.targetKeys, 35);
}

export function createInitialTypingState(config: ModeConfig): TypingState {
  return {
    config,
    phase: { status: 'idle' },
    targetWords: buildTargetWords(config),
    typedWords: [''],
    wordIndex: 0,
    liveWpm: 0,
    liveAccuracy: 100,
    streak: 0,
    totalPresses: 0,
    correctPresses: 0,
    errorsInCurrentSec: 0,
    timeline: [],
    keyDelta: {},
    settledWordIndex: null,
  };
}

function computeCharTallies(
  targetWords: string[],
  typedWords: string[]
): { correct: number; incorrect: number; extra: number } {
  let correct = 0;
  let incorrect = 0;
  let extra = 0;

  for (let w = 0; w < typedWords.length; w++) {
    const target = targetWords[w] ?? '';
    const typed = typedWords[w] ?? '';
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

    if (w < typedWords.length - 1) {
      if (typed === target) {
        correct++;
      } else {
        incorrect++;
      }
    }
  }

  return { correct, incorrect, extra };
}

function buildFinishedSession(
  state: TypingState,
  nowMs: number,
  modeBestWpm: number,
  overallBestWpm: number
): SessionRecord {
  const startedAtMs =
    state.phase.status === 'running' ? state.phase.startedAtMs : nowMs;
  const actualElapsedSec =
    state.config.mode === 'timed'
      ? state.config.duration
      : Math.max(1, Math.round((nowMs - startedAtMs) / 1000));

  const { correct, incorrect, extra } = computeCharTallies(
    state.targetWords,
    state.typedWords
  );
  const minutes = Math.max(actualElapsedSec / 60, 1 / 60);
  const netWpm = Math.max(0, Math.round(correct / 5 / minutes));
  const rawWpm = Math.max(
    netWpm,
    Math.round(state.totalPresses / 5 / minutes)
  );
  const accuracy =
    state.totalPresses > 0
      ? Math.round((state.correctPresses / state.totalPresses) * 100)
      : 100;

  const snapshots = [...state.timeline];
  if (
    snapshots.length === 0 ||
    snapshots[snapshots.length - 1].second < actualElapsedSec
  ) {
    snapshots.push({
      second: actualElapsedSec,
      wpm: netWpm,
      rawWpm,
      errors: state.errorsInCurrentSec,
    });
  }

  const consistency = calculateConsistency(snapshots.map((s) => s.rawWpm));
  const weakKeys = Object.entries(state.keyDelta)
    .filter(([, s]) => s.errors > 0)
    .map(([k, s]) => ({ key: k, errors: s.errors, presses: s.presses }))
    .sort((a, b) => b.errors - a.errors);

  const previousBestForCompare =
    modeBestWpm > 0 ? modeBestWpm : overallBestWpm;
  const isPersonalBest = netWpm > overallBestWpm && netWpm > 0;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    mode: state.config.mode,
    modeLabel: getModeLabel(state.config),
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
    targetWeakKeys:
      state.config.mode === 'weak-keys' ? state.config.targetKeys : undefined,
  };
}

export function typingReducer(
  state: TypingState,
  action: TypingAction
): TypingState {
  switch (action.type) {
    case 'CONFIGURE': {
      return createInitialTypingState(action.config);
    }

    case 'RESET': {
      if (action.keepSamePrompt) {
        return {
          ...createInitialTypingState(state.config),
          targetWords: state.targetWords,
        };
      }
      if (state.config.mode === 'quote') {
        const nextQuote = pickRandomQuote(
          state.config.length,
          state.config.quote.id
        );
        return createInitialTypingState({
          mode: 'quote',
          length: state.config.length,
          quote: nextQuote,
        });
      }
      return createInitialTypingState(state.config);
    }

    case 'CLEAR_SETTLED_WORD': {
      if (state.settledWordIndex !== action.wordIdx) return state;
      return { ...state, settledWordIndex: null };
    }

    case 'INPUT_BACKSPACE': {
      if (state.phase.status === 'finished') return state;
      const typedWords = [...state.typedWords];
      const idx = state.wordIndex;
      const currWord = typedWords[idx] ?? '';

      if (action.clearWord) {
        typedWords[idx] = '';
        return { ...state, typedWords };
      }

      if (currWord.length > 0) {
        typedWords[idx] = currWord.slice(0, -1);
        return { ...state, typedWords };
      }

      if (idx > 0 && typedWords[idx - 1] !== state.targetWords[idx - 1]) {
        typedWords.pop();
        return {
          ...state,
          typedWords,
          wordIndex: idx - 1,
        };
      }

      return state;
    }

    case 'INPUT_SPACE': {
      if (state.phase.status === 'finished') return state;
      const idx = state.wordIndex;
      const typedWords = [...state.typedWords];
      const currWord = typedWords[idx] ?? '';
      if (currWord.length === 0) return state;

      const runningPhase =
        state.phase.status === 'idle'
          ? {
              status: 'running' as const,
              startedAtMs: action.nowMs,
              lastKeyAtMs: action.nowMs,
              elapsedSec: 0,
              timeLeft:
                state.config.mode === 'timed' ? state.config.duration : 0,
            }
          : state.phase;

      const targetWord = state.targetWords[idx] ?? '';
      const isSpaceClean = currWord === targetWord;

      const totalPresses = state.totalPresses + 1;
      const correctPresses = state.correctPresses + (isSpaceClean ? 1 : 0);
      const streak = isSpaceClean ? state.streak + 1 : 0;
      const errorsInCurrentSec =
        state.errorsInCurrentSec + (isSpaceClean ? 0 : 1);

      const latency = Math.min(
        1800,
        Math.max(10, Math.round(action.nowMs - runningPhase.lastKeyAtMs))
      );
      const prevSpace = state.keyDelta[' '] ?? {
        presses: 0,
        errors: 0,
        totalLatencyMs: 0,
      };
      const keyDelta = {
        ...state.keyDelta,
        ' ': {
          presses: prevSpace.presses + 1,
          errors: prevSpace.errors + (isSpaceClean ? 0 : 1),
          totalLatencyMs: prevSpace.totalLatencyMs + latency,
        },
      };

      const liveAccuracy = Math.round((correctPresses / totalPresses) * 100);

      let nextTargetWords = state.targetWords;
      if (
        state.config.mode === 'timed' &&
        idx > state.targetWords.length - 30
      ) {
        nextTargetWords = [
          ...state.targetWords,
          ...generateWordList(
            60,
            state.config.punctuation,
            state.config.numbers
          ),
        ];
      }

      const nextState: TypingState = {
        ...state,
        phase: { ...runningPhase, lastKeyAtMs: action.nowMs },
        targetWords: nextTargetWords,
        typedWords,
        totalPresses,
        correctPresses,
        streak,
        errorsInCurrentSec,
        keyDelta,
        liveAccuracy,
        settledWordIndex: isSpaceClean ? idx : state.settledWordIndex,
      };

      if (
        (state.config.mode === 'quote' ||
          state.config.mode === 'weak-keys') &&
        idx >= state.targetWords.length - 1
      ) {
        const result = buildFinishedSession(
          nextState,
          action.nowMs,
          action.modeBestWpm,
          action.overallBestWpm
        );
        return {
          ...nextState,
          phase: { status: 'finished', result },
        };
      }

      return {
        ...nextState,
        typedWords: [...typedWords, ''],
        wordIndex: idx + 1,
      };
    }

    case 'INPUT_CHAR': {
      if (state.phase.status === 'finished') return state;
      const idx = state.wordIndex;
      const typedWords = [...state.typedWords];
      const currWord = typedWords[idx] ?? '';
      const targetWord = state.targetWords[idx] ?? '';

      if (currWord.length >= targetWord.length + 8) return state;

      const runningPhase =
        state.phase.status === 'idle'
          ? {
              status: 'running' as const,
              startedAtMs: action.nowMs,
              lastKeyAtMs: action.nowMs,
              elapsedSec: 0,
              timeLeft:
                state.config.mode === 'timed' ? state.config.duration : 0,
            }
          : state.phase;

      const expectedChar = targetWord[currWord.length];
      const isCorrect =
        expectedChar !== undefined && action.char === expectedChar;

      const nextWordVal = currWord + action.char;
      typedWords[idx] = nextWordVal;

      const totalPresses = state.totalPresses + 1;
      const correctPresses = state.correctPresses + (isCorrect ? 1 : 0);
      const streak = isCorrect ? state.streak + 1 : 0;
      const errorsInCurrentSec =
        state.errorsInCurrentSec + (isCorrect ? 0 : 1);

      const latency = Math.min(
        1800,
        Math.max(10, Math.round(action.nowMs - runningPhase.lastKeyAtMs))
      );
      const statKey = (expectedChar ?? action.char).toLowerCase();
      const prevStat = state.keyDelta[statKey] ?? {
        presses: 0,
        errors: 0,
        totalLatencyMs: 0,
      };
      const keyDelta = {
        ...state.keyDelta,
        [statKey]: {
          presses: prevStat.presses + 1,
          errors: prevStat.errors + (isCorrect ? 0 : 1),
          totalLatencyMs: prevStat.totalLatencyMs + latency,
        },
      };

      const liveAccuracy = Math.round((correctPresses / totalPresses) * 100);

      const nextState: TypingState = {
        ...state,
        phase: { ...runningPhase, lastKeyAtMs: action.nowMs },
        typedWords,
        totalPresses,
        correctPresses,
        streak,
        errorsInCurrentSec,
        keyDelta,
        liveAccuracy,
      };

      if (
        (state.config.mode === 'quote' ||
          state.config.mode === 'weak-keys') &&
        idx === state.targetWords.length - 1 &&
        nextWordVal === targetWord
      ) {
        const result = buildFinishedSession(
          nextState,
          action.nowMs,
          action.modeBestWpm,
          action.overallBestWpm
        );
        return {
          ...nextState,
          phase: { status: 'finished', result },
        };
      }

      return nextState;
    }

    case 'TICK': {
      if (state.phase.status !== 'running') return state;
      const elapsedMs = action.nowMs - state.phase.startedAtMs;
      const sec = Math.max(1, Math.floor(elapsedMs / 1000));

      const { correct } = computeCharTallies(
        state.targetWords,
        state.typedWords
      );
      const minutes = Math.max(elapsedMs / 60000, 1 / 60);
      const liveWpm = Math.max(0, Math.round(correct / 5 / minutes));
      const rawWpm = Math.max(
        liveWpm,
        Math.round(state.totalPresses / 5 / minutes)
      );

      let timeline = state.timeline;
      let errorsInCurrentSec = state.errorsInCurrentSec;
      if (
        timeline.length === 0 ||
        timeline[timeline.length - 1].second < sec
      ) {
        timeline = [
          ...timeline,
          {
            second: sec,
            wpm: liveWpm,
            rawWpm,
            errors: errorsInCurrentSec,
          },
        ];
        errorsInCurrentSec = 0;
      }

      const timeLeft =
        state.config.mode === 'timed'
          ? Math.max(0, state.config.duration - sec)
          : 0;

      const updatedState: TypingState = {
        ...state,
        phase: {
          ...state.phase,
          elapsedSec: sec,
          timeLeft,
        },
        liveWpm,
        timeline,
        errorsInCurrentSec,
      };

      if (state.config.mode === 'timed' && timeLeft <= 0) {
        const result = buildFinishedSession(
          updatedState,
          action.nowMs,
          action.modeBestWpm,
          action.overallBestWpm
        );
        return {
          ...updatedState,
          phase: { status: 'finished', result },
        };
      }

      return updatedState;
    }

    default:
      return state;
  }
}
