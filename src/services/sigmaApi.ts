import { config } from '../config';
import { logger } from '../utils/logger';
import { parseCsvBuffer, ParsedTable, TableType } from './parseCsv';

// ── Types ────────────────────────────────────────────────────────────

interface SigmaToken {
  accessToken: string;
  expiresAt: number;
}

interface SigmaElement {
  elementId: string;
  name: string;
  type: string;
  columns?: { name: string; type: string }[];
}

interface SigmaPage {
  pageId: string;
  name: string;
  elements: SigmaElement[];
}

// ── Token cache ──────────────────────────────────────────────────────

let cachedToken: SigmaToken | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.accessToken;
  }

  const url = `${baseUrl()}/v2/auth/token`;
  const credentials = Buffer.from(`${config.sigmaClientId}:${config.sigmaClientSecret}`).toString('base64');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sigma auth failed ${res.status}: ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number; token_type: string };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // refresh 60s early
  };

  logger.info('Sigma token acquired', { expiresIn: data.expires_in });
  return cachedToken.accessToken;
}

// ── Helpers ──────────────────────────────────────────────────────────

function baseUrl(): string {
  return config.sigmaBaseUrl.replace(/\/+$/, '');
}

async function sigmaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sigma API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}


// ── Public API ───────────────────────────────────────────────────────

export function isSigmaConfigured(): boolean {
  return !!(config.sigmaClientId && config.sigmaClientSecret && config.sigmaWorkbookId);
}

/** Validate credentials by fetching a token. Returns { ok, error? } */
export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    cachedToken = null; // force fresh token
    await getAccessToken();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Sigma connection test failed', { error: message });
    return { ok: false, error: message };
  }
}

/**
 * Fetch the list of valid district names.
 * Primary source: data/districts.json (written by scripts/refresh_districts.py from Snowflake).
 * This avoids the unreliable Sigma API export for this specific use case.
 */
export async function getDistrictNames(): Promise<string[]> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const cacheFile = path.join(process.cwd(), 'data', 'districts.json');

    if (!fs.existsSync(cacheFile)) {
      logger.warn('districts.json not found — run: python scripts/refresh_districts.py');
      return [];
    }

    const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const districts: string[] = data.districts ?? [];
    logger.info('Loaded district names from cache', { count: districts.length });
    return districts;
  } catch (err) {
    logger.error('Failed to read districts cache', { error: String(err) });
    return [];
  }
}

/** Discover workbook structure: pages, elements, and their IDs. */
export async function discoverWorkbook(): Promise<{ pages: SigmaPage[] }> {
  const workbookId = config.sigmaWorkbookId;

  // Get workbook pages
  const pagesData = await sigmaFetch<{ entries: { pageId: string; name: string }[] }>(
    `/v2/workbooks/${workbookId}/pages`
  );

  const pages: SigmaPage[] = [];

  for (const page of pagesData.entries ?? []) {
    // Get elements for each page
    const elemData = await sigmaFetch<{ entries: SigmaElement[] }>(
      `/v2/workbooks/${workbookId}/pages/${page.pageId}/elements`
    );

    pages.push({
      pageId: page.pageId,
      name: page.name,
      elements: (elemData.entries ?? []).map(e => ({
        elementId: e.elementId,
        name: e.name,
        type: e.type,
        columns: e.columns,
      })),
    });
  }

  return { pages };
}

/**
 * Export a single element as CSV, applying the district control filter.
 * Returns the raw CSV text.
 */
export async function exportElement(
  elementId: string,
  districtName: string,
): Promise<string> {
  const workbookId = config.sigmaWorkbookId;
  const controlId = config.sigmaDistrictControlId;

  // Step 1: Trigger the export
  const exportBody: Record<string, unknown> = {
    elementId,
    format: { type: 'csv' },
  };

  // Apply the district filter via control values
  if (districtName && controlId) {
    exportBody.parameters = {
      [controlId]: districtName,
    };
  }

  const exportRes = await sigmaFetch<{ queryId: string }>(
    `/v2/workbooks/${workbookId}/export`,
    { method: 'POST', body: JSON.stringify(exportBody) },
  );

  const { queryId } = exportRes;
  logger.info('Sigma export triggered', { elementId, queryId });

  // Step 2: Poll for completion and download
  const token = await getAccessToken();
  const downloadUrl = `${baseUrl()}/v2/query/${queryId}/download`;
  const maxAttempts = 30; // up to ~90 seconds

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));

    const dlRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (dlRes.ok) {
      const csv = await dlRes.text();
      logger.info('Sigma export downloaded', { elementId, bytes: csv.length });
      return csv;
    }

    // Any non-200 means still processing or transient error — keep polling
    if (dlRes.status >= 500) {
      logger.warn('Sigma download server error, retrying', { elementId, status: dlRes.status });
    }
  }

  throw new Error(`Sigma export timed out for element ${elementId}`);
}

// The key elements on the Adoption page that map to our report data model.
// These were discovered via GET /sigma/discover and verified to respond to
// the district control filter.
const ADOPTION_PAGE_ELEMENTS: { elementId: string; name: string; tableType: TableType }[] = [
  { elementId: '_sMwbRWevf', name: 'Campaign Metrics', tableType: 'campaign_metrics' },
  { elementId: '9xvoPy_Dki', name: 'User Activity', tableType: 'user_activity' },
  { elementId: 'cSqWVAm97F', name: 'Send Back Messages', tableType: 'sendbacks' },
  { elementId: 'mrPZ1mBawp', name: 'Send Back Counts with Reason', tableType: 'sendbacks' },
  { elementId: 'ueWaENQgMN', name: 'Weekly Submissions', tableType: 'forms_usage' },
  { elementId: 'w0zVULoNGK', name: 'Completion Rates by Step', tableType: 'forms_usage' },
  { elementId: 'HJSH41obHS', name: 'Initiator Types by Campaign', tableType: 'site_activation' },
  { elementId: 'aV-kS7Mp50', name: 'Users Not Activated', tableType: 'user_activity' },
  { elementId: 'iG-rZbjsz5', name: 'User Permissions', tableType: 'user_activity' },
];

/**
 * Pull key Adoption page elements for a district, parse them as CSV tables.
 * Exports sequentially to avoid rate limits (Sigma auth: 1 req/sec).
 * Returns ParsedTable[] ready for the normalization pipeline.
 */
export async function pullDistrictData(districtName: string): Promise<ParsedTable[]> {
  logger.info('Sigma: exporting Adoption page elements', {
    count: ADOPTION_PAGE_ELEMENTS.length,
    district: districtName,
  });

  const tables: ParsedTable[] = [];

  // Export sequentially to respect rate limits and share cached token.
  // Retry once on empty result — the Sigma API is flaky and intermittently
  // returns 0 bytes for elements that have data.
  for (const el of ADOPTION_PAGE_ELEMENTS) {
    try {
      let csv = await exportElement(el.elementId, districtName);

      // Retry once if empty — Sigma API frequently returns 0 bytes spuriously
      if (!csv || !csv.trim()) {
        logger.info('Sigma: empty export, retrying once', { element: el.name });
        await new Promise(r => setTimeout(r, 2000));
        csv = await exportElement(el.elementId, districtName);
      }

      if (!csv || !csv.trim()) {
        logger.info('Sigma: empty after retry (no data for district)', { element: el.name });
        continue;
      }
      const buffer = Buffer.from(csv, 'utf-8');
      const table = parseCsvBuffer(buffer, `${el.name}.csv`);
      // Override auto-detected type with the known type for this element
      table.tableType = el.tableType;
      if (table.rowCount > 0) {
        tables.push(table);
      } else {
        logger.info('Sigma: parsed 0 rows', { element: el.name });
      }
    } catch (err) {
      logger.warn('Sigma: element export failed', {
        element: el.name,
        error: String(err),
      });
    }
  }

  return tables;
}
