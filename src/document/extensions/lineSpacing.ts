import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineSpacing: {
      setLineSpacing: (spacing: string | number) => ReturnType;
      unsetLineSpacing: () => ReturnType;
    };
  }
}

export const LineSpacing = Extension.create({
  name: 'lineSpacing',

  addOptions() {
    return {
      types: ['paragraph'],
      defaultSpacing: '1.15',
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineSpacing: {
            default: '1.15',
            parseHTML: (element) => {
              const lh = element.style.lineHeight;
              if (!lh) return '1.15';
              return lh;
            },
            renderHTML: (attributes) => {
              if (!attributes.lineSpacing || attributes.lineSpacing === '1.15') {
                return {
                  style: 'line-height: 1.15',
                };
              }
              return {
                style: `line-height: ${attributes.lineSpacing}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineSpacing:
        (spacing: string | number) =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.updateAttributes(type, { lineSpacing: String(spacing) })
          );
        },
      unsetLineSpacing:
        () =>
        ({ commands }) => {
          return this.options.types.every((type: string) =>
            commands.resetAttributes(type, 'lineSpacing')
          );
        },
    };
  },
});

