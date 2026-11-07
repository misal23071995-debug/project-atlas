import { redirect } from "next/navigation";
import { getCurrentAgent } from "@/app/lib/auth/session";
import ResetForm from "./ResetForm";

export const metadata = { title: "Choose a password · Atlas" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  const welcome = (await searchParams).welcome === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(99,102,241,0.16),transparent)] p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">{welcome ? `Welcome, ${agent.name.split(" ")[0]}` : "Choose a new password"}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {welcome ? "Choose a password to finish setting up your account." : `For ${agent.email}`}
          </p>
        </div>
        <ResetForm />
      </div>
    </main>
  );
}
