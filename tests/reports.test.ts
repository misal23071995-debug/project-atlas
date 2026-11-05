import { describe, expect, it } from "vitest";
import { localDate, resolvePeriod, startOfLocalDay } from "@/app/lib/reports/period";
import { toCsv } from "@/app/lib/reports/csv";

describe("report periods", () => {
  it("finds local midnight, including across a daylight-saving change", () => {
    expect(new Date(startOfLocalDay("2026-11-04", "Asia/Kolkata")).toISOString()).toBe("2026-11-03T18:30:00.000Z");
    expect(new Date(startOfLocalDay("2026-11-01", "America/New_York")).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(localDate(Date.parse("2026-11-03T19:00:00Z"), "Asia/Kolkata")).toBe("2026-11-04");
  });

  it("builds presets and custom ranges, with the previous period the same length", () => {
    const now = Date.parse("2026-11-04T10:00:00Z");
    const week = resolvePeriod({ range: "7d" }, "Asia/Kolkata", now);
    expect([week.fromDate, week.toDate, week.days]).toEqual(["2026-10-29", "2026-11-04", 7]);

    const october = resolvePeriod({ range: "custom", from: "2026-10-01", to: "2026-10-31" }, "Asia/Kolkata", now);
    expect(october.days).toBe(31);
    expect(october.to - october.from).toBe(october.from - october.previousFrom);
  });

  it("falls back to 30 days for anything invalid", () => {
    expect(resolvePeriod({ range: "custom", from: "x", to: "y" }, "Asia/Kolkata").id).toBe("30d");
    expect(resolvePeriod({ range: "nonsense" }, "Asia/Kolkata").id).toBe("30d");
  });
});

describe("CSV export", () => {
  it("quotes commas and quotes, and stops formulas", () => {
    expect(toCsv(["a", "b"], [["=1+1", 'say "hi", ok'], [null, 3]])).toBe('a,b\r\n\'=1+1,"say ""hi"", ok"\r\n,3');
  });
});
