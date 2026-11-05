"use server";

import { cookies } from "next/headers";
import { TOO_MANY, allow, visitorId } from "@/app/lib/rate-limit";
import { redirect } from "next/navigation";
import { getAuthClient, getCurrentAgent, WORKSPACE_COOKIE } from "@/app/lib/auth/session";
import { createLogin, createWorkspace, findUserByEmail } from "@/app/lib/db/workspaces";

export interface SignupState {
  error?: string;
  values?: { company: string; name: string; email: string };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

async function chooseWorkspace(orgId: string) {
  (await cookies()).set(WORKSPACE_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

// New company: creates the login, the workspace with that person as admin, then signs them in
export async function signupAction(_previous: SignupState, formData: FormData): Promise<SignupState> {
  if (!(await allow("signup", await visitorId()))) return { error: TOO_MANY };
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  const company = field("company").slice(0, 80);
  const name = field("name").slice(0, 100);
  const email = field("email").toLowerCase().slice(0, 320);
  const password = String(formData.get("password") ?? "");
  const values = { company, name, email };

  if (!company) return { error: "Enter your company name.", values };
  if (!name) return { error: "Enter your name.", values };
  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email.", values };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`, values };
  }

  try {
    if (await findUserByEmail(email)) {
      return { error: "An account with this email already exists. Sign in instead.", values };
    }

    const user = await createLogin(email, password, name);
    const workspace = await createWorkspace(company, user.id);

    const supabase = await getAuthClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Your workspace is ready, but signing in failed. Try signing in.");

    await chooseWorkspace(workspace.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create your workspace.", values };
  }

  redirect("/");
}

export interface WorkspaceFormState {
  error?: string;
}

// For someone already signed in: start another workspace (or their first, if they were removed from all)
export async function createWorkspaceAction(
  _previous: WorkspaceFormState,
  formData: FormData
): Promise<WorkspaceFormState> {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");

  const company = String(formData.get("company") ?? "").trim().slice(0, 80);
  if (!company) return { error: "Enter your company name." };

  try {
    const workspace = await createWorkspace(company, agent.id);
    await chooseWorkspace(workspace.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the workspace." };
  }

  redirect("/");
}

// Workspace switcher in the sidebar. getSession ignores the cookie unless the person is a member.
export async function switchWorkspaceAction(orgId: string) {
  if (!(await getCurrentAgent())) redirect("/login");
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) throw new Error("Unknown workspace");

  await chooseWorkspace(orgId);
  redirect("/");
}
