import { ParsedTable } from './parseCsv';
import { logger } from '../utils/logger';

/**
 * In-memory cache for Sigma pull results.
 * Keyed by district name (lowercased), expires after 1 hour.
 */

interface CacheEntry {
  tables: ParsedTable[];
  pulledAt: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

function key(districtName: string): string {
  return districtName.trim().toLowerCase();
}

export function cacheSigmaTables(districtName: string, tables: ParsedTable[]): void {
  cache.set(key(districtName), { tables, pulledAt: Date.now() });
  logger.info('Sigma cache: stored', {
    district: districtName,
    tableCount: tables.length,
    totalRows: tables.reduce((s, t) => s + t.rowCount, 0),
  });
}

export function getCachedSigmaTables(districtName: string): ParsedTable[] | null {
  const entry = cache.get(key(districtName));
  if (!entry) return null;
  if (Date.now() - entry.pulledAt > TTL_MS) {
    cache.delete(key(districtName));
    return null;
  }
  logger.info('Sigma cache: hit', {
    district: districtName,
    tableCount: entry.tables.length,
    ageMs: Date.now() - entry.pulledAt,
  });
  return entry.tables;
}
