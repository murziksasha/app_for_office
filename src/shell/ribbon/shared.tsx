import React, { useEffect, useState } from 'react';

export function commandRow(children: React.ReactNode) {
  return <div className="folio-ribbon-row">{children}</div>;
}

export function useEditorTick(editor: any) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor?.on) return;
    const refresh = () => setTick((n) => n + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);
}

export function clip(editor: any, command: 'cut' | 'copy' | 'paste') {
  if (!editor) return;
  editor.chain().focus().run();
  document.execCommand(command);
}

