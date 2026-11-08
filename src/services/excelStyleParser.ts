/**
 * OpenXML (.xlsx) Cell Style & Color Parser
 *
 * SheetJS Community Edition does not parse cell styles/colors (cell.s is undefined).
 * This service directly unpacks the .xlsx ZIP archive using JSZip, parses xl/styles.xml,
 * xl/theme/theme1.xml, and xl/worksheets/sheet*.xml to extract authentic cell background
 * and font colors for every row and cell.
 */

import JSZip from 'jszip';
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';

function getDOMParser(): any {
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    return new window.DOMParser();
  }
  return new XmlDomParser();
}

export interface CellStyleInfo {
  bgColor?: string; // Hex color: e.g. "#ffd966", "#b6d7a8", "#cfe2f3", "#f4cccc"
  textColor?: string; // Hex color: e.g. "#ff0000", "#000000"
}

// 64 standard Excel indexed colors
const EXCEL_INDEXED_COLORS: Record<number, string> = {
  0: '#000000', 1: '#FFFFFF', 2: '#FF0000', 3: '#00FF00', 4: '#0000FF',
  5: '#FFFF00', 6: '#FF00FF', 7: '#00FFFF', 8: '#000000', 9: '#FFFFFF',
  10: '#FF0000', 11: '#00FF00', 12: '#0000FF', 13: '#FFFF00', 14: '#FF00FF',
  15: '#00FFFF', 16: '#800000', 17: '#008000', 18: '#000080', 19: '#808000',
  20: '#800080', 21: '#008080', 22: '#C0C0C0', 23: '#808080', 24: '#9999FF',
  25: '#993366', 26: '#FFFFCC', 27: '#CCFFFF', 28: '#660066', 29: '#FF8080',
  30: '#0066CC', 31: '#CCCCFF', 32: '#000080', 33: '#FF00FF', 34: '#FFFF00',
  35: '#00FFFF', 36: '#800080', 37: '#800000', 38: '#008080', 39: '#0000FF',
  40: '#00CCFF', 41: '#CCFFFF', 42: '#CCFFCC', 43: '#FFFF99', 44: '#99CCFF',
  45: '#FF99CC', 46: '#CC99FF', 47: '#FFCC99', 48: '#3366FF', 49: '#33CCCC',
  50: '#99CC00', 51: '#FFCC00', 52: '#FF9900', 53: '#FF6600', 54: '#666699',
  55: '#969696', 56: '#003366', 57: '#339966', 58: '#003300', 59: '#333300',
  60: '#993300', 61: '#993366', 62: '#333399', 63: '#333333', 64: '#000000',
  65: '#FFFFFF',
};

// Default Microsoft Office Theme Color Palette
const DEFAULT_THEME_COLORS: Record<number, string> = {
  0: '#ffffff', // lt1
  1: '#000000', // dk1
  2: '#eeece1', // lt2
  3: '#1f497d', // dk2
  4: '#4f81bd', // accent1
  5: '#c0504d', // accent2
  6: '#9bbb59', // accent3
  7: '#8064a2', // accent4
  8: '#4bacc6', // accent5
  9: '#f79646', // accent6
  10: '#0000ff', // hlink
  11: '#800080', // folHlink
};

/**
 * Universal helper to find elements in OpenXML documents regardless of XML namespace
 */
function getElementsByLocalName(root: Document | Element, localName: string): Element[] {
  if (!root) return [];
  // 1. Try getElementsByTagNameNS with wildcard namespace
  try {
    const list = root.getElementsByTagNameNS('*', localName);
    if (list && list.length > 0) return Array.from(list);
  } catch (e) {
    // ignore
  }

  // 2. Try standard getElementsByTagName
  try {
    const list = root.getElementsByTagName(localName);
    if (list && list.length > 0) return Array.from(list);
  } catch (e) {
    // ignore
  }

  // 3. Try with common prefixes: x: or a: or r:
  for (const prefix of ['x:', 'a:', 'r:', 'main:']) {
    try {
      const list = root.getElementsByTagName(`${prefix}${localName}`);
      if (list && list.length > 0) return Array.from(list);
    } catch (e) {
      // ignore
    }
  }

  return [];
}

/**
 * Applies OpenXML tint to a hex color
 */
export function applyTint(hexColor: string, tint: number): string {
  const clean = hexColor.replace(/^#/, '');
  if (clean.length !== 6) return hexColor;
  let r = parseInt(clean.slice(0, 2), 16);
  let g = parseInt(clean.slice(2, 4), 16);
  let b = parseInt(clean.slice(4, 6), 16);

  if (tint > 0) {
    r = Math.round(r + (255 - r) * tint);
    g = Math.round(g + (255 - g) * tint);
    b = Math.round(b + (255 - b) * tint);
  } else if (tint < 0) {
    r = Math.round(r * (1 + tint));
    g = Math.round(g * (1 + tint));
    b = Math.round(b * (1 + tint));
  }

  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extracts a normalized 6-character hex color string from an OpenXML color element
 */
function parseOpenXmlColor(
  el: Element | null | undefined,
  themePalette: Record<number, string>
): string | undefined {
  if (!el) return undefined;

  // 1. Explicit RGB (ARGB 8 chars or 6 chars)
  const rgb = el.getAttribute('rgb');
  if (rgb) {
    let clean = rgb.trim().replace(/^#/, '');
    if (clean.length === 8) clean = clean.substring(2);
    if (/^[0-9a-fA-F]{6}$/.test(clean)) {
      return `#${clean.toLowerCase()}`;
    }
  }

  // 2. Theme color
  const theme = el.getAttribute('theme');
  if (theme !== null && theme !== undefined) {
    const themeIdx = parseInt(theme, 10);
    const baseColor = themePalette[themeIdx] || DEFAULT_THEME_COLORS[themeIdx];
    if (baseColor) {
      const tint = parseFloat(el.getAttribute('tint') || '0');
      if (tint !== 0 && !isNaN(tint)) {
        return applyTint(baseColor, tint).toLowerCase();
      }
      return baseColor.toLowerCase();
    }
  }

  // 3. Indexed color
  const indexed = el.getAttribute('indexed');
  if (indexed !== null && indexed !== undefined) {
    const idx = parseInt(indexed, 10);
    const indColor = EXCEL_INDEXED_COLORS[idx];
    if (indColor) return indColor.toLowerCase();
  }

  return undefined;
}

export interface SheetStylesResult {
  // Map of "A1", "B2" etc. to CellStyleInfo
  cellColors: Map<string, CellStyleInfo>;
  // Map of row index (1-based, e.g. 2, 3...) to row-wide CellStyleInfo
  rowColors: Map<number, CellStyleInfo>;
  // Sheet tab color if defined in sheetPr
  tabColor?: string;
}

/**
 * Parses all cell styles and colors directly from an .xlsx ArrayBuffer
 */
export async function parseExcelAllStyles(
  buffer: ArrayBuffer
): Promise<{
  sheets: Map<string, SheetStylesResult>;
  sheetByIndex: Map<number, SheetStylesResult>;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = getDOMParser();

  // 1. Parse theme palette from xl/theme/theme1.xml (if present)
  const themePalette: Record<number, string> = { ...DEFAULT_THEME_COLORS };
  const themeFile = zip.file('xl/theme/theme1.xml');
  if (themeFile) {
    try {
      const themeText = await themeFile.async('text');
      const themeDoc = parser.parseFromString(themeText, 'application/xml');
      const clrSchemes = getElementsByLocalName(themeDoc, 'clrScheme');
      const clrScheme = clrSchemes[0];
      if (clrScheme) {
        const themeTags = [
          'lt1', 'dk1', 'lt2', 'dk2',
          'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
          'hlink', 'folHlink',
        ];
        themeTags.forEach((tag, idx) => {
          const els = getElementsByLocalName(clrScheme, tag);
          const el = els[0];
          if (el) {
            const srgb = getElementsByLocalName(el, 'srgbClr')[0];
            const sys = getElementsByLocalName(el, 'sysClr')[0];
            const val = srgb?.getAttribute('val') || sys?.getAttribute('lastClr');
            if (val && /^[0-9a-fA-F]{6}$/.test(val)) {
              themePalette[idx] = `#${val.toLowerCase()}`;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Could not parse theme1.xml, using default palette:', e);
    }
  }

  // 2. Parse xl/styles.xml
  const styleXfs: CellStyleInfo[] = [];
  const stylesFile = zip.file('xl/styles.xml');
  if (stylesFile) {
    try {
      const stylesText = await stylesFile.async('text');
      const stylesDoc = parser.parseFromString(stylesText, 'application/xml');

      // Fonts
      const fonts: Array<{ color?: string }> = [];
      const fontNodes = getElementsByLocalName(stylesDoc, 'font');
      for (const fontNode of fontNodes) {
        const colorEl = getElementsByLocalName(fontNode, 'color')[0];
        const textColor = parseOpenXmlColor(colorEl, themePalette);
        fonts.push({ color: textColor });
      }

      // Fills
      const fills: Array<{ color?: string }> = [];
      const fillNodes = getElementsByLocalName(stylesDoc, 'fill');
      for (const fillNode of fillNodes) {
        const patternFills = getElementsByLocalName(fillNode, 'patternFill');
        if (patternFills.length > 0) {
          const pf = patternFills[0];
          const patternType = (pf.getAttribute('patternType') || 'solid').toLowerCase();
          if (patternType !== 'none') {
            const fgEl = getElementsByLocalName(pf, 'fgColor')[0];
            let bgColor = parseOpenXmlColor(fgEl, themePalette);
            if (!bgColor) {
              const bgEl = getElementsByLocalName(pf, 'bgColor')[0];
              bgColor = parseOpenXmlColor(bgEl, themePalette);
            }
            fills.push({ color: bgColor });
          } else {
            fills.push({});
          }
        } else {
          // Check gradient fill
          const gradFills = getElementsByLocalName(fillNode, 'gradientFill');
          if (gradFills.length > 0) {
            const stops = getElementsByLocalName(gradFills[0], 'stop');
            const colorEl = stops.length > 0 ? getElementsByLocalName(stops[0], 'color')[0] : null;
            const bgColor = parseOpenXmlColor(colorEl, themePalette);
            fills.push({ color: bgColor });
          } else {
            fills.push({});
          }
        }
      }

      // CellStyleXfs (Named / Parent styles)
      const cellStyleXfs: CellStyleInfo[] = [];
      const cellStyleXfsEls = getElementsByLocalName(stylesDoc, 'cellStyleXfs');
      if (cellStyleXfsEls.length > 0) {
        const xfNodes = getElementsByLocalName(cellStyleXfsEls[0], 'xf');
        for (const xf of xfNodes) {
          const fillId = parseInt(xf.getAttribute('fillId') || '-1', 10);
          const fontId = parseInt(xf.getAttribute('fontId') || '-1', 10);
          const bgColor = fillId >= 0 && fillId < fills.length ? fills[fillId]?.color : undefined;
          const textColor = fontId >= 0 && fontId < fonts.length ? fonts[fontId]?.color : undefined;
          cellStyleXfs.push({ bgColor, textColor });
        }
      }

      // CellXfs (maps style index 's' to fill and font)
      const cellXfsEls = getElementsByLocalName(stylesDoc, 'cellXfs');
      if (cellXfsEls.length > 0) {
        const xfNodes = getElementsByLocalName(cellXfsEls[0], 'xf');
        for (const xf of xfNodes) {
          const fillId = parseInt(xf.getAttribute('fillId') || '-1', 10);
          const fontId = parseInt(xf.getAttribute('fontId') || '-1', 10);
          const xfId = parseInt(xf.getAttribute('xfId') || '-1', 10);

          let bgColor = fillId >= 0 && fillId < fills.length ? fills[fillId]?.color : undefined;
          let textColor = fontId >= 0 && fontId < fonts.length ? fonts[fontId]?.color : undefined;

          // Inherit from parent cellStyleXfs if direct fill/font is not set
          if (!bgColor && xfId >= 0 && xfId < cellStyleXfs.length) {
            bgColor = cellStyleXfs[xfId]?.bgColor;
          }
          if (!textColor && xfId >= 0 && xfId < cellStyleXfs.length) {
            textColor = cellStyleXfs[xfId]?.textColor;
          }

          styleXfs.push({ bgColor, textColor });
        }
      }
    } catch (e) {
      console.warn('Could not parse styles.xml:', e);
    }
  }

  // 3. Map sheet names from xl/workbook.xml & xl/_rels/workbook.xml.rels
  const sheetFiles: Array<{ name: string; path: string }> = [];
  const wbFile = zip.file('xl/workbook.xml');
  const wbRelsFile = zip.file('xl/_rels/workbook.xml.rels');

  if (wbFile && wbRelsFile) {
    try {
      const wbText = await wbFile.async('text');
      const wbRelsText = await wbRelsFile.async('text');
      const wbDoc = parser.parseFromString(wbText, 'application/xml');
      const wbRelsDoc = parser.parseFromString(wbRelsText, 'application/xml');

      // Map r:id to target path
      const relsMap = new Map<string, string>();
      const relNodes = getElementsByLocalName(wbRelsDoc, 'Relationship');
      for (const rel of relNodes) {
        const id = rel.getAttribute('Id');
        const target = rel.getAttribute('Target');
        if (id && target) {
          const cleanTarget = target.startsWith('/')
            ? target.substring(1)
            : `xl/${target.replace(/^(\.\.\/)+/, '')}`;
          relsMap.set(id, cleanTarget);
        }
      }

      const sheetNodes = getElementsByLocalName(wbDoc, 'sheet');
      for (let i = 0; i < sheetNodes.length; i++) {
        const sheetNode = sheetNodes[i];
        const name = sheetNode.getAttribute('name') || `Sheet${i + 1}`;
        const relId =
          sheetNode.getAttribute('r:id') ||
          sheetNode.getAttribute('id') ||
          sheetNode.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        const path = relId ? relsMap.get(relId) || `xl/worksheets/sheet${i + 1}.xml` : `xl/worksheets/sheet${i + 1}.xml`;
        sheetFiles.push({ name, path });
      }
    } catch (e) {
      console.warn('Error reading workbook relationships:', e);
    }
  }

  // Fallback if sheetFiles is empty
  if (sheetFiles.length === 0) {
    const wsFiles = Object.keys(zip.files).filter((f) => f.startsWith('xl/worksheets/sheet') && f.endsWith('.xml'));
    wsFiles.forEach((path, idx) => {
      sheetFiles.push({ name: `Sheet${idx + 1}`, path });
    });
  }

  const sheetsResult = new Map<string, SheetStylesResult>();
  const sheetByIndex = new Map<number, SheetStylesResult>();

  // 4. Parse cell coordinates and styles for each sheet
  for (let idx = 0; idx < sheetFiles.length; idx++) {
    const { name, path } = sheetFiles[idx];
    const wsFile = zip.file(path);
    if (!wsFile) continue;

    const cellColors = new Map<string, CellStyleInfo>();
    const rowColors = new Map<number, CellStyleInfo>();
    let tabColor: string | undefined;

    try {
      const wsText = await wsFile.async('text');
      const wsDoc = parser.parseFromString(wsText, 'application/xml');

      // Check tabColor in sheetPr
      const sheetPrs = getElementsByLocalName(wsDoc, 'sheetPr');
      if (sheetPrs.length > 0) {
        const tabCols = getElementsByLocalName(sheetPrs[0], 'tabColor');
        if (tabCols.length > 0) {
          tabColor = parseOpenXmlColor(tabCols[0], themePalette);
        }
      }

      // Check rows and cells
      const rowNodes = getElementsByLocalName(wsDoc, 'row');
      for (const rowNode of rowNodes) {
        const rowNum = parseInt(rowNode.getAttribute('r') || '0', 10);
        const rowStyleIdx = rowNode.getAttribute('s');
        if (rowStyleIdx && rowNum > 0) {
          const s = parseInt(rowStyleIdx, 10);
          if (s >= 0 && s < styleXfs.length) {
            rowColors.set(rowNum, styleXfs[s]);
          }
        }

        const cNodes = getElementsByLocalName(rowNode, 'c');
        for (const cNode of cNodes) {
          const cellRef = cNode.getAttribute('r') || cNode.getAttribute('R');
          const styleAttr = cNode.getAttribute('s') || cNode.getAttribute('S');
          if (cellRef && styleAttr) {
            const s = parseInt(styleAttr, 10);
            if (s >= 0 && s < styleXfs.length) {
              const info = styleXfs[s];
              if (info.bgColor || info.textColor) {
                cellColors.set(cellRef.toUpperCase(), info);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Error parsing styles in sheet ${name}:`, e);
    }

    const result: SheetStylesResult = { cellColors, rowColors, tabColor };
    sheetsResult.set(name, result);
    sheetByIndex.set(idx, result);
  }

  return { sheets: sheetsResult, sheetByIndex };
}
