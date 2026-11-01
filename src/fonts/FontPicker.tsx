import React, { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n/instance';
import { pickFontFiles } from '../platform';
import { cssFamily, readRecentFonts, rememberFont } from './names';
import { importChosenFonts, listFontFamilies, subscribeFonts } from './registry';
import { ensureFamilies } from './load';
import type { FontCategory, FontFamilyRecord } from './types';

const CATEGORIES: Array<FontCategory | 'all'> = ['all', 'serif', 'sans-serif', 'monospace', 'display', 'handwriting'];

const SAMPLE = 'Аа Бб Gg 123';

function categoryLabel(category: FontCategory | 'all'): string {
  if (category === 'all') return t('fonts.all');
  if (category === 'sans-serif') return t('fonts.sans');
  if (category === 'monospace') return t('fonts.mono');
  if (category === 'display') return t('fonts.display');
  if (category === 'handwriting') return t('fonts.handwriting');
  return t('fonts.serif');
}

export function FontPicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontCategory | 'all'>('all');
  const [active, setActive] = useState(0);
  const [families, setFamilies] = useState<FontFamilyRecord[]>(() => listFontFamilies());
  const [recent, setRecent] = useState<string[]>(() => readRecentFonts());
  const [notice, setNotice] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeFonts(() => setFamilies(listFontFamilies())), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return families.filter((family) => {
      if (category !== 'all' && family.category !== category && family.origin !== 'custom') return false;
      if (category !== 'all' && family.origin === 'custom' && family.category !== category) return false;
      return !q || family.family.toLowerCase().includes(q);
    });
  }, [families, query, category]);

  const recentFamilies = recent
    .map((name) => families.find((family) => family.family.toLowerCase() === name.toLowerCase()))
    .filter((family): family is FontFamilyRecord => Boolean(family));

  const rows = query.trim() || category !== 'all' ? filtered : [...recentFamilies, ...filtered.filter((family) => !recentFamilies.some((item) => item.family === family.family))];

  useEffect(() => {
    if (!open) return;
    const visible = rows.slice(0, 12).map((family) => family.family);
    void ensureFamilies(visible);
  }, [open, rows]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onPointer);
    return () => window.removeEventListener('mousedown', onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setActive((index) => Math.min(rows.length - 1, index + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActive((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        const family = rows[active];
        if (family) choose(family.family);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        setQuery((text) => text.slice(0, -1));
        setActive(0);
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        setQuery((text) => text + event.key);
        setActive(0);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, rows, active]);

  const choose = (family: string) => {
    setRecent(rememberFont(family));
    setOpen(false);
    setQuery('');
    onChange(family);
  };

  const addFonts = async () => {
    const picked = await pickFontFiles();
    if (!picked.length) return;
    const files = await Promise.all(
      picked.map(async (item) => ({
        name: item.name,
        bytes: new Uint8Array(await item.file.arrayBuffer()),
      }))
    );
    const issues = await importChosenFonts(files);
    setFamilies(listFontFamilies());
    setNotice(issues.map((issue) => issue.message).filter(Boolean).join(' '));
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }} onMouseDown={(event) => event.preventDefault()}>
      <button
        type="button"
        data-testid="font-picker"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('fonts.section')}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((valueOpen) => !valueOpen);
          setActive(0);
        }}
        style={{
          maxWidth: 148,
          minWidth: 96,
          height: 28,
          textAlign: 'left',
          padding: '0 8px',
          borderRadius: 4,
          border: '1px solid var(--folio-border)',
          background: 'var(--folio-panel)',
          color: 'var(--folio-ink)',
          fontFamily: cssFamily(value, 'Noto Sans'),
          cursor: disabled ? 'default' : 'pointer',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {value || t('fonts.section')}
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t('fonts.section')}
          data-testid="font-picker-menu"
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 32,
            left: 0,
            width: 280,
            maxHeight: 360,
            overflow: 'auto',
            background: 'var(--folio-panel)',
            color: 'var(--folio-ink)',
            border: '1px solid var(--folio-border)',
            borderRadius: 8,
            boxShadow: 'var(--folio-shadow-paper)',
            padding: 8,
          }}
        >
          <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--folio-ink-muted)' }}>
            {t('fonts.search')}: {query || '…'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => {
                  setCategory(item);
                  setActive(0);
                }}
                style={{
                  border: '1px solid var(--folio-border)',
                  background: category === item ? 'var(--folio-accent-light)' : 'transparent',
                  color: 'var(--folio-ink)',
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {categoryLabel(item)}
              </button>
            ))}
          </div>
          {recentFamilies.length > 0 && !query.trim() && category === 'all' && (
            <div style={{ fontSize: 11, color: 'var(--folio-ink-muted)', marginBottom: 4 }}>{t('fonts.recent')}</div>
          )}
          {rows.length === 0 && <div style={{ fontSize: 12, padding: 8 }}>{t('fonts.noResults')}</div>}
          {rows.map((family, index) => (
            <button
              key={`${family.origin}-${family.family}`}
              type="button"
              role="option"
              aria-selected={index === active || family.family === value}
              data-testid={`font-option-${family.family}`}
              onMouseEnter={() => {
                setActive(index);
                void ensureFamilies([family.family]);
              }}
              onClick={() => choose(family.family)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: index === active ? 'var(--folio-accent-light)' : 'transparent',
                color: 'var(--folio-ink)',
                borderRadius: 4,
                padding: '6px 8px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontFamily: cssFamily(family.family, 'Noto Sans'), fontSize: 16 }}>{SAMPLE}</div>
              <div style={{ fontSize: 11, color: 'var(--folio-ink-muted)' }}>
                {family.family}
                {family.coverage === 'partial' ? ` · ${t('fonts.coveragePartial')}` : ''}
              </div>
            </button>
          ))}
          <button
            type="button"
            data-testid="font-add"
            onClick={() => void addFonts()}
            style={{
              marginTop: 8,
              width: '100%',
              border: '1px solid var(--folio-border)',
              background: 'transparent',
              color: 'var(--folio-ink)',
              borderRadius: 4,
              padding: '6px 8px',
              cursor: 'pointer',
            }}
          >
            {t('fonts.add')}
          </button>
          {notice && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--folio-ink-muted)' }}>{notice}</div>}
        </div>
      )}
    </div>
  );
}
