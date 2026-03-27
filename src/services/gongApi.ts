import { config } from '../config';
import { logger } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────

export interface GongCall {
  id: string;
  title?: string;
  started?: string;
  duration?: number;
  url?: string;
  parties?: GongParty[];
}

export interface GongParty {
  name?: string;
  emailAddress?: string;
  title?: string;
  affiliation?: 'internal' | 'external';
}

export interface GongTranscriptEntry {
  speakerName?: string;
  topic?: string;
  sentences: { start: number; end: number; text: string }[];
}

export interface GongTranscript {
  callId: string;
  transcript: GongTranscriptEntry[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function authHeader(): string {
  const key = config.gongAccessKey;
  const secret = config.gongAccessKeySecret;
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

function baseUrl(): string {
  return config.gongBaseUrl.replace(/\/+$/, '');
}

async function gongFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gong API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API ───────────────────────────────────────────────────────

/** Validate credentials by hitting GET /users. */
export async function testConnection(): Promise<boolean> {
  try {
    await gongFetch<{ users: unknown[] }>('/users');
    return true;
  } catch (err) {
    logger.error('Gong connection test failed', { error: String(err) });
    return false;
  }
}

/** Return true if Gong credentials are configured. */
export function isGongConfigured(): boolean {
  return !!(config.gongAccessKey && config.gongAccessKeySecret);
}

/**
 * Fetch all calls within a date range, handling cursor-based pagination.
 * Defaults to last 30 days if no range provided.
 */
export async function getAllCalls(fromDate?: string, toDate?: string): Promise<GongCall[]> {
  const from = fromDate ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to = toDate ?? new Date().toISOString();

  const allCalls: GongCall[] = [];
  let cursor: string | undefined;

  while (true) {
    const params = new URLSearchParams({ fromDateTime: from, toDateTime: to });
    if (cursor) params.set('cursor', cursor);

    const data = await gongFetch<{
      calls: GongCall[];
      records: { cursor?: string; totalRecords?: number };
    }>(`/calls?${params}`);

    allCalls.push(...(data.calls ?? []));
    logger.info('Fetched Gong calls page', { count: data.calls?.length ?? 0, total: allCalls.length });

    cursor = data.records?.cursor ?? undefined;
    if (!cursor) break;
  }

  return allCalls;
}

/**
 * Fetch detailed call data (participants, etc.) for up to 100 call IDs.
 */
export async function getCallDetails(callIds: string[]): Promise<GongCall[]> {
  const data = await gongFetch<{ calls: GongCall[] }>('/calls/extensive', {
    method: 'POST',
    body: JSON.stringify({ filter: { callIds } }),
  });
  return data.calls ?? [];
}

/**
 * Fetch the transcript for a single call.
 */
export async function getCallTranscript(callId: string): Promise<GongTranscript | null> {
  const data = await gongFetch<{ callTranscripts: GongTranscript[] }>('/calls/transcript', {
    method: 'POST',
    body: JSON.stringify({ filter: { callIds: [callId] } }),
  });
  return data.callTranscripts?.[0] ?? null;
}

/**
 * Fetch transcripts for multiple calls and concatenate them into a single
 * text block that the existing Gong parser can consume.
 */
export async function getTranscriptsAsText(callIds: string[]): Promise<string> {
  const parts: string[] = [];

  // Also fetch call details for metadata (title, date, participants)
  const details = callIds.length > 0 ? await getCallDetails(callIds) : [];
  const detailMap = new Map(details.map(d => [d.id, d]));

  for (const callId of callIds) {
    const transcript = await getCallTranscript(callId);
    if (!transcript) continue;

    const detail = detailMap.get(callId);
    const title = detail?.title ?? 'Untitled Call';
    const date = detail?.started ? new Date(detail.started).toLocaleDateString() : '';
    const participants = (detail?.parties ?? [])
      .filter(p => p.affiliation === 'external')
      .map(p => p.name ?? p.emailAddress ?? 'Unknown')
      .join(', ');

    parts.push(`## ${title}${date ? ` (${date})` : ''}`);
    if (participants) parts.push(`Participants: ${participants}`);
    parts.push('');

    for (const entry of transcript.transcript ?? []) {
      const speaker = entry.speakerName ?? 'Unknown';
      const text = entry.sentences.map(s => s.text).join(' ');
      parts.push(`**${speaker}:** ${text}`);
    }

    parts.push('');
  }

  return parts.join('\n');
}
