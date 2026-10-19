import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import PptxGenJS from 'pptxgenjs';
import { ImportReport, ImportWarning, PresentationModel, Slide, SlideElement } from '../types';
import { VIDEO_MSG, bytesToBase64, sniffMp4, toPptxVideoData } from './videoFile';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  isArray: (name) => {
    return ['sldId', 'Relationship', 'sp', 'pic', 'p', 'r'].includes(name);
  },
});

interface SlideRel {
  target: string;
  type: string;
}

interface RelMap {
  [id: string]: SlideRel;
}

/**
 * Loads relationship targets from a slide rels XML file.
 */
async function loadSlideRels(zip: JSZip, slideRelPath: string): Promise<RelMap> {
  const relFile = zip.file(slideRelPath);
  if (!relFile) return {};
  try {
    const xml = await relFile.async('text');
    const parsed = xmlParser.parse(xml);
    const rels = parsed?.Relationships?.Relationship || [];
    const list = Array.isArray(rels) ? rels : [rels];
    const map: RelMap = {};
    for (const r of list) {
      if (r['@_Id'] && r['@_Target']) {
        map[r['@_Id']] = { target: r['@_Target'], type: r['@_Type'] || '' };
      }
    }
    return map;
  } catch {
    return {};
  }
}

function zipMediaPath(target: string): string {
  if (target.startsWith('ppt/')) return target;
  if (target.startsWith('../')) return `ppt/${target.replace(/^(\.\.\/)+/, '')}`;
  return `ppt/${target.replace(/^\//, '')}`;
}

function videoLinkId(pic: any): string | null {
  const video = pic?.nvPicPr?.nvPr?.videoFile;
  if (!video) return null;
  const node = Array.isArray(video) ? video[0] : video;
  return node?.['@_link'] || node?.['@_embed'] || null;
}

/**
 * Extracts image as a data URL from PPT zip.
 */
async function extractPptImage(zip: JSZip, target: string): Promise<string | null> {
  const cleanTarget = zipMediaPath(target);

  const file = zip.file(cleanTarget);
  if (!file) return null;

  try {
    const b64 = await file.async('base64');
    const ext = cleanTarget.split('.').pop()?.toLowerCase() || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

async function extractPptVideo(zip: JSZip, target: string): Promise<{ bytes: Uint8Array; base64: string } | null> {
  const file = zip.file(zipMediaPath(target));
  if (!file) return null;
  try {
    const bytes = await file.async('uint8array');
    return { bytes, base64: bytesToBase64(bytes) };
  } catch {
    return null;
  }
}

/**
 * Imports PPTX package into editable presentation model.
 */
export async function importPptx(
  buffer: ArrayBuffer,
  fileName: string
): Promise<{ presentation: PresentationModel; report: ImportReport }> {
  const warnings: ImportWarning[] = [];
  const skippedFeatures: string[] = [];

  const zip = await JSZip.loadAsync(buffer);
  const presFile = zip.file('ppt/presentation.xml');
  if (!presFile) {
    throw new Error('Invalid PPTX: ppt/presentation.xml not found');
  }

  const presXml = await presFile.async('text');
  const parsedPres = xmlParser.parse(presXml);

  // Check skipped features
  if (presXml.includes('anim') || presXml.includes('transition')) {
    skippedFeatures.push('Animations & Transitions');
    warnings.push({
      item: 'Animations & Transitions',
      reason: 'Slide animations and transitions are omitted in this version',
    });
  }
  if (presXml.includes('dgm') || Object.keys(zip.files).some((f) => f.includes('diagrams/'))) {
    skippedFeatures.push('SmartArt');
    warnings.push({ item: 'SmartArt', reason: 'SmartArt diagrams are simplified or omitted' });
  }

  // Get slide size (default 16:9 = 9144000 x 5143500 EMUs)
  const sldSz = parsedPres?.presentation?.sldSz;
  const slideWidthEmu = parseInt(sldSz?.['@_cx'] || '9144000', 10);
  const slideHeightEmu = parseInt(sldSz?.['@_cy'] || '5143500', 10);

  // Load presentation rels to find slide files
  const presRelMap = await loadSlideRels(zip, 'ppt/_rels/presentation.xml.rels');

  const sldIdLst = parsedPres?.presentation?.sldIdLst?.sldId || [];
  const slideIdEntries = Array.isArray(sldIdLst) ? sldIdLst : [sldIdLst];

  const slideFileNames: string[] = [];
  for (const sld of slideIdEntries) {
    const rId = sld['@_id'];
    const target = presRelMap[rId]?.target;
    if (target) {
      const cleanPath = target.startsWith('slides/') ? `ppt/${target}` : `ppt/slides/${target}`;
      slideFileNames.push(cleanPath);
    }
  }

  // If no rels found, fallback to scanning files matching ppt/slides/slide*.xml
  if (slideFileNames.length === 0) {
    Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)![0], 10);
        const numB = parseInt(b.match(/\d+/)![0], 10);
        return numA - numB;
      })
      .forEach((f) => slideFileNames.push(f));
  }

  const slides: Slide[] = [];

  for (let sIdx = 0; sIdx < slideFileNames.length; sIdx++) {
    const slidePath = slideFileNames[sIdx];
    const sFile = zip.file(slidePath);
    if (!sFile) continue;

    const sXml = await sFile.async('text');
    const sParsed = xmlParser.parse(sXml);
    const spTree = sParsed?.sld?.cSld?.spTree;

    const slideRelPath = slidePath.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const slideRels = await loadSlideRels(zip, slideRelPath);

    const elements: SlideElement[] = [];

    // Helper to calculate percentage positions
    const getPercentBounds = (xfrm: any) => {
      const offX = parseInt(xfrm?.off?.['@_x'] || '0', 10);
      const offY = parseInt(xfrm?.off?.['@_y'] || '0', 10);
      const extX = parseInt(xfrm?.ext?.['@_cx'] || '1000000', 10);
      const extY = parseInt(xfrm?.ext?.['@_cy'] || '500000', 10);

      const x = Math.max(0, Math.min(100, Math.round((offX / slideWidthEmu) * 100)));
      const y = Math.max(0, Math.min(100, Math.round((offY / slideHeightEmu) * 100)));
      const width = Math.max(5, Math.min(100, Math.round((extX / slideWidthEmu) * 100)));
      const height = Math.max(3, Math.min(100, Math.round((extY / slideHeightEmu) * 100)));

      return { x, y, width, height };
    };

    // Parse shapes / text boxes
    const shapes = spTree?.sp ? (Array.isArray(spTree.sp) ? spTree.sp : [spTree.sp]) : [];
    for (let shIdx = 0; shIdx < shapes.length; shIdx++) {
      const sp = shapes[shIdx];
      const bounds = getPercentBounds(sp.spPr?.xfrm);

      const txBody = sp.txBody;
      if (txBody) {
        const paragraphs = txBody.p ? (Array.isArray(txBody.p) ? txBody.p : [txBody.p]) : [];
        let fullText = '';
        let fontSize = 18;
        let bold = false;
        let italic = false;
        let underline = false;
        let color = '#1e2022';
        let align: 'left' | 'center' | 'right' = 'left';

        paragraphs.forEach((p: any, pIndex: number) => {
          if (pIndex > 0) fullText += '\n';

          if (p.pPr) {
            const algn = p.pPr['@_algn'];
            if (algn === 'ctr') align = 'center';
            else if (algn === 'r') align = 'right';
          }

          const runs = p.r ? (Array.isArray(p.r) ? p.r : [p.r]) : [];
          runs.forEach((r: any) => {
            if (r.t) {
              const runTxt = typeof r.t === 'string' ? r.t : r.t['#text'] ? String(r.t['#text']) : '';
              fullText += runTxt;
            }
            if (r.rPr) {
              if (r.rPr['@_sz']) {
                fontSize = Math.round(parseInt(r.rPr['@_sz'], 10) / 100);
              }
              if (r.rPr['@_b'] === '1') bold = true;
              if (r.rPr['@_i'] === '1') italic = true;
              if (r.rPr['@_u'] && r.rPr['@_u'] !== 'none') underline = true;
              if (r.rPr.solidFill?.srgbClr?.['@_val']) {
                color = `#${r.rPr.solidFill.srgbClr['@_val']}`;
              }
            }
          });
        });

        if (fullText.trim()) {
          elements.push({
            id: `elem_txt_${sIdx}_${shIdx}`,
            type: 'text',
            ...bounds,
            text: fullText,
            fontSize,
            bold,
            italic,
            underline,
            color,
            align,
          });
        }
      }
    }

    if (sXml.includes('audioFile')) {
      warnings.push({
        item: `Slide ${sIdx + 1}`,
        reason: VIDEO_MSG.skippedAudio,
      });
      if (!skippedFeatures.includes('Standalone audio')) skippedFeatures.push('Standalone audio');
    }

    // Parse pictures and videos. A video pic also carries a cover image; that cover is not a picture.
    const pics = spTree?.pic ? (Array.isArray(spTree.pic) ? spTree.pic : [spTree.pic]) : [];
    let keptVideo = false;
    for (let pIdx = 0; pIdx < pics.length; pIdx++) {
      const pic = pics[pIdx];
      const bounds = getPercentBounds(pic.spPr?.xfrm);
      const videoId = videoLinkId(pic);
      if (videoId) {
        const rel = slideRels[videoId];
        const fileName = rel?.target?.split('/').pop() || 'video.mp4';
        if (!rel) continue;
        const media = await extractPptVideo(zip, rel.target);
        if (!media) continue;
        const sniff = sniffMp4(media.bytes, fileName);
        if (!sniff.isMp4) {
          warnings.push({ item: `Slide ${sIdx + 1}`, reason: VIDEO_MSG.skippedNonMp4 });
          if (!skippedFeatures.includes('Non-mp4 video')) skippedFeatures.push('Non-mp4 video');
          continue;
        }
        if (keptVideo) {
          warnings.push({ item: `Slide ${sIdx + 1}`, reason: VIDEO_MSG.extraOnSlide });
          if (!skippedFeatures.includes('Extra slide videos')) skippedFeatures.push('Extra slide videos');
          continue;
        }
        if (!sniff.h264) {
          warnings.push({ item: `Slide ${sIdx + 1}`, reason: VIDEO_MSG.otherPrograms });
        }
        elements.push({
          id: `elem_vid_${sIdx}_${pIdx}`,
          type: 'video',
          ...bounds,
          src: `data:video/mp4;base64,${media.base64}`,
        });
        keptVideo = true;
        continue;
      }

      const blipId = pic.blipFill?.blip?.['@_embed'];
      const target = slideRels[blipId]?.target;
      if (target) {
        const dataUrl = await extractPptImage(zip, target);
        if (dataUrl) {
          elements.push({
            id: `elem_pic_${sIdx}_${pIdx}`,
            type: 'image',
            ...bounds,
            src: dataUrl,
          });
        }
      }
    }

    slides.push({
      id: `slide_${sIdx + 1}`,
      title: elements.find((e) => e.type === 'text')?.text?.slice(0, 30) || `Slide ${sIdx + 1}`,
      background: '#ffffff',
      elements,
    });
  }

  if (slides.length === 0) {
    slides.push(createEmptySlide(1));
  }

  return {
    presentation: {
      title: fileName.replace(/\.[^/.]+$/, '') || 'Presentation',
      slides,
    },
    report: {
      fileName,
      format: 'pptx',
      importedAt: new Date().toISOString(),
      warnings,
      skippedFeatures,
    },
  };
}

/**
 * Creates a default empty slide.
 */
export function createEmptySlide(slideNumber = 1): Slide {
  return {
    id: `slide_${Date.now()}_${slideNumber}`,
    title: `Slide ${slideNumber}`,
    background: '#ffffff',
    elements: [
      {
        id: `elem_${Date.now()}_title`,
        type: 'text',
        x: 10,
        y: 12,
        width: 80,
        height: 18,
        text: slideNumber === 1 ? 'Title of Presentation' : 'Slide Title',
        fontSize: slideNumber === 1 ? 32 : 26,
        bold: true,
        align: slideNumber === 1 ? 'center' : 'left',
        color: '#1e2022',
      },
      {
        id: `elem_${Date.now()}_body`,
        type: 'text',
        x: 10,
        y: 35,
        width: 80,
        height: 45,
        text:
          slideNumber === 1
            ? 'Subtitle or presenter name'
            : '• First key idea\n• Second key takeaway\n• Third supporting detail',
        fontSize: 18,
        color: '#5c6370',
        align: slideNumber === 1 ? 'center' : 'left',
      },
    ],
  };
}

/**
 * Exports presentation model into PPTX blob using pptxgenjs.
 */
export async function exportPptx(presentation: PresentationModel): Promise<Blob> {
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_16x9';

  presentation.slides.forEach((slide) => {
    const s = pres.addSlide();
    if (slide.background) {
      s.background = { color: slide.background.replace('#', '') };
    }

    slide.elements.forEach((elem) => {
      const xInch = (elem.x / 100) * 10;
      const yInch = (elem.y / 100) * 5.625;
      const wInch = (elem.width / 100) * 10;
      const hInch = (elem.height / 100) * 5.625;

      if (elem.type === 'text') {
        s.addText(elem.text || '', {
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
          fontSize: elem.fontSize || 18,
          color: (elem.color || '#1e2022').replace('#', ''),
          bold: !!elem.bold,
          italic: !!elem.italic,
          underline: elem.underline ? { style: 'sng' } : undefined,
          align: elem.align || 'left',
          valign: 'top',
        });
      } else if (elem.type === 'image' && elem.src) {
        s.addImage({
          data: elem.src,
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
        });
      } else if (elem.type === 'video' && elem.src) {
        s.addMedia({
          type: 'video',
          data: toPptxVideoData(elem.src),
          extn: 'mp4',
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
        });
      } else if (elem.type === 'rect') {
        s.addShape(pres.ShapeType.rect, {
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
          fill: { color: (elem.fill || '#e2ded6').replace('#', '') },
        });
      }
    });
  });

  const blob = (await pres.write({ outputType: 'blob' })) as Blob;
  return blob;
}
