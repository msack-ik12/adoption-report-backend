import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ParsedTable, detectTableType, computeSummary } from './parseCsv';

/**
 * Parse an XLS/XLSX workbook buffer into one ParsedTable per sheet.
 * Each sheet is treated as if it were an individual CSV upload.
 */
export function parseWorkbookBuffer(buffer: Buffer, originalFilename: string): ParsedTable[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const tables: ParsedTable[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      defval: '',
    });

    if (rows.length === 0) {
      logger.warn('Skipping empty sheet', { originalFilename, sheetName });
      continue;
    }

    const tableId = `sigma_${uuidv4().slice(0, 8)}`;
    const headers = Object.keys(rows[0]);
    const sampleRows = rows.slice(0, 5);
    const sampleValues = sampleRows.flatMap(r => Object.values(r));
    const tableType = detectTableType(headers, sampleValues);
    const summary = computeSummary(tableType, rows, headers);

    logger.info('Workbook sheet parsed', {
      originalFilename,
      sheetName,
      tableId,
      tableType,
      rowCount: rows.length,
      headers,
    });

    tables.push({
      tableId,
      filename: sheetName,
      tableType,
      headers,
      rowCount: rows.length,
      sampleRows,
      summary,
      rawRows: rows,
    });
  }

  return tables;
}
