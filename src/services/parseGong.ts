import { v4 as uuidv4 } from 'uuid';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import pdfParse = require('pdf-parse');
import { logger } from '../utils/logger';

export interface ParsedGong {
  tableId: string;
  source: 'file' | 'text';
  filename?: string;
  contentLength: number;
  summary: string;
  sections: GongSection[];
}

export interface GongSection {
  heading: string;
  content: string;
}

function extractSections(text: string): GongSection[] {
  const lines = text.split(/\r?\n/);
  const sections: GongSection[] = [];
  let currentHeading = 'General';
  let currentContent: string[] = [];

  for (const line of lines) {
    // Detect markdown-style headings or ALL CAPS lines as section breaks
    const headingMatch = line.match(/^#{1,3}\s+(.+)/) || line.match(/^([A-Z][A-Z\s]{4,})$/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
      }
      currentHeading = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections.push({ heading: currentHeading, content: currentContent.join('\n').trim() });
  }

  return sections.filter(s => s.content.length > 0);
}

function summarizeGong(sections: GongSection[]): string {
  const totalChars = sections.reduce((acc, s) => acc + s.content.length, 0);
  const headings = sections.map(s => s.heading);
  return `Gong summary with ${sections.length} sections (${totalChars} chars): ${headings.join(', ')}`;
}

/** Detect if a buffer starts with the PDF magic bytes (%PDF-) */
function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

export async function parseGongBuffer(buffer: Buffer, filename: string): Promise<ParsedGong> {
  const tableId = `gong_${uuidv4().slice(0, 8)}`;

  let text: string;

  if (isPdf(buffer) || filename.toLowerCase().endsWith('.pdf')) {
    try {
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
      logger.info('Gong PDF parsed', { filename, tableId, pages: pdfData.numpages, contentLength: text.length });
    } catch (err) {
      logger.error('Failed to parse Gong PDF — falling back to UTF-8', { filename, error: String(err) });
      text = buffer.toString('utf-8');
    }
  } else {
    text = buffer.toString('utf-8');
    logger.info('Gong text file parsed', { filename, tableId, contentLength: text.length });
  }

  const sections = extractSections(text);
  return {
    tableId,
    source: 'file',
    filename,
    contentLength: text.length,
    summary: summarizeGong(sections),
    sections,
  };
}

export function parseGongText(text: string): ParsedGong {
  const tableId = `gong_${uuidv4().slice(0, 8)}`;

  logger.info('Gong text parsed', { tableId, contentLength: text.length });

  const sections = extractSections(text);
  return {
    tableId,
    source: 'text',
    contentLength: text.length,
    summary: summarizeGong(sections),
    sections,
  };
}
