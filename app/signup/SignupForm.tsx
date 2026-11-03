"use client";

import { useActionState } from "react";
import { signupAction, type SignupState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export default function SignupForm() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signupAction, {});

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <label className={labelClass}>
        Company name
        <input name="company" required maxLength={80} defaultValue={state.values?.company} className={inputClass} />
      </label>

      <label className={labelClass}>
        Your name
        <input
          name="name"
          required
          maxLength={100}
          autoComplete="name"
          defaultValue={state.values?.name}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Work email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          defaultValue={state.values?.email}
          className={inputClass}
        />
      </label>

      <label className={labelClass}>
        Password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">At least 8 characters</span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
