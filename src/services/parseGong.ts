import { v4 as uuidv4 } from 'uuid';
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

export function parseGongBuffer(buffer: Buffer, filename: string): ParsedGong {
  const tableId = `gong_${uuidv4().slice(0, 8)}`;
  const text = buffer.toString('utf-8');

  logger.info('Gong file parsed', { filename, tableId, contentLength: text.length });

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
