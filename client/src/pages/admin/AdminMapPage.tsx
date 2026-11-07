import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useCategories, useMapPoints } from '../../hooks/queries';
import { MAP_ENABLED, MapCanvas } from '../../components/map/MapCanvas';
import { Alert, Badge, EmptyState, ErrorState, Field, LoadingPanel, PageHeader, Panel, Select, StatusBadge } from '../../components/ui/base';
import { getErrorMessage } from '../../utils/format';
import type { MapPoint, Priority, ReportStatus } from '../../types';

const STATUSES: ReportStatus[] = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected', 'Reopened'];
const PRIORITIES: Priority[] = ['Urgent', 'High', 'Medium', 'Low'];

export function AdminMapPage() {
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const categories = useCategories();
  const config = useQuery({ queryKey: ['public-config'], queryFn: api.publicConfig });
  const mapQuery = useMapPoints({ status: status ? [status] : undefined, category: category || undefined, priority: priority || undefined });
  const points = useMemo(() => mapQuery.data?.points ?? [], [mapQuery.data?.points]);

  if (!MAP_ENABLED) {
    return <div><PageHeader eyebrow="Location explorer" title="Map explorer" description="Map display is disabled by this installation." /><Alert title="Map display is disabled">The municipality can enable a tile provider with VITE_MAP_ENABLED. Other report workflows do not depend on map availability.</Alert></div>;
  }

  return <div>
    <PageHeader eyebrow="Location explorer" title="Map explorer" description="Explore reports that include valid coordinates. Report visibility is enforced by the API according to your staff role and department scope." />
    {config.data?.maps.note ? <Alert className="mb-4" tone="info" title={`${config.data.maps.provider} map tiles`}>{config.data.maps.note} The tile provider receives map tile requests from your browser.</Alert> : null}
    <Panel className="mb-4 p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Status" htmlFor="map-status"><Select id="map-status" value={status} onChange={(event) => { setStatus(event.target.value); setSelected(null); }}><option value="">All statuses</option>{STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
        <Field label="Category" htmlFor="map-category"><Select id="map-category" value={category} onChange={(event) => { setCategory(event.target.value); setSelected(null); }}><option value="">All categories</option>{(categories.data ?? []).map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</Select></Field>
        <Field label="Priority" htmlFor="map-priority"><Select id="map-priority" value={priority} onChange={(event) => { setPriority(event.target.value); setSelected(null); }}><option value="">All priorities</option>{PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field>
      </div>
    </Panel>
    {mapQuery.isLoading ? <LoadingPanel rows={6} label="Loading map records" /> : mapQuery.isError ? <ErrorState message={getErrorMessage(mapQuery.error)} onRetry={() => void mapQuery.refetch()} /> : mapQuery.data ? <>
      <p className="mb-2 text-xs text-ink-muted">{mapQuery.data.total.toLocaleString()} located report{mapQuery.data.total === 1 ? '' : 's'}{mapQuery.data.truncated ? ' · showing the newest 2,000' : ''}</p>
      <Panel className="overflow-hidden"><MapCanvas points={points} onSelect={setSelected} height={560} /></Panel>
      {selected ? <Panel className="mt-3 flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={selected.status}/><Badge tone={selected.priority === 'Urgent' || selected.priority === 'High' ? 'warn' : 'neutral'}>{selected.priority}</Badge><span className="font-mono text-[10px] text-ink-muted">{selected.reportId}</span></div><h2 className="mt-1 text-sm font-semibold text-ink">{selected.title}</h2><p className="mt-1 text-xs text-ink-muted">{selected.address}{selected.department ? ` · ${selected.department}` : ''}</p></div><Link to={`/admin/reports/${encodeURIComponent(selected.reportId)}`} className="text-xs font-semibold text-civic hover:underline">Open report</Link></Panel> : null}
      {points.length === 0 ? <Panel className="mt-3"><EmptyState title="No located reports match" description="Only reports with valid coordinates appear on the map. Try another filter or review records with missing location data in the report queue." /></Panel> : null}
    </> : null}
  </div>;
}
