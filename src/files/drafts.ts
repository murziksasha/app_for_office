import { get, set, del, keys } from 'idb-keyval';
import { DraftItem } from '../types';

const DRAFT_PREFIX = 'folio_draft_';

export async function saveDraft(item: DraftItem): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await set(`${DRAFT_PREFIX}${item.id}`, {
      ...item,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to save draft to IndexedDB:', err);
  }
}

export async function getDraft(id: string): Promise<DraftItem | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    return await get<DraftItem>(`${DRAFT_PREFIX}${id}`);
  } catch (err) {
    console.warn('Failed to get draft:', err);
    return undefined;
  }
}

export async function clearDraft(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await del(`${DRAFT_PREFIX}${id}`);
  } catch (err) {
    console.warn('Failed to clear draft:', err);
  }
}

export async function getAllDrafts(): Promise<DraftItem[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const allKeys = await keys();
    const draftKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(DRAFT_PREFIX));
    const drafts: DraftItem[] = [];
    for (const k of draftKeys) {
      const item = await get<DraftItem>(k);
      if (item) drafts.push(item);
    }
    return drafts.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn('Failed to list drafts:', err);
    return [];
  }
}
