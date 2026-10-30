import React, { useEffect, useState } from 'react';
import { DocumentKind, RecentItem, DraftItem } from '../types';
import { getRecentFiles, clearRecentFiles } from '../files/recent';
import { getAllDrafts } from '../files/drafts';
import { t } from '../i18n/instance';
import { LanguageButton } from './LanguageButton';
import { DROP_TARGET_ATTR, HOME_DRAG_EVENT } from './dropTarget';
import {
  FileText,
  Table as TableIcon,
  Presentation as PresentationIcon,
  FolderOpen,
  Clock,
  Trash2,
  Upload,
  Shield,
  Settings,
} from 'lucide-react';

interface StartScreenProps {
  onNew: (kind: DocumentKind) => void;
  onOpen: () => void;
  onOpenRecent: (item: RecentItem) => void;
  onRestoreDraft: (draft: DraftItem) => void;
  onDismissDraft: (draft: DraftItem) => void;
  onFileDrop: (files: File[]) => void;
  onOpenSettings?: () => void;
  listsRevision?: number;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onNew,
  onOpen,
  onOpenRecent,
  onRestoreDraft,
  onDismissDraft,
  onFileDrop,
  onOpenSettings,
  listsRevision = 0,
}) => {
  const [recentFiles, setRecentFiles] = useState<RecentItem[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    getRecentFiles().then(setRecentFiles);
    getAllDrafts().then(setDrafts);
  }, [listsRevision]);

  useEffect(() => {
    const onHover = (event: Event) => {
      setIsDragging(Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active));
    };
    window.addEventListener(HOME_DRAG_EVENT, onHover);
    return () => window.removeEventListener(HOME_DRAG_EVENT, onHover);
  }, []);

  const handleClearHistory = async () => {
    await clearRecentFiles();
    setRecentFiles([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(Array.from(e.dataTransfer.files));
    }
  };

  const getFormatBadgeColor = (format: string) => {
    switch (format) {
      case 'docx':
      case 'tmdx':
      case 'odt':
      case 'rtf':
      case 'md':
      case 'html':
      case 'txt':
        return { bg: '#e0f2fe', color: '#0369a1' };
      case 'xlsx':
      case 'pmdx':
      case 'csv':
      case 'tsv':
        return { bg: '#dcfce7', color: '#15803d' };
      case 'pptx':
      case 'prdx':
        return { bg: '#ffedd5', color: '#c2410c' };
      case 'pdf':
        return { bg: '#fee2e2', color: '#b91c1c' };
      default:
        return { bg: 'var(--folio-bg-alt)', color: 'var(--folio-ink)' };
    }
  };

  return (
    <div
      {...{ [DROP_TARGET_ATTR]: '' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'var(--folio-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Brand Header */}
      <header
        style={{
          padding: '24px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--folio-border)',
          backgroundColor: 'var(--folio-ribbon-bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--folio-teal)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: 'var(--folio-shadow-sm)',
            }}
          >
            <FileText size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--folio-ink)', letterSpacing: '-0.3px' }}>
              Folio
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--folio-ink-muted)' }}>{t('start.tagline')}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--folio-ink-muted)', fontSize: '12px' }}>
          <Shield size={14} color="var(--folio-teal)" />
          <span>{t('start.private')}</span>
          <button
            type="button"
            onClick={onOpenSettings}
            data-testid="start-settings-button"
            title={t('settings.title')}
            aria-label={t('settings.title')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--folio-border)',
              background: 'var(--folio-bg)',
              color: 'var(--folio-ink)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Settings size={14} />
            <span>{t('settings.title')}</span>
          </button>
          <LanguageButton />
        </div>
      </header>

      {/* Main Content Area */}
      <div
        style={{
          maxWidth: '1080px',
          width: '100%',
          margin: '0 auto',
          padding: '40px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '36px',
        }}
      >
        {/* Unsaved Drafts Alert if any */}
        {drafts.length > 0 && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--folio-radius-md)',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <strong style={{ fontSize: '13px', color: '#92400e' }}>{t('start.recovered')}</strong>
              {drafts.map((draft) => (
                <div key={draft.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#92400e' }}>{draft.name}</span>
                  <span style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => onRestoreDraft(draft)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#b45309',
                        color: 'white',
                        borderRadius: 'var(--folio-radius-md)',
                        fontSize: '12px',
                      }}
                    >
                      {t('start.open')}
                    </button>
                    <button
                      onClick={() => onDismissDraft(draft)}
                      style={{ padding: '4px 10px', fontSize: '12px', color: '#92400e' }}
                    >
                      {t('start.dismiss')}
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Start New Section */}
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--folio-ink)', marginBottom: '16px' }}>
            {t('start.create')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            {/* New Document */}
            <div
              onClick={() => onNew('document')}
              className="folio-action-card"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--folio-border)',
                borderRadius: 'var(--folio-radius-lg)',
                padding: '24px 20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: 'var(--folio-shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                }}
              >
                <FileText size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--folio-ink)' }}>{t('start.newDocument')}</h3>
                <p style={{ fontSize: '12px', color: 'var(--folio-ink-muted)', marginTop: '4px' }}>
                  {t('start.newDocumentHint')}
                </p>
              </div>
            </div>

            {/* New Spreadsheet */}
            <div
              onClick={() => onNew('spreadsheet')}
              className="folio-action-card"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--folio-border)',
                borderRadius: 'var(--folio-radius-lg)',
                padding: '24px 20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: 'var(--folio-shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a',
                }}
              >
                <TableIcon size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--folio-ink)' }}>{t('start.newSpreadsheet')}</h3>
                <p style={{ fontSize: '12px', color: 'var(--folio-ink-muted)', marginTop: '4px' }}>
                  {t('start.newSpreadsheetHint')}
                </p>
              </div>
            </div>

            {/* New Presentation */}
            <div
              onClick={() => onNew('presentation')}
              className="folio-action-card"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--folio-border)',
                borderRadius: 'var(--folio-radius-lg)',
                padding: '24px 20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: 'var(--folio-shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: '#ffedd5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c',
                }}
              >
                <PresentationIcon size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--folio-ink)' }}>{t('start.newPresentation')}</h3>
                <p style={{ fontSize: '12px', color: 'var(--folio-ink-muted)', marginTop: '4px' }}>
                  {t('start.newPresentationHint')}
                </p>
              </div>
            </div>

            {/* Open File Button Card */}
            <div
              onClick={onOpen}
              className="folio-action-card"
              style={{
                backgroundColor: '#ffffff',
                border: '1px dashed var(--folio-teal)',
                borderRadius: 'var(--folio-radius-lg)',
                padding: '24px 20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: 'var(--folio-shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--folio-teal-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--folio-teal)',
                }}
              >
                <FolderOpen size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--folio-ink)' }}>{t('start.openExisting')}</h3>
                <p style={{ fontSize: '12px', color: 'var(--folio-ink-muted)', marginTop: '4px' }}>
                  {t('start.openExistingHint')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          style={{
            border: isDragging ? '2px dashed var(--folio-teal)' : '2px dashed var(--folio-border)',
            borderRadius: 'var(--folio-radius-lg)',
            backgroundColor: isDragging ? 'var(--folio-teal-tint)' : '#ffffff',
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
            cursor: 'pointer',
          }}
          onClick={onOpen}
        >
          <Upload size={28} color="var(--folio-teal)" />
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--folio-ink)' }}>
            {t('start.dropTitle')}
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--folio-ink-muted)' }}>
            {t('start.dropHint')}
          </p>
        </div>

        {/* Recent Files Section */}
        <div data-folio-recent="">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="var(--folio-ink-muted)" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--folio-ink)' }}>{t('start.recent')}</h2>
            </div>
            {recentFiles.length > 0 && (
              <button
                onClick={handleClearHistory}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--folio-ink-muted)',
                }}
              >
                <Trash2 size={13} /> {t('start.clear')}
              </button>
            )}
          </div>

          {recentFiles.length === 0 ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--folio-border)',
                borderRadius: 'var(--folio-radius-md)',
                padding: '32px',
                textAlign: 'center',
                color: 'var(--folio-ink-muted)',
                fontSize: '13px',
              }}
            >
              {t('start.emptyRecent')}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--folio-border)',
                borderRadius: 'var(--folio-radius-md)',
                overflow: 'hidden',
              }}
            >
              {recentFiles.map((item, idx) => {
                const badge = getFormatBadgeColor(item.format);
                const dateStr = new Date(item.lastOpened).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => onOpenRecent(item)}
                    style={{
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: idx === recentFiles.length - 1 ? 'none' : '1px solid var(--folio-border-light)',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--folio-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '3px 7px',
                          borderRadius: '4px',
                          backgroundColor: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {item.format}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--folio-ink)' }}>
                        {item.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--folio-ink-muted)' }}>{dateStr}</span>
                      <button
                        style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--folio-bg)',
                          border: '1px solid var(--folio-border)',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--folio-teal)',
                        }}
                      >
                        {t('start.open')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

