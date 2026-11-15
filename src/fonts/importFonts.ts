import { assertFontLoadable, inspectFontFile } from './inspect';
import type { FontFaceRecord, FontFamilyRecord, FontStyleName } from './types';

export interface FontImportInput {
  name: string;
  bytes: Uint8Array;
}

export interface FontImportIssue {
  fileName: string;
  kind: 'invalid' | 'duplicate' | 'conflict' | 'partial' | 'storage';
  message: string;
}

export interface FontImportResult {
  families: FontFamilyRecord[];
  issues: FontImportIssue[];
  files: Array<{ fileName: string; bytes: Uint8Array }>;
}

interface ExistingFace {
  family: string;
  style: FontStyleName;
  sha256: string;
}

function faceKey(family: string, style: FontStyleName): string {
  return `${family.toLowerCase()}::${style}`;
}

function cloneFamilies(families: FontFamilyRecord[]): FontFamilyRecord[] {
  return families.map((family) => ({ ...family, faces: family.faces.map((face) => ({ ...face })) }));
}

export async function importFontFiles(
  inputs: FontImportInput[],
  existing: FontFamilyRecord[]
): Promise<FontImportResult> {
  const families = cloneFamilies(existing.filter((family) => family.origin === 'custom'));
  const known = new Map<string, ExistingFace>();
  for (const family of families) {
    for (const face of family.faces) {
      known.set(faceKey(family.family, face.style), {
        family: family.family,
        style: face.style,
        sha256: face.sha256,
      });
    }
  }
  const issues: FontImportIssue[] = [];
  const files: Array<{ fileName: string; bytes: Uint8Array }> = [];

  for (const input of inputs) {
    const inspected = await inspectFontFile(input.name, input.bytes);
    if (!inspected.ok) {
      issues.push({ fileName: input.name, kind: 'invalid', message: inspected.reason });
      continue;
    }
    const face = inspected.font;
    try {
      await assertFontLoadable(input.bytes, face.family, face.weight, face.italic);
    } catch (err) {
      issues.push({
        fileName: input.name,
        kind: 'invalid',
        message: err instanceof Error ? err.message : 'This font cannot be loaded for display.',
      });
      continue;
    }
    const key = faceKey(face.family, face.style);
    const prior = known.get(key);
    if (prior?.sha256 === face.sha256) {
      issues.push({
        fileName: input.name,
        kind: 'duplicate',
        message: `${face.family} ${face.style} is already installed.`,
      });
      continue;
    }
    if (prior) {
      issues.push({
        fileName: input.name,
        kind: 'conflict',
        message: `${face.family} already has a different ${face.style} face. The installed face was kept.`,
      });
      continue;
    }
    const fileName = `${face.sha256}.${input.name.toLowerCase().endsWith('.otf') ? 'otf' : 'ttf'}`;
    const record: FontFaceRecord = {
      style: face.style,
      file: fileName,
      sha256: face.sha256,
      weight: face.weight,
      italic: face.italic,
      embedding: face.embedding,
    };
    let family = families.find((item) => item.family.toLowerCase() === face.family.toLowerCase());
    if (!family) {
      family = {
        family: face.family,
        category: 'sans-serif',
        license: 'custom',
        licenseFile: '',
        coverage: face.coverage,
        faces: [],
        origin: 'custom',
      };
      families.push(family);
    }
    family.faces.push(record);
    if (face.coverage === 'partial' || family.coverage === 'partial') {
      family.coverage = 'partial';
      issues.push({
        fileName: input.name,
        kind: 'partial',
        message: `${face.family} does not cover the full Ukrainian and Latin set.`,
      });
    }
    known.set(key, { family: face.family, style: face.style, sha256: face.sha256 });
    files.push({ fileName, bytes: input.bytes });
  }

  return { families, issues, files };
}
