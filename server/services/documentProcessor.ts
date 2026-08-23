import pdfParseModule from 'pdf-parse';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { Chunk } from '../../src/types.js';

const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

export interface ParsedDocument {
  name: string;
  textContent: string;
  pageCount: number;
  pages: { pageNumber: number; text: string }[];
  fileType: string;
}

/**
 * Strips non-printable and binary/stream corruption artifacts from extracted text
 */
function cleanExtractedText(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove binary stream artifacts and object headers if any leaked
    .replace(/endstream[\s\S]*?endobj/gi, ' ')
    .replace(/<\?xpacket[\s\S]*?\?>/gi, ' ')
    .replace(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/gi, ' ')
    .replace(/<rdf:RDF[\s\S]*?<\/rdf:RDF>/gi, ' ')
    .replace(/\/Type\s*\/[A-Za-z0-9]+/g, ' ')
    .replace(/<<[\s\S]*?>>/g, ' ')
    .replace(/[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
    // Normalize spaces and newlines
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Extracts structured slide text from PPTX archives
 */
function parsePptxArchive(buffer: Buffer): { pages: { pageNumber: number; text: string }[]; fullText: string } | null {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    
    // Find all slide xml files
    const slideEntries = entries.filter(e => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName));
    if (slideEntries.length === 0) return null;

    slideEntries.sort((a, b) => {
      const numA = parseInt(a.entryName.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.entryName.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

    const pages: { pageNumber: number; text: string }[] = [];
    let fullText = '';

    for (let i = 0; i < slideEntries.length; i++) {
      const entry = slideEntries[i];
      const slideNum = parseInt(entry.entryName.match(/slide(\d+)\.xml/i)?.[1] || (i + 1).toString(), 10);
      const xml = entry.getData().toString('utf8');

      // Extract paragraphs (<a:p>)
      const paragraphMatches = xml.match(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g) || [];
      const slideLines: string[] = [];

      for (const pXml of paragraphMatches) {
        const textParts = (pXml.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) || [])
          .map(t => t.replace(/<[^>]*>/g, '').trim())
          .filter(Boolean);
        
        if (textParts.length > 0) {
          slideLines.push(textParts.join(' '));
        }
      }

      // If no <a:p> found, extract all <a:t>
      if (slideLines.length === 0) {
        const textParts = (xml.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) || [])
          .map(t => t.replace(/<[^>]*>/g, '').trim())
          .filter(Boolean);
        if (textParts.length > 0) {
          slideLines.push(textParts.join(' '));
        }
      }

      const slideText = cleanExtractedText(slideLines.join('\n'));
      if (slideText) {
        pages.push({
          pageNumber: slideNum,
          text: `[Slide ${slideNum}]\n${slideText}`
        });
        fullText += `[Slide ${slideNum}]\n${slideText}\n\n`;
      }
    }

    return { pages, fullText: fullText.trim() };
  } catch (e) {
    console.warn('PPTX zip parse error:', e);
    return null;
  }
}

/**
 * Extracts structured sheet text from XLSX archives
 */
function parseXlsxArchive(buffer: Buffer): { pages: { pageNumber: number; text: string }[]; fullText: string } | null {
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    
    // Extract shared strings
    const sharedEntry = entries.find(e => /xl\/sharedStrings\.xml$/i.test(e.entryName));
    const sharedStrings: string[] = [];
    if (sharedEntry) {
      const sXml = sharedEntry.getData().toString('utf8');
      const siMatches = sXml.match(/<si\b[^>]*>([\s\S]*?)<\/si>/g) || [];
      for (const si of siMatches) {
        const tMatches = (si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]*>/g, '').trim());
        sharedStrings.push(tMatches.join(' '));
      }
    }

    // Find sheets
    const sheetEntries = entries.filter(e => /^xl\/worksheets\/sheet\d+\.xml$/i.test(e.entryName));
    sheetEntries.sort((a, b) => {
      const numA = parseInt(a.entryName.match(/sheet(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.entryName.match(/sheet(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

    const pages: { pageNumber: number; text: string }[] = [];
    let fullText = '';

    for (let i = 0; i < sheetEntries.length; i++) {
      const entry = sheetEntries[i];
      const sheetNum = i + 1;
      const xml = entry.getData().toString('utf8');
      const rowMatches = xml.match(/<row\b[^>]*>([\s\S]*?)<\/row>/g) || [];
      const sheetRows: string[] = [];

      for (const rowXml of rowMatches) {
        const cellMatches = rowXml.match(/<c\b[^>]*>([\s\S]*?)<\/c>/g) || [];
        const rowCells: string[] = [];

        for (const cXml of cellMatches) {
          const isShared = /t="s"/i.test(cXml);
          const valMatch = cXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
          if (valMatch) {
            const rawVal = valMatch[1].trim();
            if (isShared) {
              const strIdx = parseInt(rawVal, 10);
              rowCells.push(sharedStrings[strIdx] || rawVal);
            } else {
              rowCells.push(rawVal);
            }
          }
        }
        if (rowCells.length > 0) {
          sheetRows.push(rowCells.join(' | '));
        }
      }

      const sheetText = sheetRows.join('\n');
      if (sheetText.trim()) {
        pages.push({
          pageNumber: sheetNum,
          text: `[Sheet ${sheetNum}]\n${sheetText.trim()}`
        });
        fullText += `[Sheet ${sheetNum}]\n${sheetText.trim()}\n\n`;
      }
    }

    return { pages, fullText: fullText.trim() };
  } catch (e) {
    console.warn('XLSX zip parse error:', e);
    return null;
  }
}

export const DocumentProcessor = {
  /**
   * Universal parser for any document type:
   * PDF, PPTX, PPT, DOCX, DOC, XLSX, XLS, TXT, MD, CSV, TSV, JSON, XML, HTML, RTF, LOG, YAML, and code files
   */
  async parseDocument(fileName: string, mimeType: string, buffer: Buffer): Promise<ParsedDocument> {
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
    let textContent = '';
    const pages: { pageNumber: number; text: string }[] = [];

    // Helper for generating simulated 1-indexed pages based on natural paragraph/character breaks
    const createPages = (fullText: string, pageSize: number = 1800) => {
      const paragraphs = fullText.split(/\n\s*\n/);
      let currentPageText = '';
      let pageNum = 1;

      for (const p of paragraphs) {
        const trimmed = p.trim();
        if (!trimmed) continue;

        if (currentPageText.length + trimmed.length > pageSize && currentPageText.length > 200) {
          pages.push({ pageNumber: pageNum++, text: cleanExtractedText(currentPageText) });
          currentPageText = trimmed + '\n\n';
        } else {
          currentPageText += trimmed + '\n\n';
        }
      }

      if (currentPageText.trim()) {
        pages.push({ pageNumber: pageNum, text: cleanExtractedText(currentPageText) });
      }

      if (pages.length === 0 && fullText.trim()) {
        pages.push({ pageNumber: 1, text: cleanExtractedText(fullText) });
      }
    };

    // 1. PowerPoint Presentations (.pptx, .ppsx, .ppt)
    if (['pptx', 'ppsx', 'ppt', 'odp'].includes(ext) || mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      const pptxResult = parsePptxArchive(buffer);
      if (pptxResult && pptxResult.pages.length > 0) {
        textContent = pptxResult.fullText;
        pages.push(...pptxResult.pages);
      } else {
        // Fallback for text extraction from ppt binaries
        const raw = buffer.toString('latin1');
        const textSegments = (raw.match(/[\x20-\x7E\t\r\n]{5,}/g) || [])
          .map(t => cleanExtractedText(t))
          .filter(t => t.length > 4 && !/^[0-9\s.,;:\-_]+$/.test(t));
        
        textContent = textSegments.join('\n');
        createPages(textContent || `[PowerPoint Presentation: ${fileName}]`, 1200);
      }
    }
    // 2. Excel Spreadsheets (.xlsx, .xlsm, .xls)
    else if (['xlsx', 'xlsm', 'xls', 'ods'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      const xlsxResult = parseXlsxArchive(buffer);
      if (xlsxResult && xlsxResult.pages.length > 0) {
        textContent = xlsxResult.fullText;
        pages.push(...xlsxResult.pages);
      } else {
        const raw = buffer.toString('utf8');
        textContent = cleanExtractedText(raw);
        createPages(textContent || `[Spreadsheet: ${fileName}]`, 1600);
      }
    }
    // 3. PDF Documents - High precision parsing with pdf-parse
    else if (ext === 'pdf' || mimeType.includes('pdf')) {
      try {
        const fn = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default;
        const pdfData = await fn(buffer, {
          pagerender: (pageData: any) => {
            return pageData.getTextContent().then((textContentObj: any) => {
              let lastY: any, text = '';
              for (const item of textContentObj.items) {
                if (lastY == item.transform[5] || !lastY) {
                  text += item.str;
                } else {
                  text += '\n' + item.str;
                }
                lastY = item.transform[5];
              }
              return text;
            });
          }
        });

        const extractedText = cleanExtractedText(pdfData.text || '');

        if (extractedText.length > 0) {
          textContent = extractedText;
          
          // Split on form-feed characters (\f) or paginate based on extracted pages
          const formFeedSplits = extractedText.split(/\f|\x0c/);
          if (formFeedSplits.length > 1) {
            let pNum = 1;
            for (const section of formFeedSplits) {
              const cleanSection = cleanExtractedText(section);
              if (cleanSection && cleanSection.length > 10) {
                pages.push({ pageNumber: pNum++, text: cleanSection });
              }
            }
          } else {
            createPages(extractedText, 1600);
          }
        }
      } catch (pdfErr) {
        console.warn('pdf-parse primary parser encountered error:', pdfErr);
      }

      // Fallback if pdf-parse failed or returned empty
      if (!textContent || textContent.length < 20) {
        const rawText = buffer.toString('utf8');
        const btMatches = rawText.match(/BT[\s\S]*?ET/g);
        if (btMatches && btMatches.length > 0) {
          const streamTexts = btMatches.map(block => {
            const textMatches = block.match(/\((.*?)\)\s*(?:Tj|'|")/g) || [];
            return textMatches.map(m => m.replace(/^\(|\)\s*(?:Tj|'|")$/g, '')).join(' ');
          }).filter(t => t.trim().length > 0);

          if (streamTexts.length > 0) {
            textContent = cleanExtractedText(streamTexts.join('\n\n'));
          }
        }

        if (!textContent || textContent.length < 20) {
          textContent = cleanExtractedText(
            rawText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\xFF]/g, ' ')
          );
        }

        createPages(textContent || `[PDF Document: ${fileName}]`, 1600);
      }
    }
    // 4. Word / DOCX / OpenXML formats - High fidelity text parsing with mammoth + AdmZip
    else if (['docx', 'dotx', 'doc'].includes(ext) || mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
      try {
        const mammothResult = await mammoth.extractRawText({ buffer });
        if (mammothResult.value && mammothResult.value.trim().length > 0) {
          textContent = cleanExtractedText(mammothResult.value.trim());
          createPages(textContent, 1600);
        }
      } catch (docxErr) {
        console.warn('mammoth extraction fallback:', docxErr);
      }

      if (!textContent) {
        try {
          const zip = new AdmZip(buffer);
          const docEntry = zip.getEntry('word/document.xml');
          if (docEntry) {
            const xml = docEntry.getData().toString('utf8');
            const xmlMatches = xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
            textContent = cleanExtractedText(
              xmlMatches.map(t => t.replace(/<[^>]*>/g, '')).filter(t => t.trim()).join(' ')
            );
            createPages(textContent, 1600);
          }
        } catch {
          // fallback
        }
      }

      if (!textContent) {
        const rawText = buffer.toString('utf8');
        textContent = cleanExtractedText(rawText.replace(/<[^>]*>/g, ' ').replace(/[^\x20-\x7E\n]/g, ''));
        createPages(textContent || `[Word Document: ${fileName}]`, 1600);
      }
    }
    // 5. JSON and JSONL documents
    else if (ext === 'json' || ext === 'jsonl' || mimeType.includes('json')) {
      const rawText = buffer.toString('utf8');
      try {
        if (ext === 'jsonl') {
          const lines = rawText.split('\n').filter(l => l.trim());
          const parsedLines = lines.map((l, idx) => {
            try {
              return `[Record ${idx + 1}]: ` + JSON.stringify(JSON.parse(l), null, 2);
            } catch {
              return `[Line ${idx + 1}]: ` + l;
            }
          });
          textContent = parsedLines.join('\n\n');
        } else {
          const parsed = JSON.parse(rawText);
          textContent = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
        }
      } catch {
        textContent = rawText;
      }
      createPages(textContent, 1600);
    }
    // 6. CSV / TSV / Tabular data
    else if (ext === 'csv' || ext === 'tsv' || mimeType.includes('csv')) {
      const rawText = buffer.toString('utf8');
      const delimiter = ext === 'tsv' ? '\t' : ',';
      const lines = rawText.split(/\r?\n/).filter(l => l.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
        const formattedRows: string[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
          const rowInfo = headers.map((h, colIdx) => `${h || `Column_${colIdx + 1}`}: ${values[colIdx] ?? ''}`).join(' | ');
          formattedRows.push(`[Row ${i}]: ${rowInfo}`);
        }
        textContent = `Table Headers: ${headers.join(', ')}\n\n` + formattedRows.join('\n');
      } else {
        textContent = rawText;
      }
      createPages(textContent, 1600);
    }
    // 7. HTML / XML / SVG
    else if (ext === 'html' || ext === 'htm' || ext === 'xml' || ext === 'svg' || mimeType.includes('html') || mimeType.includes('xml')) {
      const rawText = buffer.toString('utf8');
      textContent = rawText
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n### $1\n\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n• $1')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim();

      createPages(textContent, 1800);
    }
    // 8. Markdown / Text / Logs / YAML / Source Code / RTF
    else {
      const rawText = buffer.toString('utf8');
      if (ext === 'rtf' || rawText.startsWith('{\\rtf')) {
        textContent = rawText
          .replace(/\\par[d]?/g, '\n')
          .replace(/\\[a-zA-Z0-9\-]+/g, ' ')
          .replace(/[{}]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        textContent = rawText.replace(/\r\n/g, '\n').trim();
      }
      createPages(textContent, 1600);
    }

    // Ensure at least 1 page
    if (pages.length === 0) {
      pages.push({ pageNumber: 1, text: textContent || `[Indexed: ${fileName}]` });
    }

    return {
      name: fileName,
      textContent: textContent || `[Indexed: ${fileName}]`,
      pageCount: Math.max(1, pages.length),
      pages,
      fileType: ext.toUpperCase() || 'FILE',
    };
  },

  /**
   * Recursive token-aware chunking with customizable chunk size and overlap
   */
  chunkDocument(
    parsedDoc: ParsedDocument, 
    documentId: string, 
    chunkSize: number = 600, 
    chunkOverlap: number = 100
  ): Omit<Chunk, 'id'>[] {
    // 1 token is roughly 4 characters
    const maxChars = Math.max(200, chunkSize * 4);
    const overlapChars = Math.max(40, chunkOverlap * 4);

    const chunks: Omit<Chunk, 'id'>[] = [];

    for (const page of parsedDoc.pages) {
      const text = page.text;
      if (!text || text.trim().length === 0) continue;

      let start = 0;

      while (start < text.length) {
        let end = Math.min(start + maxChars, text.length);

        // Try to break at natural sentence or paragraph boundaries
        if (end < text.length) {
          const lastPeriod = text.lastIndexOf('. ', end);
          const lastNewline = text.lastIndexOf('\n', end);
          const breakPoint = Math.max(lastPeriod !== -1 ? lastPeriod + 1 : -1, lastNewline);
          if (breakPoint > start + maxChars * 0.5) {
            end = breakPoint;
          }
        }

        const chunkText = text.substring(start, end).trim();

        if (chunkText.length >= 15) {
          chunks.push({
            documentId,
            docName: parsedDoc.name,
            text: chunkText,
            pageNumber: page.pageNumber,
          });
        }

        if (end >= text.length) break;
        start = Math.max(start + 1, end - overlapChars);
      }
    }

    // Safety fallback for empty chunks
    if (chunks.length === 0 && parsedDoc.textContent) {
      chunks.push({
        documentId,
        docName: parsedDoc.name,
        text: parsedDoc.textContent.substring(0, maxChars),
        pageNumber: 1,
      });
    }

    return chunks;
  }
};
