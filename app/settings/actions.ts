"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/app/lib/db/supabase";
import { listMembers, requireSession } from "@/app/lib/auth/session";
import { isRole, type Role } from "@/app/lib/auth/roles";
import {
  addMembership,
  countAdmins,
  createLogin,
  findUserByEmail,
  removeMembership,
  renameWorkspace,
  updateMembershipRole,
} from "@/app/lib/db/workspaces";

export interface FormState {
  error?: string;
  success?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function message(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

// ---- Your account ----

export async function updateProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { agent } = await requireSession();
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Enter your name." };

  const { error } = await getSupabase().auth.admin.updateUserById(agent.id, {
    user_metadata: { full_name: name },
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Name saved." };
}

export async function changePasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { agent } = await requireSession();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) return { error: "The two passwords don't match." };

  const { error } = await getSupabase().auth.admin.updateUserById(agent.id, { password });
  if (error) return { error: error.message };

  return { success: "Password changed." };
}

// ---- Workspace (admins only) ----

export async function renameWorkspaceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { org } = await requireSession("workspace.manage");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Enter the company name." };

  try {
    await renameWorkspace(org.id, name);
  } catch (err) {
    return { error: message(err, "Could not rename the workspace.") };
  }

  revalidatePath("/", "layout");
  return { success: "Workspace name saved." };
}

// ---- Team (admins only) ----

// Adds an existing login to the workspace, or creates a new login with a temporary password
export async function addMemberAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { org } = await requireSession("team.manage");
  const field = (name: string) => String(formData.get(name) ?? "").trim();

  const name = field("name").slice(0, 100);
  const email = field("email").toLowerCase().slice(0, 320);
  const password = String(formData.get("password") ?? "");
  const role = field("role");

  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email." };
  if (!isRole(role)) return { error: "Choose a role." };

  try {
    const existing = await findUserByEmail(email);

    if (existing) {
      const added = await addMembership(org.id, existing.id, role);
      if (!added) return { error: `${email} is already in this workspace.` };
      revalidatePath("/settings/team");
      return { success: `${email} already had an account and has been added. They can sign in as usual.` };
    }

    if (!name) return { error: "Enter their name." };
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: `Give them a temporary password of at least ${MIN_PASSWORD_LENGTH} characters.` };
    }

    const user = await createLogin(email, password, name);
    await addMembership(org.id, user.id, role);
  } catch (err) {
    return { error: message(err, "Could not add the member.") };
  }

  revalidatePath("/settings/team");
  return {
    success: `${name} has been added. Share their email and temporary password with them; they can change it in Settings.`,
  };
}

// A workspace must always keep at least one admin
async function assertKeepsAnAdmin(orgId: string, userId: string, newRole: Role | null) {
  const member = (await listMembers(orgId)).find((m) => m.id === userId);
  if (!member) throw new Error("This person isn't in the workspace.");
  if (member.role === "admin" && newRole !== "admin" && (await countAdmins(orgId)) <= 1) {
    throw new Error("A workspace needs at least one admin. Make someone else admin first.");
  }
}

export async function changeRoleAction(userId: string, role: string) {
  const { org } = await requireSession("team.manage");
  if (!isRole(role)) throw new Error("Choose a role.");

  await assertKeepsAnAdmin(org.id, userId, role);
  await updateMembershipRole(org.id, userId, role);
  revalidatePath("/settings/team");
}

// Removes access to this workspace only; the login itself stays, in case they're in other workspaces
export async function removeMemberAction(userId: string) {
  const { org } = await requireSession("team.manage");

  await assertKeepsAnAdmin(org.id, userId, null);
  await removeMembership(org.id, userId);
  revalidatePath("/settings/team");
}
