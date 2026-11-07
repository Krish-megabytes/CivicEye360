import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/api';

describe('paginated API responses', () => {
  afterEach(() => vi.restoreAllMocks());

  it('preserves the data array and pagination metadata for report lists', async () => {
    const response = {
      data: [{ id: 'report-1', reportId: 'CE-2026-000001' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(api.reports.my({ page: 1, pageSize: 10 })).resolves.toEqual(response);
  });
});
