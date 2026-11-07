import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface TrendPoint {
  date: string;
  created: number;
  resolved: number;
}

export function TrendChart({ data, height = 260 }: { data: TrendPoint[]; height?: number }) {
  const createdTotal = data.reduce((sum, point) => sum + point.created, 0);
  const resolvedTotal = data.reduce((sum, point) => sum + point.resolved, 0);
  return (
    <div>
      <div
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Report volume trend: ${createdTotal} created and ${resolvedTotal} resolved across ${data.length} days.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#e3e1d8" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: '#61717c', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#d5d4ca' }}
              tickFormatter={(value: string) => value.slice(5)}
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: '#61717c', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                border: '1px solid #c3c5b9',
                borderRadius: 3,
                fontSize: 11,
                background: '#ffffff',
                boxShadow: '0 4px 16px rgba(19,35,47,.08)',
              }}
              labelStyle={{ fontWeight: 600, color: '#13232f' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="plainline"
              iconSize={16}
            />
            <Line
              type="monotone"
              dataKey="created"
              name="Created"
              stroke="#0f4c81"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="resolved"
              name="Resolved"
              stroke="#a45a08"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-[11px] text-ink-muted">
        <summary className="cursor-pointer font-medium text-ink-soft hover:text-civic">
          View data table
        </summary>
        <div className="mt-2 max-h-48 overflow-y-auto border border-line">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-paper">
              <tr>
                <th scope="col" className="px-2 py-1 font-semibold">Date (UTC)</th>
                <th scope="col" className="px-2 py-1 font-semibold">Created</th>
                <th scope="col" className="px-2 py-1 font-semibold">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date} className="border-t border-line">
                  <td className="px-2 py-1 tabular-nums">{point.date}</td>
                  <td className="px-2 py-1 tabular-nums">{point.created}</td>
                  <td className="px-2 py-1 tabular-nums">{point.resolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function BreakdownBars({
  items,
  emptyMessage = 'No records in this range.',
}: {
  items: Array<{ label: string; value: number; href?: string }>;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-ink-muted">{emptyMessage}</p>;
  }
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="space-y-2.5" aria-label="Distribution breakdown">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="truncate text-ink-soft">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{item.value}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden bg-paper-deep" aria-hidden="true">
            <div
              className="h-full bg-civic"
              style={{ width: `${Math.max(item.value === 0 ? 0 : 3, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
