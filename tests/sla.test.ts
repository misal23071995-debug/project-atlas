import { describe, expect, it } from "vitest";
import {
  DEFAULT_SLA_TARGETS,
  clockLabel,
  currentClock,
  dueTimes,
  firstResponseClock,
  isAtRisk,
  isBreached,
  parseDuration,
  resolutionClock,
  type TicketSla,
} from "@/app/lib/sla";

const H = 3_600_000;
const created = "2026-11-04T00:00:00.000Z";
const t0 = Date.parse(created);
const base: TicketSla = {
  priority: "High",
  status: "Open",
  createdAt: created,
  firstResponseAt: null,
  resolvedAt: null,
  ...dueTimes(created, DEFAULT_SLA_TARGETS.High), // 1h reply, 8h resolve
  slaPausedAt: null,
  slaPausedMinutes: 0,
};

describe("SLA clocks", () => {
  it("sets due times from the priority's targets", () => {
    expect(base.firstResponseDueAt).toBe("2026-11-04T01:00:00.000Z");
    expect(base.resolutionDueAt).toBe("2026-11-04T08:00:00.000Z");
  });

  it("runs, turns at risk in the last quarter, then breaches", () => {
    expect(currentClock(base, t0 + 10 * 60_000).clock?.state).toBe("running");
    expect(clockLabel("reply", currentClock(base, t0 + 10 * 60_000).clock!)).toBe("Reply in 50m");
    expect(currentClock(base, t0 + 50 * 60_000).clock?.state).toBe("at_risk");
    expect(isBreached(base, t0 + 2 * H)).toBe(true);
    expect(clockLabel("reply", currentClock(base, t0 + 2 * H).clock!)).toBe("Reply overdue 1h");
  });

  it("moves to the resolution clock after the first reply", () => {
    const replied = { ...base, firstResponseAt: new Date(t0 + 30 * 60_000).toISOString() };
    expect(firstResponseClock(replied, t0 + 2 * H)?.state).toBe("met");
    expect(currentClock(replied, t0 + 2 * H).kind).toBe("resolve");
    expect(isBreached(replied, t0 + 2 * H)).toBe(false);
    expect(isAtRisk(replied, t0 + 7 * H)).toBe(true);
  });

  it("stops counting while waiting on the customer", () => {
    const paused = { ...base, firstResponseAt: new Date(t0 + H / 2).toISOString(), status: "Waiting on Customer" as const, slaPausedAt: new Date(t0 + 3 * H).toISOString() };
    const clock = resolutionClock(paused, t0 + 20 * H)!;
    expect(clock.state).toBe("paused");
    expect(Math.round(clock.minutesLeft)).toBe(300);
  });

  it("marks a late resolution as missed, and done tickets are never breached", () => {
    const resolved = { ...base, firstResponseAt: new Date(t0 + H / 2).toISOString(), status: "Resolved" as const, resolvedAt: new Date(t0 + 9 * H).toISOString() };
    expect(resolutionClock(resolved, t0 + 30 * H)?.state).toBe("missed");
    expect(isBreached(resolved, t0 + 30 * H)).toBe(false);
  });

  it("has no reply clock for a ticket closed without a reply, or one without due times", () => {
    expect(firstResponseClock({ ...base, status: "Closed", resolvedAt: created }, t0)).toBeNull();
    expect(currentClock({ ...base, firstResponseDueAt: null, resolutionDueAt: null }, t0).clock).toBeNull();
  });

  it("reads durations people type", () => {
    expect(parseDuration("15m")).toBe(15);
    expect(parseDuration("1h 30m")).toBe(90);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("3d")).toBe(4320);
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("4 hours")).toBeNull();
  });
});
