import type { BusinessCalendar } from '../models/SlaConfig.js';

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  let instance = formatterCache.get(timezone);
  if (!instance) {
    instance = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timezone, instance);
  }
  return instance;
}

export function zonedParts(date: Date, timezone: string): ZonedParts {
  const parts = formatter(timezone).formatToParts(date);
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    weekday: WEEKDAY_INDEX[values.weekday ?? ''] ?? 0,
  };
}

/** Converts a wall-clock time in a zone to the corresponding UTC instant. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(guess), timezone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const drift = asUtc - desired;
    if (drift === 0) break;
    guess -= drift;
  }
  return new Date(guess);
}

/**
 * Adds working hours to a date using the configured business calendar.
 * The result lands exactly on a working minute; days outside the calendar are
 * skipped. Target hours are expressed in business hours, not wall-clock hours.
 */
export function addBusinessHours(
  start: Date,
  targetHours: number,
  calendar: BusinessCalendar,
): Date {
  const timezone = calendar.timezone || 'UTC';
  const weekdays = new Set(
    (calendar.weekdays?.length ? calendar.weekdays : [1, 2, 3, 4, 5]).map(Number),
  );
  const openMinute = Math.max(0, Math.min(24, calendar.startHour)) * 60;
  const closeMinute = Math.max(0, Math.min(24, calendar.endHour)) * 60;
  if (closeMinute <= openMinute) {
    return new Date(start.getTime() + Math.round(targetHours * 60) * 60_000);
  }

  let remaining = Math.round(targetHours * 60);
  if (remaining <= 0) return new Date(start);

  const startParts = zonedParts(start, timezone);
  const startDayKey = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const startMinute = startParts.hour * 60 + startParts.minute;

  for (let dayOffset = 0; dayOffset < 800; dayOffset += 1) {
    const day = new Date(startDayKey + dayOffset * 86_400_000);
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const date = day.getUTCDate();
    const weekday = day.getUTCDay();
    if (!weekdays.has(weekday)) continue;

    let availableStart = openMinute;
    if (dayOffset === 0) {
      if (startMinute >= closeMinute) continue;
      availableStart = Math.max(openMinute, startMinute);
    }

    const available = closeMinute - availableStart;
    if (available <= 0) continue;

    if (remaining <= available) {
      const targetMinute = availableStart + remaining;
      const hour = Math.floor(targetMinute / 60);
      const minute = targetMinute % 60;
      return zonedTimeToUtc(year, month, date, hour, minute, timezone);
    }

    remaining -= available;
  }

  // Calendar has no reachable working time (e.g. empty weekdays); fall back to
  // elapsed time rather than returning an invalid date.
  return new Date(start.getTime() + Math.round(targetHours * 60) * 60_000);
}
