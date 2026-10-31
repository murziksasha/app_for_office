import { Node, mergeAttributes } from '@tiptap/core';
import { generateTocItems, type TocItem } from '../toc';
import { pageSetupFromDoc } from '../pageSetup';
import { t } from '../../i18n/instance';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toc: {
      insertTableOfContents: () => ReturnType;
    };
  }
}

export const TableOfContentsExtension = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      items: {
        default: [],
        parseHTML: (element) => {
          const raw = element.getAttribute('data-items');
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes) => {
          return {
            'data-items': JSON.stringify(attributes.items || []),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'nav[data-type="toc"]',
      },
      {
        tag: 'div[data-type="toc"]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const items: TocItem[] = node.attrs.items || [];
    const children: any[] = [
      'p',
      { class: 'folio-toc-title', style: 'font-weight: bold; margin-bottom: 8px;' },
      'Table of Contents',
    ];

    const entryElements = items.map((item) => [
      'p',
      {
        class: 'folio-toc-entry',
        'data-level': String(item.level),
        style: `margin: 4px 0; padding-left: ${(item.level - 1) * 16}px;`,
      },
      ['span', { class: 'folio-toc-text' }, item.text],
      ['span', { class: 'folio-toc-leader', style: 'float: right;' }, String(item.page)],
    ]);

    return [
      'nav',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'toc',
        class: 'folio-toc folio-toc-block',
      }),
      children,
      ...entryElements,
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('nav');
      dom.className = 'folio-toc folio-toc-block';
      dom.setAttribute('data-type', 'toc');
      dom.setAttribute('contenteditable', 'false');

      const computeCurrentItems = (): TocItem[] => {
        try {
          const setup = pageSetupFromDoc(editor.getJSON());
          return generateTocItems(editor.state.doc, setup, (offset) => {
            const nodeDom = editor.view?.nodeDOM?.(offset);
            return nodeDom instanceof HTMLElement ? nodeDom.offsetHeight : 0;
          });
        } catch {
          return [];
        }
      };

      const updateView = () => {
        dom.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'folio-toc-header';
        header.style.cssText =
          'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; user-select: none; border-bottom: 1px solid var(--folio-border-light); padding-bottom: 6px;';

        const title = document.createElement('span');
        title.className = 'folio-toc-title';
        title.style.cssText = 'font-weight: 700; font-size: 15px; color: var(--folio-ink);';
        title.textContent = t('document.tableOfContents');
        header.appendChild(title);

        const updateBtn = document.createElement('button');
        updateBtn.type = 'button';
        updateBtn.className = 'folio-toc-update-btn';
        updateBtn.style.cssText =
          'background: #fff; border: 1px solid var(--folio-border); border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; color: var(--folio-ink); font-weight: 500;';
        updateBtn.textContent = t('document.updateToc');
        updateBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          recalculate();
        };
        header.appendChild(updateBtn);
        dom.appendChild(header);

        const items: TocItem[] =
          node.attrs.items && node.attrs.items.length > 0 ? node.attrs.items : computeCurrentItems();

        if (items.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'folio-toc-empty';
          empty.style.cssText =
            'color: var(--folio-ink-muted); font-size: 12px; font-style: italic; padding: 8px 0;';
          empty.textContent = t('document.noHeadingsToc');
          dom.appendChild(empty);
        } else {
          const list = document.createElement('div');
          list.className = 'folio-toc-entries';
          list.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

          items.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'folio-toc-item';
            row.setAttribute('data-toc-level', String(item.level));
            row.setAttribute('data-toc-page', String(item.page));
            row.style.cssText = `display: flex; align-items: center; font-size: 13px; color: var(--folio-ink); padding-left: ${
              (item.level - 1) * 16
            }px; cursor: pointer; border-radius: 3px; padding-top: 2px; padding-bottom: 2px;`;

            const textSpan = document.createElement('span');
            textSpan.className = 'folio-toc-text';
            textSpan.style.cssText = item.level === 1 ? 'font-weight: 600;' : '';
            textSpan.textContent = item.text;
            row.appendChild(textSpan);

            const leaderSpan = document.createElement('span');
            leaderSpan.className = 'folio-toc-leader';
            leaderSpan.style.cssText =
              'flex: 1; border-bottom: 1px dotted var(--folio-ink-muted, #94a3b8); margin: 0 8px; height: 12px;';
            row.appendChild(leaderSpan);

            const pageSpan = document.createElement('span');
            pageSpan.className = 'folio-toc-page';
            pageSpan.style.cssText = 'font-variant-numeric: tabular-nums; font-weight: 500;';
            pageSpan.textContent = String(item.page);
            row.appendChild(pageSpan);

            row.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              if (typeof item.pos === 'number') {
                const target = Math.min(item.pos + 1, editor.state.doc.content.size);
                editor.chain().focus().setTextSelection(target).scrollIntoView().run();
              }
            };

            list.appendChild(row);
          });

          dom.appendChild(list);
        }
      };

      const recalculate = () => {
        const newItems = computeCurrentItems();
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos === 'number') {
          editor.chain().setNodeSelection(pos).updateAttributes('toc', { items: newItems }).run();
        }
        updateView();
      };

      updateView();

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'toc') return false;
          node = updatedNode;
          updateView();
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands, editor }) => {
          const setup = pageSetupFromDoc(editor.getJSON());
          const items = generateTocItems(editor.state.doc, setup);
          return commands.insertContent({
            type: this.name,
            attrs: { items },
          });
        },
    };
  },
});

