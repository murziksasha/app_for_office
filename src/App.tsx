import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DraftItem, DocumentKind, EditorState, ImportReport, RecentItem, SupportedFormat } from './types';
import {
  getPlatformAdapter,
  hasFileSystemAccess,
  hasSaveFilePicker,
  isDesktopPlatform,
  pickFilesToOpen,
  readFileFromPath,
  setWindowTitle,
  setupCloseGuard,
  setupFileDropHandler,
  setupOpenRequestHandler,
  verifyPermission,
  type PlatformFileResult,
} from './platform';
import { finishOpenedTab, loadFileToEditor } from './files/open';
import { i18n, t } from './i18n/instance';
import { saveEditorContent } from './files/save';
import { clearDraft, getAllDrafts, saveDraft } from './files/drafts';
import { addRecentFile, getRecentFiles, removeRecentFile } from './files/recent';
import {
  CONFLICT_BUTTONS,
  DRAFT_OPEN_BUTTONS,
  DRAFT_REPLACE_BUTTONS,
  RELOAD_BUTTONS,
  SAVE_BUTTONS,
  closeContinues,
  contentHash,
  decideSave,
  findTabByHandle,
  getActiveSheet,
  isDiskNewer,
  isLossySave,
  isSafeSavePath,
  lossyWarningMessage,
  nextDirtyIndex,
  nextFileName,
  pathsMatch,
  planOpenBatch,
  printButtons,
  printScopeFromChoice,
  printScopeNeeded,
  resolvePickedName,
  saveFiltersForKind,
  shouldRemoveRecent,
  suggestedSaveName,
  type OpenCandidate,
  type PathStatus,
  type TabRef,
} from './files/session';
import { htmlToDocument } from './document/model';
import { markdownToHtml, plainTextToHtml } from './document/textMdHtml';
import { importCsvTsv } from './spreadsheet/adapters';
import { applyEdit, blankTab, draftContent, newTabId, stampClean, tabFromDraft } from './files/tabs';
import { exportPdf } from './pdf/exportPdf';
import { extractTextFromPdf } from './pdf/extractText';
import { StartScreen } from './shell/StartScreen';
import { Ribbon } from './shell/Ribbon';
import { StatusBar } from './shell/StatusBar';
import { ImportReportDialog } from './shell/ImportReportDialog';
import { SaveAsDialog } from './shell/SaveAsDialog';
import { ChoiceDialog } from './shell/ChoiceDialog';
import { TabStrip } from './shell/TabStrip';
import { PrintView } from './shell/PrintView';
import { DocumentEditor } from './document/DocumentEditor';
import { SpreadsheetEditor } from './spreadsheet/SpreadsheetEditor';
import { SlideEditor, emptySlideCommandState, type SlideCommandState, type SlideEditorHandle } from './slides/SlideEditor';
import type { WorkbookInstance } from '@fortune-sheet/react';
import { PdfViewer } from './pdf/PdfViewer';

interface ChoiceState {
  title: string;
  message: string;
  buttons: string[];
}

interface Incoming extends OpenCandidate {
  name: string;
  file?: File;
  handle?: FileSystemFileHandle;
  draft?: DraftItem;
}

type SaveOutcome = 'ok' | 'cancelled' | 'failed';

export const App: React.FC = () => {
  const [tabs, setTabs] = useState<EditorState[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [homeOpen, setHomeOpen] = useState(false);
  const [documentEditorInstance, setDocumentEditorInstance] = useState<any>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showImportReport, setShowImportReport] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentItem[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [listsRevision, setListsRevision] = useState(0);
  const [choice, setChoice] = useState<ChoiceState | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfCount, setPdfCount] = useState(1);
  const [printJob, setPrintJob] = useState<{ tab: EditorState; scope: 'current' | 'all' } | null>(null);
  const [findSignal, setFindSignal] = useState(0);
  const [slideState, setSlideState] = useState<SlideCommandState>(emptySlideCommandState);
  const [uiLanguage, setUiLanguage] = useState(i18n.language);
  const slideCommands = useRef<SlideEditorHandle>(null);
  const sheetApi = useRef<WorkbookInstance | null>(null);
  const handleWorkbookReady = useCallback((api: WorkbookInstance | null) => {
    sheetApi.current = api;
  }, []);

  const tabsRef = useRef<EditorState[]>([]);
  const activeRef = useRef<string | null>(null);
  const homeOpenRef = useRef(false);
  const lastFileIdRef = useRef<string | null>(null);
  const choiceRef = useRef<((value: string | null) => void) | null>(null);
  const busyRef = useRef(false);
  const actionsRef = useRef({
    confirmClose: async () => true,
    openPaths: async (_paths: string[]) => {},
    openFiles: async (_files: PlatformFileResult[]) => {},
    saveActive: async () => {},
    saveAsActive: async () => {},
    savePdfActive: async () => {},
    editAsDocumentActive: async () => {},
    closeActive: async () => {},
    printActive: async () => {},
    newActive: () => {},
    cycle: (_backward: boolean) => {},
  });

  const setHomeOpenState = (open: boolean) => {
    homeOpenRef.current = open;
    setHomeOpen(open);
  };

  useEffect(() => {
    homeOpenRef.current = homeOpen;
  }, [homeOpen]);

  const commit = (next: EditorState[], active?: string | null) => {
    tabsRef.current = next;
    setTabs(next);
    if (next.length === 0) {
      setHomeOpenState(false);
      lastFileIdRef.current = null;
      activeRef.current = null;
      setActiveId(null);
      return;
    }
    if (active !== undefined) {
      activeRef.current = active;
      setActiveId(active);
      if (active !== null) {
        lastFileIdRef.current = active;
      }
    }
  };

  const openOrFocusHome = () => {
    if (!homeOpenRef.current) {
      setHomeOpenState(true);
    }
    commit(tabsRef.current, null);
  };

  const closeHome = () => {
    setHomeOpenState(false);
    if (activeRef.current === null) {
      const targetId =
        lastFileIdRef.current && tabsRef.current.some((t) => t.id === lastFileIdRef.current)
          ? lastFileIdRef.current
          : tabsRef.current[tabsRef.current.length - 1]?.id || null;
      commit(tabsRef.current, targetId);
    }
  };

  const refreshLists = useCallback(async () => {
    setRecentFiles(await getRecentFiles());
    setDrafts(await getAllDrafts());
    setListsRevision((value) => value + 1);
  }, []);

  const ask = useCallback((title: string, message: string, buttons: string[]) => {
    if (isDesktopPlatform()) return getPlatformAdapter().choose(title, message, buttons);
    return new Promise<string | null>((resolve) => {
      choiceRef.current = resolve;
      setChoice({ title, message, buttons });
    });
  }, []);

  const resolveChoice = (value: string | null) => {
    setChoice(null);
    const resolve = choiceRef.current;
    choiceRef.current = null;
    resolve?.(value);
  };

  const activeTab = tabs.find((tab) => tab.id === activeId) || null;

  useEffect(() => {
    const title = activeTab ? `Folio — ${activeTab.fileName}${activeTab.isDirty ? ' *' : ''}` : 'Folio';
    setWindowTitle(title);
  }, [activeTab?.fileName, activeTab?.isDirty, activeTab]);

  useEffect(() => {
    refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    if (!choice) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      resolveChoice(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [choice]);

  useEffect(() => {
    const dirtyTabs = tabs.filter((tab) => tab.isDirty && tab.kind !== 'pdf' && tab.id);
    if (dirtyTabs.length === 0) return;
    const timers = dirtyTabs.map((tab) =>
      window.setTimeout(() => {
        saveDraft({
          id: tab.id!,
          name: tab.fileName,
          kind: tab.kind,
          format: tab.format,
          content: draftContent(tab),
          updatedAt: Date.now(),
          path: tab.filePath,
          cleanHash: tab.cleanHash,
          diskStamp: tab.diskStamp,
        }).then(() => refreshLists());
      }, 1500)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [tabs, refreshLists]);

  const snapshotTabs = (): TabRef[] =>
    tabsRef.current
      .filter((tab) => tab.id)
      .map((tab) => ({ id: tab.id!, path: tab.filePath, dirty: Boolean(tab.isDirty) }));

  const rememberStamp = async (path?: string): Promise<EditorState['diskStamp']> => {
    if (!path || !isDesktopPlatform()) return null;
    try {
      const status = await getPlatformAdapter().pathStatus(path);
      if (status?.exists && status.modifiedMs != null && status.len != null) {
        return { modifiedMs: status.modifiedMs, len: status.len };
      }
    } catch {
      return null;
    }
    return null;
  };

  const openLoaded = async (item: Incoming): Promise<{ id?: string; error?: string }> => {
    try {
      let file = item.file;
      let name = item.name;
      let handle = item.handle;
      if (!file && item.path) {
        const read = await readFileFromPath(item.path);
        file = read.file;
        name = read.name;
        handle = read.handle;
      }
      if (!file) return { error: t('dialog.couldNotRead') };
      const originalName = name || file.name;
      const loaded = await loadFileToEditor(file, originalName, handle, item.path);
      const tab = finishOpenedTab(loaded, originalName);
      tab.diskStamp = await rememberStamp(tab.filePath);
      commit([...tabsRef.current, tab]);
      return { id: tab.id };
    } catch (err: any) {
      return { error: err?.message || t('dialog.couldNotOpen') };
    }
  };

  const insertDraft = (draft: DraftItem, replaceId?: string): string => {
    const tab = tabFromDraft({ ...draft, id: replaceId || draft.id });
    if (replaceId) {
      commit(tabsRef.current.map((item) => (item.id === replaceId ? { ...tab, id: replaceId } : item)));
      return replaceId;
    }
    const already = tabsRef.current.find((item) => item.id === tab.id);
    if (already?.id) return already.id;
    commit([...tabsRef.current, tab]);
    return tab.id!;
  };

  const writeTab = async (tab: EditorState): Promise<SaveOutcome> => {
    try {
      const result = await saveEditorContent(tab, {
        saveAs: false,
        format: tab.format,
        fileName: tab.fileName,
      });
      if (!result.success || !result.updatedState) return 'cancelled';
      const saved = stampClean({ ...tab, ...result.updatedState, id: tab.id });
      saved.diskStamp = await rememberStamp(saved.filePath);
      commit(tabsRef.current.map((item) => (item.id === tab.id ? saved : item)));
      if (tab.id) await clearDraft(tab.id);
      if (saved.filePath || saved.fileHandle) {
        await addRecentFile({
          id: `file_${saved.filePath || saved.fileName}_${Date.now()}`,
          name: saved.fileName,
          kind: saved.kind,
          format: saved.format,
          handle: saved.fileHandle,
          path: saved.filePath,
        });
      }
      await refreshLists();
      return 'ok';
    } catch (err: any) {
      await ask(t('dialog.saveFailed'), err?.message || t('dialog.couldNotSave'), ['OK']);
      return 'failed';
    }
  };

  const executeSaveTarget = async (
    tab: EditorState,
    target: { path?: string; handle?: FileSystemFileHandle; rawName: string; formatHint?: SupportedFormat }
  ): Promise<SaveOutcome> => {
    const resolved = resolvePickedName(target.rawName, tab.kind, tab.fileName, target.formatHint || tab.format);
    if (!resolved.ok) {
      await ask(t('dialog.cannotSave'), resolved.message, ['OK']);
      return 'failed';
    }

    if (target.path) {
      const conflict = tabsRef.current.find((t) => t.id !== tab.id && pathsMatch(t.filePath, target.path));
      if (conflict) {
        await ask(t('dialog.alreadyOpen'), t('dialog.alreadyOpenNamed', { name: resolved.fileName }), ['OK']);
        return 'failed';
      }
    }
    if (target.handle) {
      const owner = await findTabByHandle(
        tabsRef.current.filter((t) => t.id && t.id !== tab.id),
        target.handle
      );
      if (owner) {
        await ask(t('dialog.alreadyOpen'), t('dialog.alreadyOpenThat'), ['OK']);
        return 'failed';
      }
    }

    const lossy = isLossySave(tab.format, resolved.format);
    if (lossy) {
      const activeSheet = getActiveSheet(tab.spreadsheetData);
      const msg = lossyWarningMessage(resolved.format, activeSheet?.name);
      const choice = await ask(t('dialog.saveAs'), msg, ['Save', 'Cancel']);
      if (choice !== 'Save') {
        return 'cancelled';
      }
    }

    try {
      const isDownloadFallback = !target.path && !target.handle;
      const result = await saveEditorContent(
        {
          ...tab,
          filePath: target.path,
          fileHandle: target.handle,
        },
        {
          saveAs: isDownloadFallback,
          format: resolved.format,
          fileName: resolved.fileName,
        }
      );

      if (!result.success || !result.updatedState) return 'cancelled';

      let updatedTab: EditorState = {
        ...tab,
        ...result.updatedState,
        id: tab.id,
        filePath: target.path,
        fileHandle: target.handle,
        fileName: resolved.fileName,
        format: resolved.format,
      };

      if (lossy && result.bytes) {
        const text = new TextDecoder('utf-8').decode(result.bytes);
        if (resolved.format === 'txt') {
          updatedTab.documentContent = htmlToDocument(plainTextToHtml(text));
        } else if (resolved.format === 'md') {
          updatedTab.documentContent = htmlToDocument(markdownToHtml(text));
        } else if (resolved.format === 'csv') {
          const { sheets } = importCsvTsv(text, resolved.fileName, false);
          updatedTab.spreadsheetData = sheets;
        } else if (resolved.format === 'tsv') {
          const { sheets } = importCsvTsv(text, resolved.fileName, true);
          updatedTab.spreadsheetData = sheets;
        }
        updatedTab.historyEpoch = (tab.historyEpoch || 0) + 1;
      }

      updatedTab = stampClean(updatedTab);
      updatedTab.diskStamp = await rememberStamp(updatedTab.filePath);
      commit(tabsRef.current.map((item) => (item.id === tab.id ? updatedTab : item)));

      if (tab.id) await clearDraft(tab.id);

      if (updatedTab.filePath || updatedTab.fileHandle) {
        await addRecentFile({
          id: `file_${updatedTab.filePath || updatedTab.fileName}_${Date.now()}`,
          name: updatedTab.fileName,
          kind: updatedTab.kind,
          format: updatedTab.format,
          handle: updatedTab.fileHandle,
          path: updatedTab.filePath,
        });
      }
      await refreshLists();
      return 'ok';
    } catch (err: any) {
      await ask(t('dialog.saveFailed'), err?.message || t('dialog.couldNotSave'), ['OK']);
      return 'failed';
    }
  };

  const pickAndSave = async (tab: EditorState): Promise<SaveOutcome> => {
    const canPick = isDesktopPlatform() || hasSaveFilePicker();
    if (!canPick) {
      setShowSaveAs(true);
      return 'cancelled';
    }

    const suggested = suggestedSaveName(tab.fileName, tab.format);
    const filters = saveFiltersForKind(tab.kind, tab.format);

    const picked = await getPlatformAdapter().pickSaveTarget(suggested, filters);
    if (!picked || (!picked.path && !picked.handle)) {
      return 'cancelled';
    }

    return executeSaveTarget(tab, {
      path: picked.path,
      handle: picked.handle,
      rawName: picked.name,
      formatHint: tab.format,
    });
  };

  const saveTab = async (
    tab: EditorState,
    mode: 'save' | 'save-as' = 'save',
    arg3?: any,
    arg4?: any,
    arg5?: boolean
  ): Promise<SaveOutcome> => {
    const held = typeof arg3 === 'boolean' ? arg3 : Boolean(arg5);
    if (!held) {
      if (busyRef.current) return 'cancelled';
      busyRef.current = true;
    }
    try {
      const current = tabsRef.current.find((item) => item.id === tab.id) || tab;
      const hasSafe = current.filePath ? isSafeSavePath(current.filePath) : Boolean(current.fileHandle);

      if (mode === 'save-as' || !hasSafe) {
        return pickAndSave(current);
      }

      if (current.filePath && isDesktopPlatform()) {
        let status: PathStatus | null = null;
        try {
          await getPlatformAdapter().allowPath(current.filePath);
          status = await getPlatformAdapter().pathStatus(current.filePath);
        } catch {
          status = null;
        }
        const decision = decideSave({
          selfId: current.id || '',
          targetPath: current.filePath,
          status,
          stamp: current.diskStamp,
          openTabs: snapshotTabs(),
        });
        if (decision.kind === 'already-open') {
          await ask(t('dialog.alreadyOpen'), t('dialog.alreadyOpenThat'), ['OK']);
          return 'failed';
        }
        if (decision.kind === 'save-as') return pickAndSave(current);
        if (decision.kind === 'conflict') {
          const choice = await ask(
            t('dialog.fileChanged'),
            t('dialog.changedOverwrite', { name: current.fileName }),
            [...CONFLICT_BUTTONS]
          );
          if (choice === 'Overwrite') return writeTab(current);
          if (choice === 'Save As') return pickAndSave(current);
          return 'cancelled';
        }
      }

      return writeTab(current);
    } finally {
      if (!held) busyRef.current = false;
    }
  };

  const runOpen = async (items: Incoming[], held = false) => {
    if (!held) {
      if (busyRef.current) return;
      busyRef.current = true;
    }
    try {
    const draftsNow = drafts.length ? drafts : await getAllDrafts();
    const prepared = await Promise.all(
      items.map(async (item) => {
        const next = { ...item };
        if (next.handle && !next.existingTabId) {
          const match = await findTabByHandle(tabsRef.current, next.handle);
          if (match) next.existingTabId = match;
        }
        if (next.path) {
          if (next.hasDraft == null) {
            next.hasDraft = draftsNow.some((draft) => draft.path && pathsMatch(draft.path, next.path));
            next.draft = next.draft || draftsNow.find((draft) => draft.path && pathsMatch(draft.path, next.path));
          }
        }
        return next;
      })
    );

    const hadActive = Boolean(activeRef.current);
    const plan = planOpenBatch(prepared, snapshotTabs(), hadActive);
    const failures: { name: string; message: string }[] = [];
    let opened = false;

    for (const step of plan.actions) {
      const item = prepared.find((entry) => entry.key === step.key);
      if (!item) continue;
      const action = step.action;
      if (action.type === 'ignore' || action.type === 'skip') continue;
      if (action.type === 'fail') {
        failures.push({ name: item.name || item.key, message: action.message });
        continue;
      }
      if (action.type === 'focus' || action.type === 'focus-dirty') {
        commit(tabsRef.current, action.tabId);
        if (action.type === 'focus-dirty') {
          await ask(t('dialog.alreadyOpen'), action.message, ['OK']);
        }
        continue;
      }
      if (action.type === 'ask-reload') {
        commit(tabsRef.current, action.tabId);
        const choice = await ask(t('dialog.fileChanged'), t('dialog.changedReload', { name: item.name }), [...RELOAD_BUTTONS]);
        if (choice === 'Reload') {
          const loaded = await openLoaded({ ...item, path: undefined });
          const fresh = loaded.id ? tabsRef.current.find((tab) => tab.id === loaded.id) : undefined;
          const previous = tabsRef.current.find((tab) => tab.id === action.tabId);
          if (!loaded.id || !fresh || !previous) {
            failures.push({ name: item.name, message: loaded.error || t('dialog.couldNotReload') });
            if (fresh) commit(tabsRef.current.filter((tab) => tab.id !== fresh.id), action.tabId);
          } else {
            const replaced = {
              ...fresh,
              id: previous.id,
              filePath: previous.filePath || fresh.filePath,
              fileHandle: previous.fileHandle || fresh.fileHandle,
            };
            replaced.diskStamp = await rememberStamp(replaced.filePath);
            commit(
              tabsRef.current.filter((tab) => tab.id !== fresh.id).map((tab) => (tab.id === previous.id ? replaced : tab)),
              previous.id
            );
          }
        }
        continue;
      }
      if (action.type === 'ask-draft') {
        const choice = await ask(
          t('dialog.recovered'),
          t('dialog.recoveredAsk', { name: item.name }),
          [...DRAFT_OPEN_BUTTONS]
        );
        if (choice === 'Restore' && item.draft) {
          const id = insertDraft(item.draft);
          if (!hadActive && !opened) commit(tabsRef.current, id);
          opened = true;
        } else {
          const loaded = await openLoaded(item);
          if (loaded.id) {
            if (!hadActive && !opened) commit(tabsRef.current, loaded.id);
            opened = true;
          } else failures.push({ name: item.name, message: loaded.error || t('dialog.couldNotOpen') });
        }
        continue;
      }
      if (action.type === 'ask-replace') {
        const choice = await ask(
          t('dialog.recovered'),
          t('dialog.replaceAsk', { name: item.name }),
          [...DRAFT_REPLACE_BUTTONS]
        );
        if (choice === 'Replace' && item.draft) insertDraft(item.draft, action.tabId);
        commit(tabsRef.current, action.tabId);
        continue;
      }
      if (item.intent === 'draft' && item.draft) {
        const id = insertDraft(item.draft);
        if (!hadActive && !opened) commit(tabsRef.current, id);
        opened = true;
        continue;
      }
      const loaded = await openLoaded(item);
      if (loaded.id) {
        if (!hadActive && !opened) commit(tabsRef.current, loaded.id);
        opened = true;
      } else failures.push({ name: item.name, message: loaded.error || t('dialog.couldNotOpen') });
    }

    if (failures.length) {
      await ask(t('dialog.someFailed'), failures.map((failure) => `${failure.name}: ${failure.message}`).join('\n'), ['OK']);
    }
    await refreshLists();
    } finally {
      if (!held) busyRef.current = false;
    }
  };

  const filesToIncoming = async (files: PlatformFileResult[]): Promise<Incoming[]> => {
    const knownDrafts = await getAllDrafts();
    const incoming: Incoming[] = [];
    for (const file of files) {
      let diskNewer = false;
      if (file.path && isDesktopPlatform()) {
        try {
          await getPlatformAdapter().allowPath(file.path);
          const status = await getPlatformAdapter().pathStatus(file.path);
          const tab = tabsRef.current.find((item) => item.filePath && pathsMatch(item.filePath, file.path));
          diskNewer = isDiskNewer(tab?.diskStamp, status);
        } catch {
          diskNewer = false;
        }
      }
      const draft = file.path ? knownDrafts.find((item) => item.path && pathsMatch(item.path, file.path)) : undefined;
      incoming.push({
        key: file.path || `${file.name}-${incoming.length}`,
        path: file.path,
        name: file.name,
        file: file.file,
        handle: file.handle,
        hasDraft: Boolean(draft),
        draft,
        diskNewer,
      });
    }
    return incoming;
  };

  const openPicked = async (files: PlatformFileResult[], held = false) => {
    if (!files.length) return;
    await runOpen(await filesToIncoming(files), held);
  };

  const openPaths = async (paths: string[], held = false) => {
    const files: PlatformFileResult[] = [];
    const failures: Incoming[] = [];
    for (const path of paths) {
      try {
        if (isDesktopPlatform()) await getPlatformAdapter().allowPath(path);
        files.push(await readFileFromPath(path));
      } catch (err: any) {
        failures.push({ key: path, path, name: path.split(/[\\/]/).pop() || path, error: err?.message || t('dialog.couldNotOpen') });
      }
    }
    await runOpen([...(await filesToIncoming(files)), ...failures], held);
  };

  const openRecent = async (item: RecentItem) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
    if (isDesktopPlatform() && item.path) {
      try {
        await getPlatformAdapter().allowPath(item.path);
        const status = await getPlatformAdapter().pathStatus(item.path);
        if (status && !status.exists) {
          await ask(t('dialog.cannotFind'), t('dialog.cannotFindBody', { name: item.name }), ['OK']);
          if (shouldRemoveRecent(status)) await removeRecentFile(item.id);
          await refreshLists();
          return;
        }
      } catch (err: any) {
        await ask(t('dialog.cannotOpen'), err?.message || t('dialog.couldNotOpen'), ['OK']);
        return;
      }
      await openPaths([item.path], true);
      return;
    }
    if (item.handle) {
      const permitted = await verifyPermission(item.handle, false);
      if (permitted) {
        const file = await item.handle.getFile();
        await openPicked([{ file, name: file.name, handle: item.handle }], true);
        return;
      }
    }
    const picked = await pickFilesToOpen();
    await openPicked(picked, true);
    } finally {
      busyRef.current = false;
    }
  };

  const closeTab = async (id: string, quitting = false, held = false): Promise<boolean> => {
    if (!held) {
      if (busyRef.current) return false;
      busyRef.current = true;
    }
    try {
      const tab = tabsRef.current.find((item) => item.id === id);
      if (!tab) return true;
      if (tab.isDirty) {
        commit(tabsRef.current, id);
        const choice = await ask(t('dialog.saveChanges'), t('dialog.saveChangesBody', { name: tab.fileName }), [...SAVE_BUTTONS]);
        if (choice === 'Save') {
          const outcome = await saveTab(tab, 'save', undefined, undefined, true);
          if (!closeContinues('Save', outcome)) {
            commit(tabsRef.current, id);
            return false;
          }
        } else if (!closeContinues(choice)) {
          commit(tabsRef.current, id);
          return false;
        } else {
          if (tab.id) await clearDraft(tab.id);
          commit(tabsRef.current.map((item) => (item.id === id ? { ...item, isDirty: false } : item)));
        }
      }
      if (!quitting) {
        const remaining = tabsRef.current.filter((item) => item.id !== id);
        if (remaining.length === 0) {
          setHomeOpenState(false);
          lastFileIdRef.current = null;
          commit([], null);
        } else {
          let nextActive = activeRef.current;
          if (activeRef.current === id) {
            nextActive = remaining[remaining.length - 1]?.id || null;
          }
          if (lastFileIdRef.current === id) {
            lastFileIdRef.current = nextActive && nextActive !== id ? nextActive : remaining[remaining.length - 1]?.id || null;
          }
          commit(remaining, nextActive);
        }
      }
      await refreshLists();
      return true;
    } finally {
      if (!held) busyRef.current = false;
    }
  };

  const confirmClose = async () => {
    if (busyRef.current) return false;
    busyRef.current = true;
    try {
      let index = 0;
      while (index < tabsRef.current.length) {
        const dirtyAt = nextDirtyIndex(
          tabsRef.current.map((tab) => ({ dirty: Boolean(tab.isDirty) })),
          index
        );
        if (dirtyAt < 0) break;
        const tab = tabsRef.current[dirtyAt];
        const closed = await closeTab(tab.id!, true, true);
        if (!closed) return false;
        if (tabsRef.current.some((item) => item.id === tab.id && item.isDirty)) return false;
        index = dirtyAt + 1;
      }
      for (const tab of tabsRef.current) {
        if (tab.id) await clearDraft(tab.id);
      }
      return true;
    } finally {
      busyRef.current = false;
    }
  };

  useEffect(() => {
    const bump = (lng: string) => setUiLanguage(lng);
    i18n.on('languageChanged', bump);
    return () => {
      i18n.off('languageChanged', bump);
    };
  }, []);

  useEffect(() => {
    const blockNavigate = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener('dragover', blockNavigate);
    window.addEventListener('drop', blockNavigate);
    return () => {
      window.removeEventListener('dragover', blockNavigate);
      window.removeEventListener('drop', blockNavigate);
    };
  }, []);

  useEffect(() => {
    const stopClose = setupCloseGuard(
      () => tabsRef.current.some((tab) => tab.isDirty),
      () => actionsRef.current.confirmClose()
    );
    const stopDrop = setupFileDropHandler((files) => {
      void actionsRef.current.openFiles(files);
    });
    const stopOpen = setupOpenRequestHandler((paths) => {
      void actionsRef.current.openPaths(paths);
    });
    if (isDesktopPlatform()) {
      getPlatformAdapter()
        .takeLaunchPaths()
        .then((paths) => {
          if (paths.length) void actionsRef.current.openPaths(paths);
        })
        .catch(() => undefined);
    }
    return () => {
      stopClose();
      stopDrop();
      stopOpen();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const isPromptOpen = Boolean(choice) || showSaveAs || showImportReport || busyRef.current;
      const hasActiveTab = Boolean(activeRef.current);

      const isF12 = event.key === 'F12';
      const mod = event.ctrlKey || event.metaKey;
      const isCtrlShiftS = Boolean(mod && event.shiftKey && event.key.toLowerCase() === 's');

      if (isF12 || isCtrlShiftS) {
        event.preventDefault();
        if (isPromptOpen || !hasActiveTab) return;
        void actionsRef.current.saveAsActive();
        return;
      }

      if (!mod) return;
      const key = event.key.toLowerCase();
      const handled = key === 's' || key === 'w' || key === 'o' || key === 'p' || key === 'n' || key === 'tab';
      if (!handled) return;
      event.preventDefault();
      if (busyRef.current) return;
      if (key === 's') {
        if (!event.shiftKey) void actionsRef.current.saveActive();
      } else if (key === 'w') {
        void actionsRef.current.closeActive();
      } else if (key === 'o') {
        void pickFilesToOpen().then((files) => actionsRef.current.openFiles(files));
      } else if (key === 'p') {
        void actionsRef.current.printActive();
      } else if (key === 'n') {
        actionsRef.current.newActive();
      } else {
        actionsRef.current.cycle(event.shiftKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choice, showSaveAs, showImportReport]);

  const createNew = (kind: DocumentKind) => {
    const tab = blankTab(kind, tabsRef.current.map((item) => item.fileName));
    commit([...tabsRef.current, tab], tab.id || null);
  };

  const updateActive = (partial: Partial<EditorState>) => {
    const id = activeRef.current;
    if (!id) return;
    commit(tabsRef.current.map((tab) => (tab.id === id ? applyEdit(tab, partial) : tab)));
  };

  const printActive = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const tab = tabsRef.current.find((item) => item.id === activeRef.current);
      if (!tab) return;
      const count = tab.kind === 'spreadsheet' ? tab.spreadsheetData?.length || 1 : tab.kind === 'presentation' ? tab.presentationData?.slides.length || 1 : tab.kind === 'pdf' ? pdfCount : 1;
      let scope: 'current' | 'all' = tab.kind === 'spreadsheet' ? 'current' : 'all';
      if (tab.kind !== 'document' && printScopeNeeded(tab.kind, count)) {
        const selected = printScopeFromChoice(await ask(t('dialog.print'), t('dialog.printBody', { name: tab.fileName }), printButtons(tab.kind)));
        if (selected === 'cancel') return;
        scope = selected;
      }
      if (tab.kind === 'document') {
        setPrintJob({ tab, scope: 'all' });
        return;
      }
      setPrintJob({ tab, scope });
    } finally {
      busyRef.current = false;
    }
  };

  const savePdfActive = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const tab = tabsRef.current.find((item) => item.id === activeRef.current);
      if (!tab || tab.kind === 'pdf') return;

      const count =
        tab.kind === 'spreadsheet'
          ? tab.spreadsheetData?.length || 1
          : tab.kind === 'presentation'
          ? tab.presentationData?.slides.length || 1
          : 1;

      let scope: 'current' | 'all' = tab.kind === 'spreadsheet' ? 'current' : 'all';
      if (tab.kind !== 'document' && printScopeNeeded(tab.kind, count)) {
        const choice = await ask(
          t('dialog.exportPdf'),
          t('dialog.exportBody', { name: tab.fileName }),
          printButtons(tab.kind)
        );
        const selected = printScopeFromChoice(choice);
        if (selected === 'cancel') return;
        scope = selected;
      }

      const baseName = tab.fileName.replace(/\.[^/.]+$/, '');
      const suggested = `${baseName}.pdf`;

      let saveName = suggested;
      let saveHandle: FileSystemFileHandle | undefined;
      let savePath: string | undefined;

      if (isDesktopPlatform() || hasSaveFilePicker()) {
        const picked = await getPlatformAdapter().pickSaveTarget(suggested, [
          { format: 'pdf', label: 'PDF Document', extensions: ['pdf'] },
        ]);
        if (!picked || (!picked.path && !picked.handle)) {
          return;
        }
        saveName = picked.name || suggested;
        saveHandle = picked.handle;
        savePath = picked.path;
      }

      try {
        const { bytes, omissions } = await exportPdf(tab, { scope, slideIndex });

        const saveRes = await getPlatformAdapter().saveFile(
          bytes,
          saveName,
          'pdf',
          { handle: saveHandle, path: savePath }
        );
        if (!saveRes.success) {
          await ask(t('dialog.exportFailed'), t('dialog.exportDisk'), ['OK']);
          return;
        }

        if (omissions.length > 0) {
          await ask(
            t('dialog.exportNotices'),
            t('dialog.exportNoticesBody', { items: Array.from(new Set(omissions)).join('\n') }),
            ['OK']
          );
        }
      } catch (err: any) {
        await ask(t('dialog.exportFailed'), err?.message || t('dialog.exportError'), ['OK']);
      }
    } finally {
      busyRef.current = false;
    }
  };

  const editAsDocumentActive = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const tab = tabsRef.current.find((item) => item.id === activeRef.current);
      if (!tab || tab.kind !== 'pdf' || !tab.pdfData) return;

      let result;
      try {
        result = await extractTextFromPdf(tab.pdfData);
      } catch {
        await ask(t('dialog.editFailed'), t('dialog.protected'), ['OK']);
        return;
      }

      if (result.paragraphsCount === 0) {
        await ask(t('dialog.nothing'), t('dialog.nothingBody'), ['OK']);
        return;
      }

      const openNames = tabsRef.current.map((t) => t.fileName);
      const docTitle = nextFileName('document', openNames, tab.fileName);
      const docModel = htmlToDocument(result.html);

      const report: ImportReport = {
        fileName: docTitle,
        format: 'docx',
        importedAt: new Date().toISOString(),
        warnings: [
          {
            item: t('dialog.layoutItem'),
            reason: t('dialog.layoutDiscarded'),
          },
          ...(result.skippedPages.length > 0
            ? [
                {
                  item: t('dialog.skippedEmpty'),
                  reason: t('dialog.skippedPages', { pages: result.skippedPages.join(', ') }),
                },
              ]
            : []),
        ],
        skippedFeatures: [
          t('dialog.skipLayout'),
          t('dialog.skipColumns'),
          t('dialog.skipTables'),
          t('dialog.skipImages'),
          t('dialog.skipHeaders'),
        ],
      };

      const newTab: EditorState = {
        id: newTabId(),
        kind: 'document',
        fileName: docTitle,
        format: 'docx',
        isDirty: true,
        cleanHash: '',
        contentHash: contentHash(docModel),
        documentContent: docModel,
        importReport: report,
        lastSavedAt: new Date(),
      };

      commit([...tabsRef.current, newTab], newTab.id);
      setShowImportReport(true);
    } finally {
      busyRef.current = false;
    }
  };

  actionsRef.current = {
    confirmClose,
    openPaths,
    openFiles: openPicked,
    saveActive: async () => {
      const tab = tabsRef.current.find((item) => item.id === activeRef.current);
      if (tab) await saveTab(tab, 'save');
    },
    saveAsActive: async () => {
      const tab = tabsRef.current.find((item) => item.id === activeRef.current);
      if (tab) await saveTab(tab, 'save-as');
    },
    savePdfActive,
    editAsDocumentActive,
    closeActive: async () => {
      if (homeOpenRef.current && activeRef.current === null) {
        closeHome();
        return;
      }
      if (activeRef.current) await closeTab(activeRef.current);
    },
    printActive,
    newActive: () => {
      if (busyRef.current) return;
      const current = tabsRef.current.find((item) => item.id === activeRef.current);
      createNew(current?.kind && current.kind !== 'pdf' ? current.kind : 'document');
    },
    cycle: (backward: boolean) => {
      if (busyRef.current) return;
      const fileTabs = tabsRef.current;
      const cycleIds: (string | null)[] = fileTabs.map((t) => t.id!);
      if (homeOpenRef.current) {
        cycleIds.push(null);
      }
      if (cycleIds.length < 2) return;

      let index: number;
      if (activeRef.current === null) {
        index = homeOpenRef.current ? cycleIds.length - 1 : 0;
      } else {
        const found = cycleIds.indexOf(activeRef.current);
        index = found >= 0 ? found : 0;
      }

      const nextIndex = backward
        ? (index - 1 + cycleIds.length) % cycleIds.length
        : (index + 1) % cycleIds.length;
      const nextId = cycleIds[nextIndex];
      commit(fileTabs, nextId);
    },
  };

  const onBrowserDrop = async (files: File[]) => {
    await openPicked(files.map((file) => ({ file, name: file.name })));
  };

  return (
    <div data-ui-lang={uiLanguage} style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <input
        type="file"
        multiple
        data-testid="global-file-input"
        style={{ display: 'none' }}
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : [];
          event.target.value = '';
          if (files.length) void onBrowserDrop(files);
        }}
      />
      {tabs.length > 0 && (
        <TabStrip
          tabs={tabs}
          activeId={activeId || undefined}
          homeOpen={homeOpen}
          onSelect={(id) => commit(tabsRef.current, id)}
          onClose={(id) => void closeTab(id)}
          onSelectHome={() => commit(tabsRef.current, null)}
          onCloseHome={closeHome}
          onNewTab={openOrFocusHome}
        />
      )}
      {tabs.length === 0 || !activeTab ? (
        <StartScreen
          onNew={createNew}
          onOpen={() => void pickFilesToOpen().then((files) => openPicked(files))}
          onOpenRecent={(item) => void openRecent(item)}
          onRestoreDraft={(draft) => void runOpen([{ key: draft.id, name: draft.name, path: draft.path, intent: 'draft', draft }])}
          onDismissDraft={(draft) => void clearDraft(draft.id).then(() => refreshLists())}
          onFileDrop={(files) => void onBrowserDrop(files)}
          listsRevision={listsRevision}
        />
      ) : (
        <>
          <Ribbon
            editorState={activeTab}
            documentEditor={documentEditorInstance}
            zoom={zoom}
            onZoomChange={setZoom}
            onSave={() => void actionsRef.current.saveActive()}
            onSaveAs={() => void actionsRef.current.saveAsActive()}
            onSavePdf={() => void actionsRef.current.savePdfActive()}
            onEditAsDocument={() => void actionsRef.current.editAsDocumentActive()}
            onPrint={() => void printActive()}
            onCloseFile={() => activeTab.id && void closeTab(activeTab.id)}
            onNew={createNew}
            onOpen={() => void pickFilesToOpen().then((files) => openPicked(files))}
            onOpenReport={() => setShowImportReport(true)}
            recentFiles={recentFiles}
            drafts={drafts}
            onOpenRecent={(item) => void openRecent(item)}
            onRestoreDraft={(draft) => void runOpen([{ key: draft.id, name: draft.name, path: draft.path, intent: 'draft', draft }])}
            onDismissDraft={(draft) => void clearDraft(draft.id).then(() => refreshLists())}
            onFind={() => setFindSignal((n) => n + 1)}
            slideCommands={slideCommands}
            slideState={slideState}
            sheetApi={sheetApi}
          />
          <main className="folio-workspace" style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            {activeTab.kind === 'document' && (
              <DocumentEditor
                key={`${activeTab.id}-${activeTab.historyEpoch || 0}`}
                content={activeTab.documentContent || { type: 'doc', content: [{ type: 'paragraph' }] }}
                zoom={zoom}
                onChange={(doc) => updateActive({ documentContent: doc })}
                onEditorReady={setDocumentEditorInstance}
                onSaveShortcut={() => void actionsRef.current.saveActive()}
                findSignal={findSignal}
              />
            )}
            {activeTab.kind === 'spreadsheet' && (
              <SpreadsheetEditor
                key={`${activeTab.id}-${activeTab.historyEpoch || 0}`}
                sheets={activeTab.spreadsheetData || []}
                onChange={(sheets) => updateActive({ spreadsheetData: sheets })}
                onSaveShortcut={() => void actionsRef.current.saveActive()}
                onWorkbookReady={handleWorkbookReady}
              />
            )}
            {activeTab.kind === 'presentation' && (
              <SlideEditor
                key={`${activeTab.id}-${activeTab.historyEpoch || 0}`}
                ref={slideCommands}
                presentation={activeTab.presentationData || { title: activeTab.fileName, slides: [] }}
                onChange={(presentation) => updateActive({ presentationData: presentation })}
                onSaveShortcut={() => void actionsRef.current.saveActive()}
                onActiveSlideChange={setSlideIndex}
                onSelectionChange={setSlideState}
              />
            )}
            {activeTab.kind === 'pdf' && activeTab.pdfData && (
              <PdfViewer
                key={activeTab.id}
                pdfData={activeTab.pdfData}
                onPageInfo={({ page, pages }) => {
                  setPdfPage(page);
                  setPdfCount(pages);
                }}
                onEditAsDocument={() => void actionsRef.current.editAsDocumentActive()}
              />
            )}
          </main>
          <StatusBar editorState={activeTab} documentEditor={documentEditorInstance} zoom={zoom} onZoomChange={setZoom} />
        </>
      )}

      {showImportReport && activeTab?.importReport && (
        <ImportReportDialog report={activeTab.importReport} onClose={() => setShowImportReport(false)} />
      )}
      {showSaveAs && activeTab && (
        <SaveAsDialog
          currentKind={activeTab.kind}
          currentFormat={activeTab.format}
          currentFileName={activeTab.fileName}
          onSave={(format, name) => {
            setShowSaveAs(false);
            void executeSaveTarget(activeTab, { rawName: name, formatHint: format });
          }}
          onClose={() => setShowSaveAs(false)}
        />
      )}
      {choice && <ChoiceDialog title={choice.title} message={choice.message} buttons={choice.buttons} onChoose={resolveChoice} />}
      {printJob && (
        <PrintView
          tab={printJob.tab}
          scope={printJob.scope}
          slideIndex={slideIndex}
          pdfPage={pdfPage}
          onDone={() => setPrintJob(null)}
        />
      )}
    </div>
  );
};
