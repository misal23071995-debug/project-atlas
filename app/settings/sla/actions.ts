"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/app/lib/auth/session";
import { saveSlaTargets } from "@/app/lib/db/sla";
import {
  MAX_FIRST_RESPONSE_MINUTES,
  MAX_RESOLUTION_MINUTES,
  formatMinutes,
  parseDuration,
  type SlaTargets,
} from "@/app/lib/sla";
import { TICKET_PRIORITIES } from "@/app/lib/tickets";

export interface SlaFormState {
  error?: string;
  success?: string;
}

export async function saveSlaTargetsAction(_previous: SlaFormState, formData: FormData): Promise<SlaFormState> {
  const { org } = await requireSession("sla.manage");
  const targets = {} as SlaTargets;

  for (const priority of TICKET_PRIORITIES) {
    const reply = parseDuration(String(formData.get(`${priority}.reply`) ?? ""));
    const resolve = parseDuration(String(formData.get(`${priority}.resolve`) ?? ""));

    if (!reply || reply > MAX_FIRST_RESPONSE_MINUTES) {
      return { error: `${priority}: enter a first reply time like 15m, 4h or 1d (up to ${formatMinutes(MAX_FIRST_RESPONSE_MINUTES)}).` };
    }
    if (!resolve || resolve > MAX_RESOLUTION_MINUTES) {
      return { error: `${priority}: enter a resolution time like 8h or 3d (up to ${formatMinutes(MAX_RESOLUTION_MINUTES)}).` };
    }
    if (resolve < reply) {
      return { error: `${priority}: the resolution time can't be shorter than the first reply time.` };
    }
    targets[priority] = { firstResponseMinutes: reply, resolutionMinutes: resolve };
  }

  try {
    await saveSlaTargets(org.id, targets);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the targets." };
  }

  revalidatePath("/settings/sla");
  return { success: "Targets saved. They apply to new tickets and to tickets whose priority changes." };
}
