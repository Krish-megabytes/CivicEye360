import { Counter } from '../models/Counter.js';

/** Generates a human-readable, unique public reference such as CE-2026-000042. */
export async function nextReportId(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `report-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  ).lean();
  const sequence = counter?.seq ?? 1;
  return `CE-${year}-${String(sequence).padStart(6, '0')}`;
}
