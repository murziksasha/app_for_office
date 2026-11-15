import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { isWordMisspelled } from './checker';
import { onUserDictionaryChange } from './userDictionary';
import { i18n } from '../../i18n/instance';

export const spellCheckPluginKey = new PluginKey('folioSpellCheck');

export interface SpellCheckOptions {
  enabled?: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spellCheck: {
      toggleSpellCheck: () => ReturnType;
      setSpellCheckEnabled: (enabled: boolean) => ReturnType;
    };
  }
}

export function findMisspellings(doc: any, lang: string): DecorationSet {
  const decorations: Decoration[] = [];
  const wordRegex = /[a-zA-Zа-яА-ЯіїєґІЇЄҐ']+/g;

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(text)) !== null) {
      const rawWord = match[0];
      const from = pos + match.index;
      const to = from + rawWord.length;

      if (isWordMisspelled(rawWord, lang)) {
        decorations.push(
          Decoration.inline(from, to, {
            class: 'folio-misspelling',
            'data-misspelled-word': rawWord,
          })
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const SpellCheck = Extension.create<SpellCheckOptions>({
  name: 'spellCheck',

  addOptions() {
    return {
      enabled: true,
    };
  },

  addCommands() {
    return {
      toggleSpellCheck:
        () =>
        ({ tr, dispatch, state }) => {
          const current = spellCheckPluginKey.getState(state);
          const next = !current?.enabled;
          if (dispatch) {
            tr.setMeta(spellCheckPluginKey, { enabled: next });
          }
          return true;
        },
      setSpellCheckEnabled:
        (enabled: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(spellCheckPluginKey, { enabled });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    let unsubscribe: (() => void) | null = null;
    let viewRef: any = null;

    return [
      new Plugin({
        key: spellCheckPluginKey,
        state: {
          init: () => ({ enabled: this.options.enabled !== false, version: 0 }),
          apply(tr, prev) {
            const meta = tr.getMeta(spellCheckPluginKey);
            if (meta && typeof meta.enabled === 'boolean') {
              return { ...prev, enabled: meta.enabled };
            }
            if (meta && meta.refresh) {
              return { ...prev, version: prev.version + 1 };
            }
            return prev;
          },
        },
        view(editorView) {
          viewRef = editorView;
          unsubscribe = onUserDictionaryChange(() => {
            if (viewRef && !viewRef.isDestroyed) {
              const tr = viewRef.state.tr.setMeta(spellCheckPluginKey, { refresh: true });
              viewRef.dispatch(tr);
            }
          });
          return {
            destroy() {
              if (unsubscribe) unsubscribe();
            },
          };
        },
        props: {
          decorations(state) {
            const pluginState = spellCheckPluginKey.getState(state);
            if (!pluginState || !pluginState.enabled) {
              return DecorationSet.empty;
            }
            const lang = i18n?.language || 'en';
            return findMisspellings(state.doc, lang);
          },
        },
      }),
    ];
  },
});

