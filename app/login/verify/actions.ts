"use server";

import { redirect } from "next/navigation";
import { getAuthClient, getCurrentAgent } from "@/app/lib/auth/session";
import { safeNext } from "@/app/lib/auth/origin";
import { TOO_MANY, allow } from "@/app/lib/rate-limit";

export interface VerifyState {
  error?: string;
}

// The 6-digit code from the person's authenticator app, after their password
export async function verifySecondStepAction(_previous: VerifyState, formData: FormData): Promise<VerifyState> {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  // Limited per person, so the code can't be guessed by trying them all
  if (!(await allow("twoFactor", agent.id))) return { error: TOO_MANY };

  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your authenticator app." };

  const supabase = await getAuthClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (listError || !factor) return { error: "Two-step sign-in isn't set up for this account." };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: "That code didn't work. Codes change every 30 seconds; try the current one." };

  redirect(safeNext(formData.get("next")));
}
