import { get, set } from 'idb-keyval';
import { RecentItem } from '../types';

const RECENT_STORAGE_KEY = 'folio_recent_files';
const MAX_RECENT_ITEMS = 20;

export async function getRecentFiles(): Promise<RecentItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const list = await get<RecentItem[]>(RECENT_STORAGE_KEY);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.warn('Failed to get recent files:', err);
    return [];
  }
}

export async function addRecentFile(item: Omit<RecentItem, 'lastOpened'>): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const existing = await getRecentFiles();
    const updated: RecentItem = {
      ...item,
      lastOpened: Date.now(),
    };
    // Filter out item with same id or name
    const filtered = existing.filter((f) => f.id !== item.id && f.name !== item.name);
    const result = [updated, ...filtered].slice(0, MAX_RECENT_ITEMS);
    await set(RECENT_STORAGE_KEY, result);
  } catch (err) {
    console.warn('Failed to add recent file:', err);
  }
}

export async function removeRecentFile(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const existing = await getRecentFiles();
    const filtered = existing.filter((f) => f.id !== id);
    await set(RECENT_STORAGE_KEY, filtered);
  } catch (err) {
    console.warn('Failed to remove recent file:', err);
  }
}

export async function clearRecentFiles(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await set(RECENT_STORAGE_KEY, []);
  } catch (err) {
    console.warn('Failed to clear recent files:', err);
  }
}
