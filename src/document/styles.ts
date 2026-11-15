export type DocumentStyleName =
  | 'Normal'
  | 'Title'
  | 'Heading 1'
  | 'Heading 2'
  | 'Heading 3'
  | 'Quote';

/**
 * Applies one of the standard document styles to the current editor selection.
 * Sets the active node and the paragraph/heading/blockquote attr styleName.
 */
export function applyDocumentStyle(editor: any, style: DocumentStyleName): void {
  if (!editor) return;
  switch (style) {
    case 'Normal':
      editor
        .chain()
        .focus()
        .clearNodes()
        .setParagraph()
        .updateAttributes('paragraph', { styleName: 'Normal' })
        .run();
      break;
    case 'Title':
      editor
        .chain()
        .focus()
        .clearNodes()
        .setHeading({ level: 1 })
        .updateAttributes('heading', { styleName: 'Title' })
        .setFontSize('26pt')
        .run();
      break;
    case 'Heading 1':
      editor
        .chain()
        .focus()
        .clearNodes()
        .setHeading({ level: 1 })
        .updateAttributes('heading', { styleName: 'Heading 1' })
        .run();
      break;
    case 'Heading 2':
      editor
        .chain()
        .focus()
        .clearNodes()
        .setHeading({ level: 2 })
        .updateAttributes('heading', { styleName: 'Heading 2' })
        .run();
      break;
    case 'Heading 3':
      editor
        .chain()
        .focus()
        .clearNodes()
        .setHeading({ level: 3 })
        .updateAttributes('heading', { styleName: 'Heading 3' })
        .run();
      break;
    case 'Quote':
      editor
        .chain()
        .focus()
        .clearNodes()
        .setBlockquote()
        .updateAttributes('blockquote', { styleName: 'Quote' })
        .updateAttributes('paragraph', { styleName: 'Quote' })
        .run();
      break;
  }
}
