import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      minLevel: 0,
      maxLevel: 8,
      indentWidth: 24,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const marginLeft = element.style.marginLeft;
              if (!marginLeft) return 0;
              const px = parseInt(marginLeft, 10);
              return Math.min(Math.max(Math.round(px / 24), 0), 8);
            },
            renderHTML: (attributes) => {
              if (!attributes.indent || attributes.indent <= 0) {
                return {};
              }
              return {
                style: `margin-left: ${attributes.indent * 24}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ editor, tr, state, dispatch }: { editor: any; tr: any; state: any; dispatch: any }) => {
          // If in a list item, try to sink it
          if (editor.can().sinkListItem('listItem')) {
            return editor.chain().sinkListItem('listItem').run();
          }

          const { selection } = state;
          const { from, to } = selection;
          let applicable = false;

          tr.doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              applicable = true;
              const currentIndent = (node.attrs.indent as number) || 0;
              const nextIndent = Math.min(currentIndent + 1, this.options.maxLevel);
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: nextIndent,
              });
            }
          });

          if (applicable && dispatch) {
            dispatch(tr);
            return true;
          }
          return false;
        },

      outdent:
        () =>
        ({ editor, tr, state, dispatch }: { editor: any; tr: any; state: any; dispatch: any }) => {
          // If in a list item, try to lift it
          if (editor.can().liftListItem('listItem')) {
            return editor.chain().liftListItem('listItem').run();
          }

          const { selection } = state;
          const { from, to } = selection;
          let applicable = false;

          tr.doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (this.options.types.includes(node.type.name)) {
              applicable = true;
              const currentIndent = (node.attrs.indent as number) || 0;
              const nextIndent = Math.max(currentIndent - 1, this.options.minLevel);
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                indent: nextIndent,
              });
            }
          });

          if (applicable && dispatch) {
            dispatch(tr);
            return true;
          }
          return false;
        },
    };
  },
});

