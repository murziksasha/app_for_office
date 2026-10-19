export const VIDEO_MSG = {
  second: 'This slide already has a video. Delete it before adding another.',
  notMp4: 'Only an mp4 video can be added.',
  cannotPlay: 'This video cannot be played.',
  otherPrograms: 'This video may not play in other presentation programs.',
  extraOnSlide: 'Only the first mp4 on a slide is kept. Other videos will be removed if you save.',
  skippedNonMp4: 'A video that is not an mp4 was left out and will be removed if you save.',
  skippedAudio: 'Audio that is not inside a video was left out and will be removed if you save.',
};

export interface Mp4Sniff {
  isMp4: boolean;
  h264: boolean;
}

function readFourcc(bytes: Uint8Array, offset: number): string {
  if (offset + 4 > bytes.length) return '';
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  );
}

/** Major brand plus compatible brands from the leading ftyp box. */
export function readFtypBrands(bytes: Uint8Array): string[] {
  if (bytes.length < 16 || readFourcc(bytes, 4) !== 'ftyp') return [];
  const size = readU32(bytes, 0);
  const end = Math.min(bytes.length, size > 16 ? size : bytes.length);
  const brands = [readFourcc(bytes, 8)];
  for (let i = 16; i + 4 <= end; i += 4) {
    brands.push(readFourcc(bytes, i));
  }
  return brands.filter((brand) => brand.length === 4);
}

export function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const codes = Array.from(needle, (ch) => ch.charCodeAt(0));
  if (codes.length === 0 || bytes.length < codes.length) return false;
  outer: for (let i = 0; i <= bytes.length - codes.length; i++) {
    for (let j = 0; j < codes.length; j++) {
      if (bytes[i + j] !== codes[j]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * An mp4 is a file named `.mp4` whose ftyp box is present and is not a QuickTime-only brand.
 * H.264 is the avc1 / avc3 sample entry. The sniff can be wrong in both directions.
 */
export function sniffMp4(bytes: Uint8Array, fileName: string): Mp4Sniff {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const brands = readFtypBrands(bytes);
  const quickTimeOnly = brands.length > 0 && brands.every((brand) => brand === 'qt  ');
  return {
    isMp4: ext === 'mp4' && brands.length > 0 && !quickTimeOnly,
    h264: containsAscii(bytes, 'avc1') || containsAscii(bytes, 'avc3'),
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** pptxgenjs wants `video/mp4;base64,...` without the `data:` prefix. */
export function toPptxVideoData(src: string): string {
  const comma = src.indexOf(',');
  const payload = comma >= 0 ? src.slice(comma + 1) : src;
  return `video/mp4;base64,${payload}`;
}

export function probeVideoPlayable(blob: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    video.onloadedmetadata = () => finish(true);
    video.onerror = () => finish(false);
    video.src = url;
  });
}
