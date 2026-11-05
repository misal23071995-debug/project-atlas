"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/app/lib/audit";
import { requireSession } from "@/app/lib/auth/session";
import { receiveEmail, regenerateInboundKey, saveEmailSettings } from "@/app/lib/db/email";
import { normalizeInbound } from "@/app/lib/email/parse";

export interface EmailFormState {
  error?: string;
  success?: string;
  ticketId?: string;
}

export async function saveEmailSettingsAction(_previous: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const { agent, org } = await requireSession("email.manage");
  try {
    await saveEmailSettings(org.id, {
      fromName: String(formData.get("fromName") ?? "").trim().slice(0, 80) || null,
      signature: String(formData.get("signature") ?? "").trim().slice(0, 1000),
      autoAcknowledge: formData.get("autoAcknowledge") === "on",
      surveyOnResolve: formData.get("surveyOnResolve") === "on",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save." };
  }
  await audit(org.id, agent, "email.settings_saved", null, { autoAcknowledge: formData.get("autoAcknowledge") === "on", surveyOnResolve: formData.get("surveyOnResolve") === "on" });
  revalidatePath("/settings/email");
  return { success: "Email settings saved." };
}

export async function regenerateInboundKeyAction() {
  const { agent, org } = await requireSession("workspace.manage");
  await regenerateInboundKey(org.id);
  await audit(org.id, agent, "email.address_changed");
  revalidatePath("/settings/email");
}

// Runs a pretend customer email through exactly what the webhook does, for demos and testing
export async function sendTestEmailAction(_previous: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const { org } = await requireSession("email.manage");
  const mail = normalizeInbound({
    from: { email: String(formData.get("fromEmail") ?? "").trim(), name: String(formData.get("fromName") ?? "").trim() },
    subject: String(formData.get("subject") ?? ""),
    text: String(formData.get("text") ?? ""),
  });
  if (!mail) return { error: "Enter a valid sender email and a message." };

  try {
    const result = await receiveEmail(org, mail);
    revalidatePath("/tickets");
    return {
      success: result.outcome === "created" ? `New ticket #${result.ticketId} created.` : `Added to ticket #${result.ticketId} as a customer reply.`,
      ticketId: result.ticketId,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not receive the email." };
  }
}
