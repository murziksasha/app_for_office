import React, { useEffect, useState } from 'react';
import { t } from '../i18n/instance';
import { pickFontFiles } from '../platform';
import { cssFamily } from './names';
import { importChosenFonts, listFontFamilies, removeCustomFont, subscribeFonts } from './registry';
import { ensureFamilies } from './load';
import type { FontFamilyRecord } from './types';

const SAMPLE = 'Аа Бб Gg 123';

export function FontSettings() {
  const [families, setFamilies] = useState<FontFamilyRecord[]>(() => listFontFamilies());
  const [notice, setNotice] = useState('');

  useEffect(() => subscribeFonts(() => setFamilies(listFontFamilies())), []);
  useEffect(() => {
    void ensureFamilies(families.slice(0, 8).map((family) => family.family));
  }, [families]);

  const addFonts = async () => {
    const picked = await pickFontFiles();
    if (!picked.length) return;
    const files = await Promise.all(
      picked.map(async (item) => ({ name: item.name, bytes: new Uint8Array(await item.file.arrayBuffer()) }))
    );
    const issues = await importChosenFonts(files);
    setNotice(issues.map((issue) => issue.message).join(' '));
    setFamilies(listFontFamilies());
  };

  const bundled = families.filter((family) => family.origin === 'bundled');
  const custom = families.filter((family) => family.origin === 'custom');

  return (
    <section data-section="fonts" data-testid="settings-fonts" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--folio-teal)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          margin: 0,
          paddingBottom: 6,
          borderBottom: '1px solid var(--folio-border-light)',
        }}
      >
        {t('fonts.section')}
      </h3>
      <button
        type="button"
        data-testid="settings-font-import"
        onClick={() => void addFonts()}
        style={{
          alignSelf: 'flex-start',
          padding: '6px 12px',
          borderRadius: 6,
          border: '1px solid var(--folio-border)',
          background: 'var(--folio-bg)',
          color: 'var(--folio-ink)',
          cursor: 'pointer',
        }}
      >
        {t('fonts.import')}
      </button>
      {notice && <p style={{ margin: 0, fontSize: 12, color: 'var(--folio-ink-muted)' }}>{notice}</p>}
      <div style={{ fontSize: 12, fontWeight: 650 }}>{t('fonts.custom')}</div>
      {custom.length === 0 && <p style={{ margin: 0, fontSize: 12, color: 'var(--folio-ink-muted)' }}>{t('fonts.emptyCustom')}</p>}
      {custom.map((family) => (
        <div key={family.family} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: cssFamily(family.family, 'Noto Sans') }}>{SAMPLE}</div>
            <div style={{ fontSize: 12 }}>
              {family.family} · {family.coverage === 'full' ? t('fonts.coverageFull') : t('fonts.coveragePartial')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void removeCustomFont(family.family)}
            style={{ border: 'none', background: 'transparent', color: 'var(--folio-ink)', cursor: 'pointer' }}
          >
            {t('fonts.remove')}
          </button>
        </div>
      ))}
      <div style={{ fontSize: 12, fontWeight: 650 }}>{t('fonts.builtin')}</div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--folio-ink-muted)' }}>{t('fonts.builtinHint')}</p>
      <div style={{ maxHeight: 180, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bundled.map((family) => (
          <div key={family.family} style={{ fontSize: 13 }}>
            <span style={{ fontFamily: cssFamily(family.family, 'Noto Sans') }}>{family.family}</span>
            <span style={{ color: 'var(--folio-ink-muted)' }}> · {t('fonts.coverageFull')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
