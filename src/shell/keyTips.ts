export type KeyTipMode = 'none' | 'tabs' | 'commands';

export interface KeyTipState {
  mode: KeyTipMode;
  activeTab: string;
}

export const TAB_KEY_TIPS: Record<string, string> = {
  file: 'F',
  home: 'H',
  insert: 'I',
  layout: 'L',
  view: 'V',
};

export const QUICK_ACCESS_KEY_TIPS: Record<string, string> = {
  save: '1',
  undo: '2',
  redo: '3',
  print: '4',
};

export const HOME_DOCUMENT_COMMAND_TIPS: Record<string, string> = {
  B: 'bold',
  I: 'italic',
  U: 'underline',
  C: 'copy',
  X: 'cut',
  V: 'paste',
};

export function handleKeyTipKey(
  key: string,
  state: KeyTipState,
  availableTabs: string[],
  commandsForTab: Record<string, () => void>,
  quickAccessCommands: Record<string, () => void>,
  onSelectTab: (tab: string) => void,
): { nextState: KeyTipState; executed?: boolean } {
  if (key === 'Escape') {
    if (state.mode === 'commands') {
      return { nextState: { mode: 'tabs', activeTab: state.activeTab } };
    }
    if (state.mode === 'tabs') {
      return { nextState: { mode: 'none', activeTab: state.activeTab } };
    }
    return { nextState: state };
  }

  const upper = key.toUpperCase();

  if (state.mode === 'tabs') {
    // Check quick access row (1=Save, 2=Undo, 3=Redo, 4=Print)
    for (const [actionId, tipKey] of Object.entries(QUICK_ACCESS_KEY_TIPS)) {
      if (tipKey === upper && quickAccessCommands[actionId]) {
        quickAccessCommands[actionId]();
        return { nextState: { mode: 'none', activeTab: state.activeTab }, executed: true };
      }
    }

    // Check ribbon tabs (F, H, I, L, V)
    for (const tab of availableTabs) {
      if (TAB_KEY_TIPS[tab] === upper) {
        onSelectTab(tab);
        if (tab === 'file') {
          return { nextState: { mode: 'none', activeTab: tab }, executed: true };
        }
        return { nextState: { mode: 'commands', activeTab: tab } };
      }
    }
  }

  if (state.mode === 'commands') {
    if (commandsForTab[upper]) {
      commandsForTab[upper]();
      return { nextState: { mode: 'none', activeTab: state.activeTab }, executed: true };
    }
  }

  return { nextState: state };
}

