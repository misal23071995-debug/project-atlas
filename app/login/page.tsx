import Link from "next/link";
import { signupOpen } from "@/app/lib/auth/signup";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(99,102,241,0.16),transparent)] p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Sign in to Atlas
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Use the email and password your admin set up for you.
          </p>
        </div>

        <LoginForm next={next ?? "/"} />

        {signupOpen() && <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          New company?{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Create a workspace
          </Link>
        </p>}
      </div>
    </main>
  );
}
