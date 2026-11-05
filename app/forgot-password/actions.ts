"use server";

import { getAuthClient } from "@/app/lib/auth/session";
import { siteOrigin } from "@/app/lib/auth/origin";
import { TOO_MANY, allow, visitorId } from "@/app/lib/rate-limit";

export interface ForgotState {
  error?: string;
  sent?: boolean;
}

// Supabase emails a one-time link. The answer is the same whether or not the account exists,
// so this page can't be used to find out who has an account.
export async function sendResetLinkAction(_previous: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the email you sign in with." };
  if (!(await allow("passwordReset", await visitorId()))) return { error: TOO_MANY };

  const supabase = await getAuthClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error) console.error("Password reset email failed:", error.message);
  return { sent: true };
}
