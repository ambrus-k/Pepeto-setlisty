import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SetlistGroup, Song } from '../types';
import { CZECH_FONT_BOLD_BASE64, CZECH_FONT_REGULAR_BASE64 } from './czechFontBase64';

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
        xml += `    <Song>\n`;
        xml += `      <Title>${title}</Title>\n`;
        xml += `      <SongId>${song.id}</SongId>\n`;
        xml += `      <FileName>${title}.pdf</FileName>\n`;
        xml += `      <FileType>1</FileType>\n`;
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
): Promise<{ doc: jsPDF; blob: Blob; dataUrl: string }> {
  const doc = new jsPDF({
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
        rows.push({
          id: song ? String(song.id) : String(songId),
          title: song ? song.pdf_title : `Skladba #${songId}`,
          bgColor: song?.bgColor || '#fef3c7',
        });
        if ((idx === 2 || idx === 5) && set.songIds.length >= 7) {
          rows.push({ id: '', title: '', bgColor: '#ffffff', isBlank: true });
        }
      });
    } else {
      rows = set.songIds.map((songId) => {
        const song = songsMap.get(songId);
        return {
          id: song ? String(song.id) : String(songId),
          title: song ? song.pdf_title : `Skladba #${songId}`,
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

    autoTable(doc, {
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
      didParseCell: (data) => {
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
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const rowData = rows[data.row.index];
          if (rowData && !rowData.isBlank) {
            const title = rowData.title;
            // Check for saxophone notes: "- ALT Sax", "- TENOR Sax", "ALT Sax", "TENOR Sax"
            const saxMatch = title.match(/(-?\s*(?:ALT|TENOR)\s*Sax.*)$/i);
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
