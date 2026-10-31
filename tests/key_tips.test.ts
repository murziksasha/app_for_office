import { describe, it, expect, vi } from 'vitest';
import {
  TAB_KEY_TIPS,
  QUICK_ACCESS_KEY_TIPS,
  handleKeyTipKey,
  type KeyTipState,
} from '../src/shell/keyTips';

describe('Key Tips logic (Alt Ribbon Navigation)', () => {
  it('maps standard badges for tabs (F=File, H=Home, I=Insert, L=Layout, V=View)', () => {
    expect(TAB_KEY_TIPS.file).toBe('F');
    expect(TAB_KEY_TIPS.home).toBe('H');
    expect(TAB_KEY_TIPS.insert).toBe('I');
    expect(TAB_KEY_TIPS.layout).toBe('L');
    expect(TAB_KEY_TIPS.view).toBe('V');
  });

  it('maps numbers for quick access row (1=Save, 2=Undo, 3=Redo, 4=Print)', () => {
    expect(QUICK_ACCESS_KEY_TIPS.save).toBe('1');
    expect(QUICK_ACCESS_KEY_TIPS.undo).toBe('2');
    expect(QUICK_ACCESS_KEY_TIPS.redo).toBe('3');
    expect(QUICK_ACCESS_KEY_TIPS.print).toBe('4');
  });

  it('activates tab and enters commands mode when typing tab badge letter in tabs mode', () => {
    const onSelectTab = vi.fn();
    const state: KeyTipState = { mode: 'tabs', activeTab: 'file' };
    const availableTabs = ['file', 'home', 'insert', 'layout'];
    const commandsForTab = {};
    const quickAccess = {};

    const result = handleKeyTipKey('h', state, availableTabs, commandsForTab, quickAccess, onSelectTab);
    expect(onSelectTab).toHaveBeenCalledWith('home');
    expect(result.nextState).toEqual({ mode: 'commands', activeTab: 'home' });
  });

  it('executes file tab and exits key tips when typing F in tabs mode', () => {
    const onSelectTab = vi.fn();
    const state: KeyTipState = { mode: 'tabs', activeTab: 'home' };
    const availableTabs = ['file', 'home', 'insert'];

    const result = handleKeyTipKey('F', state, availableTabs, {}, {}, onSelectTab);
    expect(onSelectTab).toHaveBeenCalledWith('file');
    expect(result.nextState.mode).toBe('none');
    expect(result.executed).toBe(true);
  });

  it('steps back to tabs mode on Escape in commands mode, and exits on second Escape', () => {
    const onSelectTab = vi.fn();
    // In commands mode
    const inCommands: KeyTipState = { mode: 'commands', activeTab: 'home' };
    const firstEscape = handleKeyTipKey('Escape', inCommands, ['file', 'home'], {}, {}, onSelectTab);
    expect(firstEscape.nextState).toEqual({ mode: 'tabs', activeTab: 'home' });

    // In tabs mode
    const secondEscape = handleKeyTipKey('Escape', firstEscape.nextState, ['file', 'home'], {}, {}, onSelectTab);
    expect(secondEscape.nextState).toEqual({ mode: 'none', activeTab: 'home' });
  });

  it('executes matching command and exits key tips in commands mode', () => {
    const boldSpy = vi.fn();
    const inCommands: KeyTipState = { mode: 'commands', activeTab: 'home' };
    const commandsForTab = { B: boldSpy };

    const result = handleKeyTipKey('b', inCommands, ['home'], commandsForTab, {}, vi.fn());
    expect(boldSpy).toHaveBeenCalledTimes(1);
    expect(result.nextState.mode).toBe('none');
    expect(result.executed).toBe(true);
  });

  it('executes quick-access command when typing its number in tabs mode', () => {
    const saveSpy = vi.fn();
    const state: KeyTipState = { mode: 'tabs', activeTab: 'home' };
    const quickAccess = { save: saveSpy };

    const result = handleKeyTipKey('1', state, ['home'], {}, quickAccess, vi.fn());
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(result.nextState.mode).toBe('none');
    expect(result.executed).toBe(true);
  });
});

