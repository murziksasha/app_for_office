import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import { mmToPx, PAGE_MM, pageSetupFromDoc } from '../pageSetup';
import { computeDocumentPagination } from '../pagination';
import {
  chromeFromDoc,
  resolveStoryForPage,
  type ChromeStory,
  type ChromeStoryTarget,
} from '../chrome';
import { createBandElement } from '../bandRenderer';

const pageGapKey = new PluginKey<DecorationSet>('folioPageGaps');

function createGapElement(
  bottomPx: number,
  topPx: number,
  bottomBand?: HTMLElement | null,
  topBand?: HTMLElement | null
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'folio-page-gap no-print';
  el.setAttribute('contenteditable', 'false');

  const end = document.createElement('div');
  end.className = 'folio-page-gap-end';
  end.style.height = `${bottomPx}px`;
  if (bottomBand) end.appendChild(bottomBand);

  const desk = document.createElement('div');
  desk.className = 'folio-page-gap-desk';

  const start = document.createElement('div');
  start.className = 'folio-page-gap-start';
  start.style.height = `${topPx}px`;
  if (topBand) start.appendChild(topBand);

  el.append(end, desk, start);
  return el;
}

function measureGaps(view: EditorView): { set: DecorationSet; sig: string } {
  const setup = pageSetupFromDoc({ type: 'doc', attrs: view.state.doc.attrs });
  const chrome = chromeFromDoc(view.state.doc);
  const topPx = mmToPx(setup.marginTop);
  const bottomPx = mmToPx(setup.marginBottom);

  const { gapPositions, totalPages, heights, innerPx } = computeDocumentPagination(
    view.state.doc,
    setup,
    (offset) => {
      const dom = view.nodeDOM(offset);
      return dom instanceof HTMLElement ? dom.offsetHeight : 0;
    }
  );

  const widgets: Decoration[] = [];

  // Top margin of Page 1: pos 0
  const p1HeaderStory = resolveStoryForPage(chrome, 'header', 1);
  const p1HeaderTarget: ChromeStoryTarget = chrome.differentFirstPage ? 'firstHeader' : 'header';
  widgets.push(
    Decoration.widget(
      0,
      () => {
        const wrap = document.createElement('div');
        wrap.className = 'folio-header-top-band no-print';
        wrap.setAttribute('contenteditable', 'false');
        wrap.style.height = `${topPx}px`;
        const bandEl = createBandElement({
          storyTarget: p1HeaderTarget,
          story: p1HeaderStory,
          bandType: 'header',
          pageIndex: 1,
          totalPages,
          heightPx: topPx,
          view,
        });
        wrap.appendChild(bandEl);
        return wrap;
      },
      {
        side: -1,
        ignoreSelection: true,
        key: `header-p1`,
      }
    )
  );

  // Each page gap
  gapPositions.forEach((pos, gapIdx) => {
    const prevPageIndex = gapIdx + 1;
    const nextPageIndex = gapIdx + 2;

    const prevFooterStory = resolveStoryForPage(chrome, 'footer', prevPageIndex);
    const prevFooterTarget: ChromeStoryTarget =
      chrome.differentFirstPage && prevPageIndex === 1 ? 'firstFooter' : 'footer';

    const nextHeaderStory = resolveStoryForPage(chrome, 'header', nextPageIndex);
    const nextHeaderTarget: ChromeStoryTarget = 'header';

    widgets.push(
      Decoration.widget(
        pos,
        () => {
          const bottomBand = createBandElement({
            storyTarget: prevFooterTarget,
            story: prevFooterStory,
            bandType: 'footer',
            pageIndex: prevPageIndex,
            totalPages,
            heightPx: bottomPx,
            view,
          });
          const topBand = createBandElement({
            storyTarget: nextHeaderTarget,
            story: nextHeaderStory,
            bandType: 'header',
            pageIndex: nextPageIndex,
            totalPages,
            heightPx: topPx,
            view,
          });
          return createGapElement(bottomPx, topPx, bottomBand, topBand);
        },
        {
          side: -1,
          ignoreSelection: true,
          key: `gap-${pos}`,
        }
      )
    );
  });

  // Bottom margin of last page: doc.content.size
  const lastPageIndex = totalPages;
  const lastFooterStory = resolveStoryForPage(chrome, 'footer', lastPageIndex);
  const lastFooterTarget: ChromeStoryTarget =
    chrome.differentFirstPage && lastPageIndex === 1 ? 'firstFooter' : 'footer';

  widgets.push(
    Decoration.widget(
      view.state.doc.content.size,
      () => {
        const wrap = document.createElement('div');
        wrap.className = 'folio-footer-bottom-band no-print';
        wrap.setAttribute('contenteditable', 'false');
        wrap.style.height = `${bottomPx}px`;
        const bandEl = createBandElement({
          storyTarget: lastFooterTarget,
          story: lastFooterStory,
          bandType: 'footer',
          pageIndex: lastPageIndex,
          totalPages,
          heightPx: bottomPx,
          view,
        });
        wrap.appendChild(bandEl);
        return wrap;
      },
      {
        side: 1,
        ignoreSelection: true,
        key: `footer-last`,
      }
    )
  );

  const sig = `${setup.size}:${setup.marginTop}:${setup.marginBottom}:${setup.marginLeft}:${setup.marginRight}:${Math.round(innerPx)}:${heights.join(',')}:${JSON.stringify(chrome)}`;
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
