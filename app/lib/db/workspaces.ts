import "server-only";
import { getSupabase } from "./supabase";
import type { Role, Workspace } from "@/app/lib/auth/roles";

// "Acme Wearables Ltd." -> "acme-wearables-ltd"
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;

  const { data, error } = await getSupabase()
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Failed to load workspace: ${error.message}`);
  return data;
}

// Creates the workspace with the given person as its first admin.
// Adds a short random suffix when the slug is taken, e.g. "acme-4f2a".
export async function createWorkspace(name: string, ownerId: string): Promise<Workspace> {
  const supabase = getSupabase();
  const base = slugify(name).padEnd(3, "0");

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 4)}`;
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name, slug })
      .select("id, name, slug")
      .single();

    // 23505: slug already taken, try another
    if (error?.code === "23505") continue;
    if (error) throw new Error(`Failed to create workspace: ${error.message}`);

    await addMembership(data.id, ownerId, "admin");
    return data;
  }

  throw new Error("Couldn't find a free workspace link. Try a different company name.");
}

export async function renameWorkspace(orgId: string, name: string) {
  const { error } = await getSupabase().from("organizations").update({ name }).eq("id", orgId);
  if (error) throw new Error(`Failed to rename workspace: ${error.message}`);
}

// Returns false when the person is already in the workspace
export async function addMembership(orgId: string, userId: string, role: Role) {
  const { error } = await getSupabase()
    .from("memberships")
    .insert({ org_id: orgId, user_id: userId, role });

  if (error?.code === "23505") return false;
  if (error) throw new Error(`Failed to add member: ${error.message}`);
  return true;
}

export async function updateMembershipRole(orgId: string, userId: string, role: Role) {
  const { error } = await getSupabase()
    .from("memberships")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to change role: ${error.message}`);
}

export async function removeMembership(orgId: string, userId: string) {
  const { error } = await getSupabase()
    .from("memberships")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}

export async function countAdmins(orgId: string) {
  const { count, error } = await getSupabase()
    .from("memberships")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "admin");

  if (error) throw new Error(`Failed to count admins: ${error.message}`);
  return count ?? 0;
}

// Finds a login by email. listUsers has no email filter, so this reads up to 1000 accounts.
export async function findUserByEmail(email: string) {
  const { data, error } = await getSupabase().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Failed to look up user: ${error.message}`);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

// Creates a login that can sign in straight away, without an email confirmation step
export async function createLogin(email: string, password: string, fullName: string) {
  const { data, error } = await getSupabase().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) throw new Error(error.message);
  return data.user;
}
