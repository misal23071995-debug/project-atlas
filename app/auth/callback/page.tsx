"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completeEmailLinkAction } from "./actions";

// Some Supabase emails put the one-time tokens after the # in the link, which only the browser can read,
// so this page reads the link here and hands it to the server to sign in.
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = query.get("next") ?? "/";
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";

    // Supabase reports an expired or used link in the link itself
    const failed = hash.get("error_description") || query.get("error_description");
    const attempt = failed
      ? Promise.resolve({ ok: false, error: "This link has expired or was already used." })
      : completeEmailLinkAction({
          code: query.get("code"),
          tokenHash: query.get("token_hash"),
          type: query.get("type") ?? hash.get("type"),
          accessToken: hash.get("access_token"),
          refreshToken: hash.get("refresh_token"),
        });

    attempt.then((result) => {
      if (!result.ok) return setError(result.error ?? "Couldn't sign you in with this link.");
      // An invite always goes on to choosing a password
      const goTo = hash.get("type") === "invite" || query.get("type") === "invite" ? "/reset-password?welcome=1" : safe;
      window.location.replace(goTo);
    });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-zinc-50">{error}</h1>
            <p className="mt-2 text-sm text-zinc-400">Ask for a new link and use it within the hour.</p>
            <Link href="/forgot-password" className="mt-4 inline-block text-sm font-medium text-indigo-400 hover:text-indigo-300">
              Get a new reset link
            </Link>
          </>
        ) : (
          <p className="text-sm text-zinc-400">Signing you in…</p>
        )}
      </div>
    </main>
  );
}
