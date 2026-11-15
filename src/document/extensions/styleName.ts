import { Extension } from '@tiptap/core';

export const StyleName = Extension.create({
  name: 'styleName',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'blockquote'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          styleName: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-style-name') || null,
            renderHTML: (attributes) => {
              if (!attributes.styleName) {
                return {};
              }
              return {
                'data-style-name': attributes.styleName,
              };
            },
          },
        },
      },
    ];
  },
});

