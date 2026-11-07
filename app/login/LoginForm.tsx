"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, type LoginState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 border-zinc-300 bg-white text-zinc-900";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, {});

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border p-6 shadow-sm border-zinc-200 bg-white"
    >
      <input type="hidden" name="next" value={next} />

      <label className="block text-sm font-medium text-zinc-700">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={inputClass}
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        <span className="flex items-center justify-between">
          Password
          <Link href="/forgot-password" className="text-xs font-normal text-indigo-600 hover:text-indigo-700">
            Forgot password?
          </Link>
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
