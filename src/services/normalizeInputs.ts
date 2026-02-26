import { ParsedTable } from './parseCsv';
import { ParsedGong } from './parseGong';
import { logger } from '../utils/logger';

export interface FastFacts {
  students?: number;
  sites?: number;
  launchDate?: string;
  nps?: number;
  dataDate?: string;
}

export interface DerivedMetrics {
  adoptionMetrics: {
    weeklyActiveUserPct: number | null;
    allSitesHaveActiveOfficeManager: boolean | null;
    adoptionMet: boolean | null;
    adoptionConfidence: 'High' | 'Medium' | 'Low';
    missingInputs: string[];
  };
  topForms: { formName: string; count: number }[];
  siteCoverage: { totalSites: number | null; activeSites: number | null; pct: number | null };
  userActivation: { totalUsers: number | null; activeUsers: number | null; pct: number | null };
  sendbacks: { totalSendbacks: number | null; topReasons: { reason: string; count: number }[] };
  allowedDomains: string[];
  trends: Record<string, unknown>;
}

export interface NormalizedPayload {
  district: {
    name: string;
    campaignName?: string;
    fastFacts?: FastFacts;
  };
  files: {
    sigma: Omit<ParsedTable, 'rawRows'>[];
    gong: ParsedGong | null;
    checklist: Omit<ParsedTable, 'rawRows'> | null;
  };
  derived: DerivedMetrics;
  timestamps: {
    receivedAt: string;
  };
}

// ── Adoption evaluator ─────────────────────────────────────────────
export function evaluateAdoption(
  sigmaTables: ParsedTable[]
): DerivedMetrics['adoptionMetrics'] {
  const missing: string[] = [];

  // Try to find user_activity table
  const userTable = sigmaTables.find(t => t.tableType === 'user_activity');
  let weeklyActiveUserPct: number | null = null;

  if (!userTable) {
    missing.push('user_activity table not found');
  } else {
    const activeCol = userTable.headers.find(h =>
      /weekly.?active/i.test(h) || /is.?active/i.test(h) || h.toLowerCase() === 'active'
    );
    const accountHolderCol = userTable.headers.find(h =>
      /account.?holder/i.test(h) || /role/i.test(h)
    );

    if (!activeCol) {
      missing.push('No weekly active column detected in user_activity');
    } else {
      const rows = userTable.rawRows;
      // If there's an account_holder column, filter to account holders
      let relevantRows = rows;
      if (accountHolderCol) {
        relevantRows = rows.filter(r => {
          const val = r[accountHolderCol]?.toLowerCase().trim();
          return val === 'true' || val === 'yes' || val === '1' || val === 'account holder';
        });
        if (relevantRows.length === 0) {
          relevantRows = rows; // fallback if filter yields nothing
          missing.push('account_holder filter yielded 0 rows; using all rows');
        }
      } else {
        missing.push('No account_holder column; using all users');
      }

      const activeCount = relevantRows.filter(r => {
        const val = r[activeCol]?.toLowerCase().trim();
        return val === 'true' || val === 'yes' || val === '1';
      }).length;

      weeklyActiveUserPct = relevantRows.length > 0
        ? +((activeCount / relevantRows.length) * 100).toFixed(1)
        : null;
    }
  }

  // Try to find site_activation table
  const siteTable = sigmaTables.find(t => t.tableType === 'site_activation');
  let allSitesHaveActiveOfficeManager: boolean | null = null;

  if (!siteTable) {
    missing.push('site_activation table not found');
  } else {
    const siteCol = siteTable.headers.find(h => /site|school|building/i.test(h));
    const roleCol = siteTable.headers.find(h => /role|position|title/i.test(h));
    const activeCol = siteTable.headers.find(h =>
      /weekly.?active/i.test(h) || /is.?active/i.test(h) || h.toLowerCase() === 'active'
    );

    if (!siteCol || !activeCol) {
      missing.push('site_activation missing site or active columns');
    } else {
      const rows = siteTable.rawRows;
      const sites = [...new Set(rows.map(r => r[siteCol]?.trim()).filter(Boolean))];

      // Filter to office managers (exclude principals and teachers)
      const isOfficeManager = (row: Record<string, string>) => {
        if (!roleCol) return true; // if no role column, include all
        const role = row[roleCol]?.toLowerCase().trim() || '';
        const excluded = ['principal', 'teacher', 'instructor', 'faculty'];
        return !excluded.some(ex => role.includes(ex));
      };

      const sitesWithActiveOM = sites.filter(site => {
        const siteRows = rows.filter(r => r[siteCol]?.trim() === site && isOfficeManager(r));
        return siteRows.some(r => {
          const val = r[activeCol]?.toLowerCase().trim();
          return val === 'true' || val === 'yes' || val === '1';
        });
      });

      allSitesHaveActiveOfficeManager = sites.length > 0 && sitesWithActiveOM.length === sites.length;

      if (!roleCol) {
        missing.push('No role column in site_activation; could not exclude principals/teachers');
      }
    }
  }

  // Adoption is met if either condition holds
  const condition1 = weeklyActiveUserPct !== null && weeklyActiveUserPct >= 70;
  const condition2 = allSitesHaveActiveOfficeManager === true;
  const adoptionMet = (weeklyActiveUserPct !== null || allSitesHaveActiveOfficeManager !== null)
    ? (condition1 || condition2)
    : null;

  const adoptionConfidence: 'High' | 'Medium' | 'Low' =
    missing.length === 0 ? 'High' :
    missing.length === 1 ? 'Medium' : 'Low';

  return {
    weeklyActiveUserPct,
    allSitesHaveActiveOfficeManager,
    adoptionMet,
    adoptionConfidence,
    missingInputs: missing,
  };
}

// ── Derived metrics extraction ─────────────────────────────────────
function extractTopForms(sigmaTables: ParsedTable[]): DerivedMetrics['topForms'] {
  const formsTable = sigmaTables.find(t => t.tableType === 'forms_usage');
  if (!formsTable) return [];

  const nameCol = formsTable.headers.find(h => /form.?(name|type)/i.test(h) || h.toLowerCase() === 'form');
  const countCol = formsTable.headers.find(h => /submission|count|completed|total/i.test(h));

  if (!nameCol) return [];

  if (countCol) {
    const grouped: Record<string, number> = {};
    formsTable.rawRows.forEach(r => {
      const name = r[nameCol]?.trim();
      const count = parseFloat(r[countCol]) || 0;
      if (name) grouped[name] = (grouped[name] || 0) + count;
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([formName, count]) => ({ formName, count }));
  }

  // Fallback: count rows per form name
  const grouped: Record<string, number> = {};
  formsTable.rawRows.forEach(r => {
    const name = r[nameCol]?.trim();
    if (name) grouped[name] = (grouped[name] || 0) + 1;
  });
  return Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([formName, count]) => ({ formName, count }));
}

function extractSiteCoverage(sigmaTables: ParsedTable[]): DerivedMetrics['siteCoverage'] {
  const siteTable = sigmaTables.find(t => t.tableType === 'site_activation');
  if (!siteTable) return { totalSites: null, activeSites: null, pct: null };

  const siteCol = siteTable.headers.find(h => /site|school|building/i.test(h));
  const activeCol = siteTable.headers.find(h => /active/i.test(h));
  if (!siteCol) return { totalSites: null, activeSites: null, pct: null };

  const allSites = [...new Set(siteTable.rawRows.map(r => r[siteCol]?.trim()).filter(Boolean))];
  const totalSites = allSites.length;

  if (!activeCol) return { totalSites, activeSites: null, pct: null };

  const activeSiteSet = new Set<string>();
  siteTable.rawRows.forEach(r => {
    const site = r[siteCol]?.trim();
    const active = r[activeCol]?.toLowerCase().trim();
    if (site && (active === 'true' || active === 'yes' || active === '1')) {
      activeSiteSet.add(site);
    }
  });

  const activeSites = activeSiteSet.size;
  return { totalSites, activeSites, pct: totalSites > 0 ? +((activeSites / totalSites) * 100).toFixed(1) : null };
}

function extractUserActivation(sigmaTables: ParsedTable[]): DerivedMetrics['userActivation'] {
  const userTable = sigmaTables.find(t => t.tableType === 'user_activity');
  if (!userTable) return { totalUsers: null, activeUsers: null, pct: null };

  const activeCol = userTable.headers.find(h => /weekly.?active|is.?active|^active$/i.test(h));
  const totalUsers = userTable.rawRows.length;
  if (!activeCol) return { totalUsers, activeUsers: null, pct: null };

  const activeUsers = userTable.rawRows.filter(r => {
    const val = r[activeCol]?.toLowerCase().trim();
    return val === 'true' || val === 'yes' || val === '1';
  }).length;

  return { totalUsers, activeUsers, pct: totalUsers > 0 ? +((activeUsers / totalUsers) * 100).toFixed(1) : null };
}

function extractAllowedDomains(sigmaTables: ParsedTable[]): string[] {
  const userTable = sigmaTables.find(t => t.tableType === 'user_activity');
  if (!userTable) return ['example.org'];

  const emailCol = userTable.headers.find(h => /email|e.?mail/i.test(h));
  if (!emailCol) return ['example.org'];

  const domainCounts: Record<string, number> = {};
  for (const row of userTable.rawRows) {
    const email = row[emailCol]?.trim();
    if (!email) continue;
    const atIdx = email.lastIndexOf('@');
    if (atIdx < 1) continue;
    const domain = email.slice(atIdx + 1).toLowerCase();
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }

  const sorted = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return ['example.org'];

  // Return the most common domain (may expand later)
  return [sorted[0][0]];
}

function extractSendbacks(sigmaTables: ParsedTable[]): DerivedMetrics['sendbacks'] {
  const sbTable = sigmaTables.find(t => t.tableType === 'sendbacks');
  if (!sbTable) return { totalSendbacks: null, topReasons: [] };

  const reasonCol = sbTable.headers.find(h => /reason|cause|type/i.test(h));
  const totalSendbacks = sbTable.rawRows.length;

  if (!reasonCol) return { totalSendbacks, topReasons: [] };

  const grouped: Record<string, number> = {};
  sbTable.rawRows.forEach(r => {
    const reason = r[reasonCol]?.trim();
    if (reason) grouped[reason] = (grouped[reason] || 0) + 1;
  });

  const topReasons = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  return { totalSendbacks, topReasons };
}

// ── Main normalizer ────────────────────────────────────────────────
export function normalizeInputs(
  districtName: string,
  campaignName: string | undefined,
  fastFacts: FastFacts | undefined,
  sigmaTables: ParsedTable[],
  gong: ParsedGong | null,
  checklistTable: ParsedTable | null,
): NormalizedPayload {
  const adoption = evaluateAdoption(sigmaTables);

  const derived: DerivedMetrics = {
    adoptionMetrics: adoption,
    topForms: extractTopForms(sigmaTables),
    siteCoverage: extractSiteCoverage(sigmaTables),
    userActivation: extractUserActivation(sigmaTables),
    sendbacks: extractSendbacks(sigmaTables),
    allowedDomains: extractAllowedDomains(sigmaTables),
    trends: {},
  };

  // Strip rawRows from sigma tables for the payload (privacy: don't send full data to Claude)
  const sigmaForPayload = sigmaTables.map(({ rawRows, ...rest }) => rest);
  const checklistForPayload = checklistTable ? (({ rawRows, ...rest }) => rest)(checklistTable) : null;

  logger.info('Inputs normalized', {
    districtName,
    sigmaTableCount: sigmaTables.length,
    hasGong: !!gong,
    hasChecklist: !!checklistTable,
    adoptionMet: adoption.adoptionMet,
    adoptionConfidence: adoption.adoptionConfidence,
  });

  return {
    district: { name: districtName, campaignName, fastFacts },
    files: {
      sigma: sigmaForPayload,
      gong,
      checklist: checklistForPayload,
    },
    derived,
    timestamps: { receivedAt: new Date().toISOString() },
  };
}
