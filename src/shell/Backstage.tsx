import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Info as InfoIcon,
  FilePlus,
  FolderOpen,
  Save,
  SaveAll,
  FileText,
  Printer,
  X,
  Settings as SettingsIcon,
  File,
  Table as TableIcon,
  Presentation as PresentationIcon,
} from 'lucide-react';
import { t } from '../i18n/instance';
import { getLocalizedTemplates } from '../templates';
import type { EditorState, SupportedDocumentKind, RecentFileRecord, RecoveredDraft } from '../types';

export interface BackstageProps {
  editorState: EditorState;
  docPageInfo?: { page: number; totalPages: number; words?: number } | null;
  onClose: () => void;
  onNew: (kind: SupportedDocumentKind, templateId?: string) => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onSavePdf: () => void;
  onEditAsDocument?: () => void;
  onPrint: () => void;
  onCloseFile: () => void;
  onOpenSettings?: () => void;
  recentFiles?: RecentFileRecord[];
  drafts?: RecoveredDraft[];
  onOpenRecent?: (item: RecentFileRecord) => void;
  onRestoreDraft?: (draft: RecoveredDraft) => void;
  onDismissDraft?: (draft: RecoveredDraft) => void;
  templates?: Array<{
    id: string;
    kind: SupportedDocumentKind;
    title: string;
    description: string;
    thumbnail?: string;
  }>;
}

export const Backstage: React.FC<BackstageProps> = ({
  editorState,
  docPageInfo,
  onClose,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onSavePdf,
  onEditAsDocument,
  onPrint,
  onCloseFile,
  onOpenSettings,
  recentFiles = [],
  drafts = [],
  onOpenRecent,
  onRestoreDraft,
  onDismissDraft,
  templates = getLocalizedTemplates(),
}) => {
  const [activeSection, setActiveSection] = useState<'info' | 'new' | 'open'>('info');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getFormatName = () => {
    if (editorState.kind === 'document') {
      const ext = editorState.path ? editorState.path.split('.').pop()?.toUpperCase() : 'DOCX';
      return ext || 'DOCX';
    }
    if (editorState.kind === 'spreadsheet') {
      const ext = editorState.path ? editorState.path.split('.').pop()?.toUpperCase() : 'XLSX';
      return ext || 'XLSX';
    }
    if (editorState.kind === 'presentation') {
      const ext = editorState.path ? editorState.path.split('.').pop()?.toUpperCase() : 'PPTX';
      return ext || 'PPTX';
    }
    return 'PDF';
  };

  const getStats = () => {
    if (editorState.kind === 'document') {
      const countWords = (node: any): number => {
        if (!node) return 0;
        if (typeof node.text === 'string') {
          return node.text.trim().split(/\s+/).filter(Boolean).length;
        }
        let count = 0;
        if (Array.isArray(node.content)) {
          for (const child of node.content) {
            count += countWords(child);
          }
        }
        return count;
      };
      const words = docPageInfo?.words || countWords(editorState.documentContent);
      return [
        { label: t('backstage.words'), value: String(words), testId: 'backstage-stat-words' },
        { label: t('backstage.pages'), value: String(docPageInfo?.totalPages ?? 1), testId: 'backstage-stat-pages' },
      ];
    }
    if (editorState.kind === 'spreadsheet') {
      const sheetsCount = editorState.spreadsheetData?.length || 1;
      return [
        { label: t('backstage.sheets'), value: String(sheetsCount), testId: 'backstage-stat-sheets' },
      ];
    }
    if (editorState.kind === 'presentation') {
      const slidesCount = editorState.presentationData?.slides?.length || 0;
      return [
        { label: t('backstage.slides'), value: String(slidesCount), testId: 'backstage-stat-slides' },
      ];
    }
    return [
      { label: t('backstage.fileFormat'), value: 'PDF', testId: 'backstage-stat-pdf' },
    ];
  };

  return (
    <div
      className="folio-backstage"
      data-testid="folio-backstage"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'var(--folio-bg)',
        display: 'flex',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      {/* Left Rail */}
      <div
        style={{
          width: 240,
          backgroundColor: 'var(--folio-teal)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          userSelect: 'none',
        }}
      >
        {/* Back Button */}
        <div style={{ padding: '0 16px 16px' }}>
          <button
            type="button"
            data-testid="folio-backstage-back"
            aria-label={t('backstage.back')}
            title={t('backstage.back')}
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)')}
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        {/* Navigation Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            type="button"
            data-testid="backstage-nav-info"
            onClick={() => setActiveSection('info')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeSection === 'info' ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
              color: '#ffffff',
              fontWeight: activeSection === 'info' ? 650 : 500,
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              borderLeft: activeSection === 'info' ? '4px solid #ffffff' : '4px solid transparent',
            }}
          >
            <InfoIcon size={18} />
            {t('backstage.info')}
          </button>
          <button
            type="button"
            data-testid="backstage-nav-new"
            onClick={() => setActiveSection('new')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeSection === 'new' ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
              color: '#ffffff',
              fontWeight: activeSection === 'new' ? 650 : 500,
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              borderLeft: activeSection === 'new' ? '4px solid #ffffff' : '4px solid transparent',
            }}
          >
            <FilePlus size={18} />
            {t('backstage.new')}
          </button>
          <button
            type="button"
            data-testid="backstage-nav-open"
            onClick={() => setActiveSection('open')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              border: 'none',
              backgroundColor: activeSection === 'open' ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
              color: '#ffffff',
              fontWeight: activeSection === 'open' ? 650 : 500,
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              borderLeft: activeSection === 'open' ? '4px solid #ffffff' : '4px solid transparent',
            }}
          >
            <FolderOpen size={18} />
            {t('backstage.open')}
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.2)', margin: '12px 16px' }} />

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button
            type="button"
            data-testid="backstage-action-save"
            onClick={() => {
              onSave();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#ffffff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Save size={18} />
            {t('ribbon.save')}
          </button>
          <button
            type="button"
            data-testid="backstage-action-save-as"
            onClick={() => {
              onSaveAs();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#ffffff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <SaveAll size={18} />
            {t('ribbon.saveAs')}
          </button>

          {editorState.kind !== 'pdf' ? (
            <button
              type="button"
              data-testid="backstage-action-export-pdf"
              onClick={() => {
                onSavePdf();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#ffffff',
                fontSize: 14,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <FileText size={18} />
              {t('ribbon.savePdf')}
            </button>
          ) : (
            <button
              type="button"
              data-testid="backstage-action-edit-as-document"
              onClick={() => {
                onEditAsDocument?.();
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 20px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#ffffff',
                fontSize: 14,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <FileText size={18} />
              {t('ribbon.editAsDocument')}
            </button>
          )}

          <button
            type="button"
            data-testid="backstage-action-print"
            onClick={() => {
              onPrint();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#ffffff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Printer size={18} />
            {t('ribbon.print')}
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.2)', margin: '12px 16px' }} />

        {/* Close File */}
        <button
          type="button"
          data-testid="backstage-action-close"
          onClick={() => {
            onClose();
            onCloseFile();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#ffffff',
            fontSize: 14,
            textAlign: 'left',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={18} />
          {t('backstage.close')}
        </button>

        {/* Settings button pinned at bottom */}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <button
            type="button"
            data-testid="backstage-action-settings"
            onClick={() => {
              onOpenSettings?.();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 20px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#ffffff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <SettingsIcon size={18} />
            {t('ribbon.settings')}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px 48px',
          backgroundColor: 'var(--folio-bg)',
          color: 'var(--folio-ink)',
        }}
      >
        {activeSection === 'info' && (
          <div data-testid="backstage-section-info" style={{ maxWidth: 800 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 24px', color: 'var(--folio-ink)' }}>
              {t('backstage.info')}
            </h1>

            <div
              style={{
                display: 'flex',
                gap: 24,
                flexWrap: 'wrap',
              }}
            >
              {/* Properties Card */}
              <div
                style={{
                  flex: '1 1 360px',
                  backgroundColor: 'var(--folio-panel)',
                  borderRadius: 8,
                  padding: 24,
                  border: '1px solid var(--folio-border)',
                  boxShadow: 'var(--folio-shadow-paper)',
                }}
              >
                <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 16px', color: 'var(--folio-teal)' }}>
                  {t('backstage.properties')}
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--folio-ink-muted)', marginBottom: 2 }}>
                      {t('backstage.fileLocation')}
                    </div>
                    <div
                      data-testid="backstage-info-location"
                      style={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-all' }}
                    >
                      {editorState.path || t('backstage.unsavedLocal')}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: 'var(--folio-ink-muted)', marginBottom: 2 }}>
                      {t('backstage.fileFormat')}
                    </div>
                    <div
                      data-testid="backstage-info-format"
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        backgroundColor: 'var(--folio-border)',
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {getFormatName()}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: 'var(--folio-ink-muted)', marginBottom: 2 }}>Status</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: editorState.dirty ? '#b91c1c' : '#15803d',
                        fontWeight: 600,
                      }}
                    >
                      {editorState.dirty ? t('backstage.unsavedChanges') : t('backstage.saved')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Card */}
              <div
                style={{
                  flex: '1 1 360px',
                  backgroundColor: 'var(--folio-panel)',
                  borderRadius: 8,
                  padding: 24,
                  border: '1px solid var(--folio-border)',
                  boxShadow: 'var(--folio-shadow-paper)',
                }}
              >
                <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 16px', color: 'var(--folio-teal)' }}>
                  {t('backstage.statistics')}
                </h2>

                <div
                  data-testid="backstage-info-stats"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
                >
                  {getStats().map((stat) => (
                    <div
                      key={stat.label}
                      style={{
                        backgroundColor: 'var(--folio-bg)',
                        borderRadius: 6,
                        padding: 12,
                        border: '1px solid var(--folio-border)',
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--folio-ink-muted)' }}>{stat.label}</div>
                      <div data-testid={stat.testId} style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'new' && (
          <div data-testid="backstage-section-new" style={{ maxWidth: 860 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 24px', color: 'var(--folio-ink)' }}>
              {t('backstage.new')}
            </h1>

            {/* Blank Starters */}
            <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 16px', color: 'var(--folio-ink-muted)' }}>
              Blank
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
              <div
                data-testid="backstage-new-document"
                onClick={() => {
                  onNew('document');
                  onClose();
                }}
                style={{
                  backgroundColor: 'var(--folio-panel)',
                  border: '1px solid var(--folio-border)',
                  borderRadius: 8,
                  padding: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                  boxShadow: 'var(--folio-shadow-paper)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--folio-teal)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--folio-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    backgroundColor: 'rgba(15, 118, 110, 0.1)',
                    color: 'var(--folio-teal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <File size={26} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                  {t('backstage.blankDocument')}
                </div>
              </div>

              <div
                data-testid="backstage-new-spreadsheet"
                onClick={() => {
                  onNew('spreadsheet');
                  onClose();
                }}
                style={{
                  backgroundColor: 'var(--folio-panel)',
                  border: '1px solid var(--folio-border)',
                  borderRadius: 8,
                  padding: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                  boxShadow: 'var(--folio-shadow-paper)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--folio-teal)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--folio-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    backgroundColor: 'rgba(15, 118, 110, 0.1)',
                    color: 'var(--folio-teal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TableIcon size={26} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                  {t('backstage.blankSpreadsheet')}
                </div>
              </div>

              <div
                data-testid="backstage-new-presentation"
                onClick={() => {
                  onNew('presentation');
                  onClose();
                }}
                style={{
                  backgroundColor: 'var(--folio-panel)',
                  border: '1px solid var(--folio-border)',
                  borderRadius: 8,
                  padding: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease',
                  boxShadow: 'var(--folio-shadow-paper)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--folio-teal)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--folio-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    backgroundColor: 'rgba(15, 118, 110, 0.1)',
                    color: 'var(--folio-teal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PresentationIcon size={26} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                  {t('backstage.blankPresentation')}
                </div>
              </div>
            </div>

            {/* Templates grid (for Step 26) */}
            {templates.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 16px', color: 'var(--folio-ink-muted)' }}>
                  Templates
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      data-testid={`backstage-template-${tpl.id}`}
                      onClick={() => {
                        onNew(tpl.kind, tpl.id);
                        onClose();
                      }}
                      style={{
                        backgroundColor: 'var(--folio-panel)',
                        border: '1px solid var(--folio-border)',
                        borderRadius: 8,
                        padding: 16,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        boxShadow: 'var(--folio-shadow-paper)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--folio-teal)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--folio-border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--folio-ink)' }}>{tpl.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--folio-ink-muted)' }}>{tpl.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'open' && (
          <div data-testid="backstage-section-open" style={{ maxWidth: 800 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, margin: '0 0 24px', color: 'var(--folio-ink)' }}>
              {t('backstage.open')}
            </h1>

            {/* Browse Button */}
            <div style={{ marginBottom: 28 }}>
              <button
                type="button"
                data-testid="backstage-open-browse"
                onClick={() => {
                  onClose();
                  onOpen();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  backgroundColor: 'var(--folio-teal)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <FolderOpen size={18} />
                {t('backstage.browse')}
              </button>
            </div>

            {/* Recovered Drafts */}
            {drafts.length > 0 && (
              <div style={{ marginBottom: 28 }} data-testid="backstage-recovered-drafts">
                <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 12px', color: 'var(--folio-teal)' }}>
                  {t('backstage.recoveredDrafts')}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {drafts.map((draft) => (
                    <div
                      key={draft.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: 'var(--folio-panel)',
                        borderRadius: 6,
                        border: '1px solid var(--folio-border)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onRestoreDraft?.(draft);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--folio-teal)',
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: 'pointer',
                          textAlign: 'left',
                          textDecoration: 'underline',
                        }}
                      >
                        {draft.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissDraft?.(draft)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--folio-ink-muted)',
                          fontSize: 16,
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Files */}
            <div data-testid="backstage-recent-files">
              <h2 style={{ fontSize: 16, fontWeight: 650, margin: '0 0 12px', color: 'var(--folio-ink-muted)' }}>
                {t('backstage.recentFiles')}
              </h2>
              {recentFiles.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--folio-ink-muted)' }}>No recent files</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentFiles.map((item, idx) => (
                    <div
                      key={`${item.path || item.name}-${idx}`}
                      onClick={() => {
                        onClose();
                        onOpenRecent?.(item);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        backgroundColor: 'var(--folio-panel)',
                        borderRadius: 6,
                        border: '1px solid var(--folio-border)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--folio-border)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--folio-panel)')}
                    >
                      <File size={18} color="var(--folio-teal)" />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                        {item.path && <div style={{ fontSize: 11, color: 'var(--folio-ink-muted)' }}>{item.path}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

