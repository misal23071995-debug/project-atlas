import Link from "next/link";
import ForgotForm from "./ForgotForm";

export const metadata = { title: "Reset your password · Atlas" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(99,102,241,0.16),transparent)] p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-zinc-50">Reset your password</h1>
          <p className="mt-1 text-sm text-zinc-400">We&apos;ll email you a link to choose a new one.</p>
        </div>
        <ForgotForm />
        <p className="mt-6 text-center text-sm text-zinc-400">
          <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
