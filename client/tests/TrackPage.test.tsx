import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TrackPage } from '../src/pages/public/TrackPage';
import { api } from '../src/api';

vi.mock('../src/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api')>();
  return { ...actual, api: { ...actual.api, track: vi.fn() } };
});

describe('TrackPage', () => {
  beforeEach(() => vi.clearAllMocks());
  it('requires a reference and tracking code before a request', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><TrackPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Find report' })).toBeDisabled();
    await user.type(screen.getByLabelText('Report reference'), 'CE-2026-000001');
    expect(screen.getByRole('button', { name: 'Find report' })).toBeDisabled();
    await user.type(screen.getByLabelText('Secure tracking code'), 'private-code');
    expect(screen.getByRole('button', { name: 'Find report' })).toBeEnabled();
    expect(api.track).not.toHaveBeenCalled();
  });
  it('does not reveal details before successful server verification', () => {
    render(<MemoryRouter><TrackPage /></MemoryRouter>);
    expect(screen.queryByText('Public timeline')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Verification failures do not disclose/)).toHaveLength(2);
  });
});
