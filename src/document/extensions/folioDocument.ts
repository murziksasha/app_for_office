import { Node } from '@tiptap/core';
import { mergePageSetup, readPageSetup, samePageSetup, type PageSetup } from '../pageSetup';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    folioDocument: {
      setPageSetup: (partial: Partial<PageSetup>) => ReturnType;
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
    };
  },
});
