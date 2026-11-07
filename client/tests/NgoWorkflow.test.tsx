import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { NgoTasksPage } from '../src/pages/ngo/NgoTasksPage';
import { NgoWorkPage } from '../src/pages/ngo/NgoWorkPage';
import { api } from '../src/api';

vi.mock('../src/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      ngo: {
        ...actual.api.ngo,
        tasks: vi.fn().mockResolvedValue({
          available: [
            {
              id: 'db-report',
              reportId: 'CE-2026-000001',
              title: 'Blocked drain',
              category: 'drainage',
              description: 'Clear blocked public drain.',
              address: 'Main Street',
              priority: 'High',
              suggestedPoints: 75,
              createdAt: new Date().toISOString(),
            },
          ],
          mine: [
            {
              id: 'ngo-task-1',
              reportId: 'CE-2026-000002',
              title: 'Broken streetlight',
              category: 'streetlights',
              description: 'Replace the lamp.',
              address: 'Harbour Walk',
              priority: 'Medium',
              status: 'claimed',
              summary: null,
              points: 0,
              suggestedPoints: 50,
              evidenceIds: [],
              evidence: [],
              createdAt: new Date().toISOString(),
            },
          ],
          stats: { ngoId: 'ngo-1', points: 0, completedTasks: 0, activeTasks: 1, pendingReview: 0, needsCorrections: 0, rank: null, rankedNgos: 0 },
        }),
        leaderboard: vi.fn().mockResolvedValue([]),
      },
    },
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NGO workspace pages', () => {
  it('lists discoverable tasks with a claim action', async () => {
    renderWithProviders(<NgoTasksPage />);
    expect(await screen.findByText('Blocked drain')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim task' })).toBeInTheDocument();
    expect(screen.getByText('Highest points')).toBeInTheDocument();
  });

  it('shows claimed work with photo evidence controls and status tabs', async () => {
    renderWithProviders(<NgoWorkPage />);
    expect(await screen.findByText('Broken streetlight')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /In progress/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Take a photo for CE-2026-000002')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeDisabled();
  });
});
