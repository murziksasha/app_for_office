import { Node } from '@tiptap/core';
import { mergePageSetup, readPageSetup, samePageSetup, type PageSetup } from '../pageSetup';
import { createEmptyChrome, readDocChrome, sameDocChrome, type DocumentChrome } from '../chrome';

export interface FootnoteItem {
  id: string;
  text: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    folioDocument: {
      setPageSetup: (partial: Partial<PageSetup>) => ReturnType;
      setDocumentChrome: (
        updater: Partial<DocumentChrome> | ((current: DocumentChrome) => DocumentChrome)
      ) => ReturnType;
      setFootnotes: (footnotes: FootnoteItem[]) => ReturnType;
      updateFootnoteText: (id: string, text: string) => ReturnType;
      addFootnote: () => ReturnType;
    };
  }
}

export const FolioDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'block+',

  addAttributes() {
    return {
      pageSetup: {
        default: { ...readPageSetup(null) },
        parseHTML: () => ({ ...readPageSetup(null) }),
        renderHTML: () => ({}),
      },
      chrome: {
        default: { ...createEmptyChrome() },
        parseHTML: () => ({ ...createEmptyChrome() }),
        renderHTML: () => ({}),
      },
      footnotes: {
        default: [],
        parseHTML: () => [],
        renderHTML: () => ({}),
      },
    };
  },

  addCommands() {
    return {
      setPageSetup:
        (partial) =>
        ({ tr, state, dispatch }) => {
          const current = readPageSetup(state.doc.attrs.pageSetup);
          const next = mergePageSetup(current, partial);
          if (samePageSetup(current, next)) return true;
          if (dispatch) dispatch(tr.setDocAttribute('pageSetup', next));
          return true;
        },
      setDocumentChrome:
        (updater) =>
        ({ tr, state, dispatch }) => {
          const current = readDocChrome(state.doc.attrs.chrome);
          const next =
            typeof updater === 'function'
              ? readDocChrome(updater(current))
              : readDocChrome({ ...current, ...updater });
          if (sameDocChrome(current, next)) return true;
          if (dispatch) dispatch(tr.setDocAttribute('chrome', next));
          return true;
        },
      setFootnotes:
        (footnotes: FootnoteItem[]) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setDocAttribute('footnotes', footnotes));
          return true;
        },
      updateFootnoteText:
        (id: string, text: string) =>
        ({ tr, state, dispatch }) => {
          const current: FootnoteItem[] = state.doc.attrs.footnotes || [];
          const exists = current.some((fn) => fn.id === id);
          const next = exists
            ? current.map((fn) => (fn.id === id ? { ...fn, text } : fn))
            : [...current, { id, text }];
          if (dispatch) dispatch(tr.setDocAttribute('footnotes', next));
          return true;
        },
      addFootnote:
        () =>
        ({ tr, state, dispatch }) => {
          const current: FootnoteItem[] = state.doc.attrs.footnotes || [];
          const nextNum = current.length + 1;
          const id = String(nextNum);
          const nextFootnotes = [...current, { id, text: '' }];
          const refNode = state.schema.nodes.footnoteRef?.create({ id });
          if (refNode) {
            tr.replaceSelectionWith(refNode);
          }
          tr.setDocAttribute('footnotes', nextFootnotes);
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});
