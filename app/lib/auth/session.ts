import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/app/lib/supabase-config";
import { getSupabase } from "@/app/lib/db/supabase";
import { toAgent, type Agent } from "./agent";

// Supabase Auth client bound to this request's cookies. Create one per request.
export async function getAuthClient() {
  const { url, key } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Components can't set cookies; proxy.ts refreshes the session instead
        }
      },
    },
  });
}

// Verified with Supabase on each request; cached so one render only asks once
export const getCurrentAgent = cache(async (): Promise<Agent | null> => {
  const supabase = await getAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? toAgent(user) : null;
});

// Everyone with an account, for the Assigned To list. Uses the secret key's admin access.
export async function listAgents(): Promise<Agent[]> {
  const { data, error } = await getSupabase().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Failed to load agents: ${error.message}`);

  return data.users.map(toAgent).sort((a, b) => a.name.localeCompare(b.name));
}

// For Server Actions and pages: sends visitors who aren't signed in to /login
export async function requireAgent() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  return agent;
}
