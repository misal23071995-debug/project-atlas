import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/app/lib/supabase-config";
import { getSupabase } from "@/app/lib/db/supabase";
import { toAgent, type Agent } from "./agent";
import { can, type Permission, type Role, type Session, type Workspace } from "./roles";

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

// Which workspace a person with several is working in. Only a hint: getSession checks membership.
export const WORKSPACE_COOKIE = "atlas_workspace";

type MembershipRow = {
  role: Role;
  organization: Workspace | null;
};

// The signed-in agent, their workspaces and their role in the current one.
// Null when nobody is signed in; workspaces is empty when they belong to none.
export const getSession = cache(async (): Promise<Session | { agent: Agent; workspaces: [] } | null> => {
  const agent = await getCurrentAgent();
  if (!agent) return null;

  const { data, error } = await getSupabase()
    .from("memberships")
    .select("role, organization:organizations (id, name, slug)")
    .eq("user_id", agent.id)
    .order("created_at", { ascending: true })
    .returns<MembershipRow[]>();

  if (error) throw new Error(`Failed to load workspaces: ${error.message}`);

  const workspaces = data
    .filter((m) => m.organization)
    .map((m) => ({ ...m.organization!, role: m.role }));
  if (workspaces.length === 0) return { agent, workspaces: [] };

  const chosenId = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const current = workspaces.find((w) => w.id === chosenId) ?? workspaces[0];

  return {
    agent,
    org: { id: current.id, name: current.name, slug: current.slug },
    role: current.role,
    workspaces,
  };
});

// True when the person has two-step sign-in turned on but hasn't entered a code in this session yet.
// Read from the session token, so it's quick and needs no network call.
export const needsSecondStep = cache(async (): Promise<boolean> => {
  const supabase = await getAuthClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal1" && data?.nextLevel === "aal2";
});

// For pages and Server Actions. Sends visitors who aren't signed in to /login and people
// without a workspace to /welcome. With a permission, refuses roles that don't have it.
export async function requireSession(permission?: Permission): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  // Two-step sign-in is enforced here, so every page and action needs the code, not just the login screen
  if (await needsSecondStep()) redirect("/login/verify");
  if (!("org" in session)) redirect("/welcome");
  if (permission && !can(session.role, permission)) {
    throw new Error("Your role doesn't allow this. Ask a workspace admin.");
  }
  return session;
}

export interface Member extends Agent {
  role: Role;
  joinedAt: string;
}

// Everyone in a workspace, using the secret key's admin access to read names and emails
export async function listMembers(orgId: string): Promise<Member[]> {
  const supabase = getSupabase();

  const [membershipsRes, usersRes] = await Promise.all([
    supabase.from("memberships").select("user_id, role, created_at").eq("org_id", orgId),
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (membershipsRes.error) throw new Error(`Failed to load team: ${membershipsRes.error.message}`);
  if (usersRes.error) throw new Error(`Failed to load team: ${usersRes.error.message}`);

  const users = new Map(usersRes.data.users.map((u) => [u.id, u]));

  return membershipsRes.data
    .filter((m) => users.has(m.user_id))
    .map((m) => ({ ...toAgent(users.get(m.user_id)!), role: m.role as Role, joinedAt: m.created_at }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
