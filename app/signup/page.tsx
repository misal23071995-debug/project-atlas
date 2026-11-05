import Link from "next/link";
import { SIGNUP_CLOSED_MESSAGE, signupOpen } from "@/app/lib/auth/signup";
import SignupForm from "./SignupForm";

export const metadata = { title: "Create your workspace · Atlas" };

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(99,102,241,0.16),transparent)] p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Create your support workspace</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            A private space for your company&apos;s tickets, chatbot and team. You&apos;ll be its admin.
          </p>
        </div>

        {signupOpen() ? (
          <SignupForm />
        ) : (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-300">{SIGNUP_CLOSED_MESSAGE}</p>
        )}

        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
