import { describe, it, expect } from 'vitest';
import { evaluateAdoption } from '../services/normalizeInputs';
import { ParsedTable } from '../services/parseCsv';

function makeTable(overrides: Partial<ParsedTable>): ParsedTable {
  return {
    tableId: 'test_001',
    filename: 'test.csv',
    tableType: 'unknown',
    headers: [],
    rowCount: 0,
    sampleRows: [],
    summary: {},
    rawRows: [],
    ...overrides,
  };
}

describe('evaluateAdoption', () => {
  it('returns low confidence when no tables provided', () => {
    const result = evaluateAdoption([]);
    expect(result.adoptionMet).toBeNull();
    expect(result.adoptionConfidence).toBe('Low');
    expect(result.missingInputs).toContain('user_activity table not found');
    expect(result.missingInputs).toContain('site_activation table not found');
  });

  it('detects adoption met when 70%+ weekly active users', () => {
    const userTable = makeTable({
      tableType: 'user_activity',
      headers: ['user', 'weekly_active', 'account_holder'],
      rawRows: [
        { user: 'Alice', weekly_active: 'true', account_holder: 'true' },
        { user: 'Bob', weekly_active: 'true', account_holder: 'true' },
        { user: 'Carol', weekly_active: 'true', account_holder: 'true' },
        { user: 'Dave', weekly_active: 'true', account_holder: 'true' },
        { user: 'Eve', weekly_active: 'true', account_holder: 'true' },
        { user: 'Frank', weekly_active: 'true', account_holder: 'true' },
        { user: 'Grace', weekly_active: 'true', account_holder: 'true' },
        { user: 'Hank', weekly_active: 'false', account_holder: 'true' },
        { user: 'Ivy', weekly_active: 'false', account_holder: 'true' },
        { user: 'Jack', weekly_active: 'false', account_holder: 'true' },
      ],
      rowCount: 10,
    });

    const result = evaluateAdoption([userTable]);
    expect(result.weeklyActiveUserPct).toBe(70);
    expect(result.adoptionMet).toBe(true);
  });

  it('detects adoption NOT met when below 70% and no site data', () => {
    const userTable = makeTable({
      tableType: 'user_activity',
      headers: ['user', 'weekly_active', 'account_holder'],
      rawRows: [
        { user: 'Alice', weekly_active: 'true', account_holder: 'true' },
        { user: 'Bob', weekly_active: 'false', account_holder: 'true' },
        { user: 'Carol', weekly_active: 'false', account_holder: 'true' },
        { user: 'Dave', weekly_active: 'false', account_holder: 'true' },
        { user: 'Eve', weekly_active: 'false', account_holder: 'true' },
      ],
      rowCount: 5,
    });

    const result = evaluateAdoption([userTable]);
    expect(result.weeklyActiveUserPct).toBe(20);
    expect(result.adoptionMet).toBe(false);
  });

  it('detects adoption met via site office managers path', () => {
    const siteTable = makeTable({
      tableType: 'site_activation',
      headers: ['site', 'role', 'weekly_active'],
      rawRows: [
        { site: 'School A', role: 'office manager', weekly_active: 'true' },
        { site: 'School A', role: 'principal', weekly_active: 'false' },
        { site: 'School B', role: 'office manager', weekly_active: 'true' },
        { site: 'School B', role: 'teacher', weekly_active: 'true' },
        { site: 'School C', role: 'office manager', weekly_active: 'true' },
      ],
      rowCount: 5,
    });

    const result = evaluateAdoption([siteTable]);
    expect(result.allSitesHaveActiveOfficeManager).toBe(true);
    expect(result.adoptionMet).toBe(true);
  });

  it('detects adoption NOT met when a site lacks active office manager', () => {
    const siteTable = makeTable({
      tableType: 'site_activation',
      headers: ['site', 'role', 'weekly_active'],
      rawRows: [
        { site: 'School A', role: 'office manager', weekly_active: 'true' },
        { site: 'School B', role: 'office manager', weekly_active: 'false' },
        { site: 'School C', role: 'office manager', weekly_active: 'true' },
      ],
      rowCount: 3,
    });

    const result = evaluateAdoption([siteTable]);
    expect(result.allSitesHaveActiveOfficeManager).toBe(false);
  });
});
