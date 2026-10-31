import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { t } from '../i18n/instance';
import { searchCommands, type CommandContext, type FolioCommand } from './commands';
import type { DocumentKind } from '../types';

export interface CommandSearchProps {
  kind: DocumentKind;
  context?: CommandContext;
  onCommandRun?: (cmd: FolioCommand) => void;
}

export const CommandSearch: React.FC<CommandSearchProps> = ({ kind, context, onCommandRun }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const results = searchCommands(query, kind);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === 'q') || (e.ctrlKey && e.key.toLowerCase() === 'q')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRunCommand = (cmd: FolioCommand) => {
    cmd.run(context);
    onCommandRun?.(cmd);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[selectedIndex] || results[0];
      if (target) {
        handleRunCommand(target);
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="folio-command-search"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        maxWidth: 320,
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'var(--folio-panel)',
          border: '1px solid var(--folio-border)',
          borderRadius: 6,
          padding: '4px 8px',
          width: '100%',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Search size={14} color="var(--folio-ink-muted)" />
        <input
          ref={inputRef}
          data-testid="folio-command-search-input"
          type="text"
          value={query}
          placeholder={t('commandSearch.placeholder')}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          style={{
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--folio-ink)',
            fontSize: 12,
            width: '100%',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {open && query.trim().length > 0 && (
        <div
          data-testid="folio-command-search-results"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1100,
            backgroundColor: '#ffffff',
            border: '1px solid var(--folio-border)',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            maxHeight: 280,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--folio-ink-muted)',
                textAlign: 'center',
              }}
            >
              {t('commandSearch.noResults')}
            </div>
          ) : (
            results.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              let label = '';
              try {
                label = t(cmd.labelKey);
              } catch {
                label = cmd.id;
              }
              return (
                <div
                  key={cmd.id}
                  data-testid={`command-search-item-${cmd.id}`}
                  onClick={() => handleRunCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--folio-border)' : 'transparent',
                    color: 'var(--folio-ink)',
                  }}
                >
                  <span style={{ fontWeight: isSelected ? 600 : 400 }}>{label}</span>
                  {cmd.shortcut && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--folio-ink-muted)',
                        backgroundColor: 'var(--folio-bg)',
                        border: '1px solid var(--folio-border)',
                        padding: '1px 4px',
                        borderRadius: 3,
                      }}
                    >
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

