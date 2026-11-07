"use client";

import { useActionState } from "react";
import { createWorkspaceAction, type WorkspaceFormState } from "@/app/signup/actions";

export default function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState<WorkspaceFormState, FormData>(createWorkspaceAction, {});

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border p-6 shadow-sm border-zinc-200 bg-white"
    >
      <label className="block text-sm font-medium text-zinc-700">
        Company name
        <input
          name="company"
          required
          maxLength={80}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 border-zinc-300 bg-white text-zinc-900"
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
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}
