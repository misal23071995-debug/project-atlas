// Report periods: whole days in the workspace's time zone. Safe to import from Client Components.

export const PRESETS = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
] as const;

export const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Period {
  // "7d", "30d", "90d" or "custom"
  id: string;
  label: string;
  // Local dates, inclusive, "YYYY-MM-DD"
  fromDate: string;
  toDate: string;
  days: number;
  // UTC instants: [from, to) and the same length just before it
  from: number;
  to: number;
  previousFrom: number;
  timezone: string;
}

const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

// The local calendar date of an instant, "YYYY-MM-DD"
export function localDate(instant: number, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant
  );
}

// How far the zone is ahead of UTC at an instant, in ms
function offset(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

// The instant local midnight starts on a date
export function startOfLocalDay(date: string, timezone: string) {
  const guess = Date.parse(`${date}T00:00:00Z`);
  const first = guess - offset(guess, timezone);
  // Again from the first answer, in case a daylight-saving change sits between
  return guess - offset(first, timezone);
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

// From the page's search params; anything invalid falls back to the last 30 days
export function resolvePeriod(
  params: { range?: string; from?: string; to?: string },
  timezone: string,
  now = Date.now()
): Period {
  const today = localDate(now, timezone);
  let id: string = params.range ?? "30d";
  let fromDate: string;
  let toDate = today;

  if (id === "custom" && isDate(params.from) && isDate(params.to) && params.from <= params.to) {
    fromDate = params.from;
    toDate = params.to > today ? today : params.to;
    if (daysBetween(fromDate, toDate) + 1 > MAX_DAYS) fromDate = addDays(toDate, -(MAX_DAYS - 1));
    if (fromDate > toDate) fromDate = toDate;
  } else {
    const preset = PRESETS.find((p) => p.id === id) ?? PRESETS[1];
    id = preset.id;
    fromDate = addDays(today, -(preset.days - 1));
  }

  const days = daysBetween(fromDate, toDate) + 1;
  const from = startOfLocalDay(fromDate, timezone);
  const to = startOfLocalDay(addDays(toDate, 1), timezone);
  const label = PRESETS.find((p) => p.id === id)?.label ?? `${fromDate} to ${toDate}`;

  return { id, label, fromDate, toDate, days, from, to, previousFrom: from - (to - from), timezone };
}
