import type { jsPDF as JsPdfType } from 'jspdf';
import * as jspdfModule from 'jspdf';
import * as autoTableModule from 'jspdf-autotable';
import type { SetlistGroup, Song } from '../types/index.ts';
import { CZECH_FONT_BOLD_BASE64, CZECH_FONT_REGULAR_BASE64 } from './czechFontBase64';

// Resilient class constructor resolution across Vite (browser ESM) and Node.js (tsx / CommonJS)
const JsPDFConstructor: new (...args: any[]) => JsPdfType =
  (jspdfModule as any).jsPDF ||
  (jspdfModule as any).default?.jsPDF ||
  (jspdfModule as any).default ||
  (jspdfModule as any);

// Resilient autoTable function resolution
const applyAutoTable: (doc: any, options: any) => void =
  (autoTableModule as any).default?.default ||
  (autoTableModule as any).default ||
  (autoTableModule as any).applyPlugin ||
  (autoTableModule as any);

/**
 * Escapes characters for XML
 */
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

/**
 * Convert HEX color (#ffffff or #fff) to [r, g, b] array
 */
function hexToRgb(hex: string, fallback: [number, number, number] = [255, 255, 255]): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  if (clean.length !== 6) return fallback;
  const num = parseInt(clean, 16);
  if (isNaN(num)) return fallback;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Strips redundant leading song numbers / track indexes from titles for PDF stage sheets:
 * In the PDF, column 1 already displays the colored song number (e.g. 103, 44, 8, 503).
 * Having a duplicate 3-digit number in column 2 (e.g. "103 Alenka", "044 Baroko") is redundant.
 *
 * Examples:
 * - "103 Alenka v říši divů", 103 -> "Alenka v říši divů"
 * - "044 Baroko", 44 -> "Baroko"
 * - "008 Nějak se vytrácíš má lásko", 8 -> "Nějak se vytrácíš má lásko"
 * - "503  Sova - alt sax", 503 -> "Sova - alt sax"
 * - "276 Shrek - It Is You ... - ALT Sax", 276 -> "Shrek - It Is You ... - ALT Sax"
 * - "050 Čekej tiše - TENOR Sax", 50 -> "Čekej tiše - TENOR Sax"
 * - "Baroko", 44 -> "Baroko"
 */
export function cleanTitleForPdf(rawTitle: string, songId?: number): string {
  if (!rawTitle) return '';
  const trimmed = rawTitle.trim();

  // Match leading digits (1-4 digits) followed by delimiter/space and subsequent text
  const match = trimmed.match(/^(\d{1,4})(?:[\s.\-_:)]+|\s*[-–—]\s*)(.+)$/i);
  let cleanText = trimmed;
  if (match) {
    const numStr = match[1];
    const leadingNum = parseInt(numStr, 10);
    const rest = match[2].trim();

    if (rest.length > 0) {
      // 1. Definite match: leading number equals the song's ID
      if (songId !== undefined && songId >= 0 && leadingNum === songId) {
        cleanText = rest;
      } else if (numStr.startsWith('0') && numStr.length >= 2) {
        cleanText = rest;
      } else if (songId === undefined || leadingNum === songId || (numStr.length === 3 && leadingNum >= 1 && leadingNum <= 999)) {
        cleanText = rest;
      }
    }
  }

  // Normalize and preserve saxophone information so it ALWAYS generates into the PDF:
  // - Handles Excel formats: "- ALT Sax", "- TENOR Sax", "ALT Sax", "TENOR Sax"
  // - Handles MSS formats: "_alt", "_tenor", "_alt sax", "_tenor sax"
  // - Handles informal notes: "- alt", "- tenor", "- alt sax", "- tenor sax"
  cleanText = cleanText
    .replace(/\s*[-–—_]+\s*alt\s*sax\b/gi, ' - ALT Sax')
    .replace(/\s*[-–—_]+\s*tenor\s*sax\b/gi, ' - TENOR Sax')
    .replace(/\s*[-–—_]+\s*sopran\s*sax\b/gi, ' - SOPRÁN Sax')
    .replace(/\s*[-–—_]+\s*bariton\s*sax\b/gi, ' - BARYTON Sax')
    .replace(/\s*[-–—_]+\s*alt\b(?!\s*sax)/gi, ' - ALT Sax')
    .replace(/\s*[-–—_]+\s*tenor\b(?!\s*sax)/gi, ' - TENOR Sax')
    .replace(/\s*[-–—_]+\s*sopran\b(?!\s*sax)/gi, ' - SOPRÁN Sax')
    .replace(/\s*[-–—_]+\s*bariton\b(?!\s*sax)/gi, ' - BARYTON Sax');

  return cleanText.trim();
}

/**
 * Generates MobileSheets XML (.mss) format strictly complying with the spec:
 * <?xml version='1.0' encoding='UTF-8' standalone='no' ?>
 * <Setlists>
 *   <Setlist>
 *     <Name>01 Název akce</Name>
 *     <Song>
 *       <Title>mss_title</Title>
 *       <SongId>id</SongId>
 *       <FileName>mss_title.pdf</FileName>
 *       <FileType>1</FileType>
 *     </Song>
 *     ...
 *   </Setlist>
 *   ...
 * </Setlists>
 */
export function generateMssXml(
  projectName: string,
  sets: SetlistGroup[],
  songsMap: Map<number, Song>
): string {
  const safeProjectName = projectName.trim() || 'Setlist Akce';
  let xml = `<?xml version='1.0' encoding='UTF-8' standalone='no' ?>\n`;
  xml += `<Setlists>\n`;

  const activeSets = sets.filter((s) => s.songIds.length > 0);
  const setsToExport = activeSets.length > 0 ? activeSets : sets;

  setsToExport.forEach((set, index) => {
    const numPrefix = String(index + 1).padStart(2, '0');
    let setlistName = `${numPrefix} ${safeProjectName}`;
    if (set.isFixed || !set.name.toLowerCase().startsWith('set')) {
      setlistName = `${numPrefix} ${safeProjectName} - ${set.name}`;
    }

    xml += `  <Setlist>\n`;
    xml += `    <Name>${escapeXml(setlistName)}</Name>\n`;

    for (const songId of set.songIds) {
      const song = songsMap.get(songId);
      if (song) {
        // Názvy musí být VŽDY podle souboru MSS pro MobileSheets!
        const title = escapeXml(song.mss_title);
        const fileName = escapeXml(song.fileName || `${song.mss_title}.pdf`);
        const fileType = song.fileType !== undefined ? song.fileType : 1;
        xml += `    <Song>\n`;
        xml += `      <Title>${title}</Title>\n`;
        xml += `      <SongId>${song.id}</SongId>\n`;
        xml += `      <FileName>${fileName}</FileName>\n`;
        xml += `      <FileType>${fileType}</FileType>\n`;
        xml += `    </Song>\n`;
      }
    }

    xml += `  </Setlist>\n`;
  });

  xml += `</Setlists>\n`;
  return xml;
}

/**
 * Generates visual PDF EXACTLY matching the band's stage sheet layout:
 * - One page per list/set (List 1, List 2 ... Lidovky, Zbytek)
 * - Centered bold header "List X" or "Lidovky" / "Zbytek"
 * - Column 1: ID (large bold centered number)
 * - Column 2: Song title with colored background & red saxophone tags (- ALT Sax / - TENOR Sax)
 * - Solid crisp black table borders
 * - Full native Czech diacritics (ě, š, č, ř, ž, ý, á, í, é, ů, ú, ť, ď, ň) via embedded TrueType font
 * - Bottom right footer: "${safeProjectName}.xlsx"
 */
export async function generatePdf(
  projectName: string,
  sets: SetlistGroup[],
  songsMap: Map<number, Song>
): Promise<{ doc: JsPdfType; blob: Blob; dataUrl: string }> {
  const doc = new JsPDFConstructor({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const safeProjectName = projectName.trim() || 'Oleško 22.08.2026';

  // Registrace Unicode fontů s kompletní podporou české diakritiky
  doc.addFileToVFS('CzechFont-Bold.ttf', CZECH_FONT_BOLD_BASE64);
  doc.addFont('CzechFont-Bold.ttf', 'CzechFont', 'bold');
  doc.addFileToVFS('CzechFont-Regular.ttf', CZECH_FONT_REGULAR_BASE64);
  doc.addFont('CzechFont-Regular.ttf', 'CzechFont', 'normal');

  const fontName = 'CzechFont';

  const validSets = sets.filter((s) => s.songIds.length > 0);
  const setsToRender = validSets.length > 0 ? validSets : sets;

  setsToRender.forEach((set, setIndex) => {
    if (setIndex > 0) {
      doc.addPage();
    }

    // Determine Set Title: "List 1", "List 2", "Lidovky", "Zbytek"
    let listTitle = set.name;
    if (set.name.toLowerCase().startsWith('set')) {
      listTitle = set.name.replace(/^set\s*/i, 'List ');
    }

    // Page Header: centered List title
    doc.setFont(fontName, 'bold');
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(listTitle, pageWidth / 2, 17, { align: 'center' });

    const isLidovky = listTitle.toLowerCase().includes('lidovk');
    const isZbytek = listTitle.toLowerCase().includes('zbytek');

    // Build table rows
    interface RowItem {
      id: string;
      title: string;
      bgColor: string;
      isBlank?: boolean;
    }

    let rows: RowItem[] = [];

    if (isLidovky) {
      // For Lidovky: if 9 items, insert blank separator rows after row 3 and row 6
      set.songIds.forEach((songId, idx) => {
        const song = songsMap.get(songId);
        const displayId = song ? (song.id < 0 ? '?' : String(song.id)) : (songId < 0 ? '?' : String(songId));
        const cleanTitle = song
          ? cleanTitleForPdf(song.pdf_title, song.id)
          : (songId < 0 ? 'Neznámá skladba' : `Skladba #${songId}`);
        rows.push({
          id: displayId,
          title: cleanTitle,
          bgColor: song?.bgColor || '#fef3c7',
        });
        if ((idx === 2 || idx === 5) && set.songIds.length >= 7) {
          rows.push({ id: '', title: '', bgColor: '#ffffff', isBlank: true });
        }
      });
    } else {
      rows = set.songIds.map((songId) => {
        const song = songsMap.get(songId);
        const displayId = song ? (song.id < 0 ? '?' : String(song.id)) : (songId < 0 ? '?' : String(songId));
        const cleanTitle = song
          ? cleanTitleForPdf(song.pdf_title, song.id)
          : (songId < 0 ? 'Neznámá skladba' : `Skladba #${songId}`);
        return {
          id: displayId,
          title: cleanTitle,
          bgColor: song?.bgColor || '#ffffff',
        };
      });

      // If fewer than 11 rows in standard set, append empty bordered rows to match the sheet grid
      if (!isZbytek && rows.length < 11) {
        const diff = 11 - rows.length;
        for (let i = 0; i < diff; i++) {
          rows.push({ id: '', title: '', bgColor: '#ffffff', isBlank: true });
        }
      }
    }

    const cellMinHeight = isZbytek ? 12.5 : 15.5;
    const idFontSize = isZbytek ? 14 : 16;
    const titleFontSize = isZbytek ? 13 : 15;

    const bodyData = rows.map((r) => [r.id, r.title]);

    applyAutoTable(doc, {
      startY: 23,
      margin: { left: 16, right: 16 },
      body: bodyData,
      theme: 'grid',
      styles: {
        font: 'CzechFont',
        fontStyle: 'bold',
        fontSize: titleFontSize,
        cellPadding: { top: 3.5, bottom: 3.5, left: 4.5, right: 4.5 },
        lineWidth: 0.45,
        lineColor: [0, 0, 0], // Solid crisp black border
        minCellHeight: cellMinHeight,
      },
      columnStyles: {
        0: {
          cellWidth: 38,
          halign: 'center',
          valign: 'middle',
          fontStyle: 'bold',
          fontSize: idFontSize,
          textColor: [0, 0, 0],
        },
        1: {
          cellWidth: 'auto',
          valign: 'middle',
          fontStyle: 'bold',
          textColor: [0, 0, 0],
        },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const rowData = rows[data.row.index];
          if (rowData && !rowData.isBlank) {
            const bgRgb = hexToRgb(rowData.bgColor, [255, 255, 255]);
            if (isLidovky) {
              // In Lidovky, entire row has the colored background
              data.cell.styles.fillColor = bgRgb;
            } else {
              // In standard lists and Zbytek: ID cell has the background color, title cell is white
              if (data.column.index === 0) {
                data.cell.styles.fillColor = bgRgb;
              } else {
                data.cell.styles.fillColor = [255, 255, 255];
              }
            }
          } else {
            data.cell.styles.fillColor = [255, 255, 255];
          }
        }
      },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 1) {
          const rowData = rows[data.row.index];
          if (rowData && !rowData.isBlank) {
            const title = rowData.title;
            // Check for saxophone notes: "- ALT Sax", "- TENOR Sax", "- SOPRÁN Sax", etc.
            const saxMatch = title.match(/(\s*[-–—]?\s*(?:ALT|TENOR|SOPR[AÁ]N|BARYTON)\s*Sax.*)$/i);
            if (saxMatch) {
              const saxPart = saxMatch[1];
              const mainPart = title.substring(0, title.length - saxPart.length);

              // Redraw cell text with two distinct colors
              const cellX = data.cell.x + 4.5;
              const cellY = data.cell.y + data.cell.height / 2 + 1.6;

              // Repaint background to clear default black text
              const bgRgb = isLidovky ? hexToRgb(rowData.bgColor, [255, 255, 255]) : [255, 255, 255];
              doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
              doc.rect(
                data.cell.x + 0.35,
                data.cell.y + 0.35,
                data.cell.width - 0.7,
                data.cell.height - 0.7,
                'F'
              );

              // 1. Draw main title part in black with CzechFont
              doc.setFont('CzechFont', 'bold');
              doc.setFontSize(titleFontSize);
              doc.setTextColor(0, 0, 0);
              doc.text(mainPart, cellX, cellY);

              // 2. Draw Saxophone note in bold vivid RED with CzechFont
              const mainWidth = doc.getTextWidth(mainPart);
              doc.setTextColor(255, 0, 0); // Bold vivid red #ff0000
              doc.text(saxPart, cellX + mainWidth, cellY);
            }
          }
        }
      },
    });

    // Page footer: bottom right filename "${safeProjectName}.xlsx"
    doc.setFont('CzechFont', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    const footerName = safeProjectName.toLowerCase().endsWith('.xlsx')
      ? safeProjectName
      : `${safeProjectName}.xlsx`;
    doc.text(footerName, pageWidth - 16, pageHeight - 8, { align: 'right' });
  });

  const blob = doc.output('blob');
  const dataUrl = doc.output('datauristring');

  return { doc, blob, dataUrl };
}

/**
 * Triggers browser file download
 */
export function downloadFile(content: Blob | string, fileName: string, mimeType: string = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}
