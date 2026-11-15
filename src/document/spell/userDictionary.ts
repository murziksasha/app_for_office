const USER_DICT_KEY = 'folio_user_dictionary';

let memoryWords: Set<string> | null = null;
const listeners = new Set<() => void>();

export function getUserWords(): Set<string> {
  if (memoryWords !== null) return memoryWords;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(USER_DICT_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryWords = new Set(parsed.map((w) => String(w).toLowerCase().trim()));
        return memoryWords;
      }
    }
  } catch {
    // fallback to empty set
  }
  memoryWords = new Set<string>();
  return memoryWords;
}

export function addUserWord(word: string): void {
  const clean = word.toLowerCase().trim();
  if (!clean) return;
  const set = getUserWords();
  set.add(clean);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_DICT_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // quota or access error
  }
  listeners.forEach((cb) => cb());
}

export function onUserDictionaryChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function clearUserDictionary(): void {
  memoryWords = new Set<string>();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USER_DICT_KEY);
    }
  } catch {
    // ignore
  }
  listeners.forEach((cb) => cb());
}

