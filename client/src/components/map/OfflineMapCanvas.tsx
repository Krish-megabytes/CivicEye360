import { useMemo } from 'react';
import type { MapPoint } from '../../types';
import { MAP_DEFAULT_CENTER } from './MapCanvas';

const WORLD = { minLat: -85, maxLat: 85, minLng: -180, maxLng: 180 };

/** A network-independent schematic map for report locations. */
export function OfflineMapCanvas({
  points,
  onSelect,
  height = 360,
}: {
  points: MapPoint[];
  onSelect: (point: MapPoint) => void;
  height?: number;
}) {
  const bounds = useMemo(() => {
    if (!points.length) {
      const [lat, lng] = MAP_DEFAULT_CENTER;
      return { minLat: lat - 0.03, maxLat: lat + 0.03, minLng: lng - 0.04, maxLng: lng + 0.04 };
    }
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const latSpan = Math.max(...latitudes) - Math.min(...latitudes);
    const lngSpan = Math.max(...longitudes) - Math.min(...longitudes);
    const latPadding = Math.max(latSpan * 0.12, 0.002);
    const lngPadding = Math.max(lngSpan * 0.12, 0.002);
    return {
      minLat: Math.max(WORLD.minLat, Math.min(...latitudes) - latPadding),
      maxLat: Math.min(WORLD.maxLat, Math.max(...latitudes) + latPadding),
      minLng: Math.max(WORLD.minLng, Math.min(...longitudes) - lngPadding),
      maxLng: Math.min(WORLD.maxLng, Math.max(...longitudes) + lngPadding),
    };
  }, [points]);

  return (
    <div
      className="relative isolate overflow-hidden border border-line bg-[#e8e5da]"
      style={{ height }}
      role="group"
      aria-label={`Offline map with ${points.length} report locations`}
    >
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-5 18 C20 30 23 48 42 44 S70 24 105 38 M-5 78 C20 65 35 82 52 66 S82 53 105 73 M14 -5 C25 20 12 46 29 105 M72 -5 C61 20 83 50 68 105" fill="none" stroke="#fff" strokeWidth="2.4" />
        <path d="M-5 51 C20 43 36 53 50 47 S79 34 105 48 M45 -5 C55 25 40 56 53 105 M94 -5 C80 22 101 60 88 105" fill="none" stroke="#d2d0c6" strokeWidth="0.8" />
      </svg>
      {points.map((point) => {
        const left = ((point.longitude - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng, 0.0001)) * 100;
        const top = (1 - (point.latitude - bounds.minLat) / Math.max(bounds.maxLat - bounds.minLat, 0.0001)) * 100;
        return (
          <button
            key={point.id}
            type="button"
            onClick={() => onSelect(point)}
            title={`${point.reportId}: ${point.title}`}
            aria-label={`${point.status}: ${point.title} at ${point.address}`}
            className="absolute z-[1] grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-civic text-[10px] font-bold text-white shadow-md hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic"
            style={{ left: `${Math.min(98, Math.max(2, left))}%`, top: `${Math.min(96, Math.max(4, top))}%` }}
          >
            •
          </button>
        );
      })}
      <span className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[10px] text-ink-muted">Offline map · report coordinates only</span>
    </div>
  );
}
