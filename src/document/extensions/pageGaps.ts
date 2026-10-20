import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { mmToPx, PAGE_MM, pageSetupFromDoc } from '../pageSetup';

const pageGapKey = new PluginKey<DecorationSet>('folioPageGaps');
const DESK_PX = 28;

function gapElement(bottomPx: number, topPx: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'folio-page-gap no-print';
  el.setAttribute('contenteditable', 'false');
  const end = document.createElement('div');
  end.className = 'folio-page-gap-end';
  end.style.height = `${bottomPx}px`;
  const desk = document.createElement('div');
  desk.className = 'folio-page-gap-desk';
  const start = document.createElement('div');
  start.className = 'folio-page-gap-start';
  start.style.height = `${topPx}px`;
  el.append(end, desk, start);
  return el;
}

function measureGaps(view: EditorView): { set: DecorationSet; sig: string } {
  const setup = pageSetupFromDoc({ type: 'doc', attrs: view.state.doc.attrs });
  const page = PAGE_MM[setup.size];
  const inner = Math.max(1, mmToPx(page.height - setup.marginTop - setup.marginBottom));
  const topPx = mmToPx(setup.marginTop);
  const bottomPx = mmToPx(setup.marginBottom);
  const widgets: Decoration[] = [];
  const heights: number[] = [];
  let used = 0;

  view.state.doc.forEach((node, offset) => {
    // A widget has to sit between blocks. offset + 1 is inside the node, and a
    // div there is illegal in a paragraph, heading, list, or table.
    const pos = node.type.name === 'pageBreak' ? offset + node.nodeSize : offset;
    if (node.type.name === 'pageBreak') {
      widgets.push(
        Decoration.widget(pos, () => gapElement(bottomPx, topPx), {
          side: -1,
          ignoreSelection: true,
          key: `gap-${pos}`,
        })
      );
      heights.push(-1);
      used = 0;
      return;
    }
    const dom = view.nodeDOM(offset);
    const height = dom instanceof HTMLElement ? dom.offsetHeight : 0;
    heights.push(Math.round(height));
    if (used > 0 && used + height > inner + 0.5) {
      widgets.push(
        Decoration.widget(pos, () => gapElement(bottomPx, topPx), {
          side: -1,
          ignoreSelection: true,
          key: `gap-${pos}`,
        })
      );
      used = height;
    } else {
      used += height;
    }
  });

  const sig = `${setup.size}:${setup.marginTop}:${setup.marginBottom}:${Math.round(inner)}:${heights.join(',')}`;
  return { set: DecorationSet.create(view.state.doc, widgets), sig };
}

export const PageGaps = Extension.create({
  name: 'pageGaps',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pageGapKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(pageGapKey) as DecorationSet | undefined;
            if (meta) return meta;
            if (tr.docChanged) return old.map(tr.mapping, tr.doc);
            return old;
          },
        },
        props: {
          decorations(state) {
            return pageGapKey.getState(state) ?? DecorationSet.empty;
          },
        },
        view(view) {
          let frame = 0;
          let lastSig = '';
          let dead = false;

          const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
              if (dead || !view.dom.isConnected) return;
              try {
                const next = measureGaps(view);
                if (next.sig === lastSig) return;
                lastSig = next.sig;
                view.dispatch(
                  view.state.tr
                    .setMeta(pageGapKey, next.set)
                    .setMeta('addToHistory', false)
                    .setMeta('skipTrailingNode', true)
                );
              } catch {
                // A failed measure leaves the previous gaps in place.
              }
            });
          };

          const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null;
          observer?.observe(view.dom);
          schedule();

          return {
            update: schedule,
            destroy() {
              dead = true;
              cancelAnimationFrame(frame);
              observer?.disconnect();
            },
          };
        },
      }),
    ];
  },
});
