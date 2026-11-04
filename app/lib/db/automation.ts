import "server-only";
import { getSupabase } from "./supabase";
import { addActivity, addNote, updateTicket } from "./tickets";
import { getCapacitySettings } from "./capacity";
import { listLeave, listShifts } from "./roster";
import { listMembers } from "@/app/lib/auth/session";
import { DEFAULT_SETTINGS } from "@/app/lib/capacity/model";
import { addDays, localDate } from "@/app/lib/reports/period";
import { isBreached, isDone, type TicketSla } from "@/app/lib/sla";
import { leaveCovers } from "@/app/lib/roster/types";
import {
  AUTO_ASSIGN,
  STARTER_RULES,
  describeAction,
  matches,
  onShiftNow,
  pickAssignee,
  type Action,
  type AssignmentMode,
  type AssignmentSettings,
  type Condition,
  type Rule,
  type TicketFacts,
  type Trigger,
} from "@/app/lib/automation/types";
import type { TicketPriority, TicketStatus } from "@/app/lib/tickets";

// Rules and assignment for one workspace. Every function takes the workspace id.

// ---- Rules ----

type RuleRow = {
  id: number;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  wait_hours: number | null;
  conditions: Condition[];
  actions: Action[];
  position: number;
  run_count: number;
  last_run_at: string | null;
};

const RULE_COLUMNS = "id, name, enabled, trigger, wait_hours, conditions, actions, position, run_count, last_run_at";

const toRule = (row: RuleRow): Rule => ({
  id: String(row.id),
  name: row.name,
  enabled: row.enabled,
  trigger: row.trigger,
  waitHours: row.wait_hours,
  conditions: row.conditions ?? [],
  actions: row.actions ?? [],
  position: row.position,
  runCount: row.run_count,
  lastRunAt: row.last_run_at,
});

// Null until migration 014 has been run
export async function listRules(orgId: string, trigger?: Trigger): Promise<Rule[] | null> {
  let query = getSupabase().from("automation_rules").select(RULE_COLUMNS).eq("org_id", orgId);
  if (trigger) query = query.eq("trigger", trigger).eq("enabled", true);
  const { data, error } = await query.order("position").order("id").returns<RuleRow[]>();
  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load automation rules: ${error.message}`);
  return data.map(toRule);
}

export type RuleInput = Pick<Rule, "name" | "enabled" | "trigger" | "waitHours" | "conditions" | "actions">;

export async function saveRule(orgId: string, id: string | null, input: RuleInput, author: string) {
  const supabase = getSupabase();
  const values = {
    name: input.name.trim(),
    enabled: input.enabled,
    trigger: input.trigger,
    wait_hours: input.trigger === "waiting_on_customer" ? input.waitHours : null,
    conditions: input.conditions,
    actions: input.actions,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("automation_rules").update(values).eq("org_id", orgId).eq("id", id);
    if (error) throw new Error(`Failed to save the rule: ${error.message}`);
    return id;
  }

  // New rules go to the end
  const { data: last } = await supabase
    .from("automation_rules")
    .select("position")
    .eq("org_id", orgId)
    .order("position", { ascending: false })
    .limit(1);
  const { data, error } = await supabase
    .from("automation_rules")
    .insert({ ...values, org_id: orgId, created_by: author, position: (last?.[0]?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to save the rule: ${error.message}`);
  return String(data.id);
}

export async function setRuleEnabled(orgId: string, id: string, enabled: boolean) {
  const { error } = await getSupabase()
    .from("automation_rules")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("id", id);
  if (error) throw new Error(`Failed to update the rule: ${error.message}`);
}

export async function deleteRule(orgId: string, id: string) {
  const { error } = await getSupabase().from("automation_rules").delete().eq("org_id", orgId).eq("id", id);
  if (error) throw new Error(`Failed to delete the rule: ${error.message}`);
}

// Swaps a rule with its neighbour, so it runs earlier or later
export async function moveRule(orgId: string, id: string, direction: "up" | "down") {
  const rules = (await listRules(orgId)) ?? [];
  const index = rules.findIndex((r) => r.id === id);
  const other = rules[direction === "up" ? index - 1 : index + 1];
  if (index < 0 || !other) return;

  const supabase = getSupabase();
  // Number them in order first, so equal positions can't stop the swap
  await Promise.all(rules.map((r, i) => supabase.from("automation_rules").update({ position: i }).eq("org_id", orgId).eq("id", r.id)));
  const otherIndex = direction === "up" ? index - 1 : index + 1;
  await supabase.from("automation_rules").update({ position: otherIndex }).eq("org_id", orgId).eq("id", id);
  await supabase.from("automation_rules").update({ position: index }).eq("org_id", orgId).eq("id", other.id);
}

export async function addStarterRules(orgId: string, author: string) {
  const { error } = await getSupabase()
    .from("automation_rules")
    .insert(
      STARTER_RULES.map((r, i) => ({
        org_id: orgId,
        name: r.name,
        enabled: r.enabled,
        trigger: r.trigger,
        wait_hours: r.waitHours,
        conditions: r.conditions,
        actions: r.actions,
        position: i,
        created_by: author,
      }))
    );
  if (error) throw new Error(`Failed to add the starter rules: ${error.message}`);
}

// ---- Assignment settings ----

type AssignmentRow = {
  mode: AssignmentMode;
  only_on_shift: boolean;
  user_ids: string[];
  last_assigned_user_id: string | null;
  last_sweep_at: string | null;
};

const DEFAULT_ASSIGNMENT: AssignmentSettings = { mode: "off", onlyOnShift: false, userIds: [], lastAssignedUserId: null };

async function assignmentRow(orgId: string) {
  const { data, error } = await getSupabase()
    .from("assignment_settings")
    .select("mode, only_on_shift, user_ids, last_assigned_user_id, last_sweep_at")
    .eq("org_id", orgId)
    .returns<AssignmentRow[]>()
    .maybeSingle();
  if (error?.code === "PGRST205") return undefined;
  if (error) throw new Error(`Failed to load assignment settings: ${error.message}`);
  return data;
}

// Null until migration 014 has been run
export async function getAssignmentSettings(orgId: string): Promise<AssignmentSettings | null> {
  const row = await assignmentRow(orgId);
  if (row === undefined) return null;
  if (!row) return DEFAULT_ASSIGNMENT;
  return { mode: row.mode, onlyOnShift: row.only_on_shift, userIds: row.user_ids ?? [], lastAssignedUserId: row.last_assigned_user_id };
}

export async function saveAssignmentSettings(orgId: string, settings: Pick<AssignmentSettings, "mode" | "onlyOnShift" | "userIds">) {
  const { error } = await getSupabase().from("assignment_settings").upsert(
    {
      org_id: orgId,
      mode: settings.mode,
      only_on_shift: settings.onlyOnShift,
      user_ids: settings.userIds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );
  if (error) throw new Error(`Failed to save assignment settings: ${error.message}`);
}

// ---- Running rules ----

type FactsRow = {
  id: number;
  subject: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  channel: string;
  category: string;
  sentiment: string;
  tags: string[];
  assigned_to: string;
  created_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  sla_paused_at: string | null;
  sla_paused_minutes: number;
  customer: { email: string } | null;
};

const FACT_COLUMNS =
  "id, subject, description, priority, status, channel, category, sentiment, tags, assigned_to, created_at, first_response_at, resolved_at, first_response_due_at, resolution_due_at, sla_paused_at, sla_paused_minutes, customer:customers (email)";

const toFacts = (t: FactsRow): TicketFacts => ({
  channel: t.channel,
  category: t.category,
  priority: t.priority,
  status: t.status,
  sentiment: t.sentiment,
  text: `${t.subject}\n${t.description}`,
  customer_email: t.customer?.email ?? "",
  assigned_to: t.assigned_to,
});

const toSla = (t: FactsRow): TicketSla => ({
  priority: t.priority,
  status: t.status,
  createdAt: t.created_at,
  firstResponseAt: t.first_response_at,
  resolvedAt: t.resolved_at,
  firstResponseDueAt: t.first_response_due_at,
  resolutionDueAt: t.resolution_due_at,
  slaPausedAt: t.sla_paused_at,
  slaPausedMinutes: t.sla_paused_minutes ?? 0,
});

async function loadTicket(orgId: string, ticketId: string) {
  const { data, error } = await getSupabase()
    .from("tickets")
    .select(FACT_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", ticketId)
    .returns<FactsRow[]>()
    .maybeSingle();
  if (error) throw new Error(`Failed to load ticket: ${error.message}`);
  return data;
}

// Does one action and returns what it changed, for the next rule to see
async function apply(orgId: string, ticket: FactsRow, action: Action): Promise<Partial<FactsRow>> {
  const id = String(ticket.id);
  switch (action.type) {
    case "set_priority":
      if (ticket.priority === action.value) return {};
      await updateTicket(orgId, id, { priority: action.value as TicketPriority });
      return { priority: action.value as TicketPriority };
    case "set_status":
      if (ticket.status === action.value) return {};
      await updateTicket(orgId, id, { status: action.value as TicketStatus });
      return { status: action.value as TicketStatus };
    case "assign": {
      const name = action.value === AUTO_ASSIGN ? await chooseAssignee(orgId) : action.value;
      if (!name || name === ticket.assigned_to) return {};
      await updateTicket(orgId, id, { assignedTo: name });
      return { assigned_to: name };
    }
    case "add_tag": {
      const tag = action.value.trim().slice(0, 50);
      if (ticket.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return {};
      const tags = [...ticket.tags, tag].slice(0, 20);
      const { error } = await getSupabase().from("tickets").update({ tags }).eq("org_id", orgId).eq("id", id);
      if (error) throw new Error(`Failed to tag the ticket: ${error.message}`);
      return { tags };
    }
    case "add_note":
      await addNote(orgId, id, "Automation", action.value.slice(0, 1000));
      return {};
  }
}

// Runs every enabled rule for this trigger, in order, on one ticket. Later rules see earlier rules' changes.
// Never throws: a broken rule shouldn't stop a ticket being created or a reply being saved.
export async function runRules(orgId: string, ticketId: string, trigger: Trigger) {
  try {
    const rules = await listRules(orgId, trigger);
    if (!rules?.length) return [];
    let ticket = await loadTicket(orgId, ticketId);
    if (!ticket) return [];

    const fired: string[] = [];
    for (const rule of rules) {
      if (!matches(toFacts(ticket), rule.conditions)) continue;
      const done: string[] = [];
      for (const action of rule.actions) {
        const changes = await apply(orgId, ticket, action);
        if (Object.keys(changes).length || action.type === "add_note") done.push(describeAction(action));
        ticket = { ...ticket, ...changes };
      }
      fired.push(rule.name);
      await recordRun(orgId, rule, ticket.id);
      if (done.length) await addActivity(orgId, ticketId, `Automation “${rule.name}”: ${done.join(", ")}`, "bg-violet-500");
    }
    return fired;
  } catch (err) {
    console.error("Automation failed:", err);
    return [];
  }
}

async function recordRun(orgId: string, rule: Rule, ticketId: number) {
  const supabase = getSupabase();
  await Promise.all([
    supabase
      .from("automation_rules")
      .update({ run_count: rule.runCount + 1, last_run_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("id", rule.id),
    supabase.from("automation_runs").upsert({ rule_id: rule.id, ticket_id: ticketId }, { onConflict: "rule_id,ticket_id" }),
  ]);
  rule.runCount += 1;
}

// ---- Assignment ----

// Who should get the next ticket under the workspace's method, or null if nobody is available
async function chooseAssignee(orgId: string) {
  const settings = await getAssignmentSettings(orgId);
  if (!settings || settings.mode === "off") return null;

  let people = (await listMembers(orgId)).filter((m) => m.role !== "qa");
  if (settings.userIds.length) people = people.filter((m) => settings.userIds.includes(m.id));

  if (settings.onlyOnShift && people.length) {
    // Shifts are in the team's local time, the same zone the roster and capacity plan use
    const timezone = (await getCapacitySettings(orgId))?.timezone ?? DEFAULT_SETTINGS.timezone;
    const now = Date.now();
    const today = localDate(now, timezone);
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const minute = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
    const yesterday = addDays(today, -1);
    const [shifts, leave] = await Promise.all([listShifts(orgId, yesterday, today), listLeave(orgId, { from: today, to: today })]);
    const working = onShiftNow(shifts ?? [], today, yesterday, minute);
    const away = new Set((leave ?? []).filter((l) => l.status === "approved" && leaveCovers(l, today)).map((l) => l.userId));
    people = people.filter((m) => working.has(m.id) && !away.has(m.id));
  }
  if (!people.length) return null;

  // Open tickets per person, for "fewest open tickets"
  const { data, error } = await getSupabase()
    .from("tickets")
    .select("assigned_to")
    .eq("org_id", orgId)
    .not("status", "in", "(Resolved,Closed)")
    .in("assigned_to", people.map((m) => m.name));
  if (error) throw new Error(`Failed to count open tickets: ${error.message}`);
  const open = new Map<string, number>();
  for (const row of data) open.set(row.assigned_to, (open.get(row.assigned_to) ?? 0) + 1);

  const pick = pickAssignee(
    settings.mode,
    people.map((m) => ({ id: m.id, name: m.name, openTickets: open.get(m.name) ?? 0 })),
    settings.lastAssignedUserId
  );
  if (!pick) return null;

  await getSupabase().from("assignment_settings").update({ last_assigned_user_id: pick.id }).eq("org_id", orgId);
  return pick.name;
}

// Gives an unassigned ticket an owner under the workspace's method. Never throws.
export async function autoAssign(orgId: string, ticketId: string) {
  try {
    const ticket = await loadTicket(orgId, ticketId);
    if (!ticket || ticket.assigned_to !== "Unassigned" || isDone(ticket.status)) return null;
    const name = await chooseAssignee(orgId);
    if (!name) return null;
    await updateTicket(orgId, ticketId, { assignedTo: name });
    await addActivity(orgId, ticketId, `Assigned to ${name} automatically`, "bg-purple-500");
    return name;
  } catch (err) {
    console.error("Auto-assignment failed:", err);
    return null;
  }
}

// A new ticket: rules first (they may set priority or pick an owner), then assignment if nobody owns it
export async function onTicketCreated(orgId: string, ticketId: string) {
  await runRules(orgId, ticketId, "ticket_created");
  await autoAssign(orgId, ticketId);
}

// ---- Time-based rules ----

const SWEEP_EVERY_MS = 5 * 60 * 1000;

// Runs SLA-breach and waiting rules on tickets that newly qualify. Called in the background after
// pages load, at most every five minutes per workspace. Each rule acts on a ticket once.
export async function sweepTimedRules(orgId: string, force = false) {
  try {
    const row = await assignmentRow(orgId);
    if (row === undefined) return { checked: 0, fired: 0 };
    if (!force && row?.last_sweep_at && Date.now() - Date.parse(row.last_sweep_at) < SWEEP_EVERY_MS) return { checked: 0, fired: 0 };
    await getSupabase().from("assignment_settings").upsert({ org_id: orgId, last_sweep_at: new Date().toISOString() }, { onConflict: "org_id" });

    const [breachRules, waitRules] = await Promise.all([listRules(orgId, "sla_breached"), listRules(orgId, "waiting_on_customer")]);
    const rules = [...(breachRules ?? []), ...(waitRules ?? [])];
    if (!rules.length) return { checked: 0, fired: 0 };

    const supabase = getSupabase();
    const { data: open, error } = await supabase
      .from("tickets")
      .select(FACT_COLUMNS)
      .eq("org_id", orgId)
      .not("status", "in", "(Resolved,Closed)")
      .limit(2000)
      .returns<FactsRow[]>();
    if (error) throw new Error(error.message);

    const { data: runs } = await supabase
      .from("automation_runs")
      .select("rule_id, ticket_id")
      .in("rule_id", rules.map((r) => r.id));
    const already = new Set((runs ?? []).map((r) => `${r.rule_id}:${r.ticket_id}`));

    const now = Date.now();
    let fired = 0;
    for (const ticket of open) {
      const due = rules.filter((rule) => {
        if (already.has(`${rule.id}:${ticket.id}`)) return false;
        if (rule.trigger === "sla_breached") return isBreached(toSla(ticket), now);
        return ticket.status === "Waiting on Customer" && !!ticket.sla_paused_at && now - Date.parse(ticket.sla_paused_at) >= (rule.waitHours ?? 0) * 3600_000;
      });
      // Same as runRules, but only for the rules this ticket newly qualifies for
      let current = ticket;
      for (const rule of due) {
        if (!matches(toFacts(current), rule.conditions)) continue;
        const done: string[] = [];
        for (const action of rule.actions) {
          const changes = await apply(orgId, current, action);
          if (Object.keys(changes).length || action.type === "add_note") done.push(describeAction(action));
          current = { ...current, ...changes };
        }
        await recordRun(orgId, rule, ticket.id);
        if (done.length) await addActivity(orgId, String(ticket.id), `Automation “${rule.name}”: ${done.join(", ")}`, "bg-violet-500");
        fired += 1;
      }
    }
    return { checked: open.length, fired };
  } catch (err) {
    console.error("Timed automation failed:", err);
    return { checked: 0, fired: 0 };
  }
}
