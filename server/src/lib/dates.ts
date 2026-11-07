import { unprocessable } from './errors.js';

export interface DateRange {
  from: Date;
  to: Date;
}

const DAY = 86_400_000;

export function resolveRange(from?: Date, to?: Date, defaultDays = 30): DateRange {
  const now = new Date();
  let end = to ? new Date(to) : now;
  if (to && to.getUTCHours() === 0 && to.getUTCMinutes() === 0 && to.getUTCSeconds() === 0) {
    end = new Date(to.getTime() + DAY - 1);
  }
  let start = from
    ? new Date(from)
    : new Date(end.getTime() - (defaultDays - 1) * DAY);
  if (!from && !to) {
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - (defaultDays - 1) * DAY);
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw unprocessable('Invalid date range.');
  }
  if (start > end) throw unprocessable('The start date must be before the end date.');
  if (end.getTime() - start.getTime() > 366 * DAY) {
    throw unprocessable('Choose a date range of 366 days or less.');
  }
  return { from: start, to: end };
}
