import { Node, mergeAttributes } from '@tiptap/core';

export const FootnoteRef = Node.create({
  name: 'footnoteRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: '1',
        parseHTML: (element) => element.getAttribute('data-footnote-id') || '1',
        renderHTML: (attributes) => ({
          'data-footnote-id': attributes.id,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'sup[data-footnote-id]',
      },
      {
        tag: 'span[data-footnote-id]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'sup',
      mergeAttributes(HTMLAttributes, {
        class: 'folio-footnote-ref',
      }),
      `[${node.attrs.id}]`,
    ];
  },
});

