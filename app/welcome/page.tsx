import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/auth/session";
import { signOutAction } from "@/app/login/actions";
import CreateWorkspaceForm from "./CreateWorkspaceForm";

export const dynamic = "force-dynamic";

// For a signed-in person who isn't in any workspace: removed from their team, or never added
export default async function WelcomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if ("org" in session) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">You&apos;re not in a workspace</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as {session.agent.email}. Ask your team&apos;s admin to add you, or start a workspace for
            your own company.
          </p>
        </div>

        <CreateWorkspaceForm />

        <form action={signOutAction} className="text-center">
          <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
