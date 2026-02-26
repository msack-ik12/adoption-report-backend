import { describe, it, expect } from 'vitest';
import { detectTableType, parseCsvBuffer } from '../services/parseCsv';

describe('detectTableType', () => {
  it('detects campaign_metrics from headers', () => {
    const result = detectTableType(
      ['campaign_name', 'impressions', 'clicks', 'open_rate'],
      ['Welcome Email', '5000', '1200', '0.45']
    );
    expect(result).toBe('campaign_metrics');
  });

  it('detects user_activity from headers', () => {
    const result = detectTableType(
      ['user_id', 'user_name', 'weekly_active', 'last_active', 'role'],
      ['u001', 'Jane Doe', 'true', '2024-01-15', 'admin']
    );
    expect(result).toBe('user_activity');
  });

  it('detects site_activation from headers', () => {
    const result = detectTableType(
      ['site_name', 'school_id', 'office_manager', 'activated'],
      ['Lincoln Elementary', 'S001', 'John Smith', 'true']
    );
    expect(result).toBe('site_activation');
  });

  it('detects forms_usage from headers', () => {
    const result = detectTableType(
      ['form_name', 'department', 'submission_count', 'completed'],
      ['Enrollment', 'Admissions', '150', '140']
    );
    expect(result).toBe('forms_usage');
  });

  it('detects sendbacks from headers', () => {
    const result = detectTableType(
      ['sendback_id', 'reason', 'returned_date'],
      ['SB001', 'Missing signature', '2024-01-10']
    );
    expect(result).toBe('sendbacks');
  });

  it('returns unknown for unrecognizable headers', () => {
    const result = detectTableType(
      ['col_a', 'col_b', 'col_c'],
      ['val1', 'val2', 'val3']
    );
    expect(result).toBe('unknown');
  });
});

describe('parseCsvBuffer', () => {
  it('parses a valid CSV buffer', () => {
    const csv = 'user,weekly_active,account_holder\nAlice,true,true\nBob,false,true\n';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = parseCsvBuffer(buffer, 'users.csv');

    expect(result.filename).toBe('users.csv');
    expect(result.headers).toEqual(['user', 'weekly_active', 'account_holder']);
    expect(result.rowCount).toBe(2);
    expect(result.tableType).toBe('user_activity');
    expect(result.tableId).toMatch(/^sigma_/);
    expect(result.sampleRows).toHaveLength(2);
  });

  it('handles empty CSV gracefully', () => {
    const buffer = Buffer.from('', 'utf-8');
    const result = parseCsvBuffer(buffer, 'empty.csv');
    expect(result.rowCount).toBe(0);
    expect(result.tableType).toBe('unknown');
  });

  it('handles CSV with headers only', () => {
    const csv = 'col_a,col_b,col_c\n';
    const buffer = Buffer.from(csv, 'utf-8');
    const result = parseCsvBuffer(buffer, 'headers-only.csv');
    expect(result.rowCount).toBe(0);
  });
});
