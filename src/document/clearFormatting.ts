export function clearFormatting(editor: any): void {
  if (!editor || !editor.state) return;
  const chain = editor.chain().focus();
  chain.unsetAllMarks();

  if (typeof chain.setTextAlign === 'function') {
    chain.setTextAlign('left');
  }
  if (typeof chain.setLineSpacing === 'function') {
    chain.setLineSpacing('1.15');
  }

  chain.command(({ tr, state, dispatch }: any) => {
    const { from, to } = state.selection;
    state.doc.nodesBetween(from, to, (node: any, pos: number) => {
      if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        const attrs = { ...node.attrs };
        let changed = false;
        if (attrs.textAlign && attrs.textAlign !== 'left') {
          attrs.textAlign = 'left';
          changed = true;
        }
        if (attrs.indent && attrs.indent !== 0) {
          attrs.indent = 0;
          changed = true;
        }
        if (attrs.lineSpacing && attrs.lineSpacing !== '1.15') {
          attrs.lineSpacing = '1.15';
          changed = true;
        }
        if (changed && dispatch) {
          tr.setNodeMarkup(pos, undefined, attrs);
        }
      }
    });
    return true;
  });

  chain.run();
}

