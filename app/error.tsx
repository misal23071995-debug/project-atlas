"use client";

import Link from "next/link";

// Shown when a page or action fails. The error is already recorded on the server.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 font-sans">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center">
        <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This has been recorded. Try again, and if it keeps happening, tell your workspace admin
          {error.digest ? " and quote the error id below" : ""}.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-zinc-500">Error id: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500">
            Try again
          </button>
          <Link href="/" className="inline-flex h-9 items-center rounded-lg border border-zinc-300 px-4 text-sm text-zinc-800 hover:bg-zinc-100">
            Go to the dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
