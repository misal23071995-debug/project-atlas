// Capacity planning maths: demand forecast, Erlang C staffing and roster coverage.
// Pure functions with no database access, so they're easy to test. Safe for Client Components.

import { addDays, type LeaveRequest, type Shift } from "@/app/lib/roster/types";

export interface CapacitySettings {
  timezone: string;
  ahtMinutes: number;
  targetPercent: number;
  targetSeconds: number;
  shrinkagePercent: number;
  historyWeeks: number;
  useSampleDemand: boolean;
}

export const DEFAULT_SETTINGS: CapacitySettings = {
  timezone: "Asia/Kolkata",
  ahtMinutes: 8,
  targetPercent: 80,
  targetSeconds: 120,
  shrinkagePercent: 15,
  historyWeeks: 6,
  useSampleDemand: false,
};

// A week of hourly values: grid[day][hour], day 0 = Monday, hour 0-23
export type WeekGrid = number[][];

export const emptyGrid = (): WeekGrid => Array.from({ length: 7 }, () => Array(24).fill(0));

// ---- Demand ----

// Monday-based weekday and hour of a moment, in the team's time zone
export function localSlot(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday), hour: hour % 24 };
}

// Average contacts per weekday-hour over the history window
export function forecastFromHistory(createdAt: string[], timezone: string, weeks: number): WeekGrid {
  const grid = emptyGrid();
  for (const iso of createdAt) {
    const { day, hour } = localSlot(iso, timezone);
    if (day >= 0) grid[day][hour] += 1;
  }
  return grid.map((hours) => hours.map((count) => Math.round((count / weeks) * 10) / 10));
}

// A realistic made-up week for a mid-sized consumer brand: quiet nights, a late-morning
// peak, an evening peak after work, and lighter weekends. About 1,400 contacts a week.
export function sampleDemand(): WeekGrid {
  const hourShape = [
    1, 0.6, 0.4, 0.3, 0.3, 0.5, 1.5, 4, 8, 13, 17, 18, 15, 14, 14, 13, 12, 12, 14, 17, 16, 11, 6, 3,
  ];
  const dayFactor = [1.25, 1.1, 1, 1, 0.95, 0.7, 0.65];

  return dayFactor.map((factor, day) =>
    hourShape.map((base, hour) => {
      // Small fixed wobble so the pattern doesn't look machine-made
      const wobble = 1 + (((day * 31 + hour * 17) % 11) - 5) / 50;
      return Math.round(base * factor * wobble * 10) / 10;
    })
  );
}

// ---- Erlang C ----

// Probability a contact has to wait, for `agents` agents and `traffic` Erlangs
function erlangC(agents: number, traffic: number) {
  if (agents <= traffic) return 1;
  // Erlang B built up one agent at a time, which stays numerically stable for large teams
  let b = 1;
  for (let n = 1; n <= agents; n++) b = (traffic * b) / (n + traffic * b);
  return (agents * b) / (agents - traffic * (1 - b));
}

export function serviceLevel(agents: number, contactsPerHour: number, ahtSeconds: number, targetSeconds: number) {
  if (contactsPerHour <= 0) return 1;
  const traffic = (contactsPerHour * ahtSeconds) / 3600;
  if (agents <= traffic) return 0;
  return 1 - erlangC(agents, traffic) * Math.exp(-((agents - traffic) * targetSeconds) / ahtSeconds);
}

// Agents that must be handling contacts in the hour to hit the service level
export function agentsForServiceLevel(contactsPerHour: number, settings: CapacitySettings) {
  if (contactsPerHour <= 0) return 0;
  const ahtSeconds = settings.ahtMinutes * 60;
  const traffic = (contactsPerHour * ahtSeconds) / 3600;

  let agents = Math.max(1, Math.ceil(traffic));
  while (agents < 1000 && serviceLevel(agents, contactsPerHour, ahtSeconds, settings.targetSeconds) < settings.targetPercent / 100) {
    agents += 1;
  }
  return agents;
}

// Rostered people needed, allowing for shrinkage (meetings, coaching, absence)
export function staffNeeded(demand: WeekGrid, settings: CapacitySettings): WeekGrid {
  const keep = 1 - settings.shrinkagePercent / 100;
  return demand.map((hours) =>
    hours.map((contacts) => {
      const agents = agentsForServiceLevel(contacts, settings);
      return agents === 0 ? 0 : Math.ceil(agents / keep);
    })
  );
}

// ---- Roster coverage ----

// People on shift in each hour of the week starting `monday`, excluding breaks and approved leave.
// A person on for half an hour counts as 0.5. Pass shifts from the Sunday before too, so
// overnight shifts that run into Monday morning are counted.
export function rosterCoverage(monday: string, shifts: Shift[], leave: LeaveRequest[]): WeekGrid {
  const grid = emptyGrid();
  const weekStartMs = Date.parse(`${monday}T00:00:00Z`);
  const onLeave = (userId: string, date: string) =>
    leave.some((l) => l.status === "approved" && l.userId === userId && l.startDate <= date && date <= l.endDate);

  for (const shift of shifts) {
    if (onLeave(shift.userId, shift.date)) continue;

    // Minutes from the start of this roster week
    const offset = (Date.parse(`${shift.date}T00:00:00Z`) - weekStartMs) / 60000;
    const working: [number, number][] = [];
    let cursor = shift.startMinute;
    for (const b of [...shift.breaks].sort((a, c) => a.start - c.start)) {
      if (b.start > cursor) working.push([cursor, b.start]);
      cursor = Math.max(cursor, b.start + b.minutes);
    }
    if (shift.endMinute > cursor) working.push([cursor, shift.endMinute]);

    for (const [from, to] of working) {
      for (let minute = offset + from; minute < offset + to; ) {
        const hourEnd = (Math.floor(minute / 60) + 1) * 60;
        const until = Math.min(hourEnd, offset + to);
        const slot = Math.floor(minute / 60);
        if (slot >= 0 && slot < 7 * 24) grid[Math.floor(slot / 24)][slot % 24] += (until - minute) / 60;
        minute = until;
      }
    }
  }

  return grid.map((hours) => hours.map((value) => Math.round(value * 10) / 10));
}

export const previousSunday = (monday: string) => addDays(monday, -1);

export const gridTotal = (grid: WeekGrid) => grid.flat().reduce((sum, value) => sum + value, 0);
