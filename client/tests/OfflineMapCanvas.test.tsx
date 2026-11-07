import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfflineMapCanvas } from '../src/components/map/OfflineMapCanvas';
import type { MapPoint } from '../src/types';

const points: MapPoint[] = [{
  id: 'report-1', reportId: 'CE-2026-000001', title: 'Broken streetlight', category: 'streetlights',
  status: 'Submitted', priority: 'Medium', latitude: 40.44, longitude: -80.0,
  address: '1 Main Street', department: null, createdAt: '2026-01-01T00:00:00.000Z',
}];

describe('OfflineMapCanvas', () => {
  it('plots authorized report coordinates and lets the citizen select a marker', () => {
    const onSelect = vi.fn();
    render(<OfflineMapCanvas points={points} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Broken streetlight at 1 Main Street/ }));
    expect(onSelect).toHaveBeenCalledWith(points[0]);
    expect(screen.getByText(/Offline map/)).toBeInTheDocument();
  });
});
