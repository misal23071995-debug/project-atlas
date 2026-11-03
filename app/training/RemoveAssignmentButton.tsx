"use client";

import { useTransition } from "react";
import { removeAssignmentAction } from "./actions";

export default function RemoveAssignmentButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (confirm("Remove this assignment and its result?")) startTransition(() => removeAssignmentAction(id));
      }}
      className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
