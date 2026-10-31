import { EN_WORDS, UK_WORDS } from './dictionaries';
import { getUserWords } from './userDictionary';

export function getDictionaryForLang(lang = 'en'): Set<string> {
  const isUk = lang.toLowerCase().startsWith('uk');
  return isUk ? UK_WORDS : EN_WORDS;
}

export function isWordMisspelled(rawWord: string, lang = 'en'): boolean {
  const word = rawWord.replace(/^[^a-zA-Zа-яА-ЯіїєґІЇЄҐ]+|[^a-zA-Zа-яА-ЯіїєґІЇЄҐ]+$/g, '').toLowerCase();
  if (!word || word.length < 2) return false;

  // Skip numbers, emails, URLs
  if (/^\d+$/.test(word)) return false;
  if (/\d/.test(word)) return false;
  if (word.includes('http') || word.includes('www') || word.includes('@') || word.includes('.com')) return false;

  const dict = getDictionaryForLang(lang);
  if (dict.has(word)) return false;

  const userWords = getUserWords();
  if (userWords.has(word)) return false;

  return true;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row: number[] = [];
  for (let i = 0; i <= b.length; i++) row[i] = i;
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export function getSuggestions(rawWord: string, lang = 'en', limit = 4): string[] {
  const word = rawWord.replace(/^[^a-zA-Zа-яА-ЯіїєґІЇЄҐ]+|[^a-zA-Zа-яА-ЯіїєґІЇЄҐ]+$/g, '').toLowerCase();
  if (!word) return [];

  const dict = getDictionaryForLang(lang);
  const userWords = getUserWords();
  const allWords = new Set([...dict, ...userWords]);

  const candidates: Array<{ word: string; dist: number }> = [];

  for (const candidate of allWords) {
    if (Math.abs(candidate.length - word.length) > 2) continue;
    const dist = levenshtein(word, candidate);
    if (dist <= 2) {
      candidates.push({ word: candidate, dist });
    }
  }

  candidates.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    // Prefer words sharing first letter
    const aFirst = a.word[0] === word[0] ? 0 : 1;
    const bFirst = b.word[0] === word[0] ? 0 : 1;
    if (aFirst !== bFirst) return aFirst - bFirst;
    return a.word.localeCompare(b.word);
  });

  // Preserve initial capitalization if source was capitalized
  const isCapitalized = /^[A-ZА-ЯІЇЄҐ]/.test(rawWord);
  return candidates.slice(0, limit).map((c) => {
    if (isCapitalized) {
      return c.word.charAt(0).toUpperCase() + c.word.slice(1);
    }
    return c.word;
  });
}

