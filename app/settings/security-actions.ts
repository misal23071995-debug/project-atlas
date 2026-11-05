"use server";

import { revalidatePath } from "next/cache";
import { getAuthClient, requireSession } from "@/app/lib/auth/session";
import { audit } from "@/app/lib/audit";

export interface TwoFactorSetup {
  error?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
}

// Step 1: a new authenticator entry, shown as a QR code. Not active until a code from it is confirmed.
export async function startTwoFactorAction(): Promise<TwoFactorSetup> {
  await requireSession();
  const supabase = await getAuthClient();

  // Clear any half-finished setup from before, so it doesn't pile up
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  if (existing?.totp?.length) return { error: "Two-step sign-in is already on." };

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Atlas ${Date.now()}` });
  if (error) return { error: `Couldn't start setup: ${error.message}` };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

// Step 2: a code from the app proves it's set up; from now on sign-in asks for a code
export async function confirmTwoFactorAction(factorId: string, code: string): Promise<{ error?: string; success?: string }> {
  const { agent, org } = await requireSession();
  if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) return { error: "Enter the 6-digit code from the app." };

  const supabase = await getAuthClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
  if (error) return { error: "That code didn't work. Make sure your phone's clock is right and try the current code." };

  await audit(org.id, agent, "security.2fa_on", agent.name);
  revalidatePath("/settings");
  return { success: "Two-step sign-in is on. You'll enter a code from the app each time you sign in." };
}

export async function disableTwoFactorAction(): Promise<{ error?: string }> {
  // Reaching here already needed a code this session (requireSession checks), so they've proved it's them
  const { agent, org } = await requireSession();
  const supabase = await getAuthClient();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { error: `Couldn't turn it off: ${error.message}` };
  }
  await audit(org.id, agent, "security.2fa_off", agent.name);
  revalidatePath("/settings");
  return {};
}
