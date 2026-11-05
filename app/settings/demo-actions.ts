"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/app/lib/audit";
import { requireSession } from "@/app/lib/auth/session";
import { loadDemoData, removeDemoData } from "@/app/lib/db/demo";

export interface DemoState {
  error?: string;
  success?: string;
}

// Admins only: it adds hundreds of tickets to the workspace everyone works in
export async function loadDemoDataAction(): Promise<DemoState> {
  const { agent, org } = await requireSession("workspace.manage");
  try {
    const result = await loadDemoData(org.id, org.slug);
    await audit(org.id, agent, "demo.loaded", null, result);
    revalidatePath("/", "layout");
    return {
      success: `Added ${result.tickets.toLocaleString("en-IN")} tickets, ${result.reviews} quality reviews and ${result.chats.toLocaleString("en-IN")} bot chats from the last 90 days.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not load demo data." };
  }
}

export async function removeDemoDataAction(): Promise<DemoState> {
  const { agent, org } = await requireSession("workspace.manage");
  try {
    const result = await removeDemoData(org.id);
    await audit(org.id, agent, "demo.removed", null, result);
    revalidatePath("/", "layout");
    return { success: `Removed ${result.tickets.toLocaleString("en-IN")} demo tickets and ${result.chats.toLocaleString("en-IN")} demo chats.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not remove demo data." };
  }
}
