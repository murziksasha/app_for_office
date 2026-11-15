export interface TextStatistics {
  pages: number;
  words: number;
  charactersNoSpaces: number;
  charactersWithSpaces: number;
  paragraphs: number;
  lines: number;
}

export interface DocumentWordCountStats {
  document: TextStatistics;
  selection: TextStatistics | null;
  hasSelection: boolean;
}

/**
 * Calculates words, characters with/without spaces, paragraphs, and estimated lines
 * from a raw text string and paragraph count.
 */
export function calculateTextStats(text: string, blockCount?: number, totalPages: number = 1): TextStatistics {
  const normalized = (text || '').replace(/\r\n/g, '\n');
  const charactersWithSpaces = normalized.length;
  const charactersNoSpaces = normalized.replace(/\s/g, '').length;

  const trimmed = normalized.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;

  // Count paragraphs based on non-empty blocks or newlines
  let paragraphs = 0;
  if (typeof blockCount === 'number' && blockCount > 0) {
    paragraphs = blockCount;
  } else if (trimmed) {
    paragraphs = normalized.split(/\n+/).filter((s) => s.trim().length > 0).length || 1;
  }

  // Count lines: each newline or wrapped line (~70-80 chars)
  let lines = 0;
  if (trimmed) {
    const rawLines = normalized.split('\n');
    for (const line of rawLines) {
      const len = line.length;
      lines += len === 0 ? 1 : Math.max(1, Math.ceil(len / 75));
    }
  }

  return {
    pages: Math.max(1, totalPages),
    words,
    charactersNoSpaces,
    charactersWithSpaces,
    paragraphs,
    lines,
  };
}

/**
 * Extracts comprehensive statistics from a Tiptap / ProseMirror editor instance.
 */
export function getEditorStats(editor: any, totalPages: number = 1): DocumentWordCountStats {
  if (!editor || !editor.state || !editor.state.doc) {
    const emptyStats: TextStatistics = {
      pages: Math.max(1, totalPages),
      words: 0,
      charactersNoSpaces: 0,
      charactersWithSpaces: 0,
      paragraphs: 0,
      lines: 0,
    };
    return {
      document: emptyStats,
      selection: null,
      hasSelection: false,
    };
  }

  const doc = editor.state.doc;
  const selection = editor.state.selection;

  // Count paragraphs and blocks in doc
  let docParagraphs = 0;
  doc.descendants((node: any) => {
    if (node.isBlock && (node.type.name === 'paragraph' || node.type.name === 'heading' || node.type.name === 'blockquote')) {
      docParagraphs++;
    }
  });

  const fullText = doc.textBetween(0, doc.content.size, '\n', ' ');
  const docStats = calculateTextStats(fullText, docParagraphs, totalPages);

  let selectionStats: TextStatistics | null = null;
  const hasSelection = selection && !selection.empty;

  if (hasSelection) {
    const selText = doc.textBetween(selection.from, selection.to, '\n', ' ');
    // Count blocks within selection
    let selParagraphs = 0;
    doc.nodesBetween(selection.from, selection.to, (node: any) => {
      if (node.isBlock && (node.type.name === 'paragraph' || node.type.name === 'heading' || node.type.name === 'blockquote')) {
        selParagraphs++;
      }
    });
    selectionStats = calculateTextStats(selText, selParagraphs, 1);
  }

  return {
    document: docStats,
    selection: selectionStats,
    hasSelection,
  };
}
