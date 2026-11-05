import { describe, expect, it } from "vitest";
import { STARTER_RULES, matches, onShiftNow, pickAssignee, validateRule, type TicketFacts } from "@/app/lib/automation/types";

const facts: TicketFacts = {
  channel: "Email",
  category: "Returns & Refunds",
  priority: "Medium",
  status: "Open",
  sentiment: "Angry",
  text: "I was CHARGED TWICE this month",
  customer_email: "a@vip.example",
  assigned_to: "Unassigned",
};

describe("rule conditions", () => {
  it("matches every condition, case-insensitively", () => {
    expect(matches(facts, [])).toBe(true);
    expect(matches(facts, [{ field: "channel", op: "is", value: "email" }])).toBe(true);
    expect(matches(facts, [{ field: "channel", op: "is_not", value: "Email" }])).toBe(false);
    expect(matches(facts, [{ field: "text", op: "contains", value: "fraud, charged twice" }])).toBe(true);
    expect(matches(facts, [{ field: "text", op: "not_contains", value: "refund" }])).toBe(true);
    expect(matches(facts, [{ field: "sentiment", op: "is", value: "Angry" }, { field: "priority", op: "is", value: "High" }])).toBe(false);
  });

  it("accepts the starter rules and rejects incomplete ones", () => {
    for (const rule of STARTER_RULES) expect(validateRule(rule)).toBeNull();
    const base = { name: "x", trigger: "ticket_created" as const, waitHours: null, conditions: [] };
    expect(validateRule({ ...base, actions: [] })).toBe("Add at least one action.");
    expect(validateRule({ ...base, actions: [{ type: "set_priority", value: "Mega" }] })).toMatch(/isn't allowed/);
    expect(validateRule({ ...base, trigger: "waiting_on_customer", actions: [{ type: "add_tag", value: "a" }] })).toMatch(/how long to wait/);
    expect(validateRule({ ...base, conditions: [{ field: "priority", op: "contains", value: "Hi" }], actions: [{ type: "add_tag", value: "a" }] })).toMatch(/isn't complete/);
  });
});

describe("assignment", () => {
  const people = [
    { id: "b", name: "Bea", openTickets: 3 },
    { id: "a", name: "Ann", openTickets: 1 },
    { id: "c", name: "Cal", openTickets: 1 },
  ];

  it("takes turns in name order", () => {
    expect(pickAssignee("round_robin", people, null)?.name).toBe("Ann");
    expect(pickAssignee("round_robin", people, "a")?.name).toBe("Bea");
    expect(pickAssignee("round_robin", people, "c")?.name).toBe("Ann");
  });

  it("picks whoever has fewest open tickets, taking turns on a tie", () => {
    expect(pickAssignee("least_busy", people, null)?.name).toBe("Ann");
    expect(pickAssignee("least_busy", people, "a")?.name).toBe("Cal");
  });

  it("assigns nobody when off or when nobody is available", () => {
    expect(pickAssignee("off", people, null)).toBeNull();
    expect(pickAssignee("round_robin", [], null)).toBeNull();
  });

  it("knows who is on shift, including overnight shifts from yesterday", () => {
    const shifts = [
      { userId: "day", date: "2026-11-05", startMinute: 540, endMinute: 1050 },
      { userId: "night", date: "2026-11-04", startMinute: 1320, endMinute: 1830 },
      { userId: "later", date: "2026-11-05", startMinute: 840, endMinute: 1350 },
    ];
    expect([...onShiftNow(shifts, "2026-11-05", "2026-11-04", 600)]).toEqual(["day"]);
    expect([...onShiftNow(shifts, "2026-11-05", "2026-11-04", 120)]).toEqual(["night"]);
    expect([...onShiftNow(shifts, "2026-11-05", "2026-11-04", 900)].sort()).toEqual(["day", "later"]);
  });
});
