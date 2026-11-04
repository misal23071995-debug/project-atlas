// Automation rules: when something happens to a ticket and it matches every condition, run the actions.
// Safe to import from Client Components.

import { KB_CATEGORIES } from "@/app/lib/bot/types";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/app/lib/tickets";

export const TRIGGERS = ["ticket_created", "customer_replied", "sla_breached", "waiting_on_customer"] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const TRIGGER_LABELS: Record<Trigger, string> = {
  ticket_created: "A ticket is created",
  customer_replied: "The customer replies",
  sla_breached: "A ticket breaches its SLA",
  waiting_on_customer: "A ticket has waited on the customer for",
};

// Time-based triggers are checked in the background, so they act a few minutes late at most
export const TIMED_TRIGGERS: Trigger[] = ["sla_breached", "waiting_on_customer"];

export const CHANNELS = ["Email", "AI Chatbot", "Chat", "Phone", "Social"];
export const SENTIMENTS = ["Angry", "Frustrated", "Neutral", "Positive"];

export const FIELDS = {
  channel: { label: "Channel", options: CHANNELS },
  category: { label: "Category", options: [...KB_CATEGORIES] as string[] },
  priority: { label: "Priority", options: [...TICKET_PRIORITIES] as string[] },
  status: { label: "Status", options: [...TICKET_STATUSES] as string[] },
  sentiment: { label: "Sentiment", options: SENTIMENTS },
  text: { label: "Subject or message", options: null },
  customer_email: { label: "Customer email", options: null },
  assigned_to: { label: "Assigned to", options: null },
} as const;

export type Field = keyof typeof FIELDS;

export const OPERATORS = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "doesn't contain",
} as const;

export type Operator = keyof typeof OPERATORS;

// Fields with a fixed list compare exactly; free-text fields can also look for words
export function operatorsFor(field: Field): Operator[] {
  return FIELDS[field].options ? ["is", "is_not"] : ["contains", "not_contains", "is", "is_not"];
}

export interface Condition {
  field: Field;
  op: Operator;
  value: string;
}

export const ACTIONS = {
  set_priority: { label: "Set priority to", options: [...TICKET_PRIORITIES] as string[] },
  set_status: { label: "Set status to", options: [...TICKET_STATUSES] as string[] },
  assign: { label: "Assign to", options: null },
  add_tag: { label: "Add tag", options: null },
  add_note: { label: "Add internal note", options: null },
} as const;

export type ActionType = keyof typeof ACTIONS;

// assign takes an agent's name, or AUTO_ASSIGN to use the workspace's assignment method
export const AUTO_ASSIGN = "auto";

export interface Action {
  type: ActionType;
  value: string;
}

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  waitHours: number | null;
  conditions: Condition[];
  actions: Action[];
  position: number;
  runCount: number;
  lastRunAt: string | null;
}

export const MAX_CONDITIONS = 8;
export const MAX_ACTIONS = 6;

// What a rule can look at on a ticket
export interface TicketFacts {
  channel: string;
  category: string;
  priority: string;
  status: string;
  sentiment: string;
  text: string;
  customer_email: string;
  assigned_to: string;
}

function test(actual: string, op: Operator, expected: string) {
  const a = actual.toLowerCase();
  const e = expected.trim().toLowerCase();
  switch (op) {
    case "is":
      return a === e;
    case "is_not":
      return a !== e;
    case "contains":
      // Several words separated by commas: any of them counts
      return e.split(",").map((w) => w.trim()).filter(Boolean).some((w) => a.includes(w));
    case "not_contains":
      return !e.split(",").map((w) => w.trim()).filter(Boolean).some((w) => a.includes(w));
  }
}

// Every condition must match; a rule with no conditions matches every ticket
export function matches(facts: TicketFacts, conditions: Condition[]) {
  return conditions.every((c) => test(facts[c.field] ?? "", c.op, c.value));
}

export function describeAction(action: Action) {
  if (action.type === "assign") return action.value === AUTO_ASSIGN ? "assigned automatically" : `assigned to ${action.value}`;
  if (action.type === "add_tag") return `tagged "${action.value}"`;
  if (action.type === "add_note") return "added a note";
  return `${ACTIONS[action.type].label.toLowerCase()} ${action.value}`;
}

// Checks a rule from the editor; returns what's wrong, or null
export function validateRule(rule: Pick<Rule, "name" | "trigger" | "waitHours" | "conditions" | "actions">): string | null {
  if (!rule.name.trim() || rule.name.length > 80) return "Give the rule a name of up to 80 characters.";
  if (!TRIGGERS.includes(rule.trigger)) return "Choose when the rule runs.";
  if (rule.trigger === "waiting_on_customer" && !(rule.waitHours && rule.waitHours >= 1 && rule.waitHours <= 2160)) {
    return "Choose how long to wait, from 1 hour to 90 days.";
  }
  if (rule.conditions.length > MAX_CONDITIONS) return `Use up to ${MAX_CONDITIONS} conditions.`;
  for (const c of rule.conditions) {
    if (!(c.field in FIELDS) || !operatorsFor(c.field).includes(c.op)) return "One of the conditions isn't complete.";
    if (!c.value.trim()) return `Fill in the value for "${FIELDS[c.field].label}".`;
  }
  if (!rule.actions.length) return "Add at least one action.";
  if (rule.actions.length > MAX_ACTIONS) return `Use up to ${MAX_ACTIONS} actions.`;
  for (const a of rule.actions) {
    if (!(a.type in ACTIONS) || !a.value.trim()) return "One of the actions isn't complete.";
    const options = ACTIONS[a.type].options as readonly string[] | null;
    if (options && !options.includes(a.value)) return "One of the actions has a value that isn't allowed.";
    if (a.value.length > 1000) return "Keep notes under 1,000 characters.";
  }
  return null;
}

// Offered to a workspace with no rules yet: common rules a support lead sets up first
export const STARTER_RULES: Omit<Rule, "id" | "position" | "runCount" | "lastRunAt">[] = [
  {
    name: "Payment problems are urgent",
    enabled: true,
    trigger: "ticket_created",
    waitHours: null,
    conditions: [{ field: "text", op: "contains", value: "charged twice, double charged, refund not received, fraud" }],
    actions: [
      { type: "set_priority", value: "Urgent" },
      { type: "add_tag", value: "Billing" },
    ],
  },
  {
    name: "Angry customers go to the top",
    enabled: true,
    trigger: "ticket_created",
    waitHours: null,
    conditions: [{ field: "sentiment", op: "is", value: "Angry" }],
    actions: [{ type: "set_priority", value: "High" }],
  },
  {
    name: "Escalate SLA breaches",
    enabled: true,
    trigger: "sla_breached",
    waitHours: null,
    conditions: [{ field: "priority", op: "is", value: "Urgent" }],
    actions: [
      { type: "set_status", value: "Escalated" },
      { type: "add_note", value: "This urgent ticket missed its SLA. A lead should check it now." },
    ],
  },
  {
    name: "Close tickets after 3 days without a reply",
    enabled: true,
    trigger: "waiting_on_customer",
    waitHours: 72,
    conditions: [],
    actions: [
      { type: "set_status", value: "Resolved" },
      { type: "add_note", value: "Closed automatically after 3 days without a reply from the customer." },
    ],
  },
  {
    name: "Assign customer replies nobody owns",
    enabled: false,
    trigger: "customer_replied",
    waitHours: null,
    conditions: [{ field: "assigned_to", op: "is", value: "Unassigned" }],
    actions: [{ type: "assign", value: AUTO_ASSIGN }],
  },
];

// ---- Assignment ----

export const ASSIGNMENT_MODES = ["off", "round_robin", "least_busy"] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

export const ASSIGNMENT_LABELS: Record<AssignmentMode, string> = {
  off: "Off: people pick tickets themselves",
  round_robin: "Take turns (round robin)",
  least_busy: "Whoever has the fewest open tickets",
};

export interface AssignmentSettings {
  mode: AssignmentMode;
  onlyOnShift: boolean;
  // Empty means everyone who works tickets
  userIds: string[];
  lastAssignedUserId: string | null;
}

export interface Candidate {
  id: string;
  name: string;
  openTickets: number;
}

// Who gets the next ticket. Candidates are already filtered to those allowed and on shift.
export function pickAssignee(mode: AssignmentMode, candidates: Candidate[], lastAssignedUserId: string | null) {
  if (mode === "off" || !candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name));

  if (mode === "least_busy") {
    const fewest = Math.min(...sorted.map((c) => c.openTickets));
    const tied = sorted.filter((c) => c.openTickets === fewest);
    // Among people level on tickets, take turns
    return nextAfter(tied, lastAssignedUserId);
  }
  return nextAfter(sorted, lastAssignedUserId);
}

function nextAfter(list: Candidate[], lastId: string | null) {
  const index = list.findIndex((c) => c.id === lastId);
  return list[(index + 1) % list.length];
}

// Is someone working right now? Minutes are local; a shift from yesterday can run past midnight.
export function onShiftNow(
  shifts: { userId: string; date: string; startMinute: number; endMinute: number }[],
  today: string,
  yesterday: string,
  minute: number
) {
  const working = new Set<string>();
  for (const s of shifts) {
    if (s.date === today && s.startMinute <= minute && minute < s.endMinute) working.add(s.userId);
    if (s.date === yesterday && s.endMinute > 1440 && minute + 1440 < s.endMinute) working.add(s.userId);
  }
  return working;
}
