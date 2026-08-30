/**
 * Account-local calendar helpers using Intl (no extra tz library).
 * Falls back to a fixed Asia/Nicosia offset table when ICU lacks the zone.
 */

export type LocalClock = {
  localDate: string; // YYYY-MM-DD
  localHour: number; // 0-23
  timeZone: string;
};

const NICOSIA_OFFSETS: Array<{ start: string; end: string; offsetHours: number }> = [
  // Approximate EET/EEST windows for Asia/Nicosia (last Sunday Mar → last Sunday Oct = +3)
  { start: '2025-03-30', end: '2025-10-25', offsetHours: 3 },
  { start: '2025-10-26', end: '2026-03-28', offsetHours: 2 },
  { start: '2026-03-29', end: '2026-10-24', offsetHours: 3 },
  { start: '2026-10-25', end: '2027-03-27', offsetHours: 2 },
  { start: '2027-03-28', end: '2027-10-30', offsetHours: 3 },
  { start: '2027-10-31', end: '2028-03-25', offsetHours: 2 },
];

function supportsTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function nicosiaFallback(date: Date): LocalClock {
  const utcMs = date.getTime();
  const utcDay = date.toISOString().slice(0, 10);
  let offsetHours = 2;
  for (const row of NICOSIA_OFFSETS) {
    if (utcDay >= row.start && utcDay <= row.end) {
      offsetHours = row.offsetHours;
      break;
    }
  }
  const local = new Date(utcMs + offsetHours * 3600_000);
  return {
    localDate: local.toISOString().slice(0, 10),
    localHour: local.getUTCHours(),
    timeZone: 'Asia/Nicosia',
  };
}

/**
 * Returns the local calendar date and hour for `date` in `timeZone`.
 */
export function getLocalClock(date: Date, timeZone: string): LocalClock {
  const tz = timeZone || 'Asia/Nicosia';
  if (!supportsTimeZone(tz)) {
    if (tz === 'Asia/Nicosia' || tz === 'Europe/Nicosia') {
      return nicosiaFallback(date);
    }
    // Unknown zone without ICU: treat as UTC
    return {
      localDate: date.toISOString().slice(0, 10),
      localHour: date.getUTCHours(),
      timeZone: 'UTC',
    };
  }

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = dateParts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = dateParts.find((p) => p.type === 'month')?.value ?? '01';
  const day = dateParts.find((p) => p.type === 'day')?.value ?? '01';

  const hourParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hourRaw = hourParts.find((p) => p.type === 'hour')?.value ?? '0';
  const localHour = Number.parseInt(hourRaw, 10);

  return {
    localDate: `${year}-${month}-${day}`,
    localHour: Number.isFinite(localHour) ? localHour : 0,
    timeZone: tz,
  };
}

export function isDueHour(date: Date, timeZone: string, hour: number): boolean {
  const { localHour } = getLocalClock(date, timeZone);
  return localHour === hour;
}

/** YYYY-MM-DD that is `daysAgo` calendar days before `localDate`. */
export function localDateDaysAgo(localDate: string, daysAgo: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - daysAgo);
  return utc.toISOString().slice(0, 10);
}
