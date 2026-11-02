import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/app/lib/supabase-config";
import type { Agent } from "./agent";

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

// "priya.sharma@acme.com" -> "Priya Sharma"
function nameFromEmail(email: string) {
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function toAgent(user: User): Agent {
  const email = user.email ?? "";
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const name =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : nameFromEmail(email) || "Agent";

  return { id: user.id, email, name };
}

// Verified with Supabase on each request; cached so one render only asks once
export const getCurrentAgent = cache(async (): Promise<Agent | null> => {
  const supabase = await getAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? toAgent(user) : null;
});

// For Server Actions and pages: sends visitors who aren't signed in to /login
export async function requireAgent() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  return agent;
}
