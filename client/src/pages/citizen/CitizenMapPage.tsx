import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Alert, LinkButton, PageHeader, Panel } from '../../components/ui/base';
import { OfflineMapCanvas } from '../../components/map/OfflineMapCanvas';
import type { MapPoint } from '../../types';

export function CitizenMapPage() {
  const mapQuery = useQuery({
    queryKey: ['citizen', 'offline-map'],
    queryFn: async () => {
      const response = await api.reports.my({ page: 1, pageSize: 100, sort: 'createdAt', order: 'desc' });
      return response.data.flatMap((report): MapPoint[] => {
        const { latitude, longitude } = report.location;
        if (latitude === null || longitude === null) return [];
        return [{
          id: report.id,
          reportId: report.reportId,
          title: report.title,
          category: report.category,
          status: report.status,
          priority: report.priority,
          latitude,
          longitude,
          address: report.location.address,
          department: report.department?.name ?? null,
          createdAt: report.createdAt,
        }];
      });
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Citizen dashboard"
        title="My report map"
        description="A tile-free offline map of your reports with saved coordinates. Only you can see these locations."
        actions={<LinkButton to="/dashboard/reports" variant="secondary">View as list</LinkButton>}
      />
      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">Report locations</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Select a marker to open the full report and its recorded updates.
            </p>
          </div>
          {mapQuery.data ? (
            <span className="text-[10px] text-ink-muted">
              {mapQuery.data.length} mapped{mapQuery.data.length === 100 ? ' · newest 100 reports checked' : ''}
            </span>
          ) : null}
        </div>
        {mapQuery.isLoading ? (
          <div role="status" className="grid h-64 place-items-center border border-line bg-paper text-xs text-ink-muted">
            Loading your report locations…
          </div>
        ) : mapQuery.isError ? (
          <Alert tone="error" title="Map locations unavailable">
            Your report list is still available in <Link to="/dashboard/reports" className="font-semibold text-civic underline">My reports</Link>.
          </Alert>
        ) : mapQuery.data?.length ? (
          <OfflineMapCanvas
            points={mapQuery.data}
            onSelect={(point) => {
              window.location.assign(`/reports/${encodeURIComponent(point.reportId)}`);
            }}
          />
        ) : (
          <div className="grid h-64 place-items-center border border-line bg-paper text-center">
            <p className="max-w-sm px-4 text-xs text-ink-muted">
              No reports with coordinates to show yet. Add a location when you submit a report and it will appear here.
            </p>
          </div>
        )}
      </Panel>
    </>
  );
}
