import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { MapPoint, ReportStatus } from '../../types';

export const MAP_ENABLED = import.meta.env.VITE_MAP_ENABLED !== 'false';
export const MAP_TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; OpenStreetMap contributors';
export const MAP_DEFAULT_CENTER: [number, number] = [
  Number(import.meta.env.VITE_MAP_DEFAULT_LAT || 40.4414),
  Number(import.meta.env.VITE_MAP_DEFAULT_LNG || -80.0006),
];

const STATUS_COLORS: Record<ReportStatus, string> = {
  Submitted: '#1f5f86',
  'Under Review': '#8a5a00',
  Assigned: '#0f4c81',
  'In Progress': '#0f4c81',
  Resolved: '#166b4f',
  Closed: '#8a969e',
  Rejected: '#a12f23',
  Reopened: '#a45a08',
};

function pinIcon(status: ReportStatus): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin" style="background:${STATUS_COLORS[status]}"><span></span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

function FitToPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  const signature = points.map((point) => point.id).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0]!.latitude, points[0]!.longitude], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [34, 34], maxZoom: 15 });
    // Re-fit only when the set of records changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);
  return null;
}

function ClusteredPoints({
  points,
  onSelect,
}: {
  points: MapPoint[];
  onSelect: (point: MapPoint) => void;
}) {
  const map = useMap();
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 42,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
        return L.divIcon({
          html: `<div>${count}</div>`,
          className: `marker-cluster marker-cluster-${size}`,
          iconSize: L.point(38, 38),
        });
      },
    });

    for (const point of points) {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: pinIcon(point.status),
        title: `${point.reportId}: ${point.title}`,
        alt: `${point.status} report ${point.reportId}`,
        keyboard: true,
      });
      marker.on('click', () => selectRef.current(point));
      group.addLayer(marker);
    }

    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, points]);

  return null;
}

export function MapCanvas({
  points,
  onSelect,
  height = 480,
  className = '',
}: {
  points: MapPoint[];
  onSelect: (point: MapPoint) => void;
  height?: number;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden border border-line ${className}`} style={{ height }}>
      <MapContainer
        center={MAP_DEFAULT_CENTER}
        zoom={12}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        aria-label="Map of filtered reports"
      >
        <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
        <FitToPoints points={points} />
        <ClusteredPoints points={points} onSelect={onSelect} />
      </MapContainer>
    </div>
  );
}

function PickerEvents({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Recenter({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, map]);
  return null;
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
  height = 240,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
  height?: number;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const hasPoint = typeof latitude === 'number' && typeof longitude === 'number';
  const center: [number, number] = hasPoint ? [latitude, longitude] : MAP_DEFAULT_CENTER;

  useEffect(() => {
    if (!markerRef.current) return;
    const handler = () => {
      const position = markerRef.current?.getLatLng();
      if (position) onChange(position.lat, position.lng);
    };
    markerRef.current.on('dragend', handler);
    return () => {
      markerRef.current?.off('dragend', handler);
    };
  }, [onChange]);

  return (
    <div className="overflow-hidden border border-line" style={{ height }}>
      <MapContainer
        center={center}
        zoom={hasPoint ? 15 : 12}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        aria-label="Map location picker. Click the map to place a pin."
      >
        <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} />
        <PickerEvents
          onPick={(lat, lng) => {
            onChange(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
          }}
        />
        <Recenter latitude={latitude} longitude={longitude} />
        {hasPoint ? (
          <DraggableMarker
            latitude={latitude}
            longitude={longitude}
            markerRef={markerRef}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}

function DraggableMarker({
  latitude,
  longitude,
  markerRef,
}: {
  latitude: number;
  longitude: number;
  markerRef: React.MutableRefObject<L.Marker | null>;
}) {
  const map = useMap();
  useEffect(() => {
    const marker = L.marker([latitude, longitude], {
      draggable: true,
      icon: pinIcon('Assigned'),
      keyboard: true,
      title: 'Selected location. Drag to adjust.',
      alt: 'Selected location marker',
    })
      .addTo(map)
      .bindTooltip('Drag to adjust the pin', { direction: 'top', offset: [0, -18] });
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, markerRef]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
  }, [latitude, longitude, markerRef]);

  return null;
}
