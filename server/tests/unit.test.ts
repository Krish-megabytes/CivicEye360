import { describe, expect, it } from 'vitest';
import { addBusinessHours, zonedParts } from '../src/lib/sla.js';
import { deriveTrackingCode, verifyTrackingCode } from '../src/auth/tokens.js';
import { toCsv } from '../src/lib/csv.js';
import { median, percentile } from '../src/lib/stats.js';
import { rulesClassify } from '../src/services/aiService.js';
import { resolveRange } from '../src/lib/dates.js';

const calendar = {
  timezone: 'UTC',
  weekdays: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 17,
};

describe('business-hour SLA arithmetic', () => {
  it('starts a before-hours target at the opening time', () => {
    const due = addBusinessHours(new Date('2026-10-19T08:00:00.000Z'), 8, calendar);
    expect(due.toISOString()).toBe('2026-10-19T17:00:00.000Z');
  });

  it('carries work into the next business day', () => {
    const due = addBusinessHours(new Date('2026-10-19T10:00:00.000Z'), 8, calendar);
    expect(due.toISOString()).toBe('2026-10-20T10:00:00.000Z');
  });

  it('skips weekends', () => {
    const due = addBusinessHours(new Date('2026-10-23T16:00:00.000Z'), 2, calendar);
    expect(due.toISOString()).toBe('2026-10-26T10:00:00.000Z');
  });

  it('honours a configured timezone', () => {
    const due = addBusinessHours(
      new Date('2026-10-19T13:00:00.000Z'),
      8,
      { ...calendar, timezone: 'America/New_York' },
    );
    expect(due.toISOString()).toBe('2026-10-19T21:00:00.000Z');
    const parts = zonedParts(due, 'America/New_York');
    expect(parts.hour).toBe(17);
  });

  it('falls back to elapsed hours for a zero-length calendar', () => {
    const due = addBusinessHours(new Date('2026-10-19T10:00:00.000Z'), 2, {
      ...calendar,
      startHour: 10,
      endHour: 10,
    });
    expect(due.toISOString()).toBe('2026-10-19T12:00:00.000Z');
  });
});

describe('tracking codes', () => {
  it('derives stable, grouped codes that are verifiable with flexible formatting', () => {
    const code = deriveTrackingCode('CE-2026-000042');
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(deriveTrackingCode('CE-2026-000042')).toBe(code);
    expect(deriveTrackingCode('CE-2026-000043')).not.toBe(code);
    expect(verifyTrackingCode('CE-2026-000042', code.toLowerCase().replaceAll('-', ' '))).toBe(true);
    expect(verifyTrackingCode('CE-2026-000042', 'AAAA-BBBB-CCCC-DDDD')).toBe(false);
  });
});

describe('CSV export safety', () => {
  it('escapes delimiters, quotes, newlines and spreadsheet formulas', () => {
    const csv = toCsv(
      [{ name: '=SUM(A1:A4)', note: 'He said "hello", then left\nNext line' }],
      [
        { header: 'Name', value: (row) => row.name },
        { header: 'Note', value: (row) => row.note },
      ],
    );
    expect(csv.startsWith('Name,Note\r\n')).toBe(true);
    expect(csv).toContain("'=SUM(A1:A4)");
    expect(csv).toContain('"He said ""hello"", then left\nNext line"');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

describe('statistics', () => {
  it('computes medians and percentiles without mutating input', () => {
    const values = [4, 1, 3, 2];
    expect(median(values)).toBe(2.5);
    expect(percentile(values, 90)).toBeCloseTo(3.7, 5);
    expect(values).toEqual([4, 1, 3, 2]);
    expect(median([])).toBeNull();
    expect(percentile([7], 95)).toBe(7);
  });
});

describe('rules-based AI fallback', () => {
  it('suggests a plausible category, priority and an honest rationale', () => {
    const result = rulesClassify(
      'Deep pothole near the school crossing',
      'The pothole is unsafe for children crossing and cars are swerving.',
    );
    expect(result.category).toBe('roads');
    expect(result.suggestedPriority).toBe('Urgent');
    expect(result.source).toBe('rules');
    expect(result.aiConfigured).toBe(false);
    expect(result.rationale).toContain('Rules-based');
    expect(result.priorityRationale).toContain('not an emergency service');
  });

  it('falls back to Other when nothing matches', () => {
    const result = rulesClassify('General question', 'Something unusual to review.');
    expect(result.category).toBe('other');
    expect(result.confidence).toBe(0.25);
  });
});

describe('date ranges', () => {
  it('uses the whole end day and rejects inverted ranges', () => {
    const range = resolveRange(new Date('2026-10-01T00:00:00.000Z'), new Date('2026-10-03T00:00:00.000Z'));
    expect(range.to.getUTCHours()).toBe(23);
    expect(range.to.getUTCMinutes()).toBe(59);
    expect(() =>
      resolveRange(new Date('2026-10-05T00:00:00.000Z'), new Date('2026-10-01T00:00:00.000Z')),
    ).toThrow();
  });
});
