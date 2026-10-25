import { EditorView } from '@tiptap/pm/view';
import {
  chromeFromDoc,
  type ChromeMarks,
  type ChromeStoryTarget,
  type DocumentChrome,
} from './chrome';

export interface ActiveBandFocus {
  storyTarget: ChromeStoryTarget;
  zoneKey?: 'left' | 'center' | 'right';
  lineIndex?: number; // 0 for line 0, 1+ for lines
  marks: ChromeMarks;
  align: 'left' | 'center' | 'right';
  pageIndex: number;
}

type FocusListener = (focus: ActiveBandFocus | null) => void;

class BandStateManager {
  private currentFocus: ActiveBandFocus | null = null;
  private currentView: EditorView | null = null;
  private listeners: Set<FocusListener> = new Set();

  setView(view: EditorView | null) {
    this.currentView = view;
  }

  getView(): EditorView | null {
    return this.currentView;
  }

  getFocus(): ActiveBandFocus | null {
    return this.currentFocus;
  }

  setFocus(focus: ActiveBandFocus | null) {
    this.currentFocus = focus;
    for (const listener of this.listeners) {
      listener(focus);
    }
  }

  subscribe(listener: FocusListener): () => void {
    this.listeners.add(listener);
    listener(this.currentFocus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateActiveZone(updater: (marks: ChromeMarks, align: 'left' | 'center' | 'right') => { marks: ChromeMarks; align: 'left' | 'center' | 'right' }) {
    if (!this.currentFocus || !this.currentView) return;
    const view = this.currentView;
    const chrome = chromeFromDoc(view.state.doc);
    const target = this.currentFocus.storyTarget;
    const story = chrome[target] ? { ...chrome[target] } : chrome.header ? { ...chrome.header } : null;
    if (!story) return;

    const { marks, align } = updater(this.currentFocus.marks, this.currentFocus.align);
    this.currentFocus.marks = marks;
    this.currentFocus.align = align;

    if (this.currentFocus.zoneKey) {
      const zoneKey = this.currentFocus.zoneKey;
      const zone = story.line0[zoneKey];
      zone.align = align;
      zone.runs = zone.runs.map((r) => {
        if (r.type === 'image') return r;
        return { ...r, ...marks };
      });
    } else if (this.currentFocus.lineIndex !== undefined && this.currentFocus.lineIndex > 0) {
      const lineIdx = this.currentFocus.lineIndex - 1;
      if (story.lines[lineIdx]) {
        story.lines[lineIdx].align = align;
        story.lines[lineIdx].runs = story.lines[lineIdx].runs.map((r) => {
          if (r.type === 'image') return r;
          return { ...r, ...marks };
        });
      }
    }

    const nextChrome: DocumentChrome = {
      ...chrome,
      [target]: story,
    };

    view.dispatch(view.state.tr.setDocAttribute('chrome', nextChrome));
    this.setFocus({ ...this.currentFocus });
  }

  toggleMark(mark: 'bold' | 'italic' | 'underline') {
    this.updateActiveZone((marks, align) => ({
      marks: { ...marks, [mark]: !marks[mark] },
      align,
    }));
  }

  setFontFamily(fontFamily: string) {
    this.updateActiveZone((marks, align) => ({
      marks: { ...marks, fontFamily },
      align,
    }));
  }

  setFontSize(fontSizePt: number) {
    this.updateActiveZone((marks, align) => ({
      marks: { ...marks, fontSize: fontSizePt },
      align,
    }));
  }

  setColor(color: string) {
    this.updateActiveZone((marks, align) => ({
      marks: { ...marks, color },
      align,
    }));
  }

  setAlign(align: 'left' | 'center' | 'right') {
    this.updateActiveZone((marks) => ({
      marks,
      align,
    }));
  }

  insertPageNumber(type: 'page' | 'pageOfTotal') {
    if (!this.currentView) return;
    const view = this.currentView;
    const chrome = chromeFromDoc(view.state.doc);

    if (this.currentFocus) {
      const target = this.currentFocus.storyTarget;
      const story = chrome[target] ? { ...chrome[target] } : { ...chrome.header };
      const marks = this.currentFocus.marks;

      if (this.currentFocus.zoneKey) {
        const zoneKey = this.currentFocus.zoneKey;
        story.line0[zoneKey].runs.push({
          type: 'field',
          field: type,
          ...marks,
        });
      } else if (this.currentFocus.lineIndex !== undefined && this.currentFocus.lineIndex > 0) {
        const lineIdx = this.currentFocus.lineIndex - 1;
        if (story.lines[lineIdx]) {
          story.lines[lineIdx].runs.push({
            type: 'field',
            field: type,
            ...marks,
          });
        }
      }

      const nextChrome: DocumentChrome = { ...chrome, [target]: story };
      view.dispatch(view.state.tr.setDocAttribute('chrome', nextChrome));
    } else {
      // Caret is in body: insert into footer's right zone
      const story = { ...chrome.footer };
      story.line0.right.runs.push({
        type: 'field',
        field: type,
      });
      const nextChrome: DocumentChrome = { ...chrome, footer: story };
      view.dispatch(view.state.tr.setDocAttribute('chrome', nextChrome));
    }
  }
}

export const bandState = new BandStateManager();

