export interface HeadingItem {
  level: number;
  text: string;
  pos: number;
}

/**
 * Extracts headings 1 to 3 from a document (ProseMirror Node or JSONContent).
 * Headings with level 4 or higher are ignored.
 * Returns items in document order with { level, text, pos }.
 */
export function getHeadings(doc: any): HeadingItem[] {
  if (!doc) return [];
  const result: HeadingItem[] = [];

  // If it's a ProseMirror Node with .descendants
  if (typeof doc.descendants === 'function') {
    doc.descendants((node: any, pos: number) => {
      if (node.type?.name === 'heading') {
        const level = Number(node.attrs?.level || 1);
        if (level >= 1 && level <= 3) {
          result.push({
            level,
            text: node.textContent || '',
            pos,
          });
        }
        return false;
      }
    });
    return result;
  }

  // If it's a JSONContent tree
  function walkJson(node: any, currentPos: number): number {
    if (!node) return 0;
    if (typeof node.text === 'string') {
      return node.text.length;
    }

    const isDoc = node.type === 'doc';
    const isHeading = node.type === 'heading';

    if (isHeading) {
      const level = Number(node.attrs?.level || 1);
      const text = extractNodeText(node);
      if (level >= 1 && level <= 3) {
        result.push({
          level,
          text,
          pos: currentPos,
        });
      }
    }

    if (!Array.isArray(node.content)) {
      return 1;
    }

    let innerSize = 0;
    for (const child of node.content) {
      const childPos = isDoc ? currentPos + innerSize : currentPos + 1 + innerSize;
      const childSize = walkJson(child, childPos);
      innerSize += childSize;
    }

    return isDoc ? innerSize : innerSize + 2;
  }

  function extractNodeText(node: any): string {
    if (typeof node.text === 'string') return node.text;
    if (Array.isArray(node.content)) {
      return node.content.map(extractNodeText).join('');
    }
    return '';
  }

  walkJson(doc, 0);
  return result;
}

export const getOutline = getHeadings;
export default getHeadings;

