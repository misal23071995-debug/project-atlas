import "server-only";
import { getSupabase } from "./supabase";
import { DEFAULT_SLA_TARGETS, type SlaTargets } from "@/app/lib/sla";
import { TICKET_PRIORITIES, type TicketPriority } from "@/app/lib/tickets";

type TargetRow = {
  priority: TicketPriority;
  first_response_minutes: number;
  resolution_minutes: number;
};

// The workspace's targets, with the defaults for any priority it hasn't set. Null until migration 011 has been run.
export async function getSlaTargets(orgId: string): Promise<SlaTargets | null> {
  const { data, error } = await getSupabase()
    .from("sla_targets")
    .select("priority, first_response_minutes, resolution_minutes")
    .eq("org_id", orgId)
    .returns<TargetRow[]>();

  if (error?.code === "PGRST205") return null;
  if (error) throw new Error(`Failed to load SLA targets: ${error.message}`);

  const targets = { ...DEFAULT_SLA_TARGETS };
  for (const row of data) {
    targets[row.priority] = {
      firstResponseMinutes: row.first_response_minutes,
      resolutionMinutes: row.resolution_minutes,
    };
  }
  return targets;
}

// Applies to tickets created (or re-prioritised) from now on; existing due times stay as they were
export async function saveSlaTargets(orgId: string, targets: SlaTargets) {
  const now = new Date().toISOString();
  const { error } = await getSupabase()
    .from("sla_targets")
    .upsert(
      TICKET_PRIORITIES.map((priority) => ({
        org_id: orgId,
        priority,
        first_response_minutes: targets[priority].firstResponseMinutes,
        resolution_minutes: targets[priority].resolutionMinutes,
        updated_at: now,
      })),
      { onConflict: "org_id,priority" }
    );

  if (error) throw new Error(`Failed to save SLA targets: ${error.message}`);
}
