import { parse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export type TableType =
  | 'campaign_metrics'
  | 'user_activity'
  | 'site_activation'
  | 'forms_usage'
  | 'sendbacks'
  | 'checklist'
  | 'unknown';

export interface ParsedTable {
  tableId: string;
  filename: string;
  tableType: TableType;
  headers: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  summary: Record<string, unknown>;
  rawRows: Record<string, string>[];
}

const TABLE_HEURISTICS: { type: TableType; signals: string[] }[] = [
  {
    type: 'campaign_metrics',
    signals: ['campaign', 'impressions', 'clicks', 'open_rate', 'open rate', 'sent', 'delivered', 'bounce'],
  },
  {
    type: 'user_activity',
    signals: ['user', 'active', 'login', 'last_active', 'last active', 'weekly_active', 'weekly active', 'account_holder', 'account holder', 'role'],
  },
  {
    type: 'site_activation',
    signals: ['site', 'school', 'building', 'activated', 'site_office', 'site office', 'office_manager', 'office manager'],
  },
  {
    type: 'forms_usage',
    signals: ['form', 'submission', 'department', 'form_name', 'form name', 'form_type', 'form type', 'completed'],
  },
  {
    type: 'sendbacks',
    signals: ['sendback', 'send_back', 'send back', 'reason', 'returned', 'rejected', 'denial'],
  },
  {
    type: 'checklist',
    signals: ['prerequisite', 'checklist', 'task', 'status', 'completed', 'pending', 'step'],
  },
];

export function detectTableType(headers: string[], sampleValues: string[]): TableType {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  const lowerValues = sampleValues.map(v => v.toLowerCase().trim());
  const combined = [...lowerHeaders, ...lowerValues];

  let bestMatch: TableType = 'unknown';
  let bestScore = 0;

  for (const heuristic of TABLE_HEURISTICS) {
    const score = heuristic.signals.reduce((acc, signal) => {
      return acc + (combined.some(c => c.includes(signal)) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = heuristic.type;
    }
  }

  return bestScore >= 2 ? bestMatch : 'unknown';
}

export function computeSummary(tableType: TableType, rows: Record<string, string>[], headers: string[]): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    totalRows: rows.length,
    columns: headers,
  };

  if (rows.length === 0) return summary;

  // Try to compute numeric summaries for numeric-looking columns
  for (const header of headers) {
    const values = rows.map(r => parseFloat(r[header])).filter(v => !isNaN(v));
    if (values.length > rows.length * 0.5) {
      summary[`${header}_avg`] = +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
      summary[`${header}_min`] = Math.min(...values);
      summary[`${header}_max`] = Math.max(...values);
      summary[`${header}_sum`] = +values.reduce((a, b) => a + b, 0).toFixed(2);
    }
  }

  // Count unique values for low-cardinality string columns
  for (const header of headers) {
    const unique = new Set(rows.map(r => r[header]?.trim()).filter(Boolean));
    if (unique.size > 0 && unique.size <= 20 && unique.size < rows.length * 0.5) {
      const counts: Record<string, number> = {};
      rows.forEach(r => {
        const v = r[header]?.trim();
        if (v) counts[v] = (counts[v] || 0) + 1;
      });
      summary[`${header}_distribution`] = counts;
    }
  }

  return summary;
}

export function parseCsvBuffer(buffer: Buffer, filename: string): ParsedTable {
  const tableId = `sigma_${uuidv4().slice(0, 8)}`;

  let rows: Record<string, string>[];
  try {
    rows = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    logger.error('CSV parse error', { filename, error: String(err) });
    return {
      tableId,
      filename,
      tableType: 'unknown',
      headers: [],
      rowCount: 0,
      sampleRows: [],
      summary: { error: 'Failed to parse CSV' },
      rawRows: [],
    };
  }

  if (rows.length === 0) {
    return {
      tableId,
      filename,
      tableType: 'unknown',
      headers: [],
      rowCount: 0,
      sampleRows: [],
      summary: {},
      rawRows: [],
    };
  }

  const headers = Object.keys(rows[0]);
  const sampleRows = rows.slice(0, 5);
  const sampleValues = sampleRows.flatMap(r => Object.values(r));
  const tableType = detectTableType(headers, sampleValues);
  const summary = computeSummary(tableType, rows, headers);

  logger.info('CSV parsed', { filename, tableId, tableType, rowCount: rows.length, headers });

  return {
    tableId,
    filename,
    tableType,
    headers,
    rowCount: rows.length,
    sampleRows,
    summary,
    rawRows: rows,
  };
}
