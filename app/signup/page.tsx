import Link from "next/link";
import { SIGNUP_CLOSED_MESSAGE, signupOpen } from "@/app/lib/auth/signup";
import SignupForm from "./SignupForm";

export const metadata = { title: "Create your workspace · Atlas" };

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(99,102,241,0.16),transparent)] p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Create your support workspace</h1>
          <p className="mt-1 text-sm text-zinc-600">
            A private space for your company&apos;s tickets, chatbot and team. You&apos;ll be its admin.
          </p>
        </div>

        {signupOpen() ? (
          <SignupForm />
        ) : (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-700 shadow-sm">{SIGNUP_CLOSED_MESSAGE}</p>
        )}

        <p className="mt-6 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium hover:text-indigo-500 text-indigo-600">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
