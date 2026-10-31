import React, { useEffect, useRef } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { t } from '../i18n/instance';

export interface FindPanelProps {
  open: boolean;
  onClose: () => void;
  initialFocus?: 'find' | 'replace';
  supportsReplace?: boolean;
  findText: string;
  setFindText: (text: string) => void;
  replaceText?: string;
  setReplaceText?: (text: string) => void;
  matchCase: boolean;
  setMatchCase: (matchCase: boolean) => void;
  matchCount: number;
  currentIndex: number;
  onFind: () => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onReplaceOne?: () => void;
  onReplaceAll?: () => void;
}

export const FindPanel: React.FC<FindPanelProps> = ({
  open,
  onClose,
  initialFocus = 'find',
  supportsReplace = true,
  findText,
  setFindText,
  replaceText = '',
  setReplaceText,
  matchCase,
  setMatchCase,
  matchCount,
  currentIndex,
  onFind,
  onFindNext,
  onFindPrevious,
  onReplaceOne,
  onReplaceAll,
}) => {
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (initialFocus === 'replace' && replaceInputRef.current) {
          replaceInputRef.current.focus();
          replaceInputRef.current.select();
        } else if (findInputRef.current) {
          findInputRef.current.focus();
          findInputRef.current.select();
        }
      }, 50);
    }
  }, [open, initialFocus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={t('find.title')}
      style={{
        position: 'fixed',
        top: '180px',
        right: '24px',
        zIndex: 100,
        backgroundColor: 'var(--folio-page)',
        border: '1px solid var(--folio-border)',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '12px',
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--folio-ink)' }}>
          {t('find.title')}
        </span>
        <button
          onClick={onClose}
          aria-label={t('ribbon.closeFile')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: 'var(--folio-ink-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Find input row */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          ref={findInputRef}
          type="text"
          placeholder={t('find.placeholder')}
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) {
                onFindPrevious();
              } else {
                onFindNext();
              }
            }
          }}
          style={{
            flex: 1,
            padding: '4px 8px',
            border: '1px solid var(--folio-border)',
            borderRadius: '4px',
            fontSize: '13px',
            outline: 'none',
            color: 'var(--folio-ink)',
            backgroundColor: 'var(--folio-bg)',
          }}
        />
        <button
          onClick={onFind}
          style={{
            padding: '4px 10px',
            background: 'var(--folio-teal)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {t('find.action')}
        </button>
      </div>

      {/* Controls row: match count + prev/next + match case */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: 'var(--folio-ink-muted)',
        }}
      >
        <div>
          {matchCount > 0 ? (
            currentIndex >= 0 ? (
              <span>
                {t('find.matchIndex', {
                  current: currentIndex + 1,
                  total: matchCount,
                })}
              </span>
            ) : (
              <span>{t('find.found', { count: matchCount })}</span>
            )
          ) : findText ? (
            <span>{t('find.noMatches')}</span>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={onFindPrevious}
            disabled={matchCount === 0}
            title={t('find.previous')}
            aria-label={t('find.previous')}
            style={{
              padding: '2px 4px',
              border: '1px solid var(--folio-border)',
              borderRadius: '3px',
              background: 'var(--folio-bg)',
              cursor: matchCount > 0 ? 'pointer' : 'default',
              opacity: matchCount > 0 ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={onFindNext}
            disabled={matchCount === 0}
            title={t('find.next')}
            aria-label={t('find.next')}
            style={{
              padding: '2px 4px',
              border: '1px solid var(--folio-border)',
              borderRadius: '3px',
              background: 'var(--folio-bg)',
              cursor: matchCount > 0 ? 'pointer' : 'default',
              opacity: matchCount > 0 ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronDown size={14} />
          </button>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              marginLeft: '6px',
            }}
          >
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
            />
            <span>{t('find.matchCase')}</span>
          </label>
        </div>
      </div>

      {/* Replace row */}
      {supportsReplace && (
        <>
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <input
              ref={replaceInputRef}
              type="text"
              placeholder={t('find.replacePlaceholder')}
              value={replaceText}
              onChange={(e) => setReplaceText?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onReplaceOne?.();
                }
              }}
              style={{
                flex: 1,
                padding: '4px 8px',
                border: '1px solid var(--folio-border)',
                borderRadius: '4px',
                fontSize: '13px',
                outline: 'none',
                color: 'var(--folio-ink)',
                backgroundColor: 'var(--folio-bg)',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button
              onClick={onReplaceOne}
              disabled={matchCount === 0}
              style={{
                padding: '4px 10px',
                background: 'var(--folio-bg-alt)',
                border: '1px solid var(--folio-border)',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: matchCount > 0 ? 'pointer' : 'default',
                opacity: matchCount > 0 ? 1 : 0.6,
              }}
            >
              {t('find.replace')}
            </button>
            <button
              onClick={onReplaceAll}
              disabled={matchCount === 0}
              style={{
                padding: '4px 10px',
                background: 'var(--folio-bg-alt)',
                border: '1px solid var(--folio-border)',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: matchCount > 0 ? 'pointer' : 'default',
                opacity: matchCount > 0 ? 1 : 0.6,
              }}
            >
              {t('find.replaceAll')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

