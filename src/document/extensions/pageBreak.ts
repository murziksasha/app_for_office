import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [
      { tag: 'div.folio-page-break' },
      { tag: 'hr.folio-page-break' },
      {
        tag: 'div',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const style = el.getAttribute('style') || '';
          if (
            style.includes('page-break-after: always') ||
            style.includes('break-after: page') ||
            el.classList.contains('folio-page-break')
          ) {
            return {};
          }
          return false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'folio-page-break',
        style: 'break-after: page; page-break-after: always;',
      }),
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }: { chain: any }) => {
          return chain()
            .insertContent({
              type: this.name,
            })
            .run();
        },
    };
  },
});

