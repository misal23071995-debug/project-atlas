"use server";

import { redirect } from "next/navigation";
import { getAuthClient, getCurrentAgent } from "@/app/lib/auth/session";
import { audit } from "@/app/lib/audit";
import { getSupabase } from "@/app/lib/db/supabase";

export interface ResetState {
  error?: string;
}

const MIN_PASSWORD_LENGTH = 8;

// The person arrived from an email link, so they're signed in; this sets their new password
export async function setNewPasswordAction(_previous: ResetState, formData: FormData): Promise<ResetState> {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");

  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords don't match." };

  const supabase = await getAuthClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Recorded in each workspace they belong to
  const { data: memberships } = await getSupabase().from("memberships").select("org_id").eq("user_id", agent.id);
  await Promise.all((memberships ?? []).map((m) => audit(m.org_id, agent, "security.password_changed", agent.name, { via: "email link" })));

  redirect("/");
}
