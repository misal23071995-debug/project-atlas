"use server";

import { redirect } from "next/navigation";
import { getAuthClient } from "@/app/lib/auth/session";

export interface LoginState {
  error?: string;
  email?: string;
}

// Only follow same-site paths like "/tickets/4821", never "//evil.com"
function safeNext(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export async function signInAction(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  const supabase = await getAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Wrong email or password.", email };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await getAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
