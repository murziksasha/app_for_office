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
    return ['sldId', 'Relationship', 'sp', 'pic', 'p', 'r', 'graphicFrame', 'tr', 'tc'].includes(name);
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
  let warnedTableStyles = false;

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
  const ratio = slideWidthEmu / slideHeightEmu;

  let slideSize: '16:9' | '16:10' | '4:3' = '16:9';
  if (Math.abs(ratio - 16 / 9) < 0.05) {
    slideSize = '16:9';
  } else if (Math.abs(ratio - 1.6) < 0.05) {
    slideSize = '16:10';
  } else if (Math.abs(ratio - 4 / 3) < 0.05) {
    slideSize = '4:3';
  } else {
    const d169 = Math.abs(ratio - 16 / 9);
    const d1610 = Math.abs(ratio - 1.6);
    const d43 = Math.abs(ratio - 4 / 3);
    if (d1610 < d169 && d1610 < d43) {
      slideSize = '16:10';
    } else if (d43 < d169 && d43 < d1610) {
      slideSize = '4:3';
    } else {
      slideSize = '16:9';
    }
    warnings.push({
      item: 'Slide size',
      reason: 'Non-standard slide size was mapped to nearest aspect ratio',
    });
    if (!skippedFeatures.includes('Custom slide dimensions')) {
      skippedFeatures.push('Custom slide dimensions');
    }
  }

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

    // Read notes slide if available
    let slideNotes: string | undefined;
    let notesTarget: string | null = null;
    for (const r of Object.values(slideRels)) {
      if (r.type?.includes('notesSlide') || r.target?.includes('notesSlide')) {
        notesTarget = r.target;
        break;
      }
    }
    if (notesTarget) {
      const cleanNotesPath = zipMediaPath(notesTarget);
      const nFile = zip.file(cleanNotesPath);
      if (nFile) {
        try {
          const nXml = await nFile.async('text');
          if (nXml.includes('audioFile')) {
            warnings.push({
              item: `Slide ${sIdx + 1}`,
              reason: VIDEO_MSG.skippedAudio,
            });
            if (!skippedFeatures.includes('Standalone audio')) skippedFeatures.push('Standalone audio');
          }
          const nParsed = xmlParser.parse(nXml);
          const notesShapes = nParsed?.notes?.cSld?.spTree?.sp;
          const nShapeList = notesShapes ? (Array.isArray(notesShapes) ? notesShapes : [notesShapes]) : [];
          for (const sp of nShapeList) {
            const ph = sp.nvSpPr?.nvPr?.ph;
            const phType = ph?.['@_type'];
            // Skip slide thumbnail placeholder
            if (phType === 'sldImg') continue;
            // Body placeholder contains speaker notes
            if (phType === 'body' || ph?.['@_idx'] === '1' || (!ph && sp.txBody)) {
              const paragraphs = sp.txBody?.p ? (Array.isArray(sp.txBody.p) ? sp.txBody.p : [sp.txBody.p]) : [];
              let text = '';
              paragraphs.forEach((p: any, pIndex: number) => {
                if (pIndex > 0) text += '\n';
                const runs = p.r ? (Array.isArray(p.r) ? p.r : [p.r]) : [];
                runs.forEach((r: any) => {
                  if (r.t) {
                    const runTxt = typeof r.t === 'string' ? r.t : r.t['#text'] ? String(r.t['#text']) : '';
                    text += runTxt;
                  }
                });
              });
              if (text.trim()) {
                slideNotes = text;
              }
            }
          }
        } catch {
          // Ignore notes parse errors
        }
      }
    }

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
      const height = Math.max(2, Math.min(100, Math.round((extY / slideHeightEmu) * 100)));

      return { x, y, width, height };
    };

    // Parse shapes / text boxes
    const shapes = spTree?.sp ? (Array.isArray(spTree.sp) ? spTree.sp : [spTree.sp]) : [];
    for (let shIdx = 0; shIdx < shapes.length; shIdx++) {
      const sp = shapes[shIdx];
      const bounds = getPercentBounds(sp.spPr?.xfrm);
      const prst = sp.spPr?.prstGeom?.['@_prst'];

      let shape: 'rect' | 'roundRect' | 'ellipse' | 'triangle' | 'line' | undefined;
      if (prst === 'roundRect') {
        shape = 'roundRect';
      } else if (prst === 'ellipse') {
        shape = 'ellipse';
      } else if (prst === 'triangle') {
        shape = 'triangle';
      } else if (prst === 'line' || (typeof prst === 'string' && prst.startsWith('straightConnector'))) {
        shape = 'line';
      } else if (prst === 'rect') {
        shape = 'rect';
      } else if (prst) {
        shape = 'rect';
        warnings.push({
          item: 'Shape preset',
          reason: `Shape preset '${prst}' was converted to rectangle`,
        });
        if (!skippedFeatures.includes('Custom shape presets')) {
          skippedFeatures.push('Custom shape presets');
        }
      }

      let fill: string | undefined;
      if (sp.spPr?.solidFill?.srgbClr?.['@_val']) {
        fill = `#${sp.spPr.solidFill.srgbClr['@_val']}`;
      }

      let borderColor: string | undefined;
      let borderWidth: number | undefined;
      if (sp.spPr?.ln) {
        if (sp.spPr.ln.solidFill?.srgbClr?.['@_val']) {
          borderColor = `#${sp.spPr.ln.solidFill.srgbClr['@_val']}`;
        }
        if (sp.spPr.ln['@_w']) {
          borderWidth = Math.max(1, Math.round(parseInt(sp.spPr.ln['@_w'], 10) / 12700));
        }
      }
      if (shape === 'line') {
        borderColor = borderColor || fill || '#0f766e';
        borderWidth = borderWidth || 2;
      }

      const txBody = sp.txBody;
      let fullText = '';
      let fontSize = 18;
      let bold = false;
      let italic = false;
      let underline = false;
      let color = '#1e2022';
      let align: 'left' | 'center' | 'right' = 'left';

      if (txBody) {
        const paragraphs = txBody.p ? (Array.isArray(txBody.p) ? txBody.p : [txBody.p]) : [];
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
      }

      const hasText = Boolean(fullText.trim());

      if (shape && shape !== 'rect') {
        elements.push({
          id: `elem_shp_${sIdx}_${shIdx}`,
          type: 'rect',
          shape,
          ...bounds,
          fill,
          borderColor,
          borderWidth,
          ...(hasText ? { text: fullText, fontSize, bold, italic, underline, color, align } : {}),
        });
      } else if (hasText && !fill && !borderColor) {
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
      } else {
        // Rectangle shape (with or without fill, and optional text)
        elements.push({
          id: `elem_shp_${sIdx}_${shIdx}`,
          type: 'rect',
          shape: 'rect',
          ...bounds,
          fill: fill || (hasText ? undefined : '#e2ded6'),
          borderColor,
          borderWidth,
          ...(hasText ? { text: fullText, fontSize, bold, italic, underline, color, align } : {}),
        });
      }
    }

    // Parse tables (graphicFrame / tbl)
    const graphicFrames = spTree?.graphicFrame ? (Array.isArray(spTree.graphicFrame) ? spTree.graphicFrame : [spTree.graphicFrame]) : [];
    let slideHadMergedCells = false;

    for (let gfIdx = 0; gfIdx < graphicFrames.length; gfIdx++) {
      const gf = graphicFrames[gfIdx];
      const tbl = gf.graphic?.graphicData?.tbl;
      if (!tbl) continue;

      const bounds = getPercentBounds(gf.xfrm);
      const trList = tbl.tr ? (Array.isArray(tbl.tr) ? tbl.tr : [tbl.tr]) : [];
      const rows: string[][] = [];
      let hadDroppedStyles = false;

      for (const tr of trList) {
        const tcList = tr.tc ? (Array.isArray(tr.tc) ? tr.tc : [tr.tc]) : [];
        const rowCells: string[] = [];

        for (const tc of tcList) {
          if (tc.tcPr?.solidFill || tc.tcPr?.lnL || tc.tcPr?.lnR || tc.tcPr?.lnT || tc.tcPr?.lnB || tc.pic || tc.blipFill) {
            hadDroppedStyles = true;
          }

          const isHMerge = tc['@_hMerge'] === '1' || tc['@_hMerge'] === 'true';
          const isVMerge = tc['@_vMerge'] === '1' || tc['@_vMerge'] === 'true';
          const gridSpan = parseInt(tc['@_gridSpan'] || '1', 10);
          const rowSpan = parseInt(tc['@_rowSpan'] || '1', 10);

          if (isHMerge || isVMerge || gridSpan > 1 || rowSpan > 1) {
            slideHadMergedCells = true;
          }

          if (isHMerge || isVMerge) {
            rowCells.push('');
          } else {
            let cellText = '';
            const pList = tc.txBody?.p ? (Array.isArray(tc.txBody.p) ? tc.txBody.p : [tc.txBody.p]) : [];
            pList.forEach((p: any, pIndex: number) => {
              if (pIndex > 0) cellText += '\n';
              const rList = p.r ? (Array.isArray(p.r) ? p.r : [p.r]) : [];
              rList.forEach((r: any) => {
                if (r.t) {
                  const txt = typeof r.t === 'string' ? r.t : r.t['#text'] ? String(r.t['#text']) : '';
                  cellText += txt;
                }
              });
            });
            rowCells.push(cellText);

            for (let g = 1; g < gridSpan; g++) {
              rowCells.push('');
            }
          }
        }
        rows.push(rowCells);
      }

      if (hadDroppedStyles && !warnedTableStyles) {
        warnedTableStyles = true;
        warnings.push({
          item: 'Tables',
          reason: 'Table cell fills, borders, and nested pictures were dropped',
        });
        if (!skippedFeatures.includes('Table styles and graphics')) {
          skippedFeatures.push('Table styles and graphics');
        }
      }

      const maxCols = Math.max(...rows.map((r) => r.length), 1);
      for (const r of rows) {
        while (r.length < maxCols) r.push('');
      }

      elements.push({
        id: `elem_tbl_${sIdx}_${gfIdx}`,
        type: 'table',
        ...bounds,
        rows: rows.length ? rows : [['', '', ''], ['', '', ''], ['', '', '']],
      });
    }

    if (slideHadMergedCells) {
      warnings.push({
        item: `Slide ${sIdx + 1}`,
        reason: 'Merged table cells were simplified to separate empty cells',
      });
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
      ...(slideNotes ? { notes: slideNotes } : {}),
    });
  }

  if (slides.length === 0) {
    slides.push(createEmptySlide(1));
  }

  return {
    presentation: {
      title: fileName.replace(/\.[^/.]+$/, '') || 'Presentation',
      slides,
      slideSize,
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
  const slideSize = presentation.slideSize || '16:9';
  if (slideSize === '4:3') {
    pres.layout = 'LAYOUT_4x3';
  } else if (slideSize === '16:10') {
    pres.layout = 'LAYOUT_16x10';
  } else {
    pres.layout = 'LAYOUT_16x9';
  }

  const slideWidthInches = 10;
  const slideHeightInches = slideSize === '4:3' ? 7.5 : slideSize === '16:10' ? 6.25 : 5.625;

  presentation.slides.forEach((slide) => {
    const s = pres.addSlide();
    if (slide.background) {
      s.background = { color: slide.background.replace('#', '') };
    }
    if (slide.notes) {
      s.addNotes(slide.notes);
    }

    slide.elements.forEach((elem) => {
      const xInch = (elem.x / 100) * slideWidthInches;
      const yInch = (elem.y / 100) * slideHeightInches;
      const wInch = (elem.width / 100) * slideWidthInches;
      const hInch = (elem.height / 100) * slideHeightInches;

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
        const shapeType = elem.shape || 'rect';
        const pptxShape = (pres.ShapeType as any)[shapeType] || pres.ShapeType.rect;
        if (shapeType === 'line') {
          s.addShape(pres.ShapeType.line, {
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            line: {
              color: (elem.borderColor || '#0f766e').replace('#', ''),
              width: elem.borderWidth || 2,
            },
          });
        } else if (elem.text) {
          s.addText(elem.text, {
            shape: pptxShape,
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            fill: elem.fill ? { color: elem.fill.replace('#', '') } : undefined,
            line: elem.borderColor ? { color: elem.borderColor.replace('#', ''), width: elem.borderWidth || 1 } : undefined,
            fontSize: elem.fontSize || 18,
            color: (elem.color || '#1e2022').replace('#', ''),
            bold: !!elem.bold,
            italic: !!elem.italic,
            underline: elem.underline ? { style: 'sng' } : undefined,
            align: elem.align || 'center',
            valign: 'middle',
          });
        } else {
          s.addShape(pptxShape, {
            x: xInch,
            y: yInch,
            w: wInch,
            h: hInch,
            fill: elem.fill ? { color: elem.fill.replace('#', '') } : undefined,
            line: elem.borderColor ? { color: elem.borderColor.replace('#', ''), width: elem.borderWidth || 1 } : undefined,
          });
        }
      } else if (elem.type === 'table' && elem.rows && elem.rows.length > 0) {
        const tableRows = elem.rows.map((row) => row.map((cell) => ({ text: cell })));
        s.addTable(tableRows, {
          x: xInch,
          y: yInch,
          w: wInch,
          h: hInch,
          border: { type: 'solid', pt: 1, color: '000000' },
          autoPage: false,
        });
      }
    });
  });

  const blob = (await pres.write({ outputType: 'blob' })) as Blob;
  return blob;
}
