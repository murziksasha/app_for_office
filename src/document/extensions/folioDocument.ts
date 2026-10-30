import { Node } from '@tiptap/core';
import { mergePageSetup, readPageSetup, samePageSetup, type PageSetup } from '../pageSetup';
import { createEmptyChrome, readDocChrome, sameDocChrome, type DocumentChrome } from '../chrome';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    folioDocument: {
      setPageSetup: (partial: Partial<PageSetup>) => ReturnType;
      setDocumentChrome: (
        updater: Partial<DocumentChrome> | ((current: DocumentChrome) => DocumentChrome)
      ) => ReturnType;
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
    };
  },
});
