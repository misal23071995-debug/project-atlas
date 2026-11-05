import "server-only";
import { getSupabase } from "@/app/lib/db/supabase";

// Who changed what in a workspace. Admins read it in Settings → Audit log.

export const AUDIT_ACTIONS = {
  "member.added": "Added a team member",
  "member.invited": "Invited a team member",
  "member.role_changed": "Changed a role",
  "member.removed": "Removed a team member",
  "workspace.renamed": "Renamed the workspace",
  "sla.saved": "Changed SLA targets",
  "automation.rule_saved": "Saved an automation rule",
  "automation.rule_deleted": "Deleted an automation rule",
  "automation.rule_toggled": "Turned a rule on or off",
  "automation.assignment_saved": "Changed ticket assignment",
  "automation.starters_added": "Added the starter rules",
  "email.settings_saved": "Changed email settings",
  "email.address_changed": "Made a new incoming email address",
  "replies.saved": "Saved a reply",
  "replies.deleted": "Deleted a saved reply",
  "quality.scorecard_saved": "Changed the QC scorecard",
  "capacity.settings_saved": "Changed capacity settings",
  "order.cancelled": "Cancelled an order",
  "order.refunded": "Refunded an order",
  "demo.loaded": "Loaded demo data",
  "demo.removed": "Removed demo data",
  "security.password_changed": "Changed their password",
  "security.2fa_on": "Turned on two-step sign-in",
  "security.2fa_off": "Turned off two-step sign-in",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

// Records one change. Never throws: a failed log entry mustn't undo or block the change itself.
export async function audit(
  orgId: string,
  actor: { id: string; name: string },
  action: AuditAction,
  target?: string | null,
  details: Record<string, unknown> = {}
) {
  try {
    const { error } = await getSupabase()
      .from("audit_log")
      .insert({ org_id: orgId, actor_id: actor.id, actor_name: actor.name, action, target: target?.slice(0, 200) ?? null, details });
    // PGRST205: migration 017 not run yet
    if (error && error.code !== "PGRST205") throw new Error(error.message);
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

export interface AuditEntry {
  id: string;
  actorName: string;
  action: string;
  target: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

// Newest first. Null until migration 017 has been run.
export async function listAudit(orgId: string, { action, limit = 200 }: { action?: string; limit?: number } = {}): Promise<AuditEntry[] | null> {
  let query = getSupabase()
    .from("audit_log")
    .select("id, actor_name, action, target, details, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (action) query = query.like("action", `${action.replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load the audit log: ${error.message}`);
  return data.map((r) => ({
    id: String(r.id),
    actorName: r.actor_name,
    action: r.action,
    target: r.target,
    details: r.details ?? {},
    createdAt: r.created_at,
  }));
}
