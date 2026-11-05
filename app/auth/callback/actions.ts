"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { getAuthClient } from "@/app/lib/auth/session";

// Turns the one-time link from a Supabase email (password reset or invite) into a signed-in session.
// Links arrive in one of three shapes depending on the email, so all three are handled.
export async function completeEmailLinkAction(link: {
  code?: string | null;
  tokenHash?: string | null;
  type?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getAuthClient();
  let error: { message: string } | null = null;

  if (link.code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(link.code));
  } else if (link.tokenHash && link.type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type as EmailOtpType }));
  } else if (link.accessToken && link.refreshToken) {
    ({ error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken }));
  } else {
    return { ok: false, error: "This link is incomplete." };
  }

  if (error) return { ok: false, error: "This link has expired or was already used." };
  return { ok: true };
}
