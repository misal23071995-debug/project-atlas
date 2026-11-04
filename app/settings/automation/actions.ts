"use server";

import { revalidatePath } from "next/cache";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import {
  addStarterRules,
  deleteRule,
  moveRule,
  saveAssignmentSettings,
  saveRule,
  setRuleEnabled,
  sweepTimedRules,
} from "@/app/lib/db/automation";
import { ASSIGNMENT_MODES, AUTO_ASSIGN, validateRule, type AssignmentMode, type Rule } from "@/app/lib/automation/types";

export interface ActionResult {
  error?: string;
  success?: string;
}

const done = () => revalidatePath("/settings/automation");
const isId = (id: string) => /^\d+$/.test(id);

export async function saveRuleAction(
  id: string | null,
  input: Pick<Rule, "name" | "enabled" | "trigger" | "waitHours" | "conditions" | "actions">
): Promise<ActionResult> {
  const { agent, org } = await requireSession("automation.manage");
  if (id && !isId(id)) return { error: "Rule not found." };

  const rule = {
    name: String(input.name ?? "").trim(),
    enabled: Boolean(input.enabled),
    trigger: input.trigger,
    waitHours: input.waitHours === null ? null : Math.round(Number(input.waitHours)),
    conditions: (Array.isArray(input.conditions) ? input.conditions : []).map((c) => ({
      field: c.field,
      op: c.op,
      value: String(c.value ?? "").slice(0, 300),
    })),
    actions: (Array.isArray(input.actions) ? input.actions : []).map((a) => ({ type: a.type, value: String(a.value ?? "").slice(0, 1000) })),
  };
  const problem = validateRule(rule);
  if (problem) return { error: problem };

  // An "assign to" action must name someone in this workspace who works tickets
  const names = (await listMembers(org.id)).filter((m) => m.role !== "qa").map((m) => m.name);
  if (rule.actions.some((a) => a.type === "assign" && a.value !== AUTO_ASSIGN && !names.includes(a.value))) {
    return { error: "Choose someone from the team to assign to." };
  }

  try {
    await saveRule(org.id, id, rule, agent.name);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the rule." };
  }
  done();
  return { success: id ? "Rule saved." : "Rule added." };
}

export async function setRuleEnabledAction(id: string, enabled: boolean) {
  const { org } = await requireSession("automation.manage");
  if (!isId(id)) throw new Error("Rule not found");
  await setRuleEnabled(org.id, id, enabled);
  done();
}

export async function moveRuleAction(id: string, direction: "up" | "down") {
  const { org } = await requireSession("automation.manage");
  if (!isId(id)) throw new Error("Rule not found");
  await moveRule(org.id, id, direction === "up" ? "up" : "down");
  done();
}

export async function deleteRuleAction(id: string) {
  const { org } = await requireSession("automation.manage");
  if (!isId(id)) throw new Error("Rule not found");
  await deleteRule(org.id, id);
  done();
}

export async function addStarterRulesAction() {
  const { agent, org } = await requireSession("automation.manage");
  await addStarterRules(org.id, agent.name);
  done();
}

export async function saveAssignmentAction(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const { org } = await requireSession("automation.manage");
  const mode = String(formData.get("mode") ?? "off") as AssignmentMode;
  if (!ASSIGNMENT_MODES.includes(mode)) return { error: "Choose how tickets are assigned." };

  const allowed = new Set((await listMembers(org.id)).filter((m) => m.role !== "qa").map((m) => m.id));
  const userIds = formData.getAll("userIds").map(String).filter((id) => allowed.has(id));
  // Ticking everyone is the same as leaving everyone in, including people added later
  const everyone = userIds.length === allowed.size;

  try {
    await saveAssignmentSettings(org.id, { mode, onlyOnShift: formData.get("onlyOnShift") === "on", userIds: everyone ? [] : userIds });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save." };
  }
  done();
  return { success: "Assignment saved." };
}

// Runs the SLA-breach and waiting rules straight away instead of on the next page load
export async function runTimedRulesNowAction(): Promise<ActionResult> {
  const { org } = await requireSession("automation.manage");
  const result = await sweepTimedRules(org.id, true);
  done();
  revalidatePath("/tickets");
  return {
    success: result.fired
      ? `Checked ${result.checked} open tickets; rules acted on ${result.fired}.`
      : `Checked ${result.checked} open tickets; none needed a time-based rule.`,
  };
}
