import { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface TextRange {
  from: number;
  to: number;
}

export interface FindOptions {
  matchCase?: boolean;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findTextRanges(
  doc: ProseMirrorNode,
  query: string,
  options?: FindOptions
): TextRange[] {
  if (!query || !doc) return [];
  const escaped = escapeRegex(query);
  const flags = options?.matchCase ? 'g' : 'gi';
  const regex = new RegExp(escaped, flags);
  const ranges: TextRange[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(node.text)) !== null) {
        ranges.push({
          from: pos + match.index,
          to: pos + match.index + match[0].length,
        });
      }
    }
  });

  return ranges;
}

export function replaceOne(
  editor: any,
  range: TextRange,
  replacement: string
): boolean {
  if (!editor || !editor.state || !range) return false;
  const { tr, schema } = editor.state;
  const $from = editor.state.doc.resolve(range.from);
  const node = $from.nodeAfter;
  const marks = node?.isText ? node.marks : $from.marks();

  if (replacement.length > 0) {
    tr.replaceWith(range.from, range.to, schema.text(replacement, marks));
  } else {
    tr.delete(range.from, range.to);
  }
  editor.view.dispatch(tr);
  return true;
}

export function replaceAll(
  editor: any,
  query: string,
  replacement: string,
  options?: FindOptions
): number {
  if (!editor || !editor.state || !query) return 0;
  const ranges = findTextRanges(editor.state.doc, query, options);
  if (ranges.length === 0) return 0;

  const { tr, schema } = editor.state;
  // Replace in reverse order so position indices for earlier ranges remain valid
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    const $from = tr.doc.resolve(range.from);
    const node = $from.nodeAfter;
    const marks = node?.isText ? node.marks : $from.marks();
    if (replacement.length > 0) {
      tr.replaceWith(range.from, range.to, schema.text(replacement, marks));
    } else {
      tr.delete(range.from, range.to);
    }
  }
  editor.view.dispatch(tr);
  return ranges.length;
}

export function findNextIndex(total: number, currentIndex: number): number {
  if (total <= 0) return -1;
  if (currentIndex < 0) return 0;
  return (currentIndex + 1) % total;
}

export function findPreviousIndex(total: number, currentIndex: number): number {
  if (total <= 0) return -1;
  if (currentIndex < 0) return total - 1;
  return (currentIndex - 1 + total) % total;
}

