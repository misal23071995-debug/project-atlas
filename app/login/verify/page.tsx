import { redirect } from "next/navigation";
import { getCurrentAgent, needsSecondStep } from "@/app/lib/auth/session";
import { signOutAction } from "@/app/login/actions";
import VerifyForm from "./VerifyForm";

export const metadata = { title: "Enter your code · Atlas" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  const { next } = await searchParams;
  if (!(await needsSecondStep())) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(99,102,241,0.16),transparent)] p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-50">Enter your code</h1>
          <p className="mt-1 text-sm text-zinc-400">Open your authenticator app and enter the 6-digit code for Atlas.</p>
        </div>
        <VerifyForm next={next ?? "/"} />
        <form action={signOutAction} className="mt-6 text-center">
          <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-200">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
