import { QuoteItem, QuoteLength } from '../types/typing';

export const COMMON_WORDS: string[] = [
  'the', 'be', 'of', 'and', 'a', 'to', 'in', 'he', 'have', 'it', 'that', 'for',
  'they', 'with', 'as', 'not', 'on', 'she', 'at', 'by', 'this', 'we', 'you',
  'do', 'but', 'from', 'or', 'which', 'one', 'would', 'all', 'will', 'there',
  'say', 'who', 'make', 'when', 'can', 'more', 'if', 'no', 'man', 'out',
  'other', 'so', 'what', 'time', 'up', 'go', 'about', 'than', 'into', 'could',
  'state', 'only', 'new', 'year', 'some', 'take', 'come', 'these', 'know',
  'see', 'use', 'get', 'like', 'then', 'first', 'any', 'work', 'now', 'may',
  'such', 'give', 'over', 'think', 'most', 'even', 'find', 'day', 'also',
  'after', 'way', 'many', 'must', 'look', 'before', 'great', 'back', 'through',
  'long', 'where', 'much', 'should', 'well', 'people', 'down', 'own', 'just',
  'because', 'good', 'each', 'those', 'feel', 'seem', 'how', 'high', 'too',
  'place', 'little', 'world', 'very', 'still', 'nation', 'hand', 'old', 'life',
  'tell', 'write', 'become', 'here', 'show', 'house', 'both', 'between', 'need',
  'mean', 'call', 'develop', 'under', 'last', 'right', 'move', 'thing', 'general',
  'school', 'never', 'same', 'another', 'begin', 'while', 'number', 'part',
  'turn', 'real', 'leave', 'might', 'want', 'point', 'form', 'off', 'child',
  'few', 'small', 'since', 'against', 'ask', 'late', 'home', 'interest', 'large',
  'person', 'end', 'open', 'public', 'follow', 'during', 'present', 'without',
  'again', 'hold', 'govern', 'around', 'possible', 'head', 'consider', 'word',
  'program', 'problem', 'however', 'lead', 'system', 'set', 'order', 'eye',
  'plan', 'run', 'keep', 'face', 'fact', 'group', 'play', 'stand', 'increase',
  'early', 'course', 'change', 'help', 'line', 'quiet', 'craft', 'frame',
  'rhythm', 'sound', 'light', 'paper', 'stone', 'table', 'glass', 'river',
  'forest', 'winter', 'autumn', 'morning', 'evening', 'simple', 'steady',
  'clear', 'sharp', 'bright', 'silent', 'smooth', 'gentle', 'rapid', 'clean',
  'build', 'shape', 'trace', 'focus', 'pause', 'drift', 'reach', 'carry',
  'measure', 'balance', 'pattern', 'detail', 'surface', 'motion', 'moment',
  'signal', 'memory', 'engine', 'spring', 'letter', 'anchor', 'bridge',
  'quartz', 'velvet', 'spark', 'jacket', 'puzzle', 'breeze', 'bronze', 'vivid',
  'exact', 'mixed', 'quick', 'quest', 'zebra', 'glyph', 'ivory', 'kiosk',
  'knack', 'jolt', 'pivot', 'flock', 'ember', 'chalk', 'plank', 'whisk',
];

const PUNCTUATION_SUFFIXES = [',', ',', '.', '.', ';', ':'];

export function generateWordList(
  count: number,
  includePunctuation: boolean,
  includeNumbers: boolean
): string[] {
  const result: string[] = [];
  let prevWord = '';

  for (let i = 0; i < count; i++) {
    if (includeNumbers && Math.random() < 0.09) {
      const num = Math.floor(Math.random() * 990) + 10;
      result.push(String(num));
      prevWord = String(num);
      continue;
    }

    let word = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
    while (word === prevWord) {
      word = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
    }
    prevWord = word;

    if (includePunctuation) {
      if (i === 0 || (result[i - 1] && /[.!?]$/.test(result[i - 1]))) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      } else if (Math.random() < 0.16 && i < count - 1) {
        const suffix =
          PUNCTUATION_SUFFIXES[
            Math.floor(Math.random() * PUNCTUATION_SUFFIXES.length)
          ];
        word = word + suffix;
      }
    }

    result.push(word);
  }

  return result;
}

export function generateWeakKeyDrill(targetKeys: string[], count = 35): string[] {
  const cleanedKeys = Array.from(
    new Set(
      targetKeys
        .map((k) => k.toLowerCase().trim())
        .filter((k) => k.length === 1 && /[a-z0-9]/.test(k))
    )
  );

  if (cleanedKeys.length === 0) {
    return generateWordList(count, false, false);
  }

  // Score each word by how densely it exercises the target weak keys
  const scored = COMMON_WORDS.map((word) => {
    let score = 0;
    for (const ch of word) {
      const idx = cleanedKeys.indexOf(ch);
      if (idx !== -1) {
        // Higher weight for the top-most missed key
        score += cleanedKeys.length - idx;
      }
    }
    return { word, score };
  });

  const matchingPool = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(24, Math.min(60, scored.length)));

  const pool =
    matchingPool.length >= 6
      ? matchingPool.map((m) => m.word)
      : COMMON_WORDS;

  const result: string[] = [];
  let prev = '';
  for (let i = 0; i < count; i++) {
    let candidate = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) {
      while (candidate === prev) {
        candidate = pool[Math.floor(Math.random() * pool.length)];
      }
    }
    prev = candidate;
    result.push(candidate);
  }

  return result;
}

export const CURATED_QUOTES: QuoteItem[] = [
  {
    id: 'q-short-1',
    length: 'short',
    author: 'Dieter Rams',
    text: 'Good design is as little design as possible. Less, but better, because it concentrates on the essential aspects.',
  },
  {
    id: 'q-short-2',
    length: 'short',
    author: 'Antoine de Saint-Exupery',
    text: 'Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.',
  },
  {
    id: 'q-short-3',
    length: 'short',
    author: 'Annie Dillard',
    text: 'How we spend our days is, of course, how we spend our lives. What we do with this hour, and that one, is what we are doing.',
  },
  {
    id: 'q-short-4',
    length: 'short',
    author: 'William Morris',
    text: 'Have nothing in your houses that you do not know to be useful, or believe to be beautiful.',
  },
  {
    id: 'q-med-1',
    length: 'medium',
    author: 'Jony Ive',
    text: 'Simplicity is not just the absence of clutter; that is just the consequence of simplicity. Simplicity is about bringing order to complexity and making the purpose of an object immediately clear.',
  },
  {
    id: 'q-med-2',
    length: 'medium',
    author: 'Haruki Murakami',
    text: 'When I sit at my desk before dawn, the quiet room feels like an empty harbor. Every keystroke sets a small boat onto dark water, and by noon the pages have carried me somewhere I did not expect.',
  },
  {
    id: 'q-med-3',
    length: 'medium',
    author: 'Don Norman',
    text: 'Two of the most important characteristics of good design are discoverability and understanding. Discoverability means it is possible to figure out what actions are possible and where and how to perform them.',
  },
  {
    id: 'q-med-4',
    length: 'medium',
    author: 'Ursula K. Le Guin',
    text: 'The unread story is not a story; it is little black marks on wood pulp. The reader, reading it, makes it live: a live thing, a story. Words hold silence together until someone reads them aloud in thought.',
  },
  {
    id: 'q-long-1',
    length: 'long',
    author: 'Robert Bringhurst',
    text: 'Typography exists to honor content. Like a crystal goblet, the finest page disappears behind the voice of the text, allowing rhythm, proportion, and quiet spacing to carry thought from writer to reader without friction or distraction. When letterforms align with natural breath, reading becomes effortless.',
  },
  {
    id: 'q-long-2',
    length: 'long',
    author: 'Cal Newport',
    text: 'Deep work is the ability to focus without distraction on a cognitively demanding task. It is a skill that allows you to quickly master complicated information and produce better results in less time. In an age of constant interruption, cultivating uninterrupted quiet attention has become both rare and extraordinarily valuable.',
  },
  {
    id: 'q-long-3',
    length: 'long',
    author: 'Richard Sennett',
    text: 'Craftsmanship names an enduring, basic human impulse, the desire to do a job well for its own sake. Whether shaping timber, tuning a mechanical switch, or composing clean prose, the hand and mind learn together through patient repetition, noticing small imperfections and refining each motion until it feels effortless.',
  },
];

export function pickRandomQuote(length: QuoteLength, excludeId?: string): QuoteItem {
  const pool = CURATED_QUOTES.filter((q) => q.length === length);
  const filtered = pool.length > 1 && excludeId ? pool.filter((q) => q.id !== excludeId) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)] ?? CURATED_QUOTES[0];
}
