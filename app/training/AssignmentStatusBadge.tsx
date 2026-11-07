import { isOverdue, type Assignment } from "@/app/lib/training/types";

// "Passed 90%", "Failed 40%", "Overdue" or "To do"
export default function AssignmentStatusBadge({
  assignment,
  today = new Date().toISOString().slice(0, 10),
}: {
  assignment: Pick<Assignment, "status" | "dueDate" | "bestScore" | "lastScore">;
  today?: string;
}) {
  const overdue = isOverdue(assignment, today);
  const [label, className] =
    assignment.status === "passed"
      ? [`Passed ${assignment.bestScore ?? ""}%`, "bg-emerald-50 text-emerald-700 ring-emerald-600/20"]
      : overdue
      ? ["Overdue", "bg-rose-50 text-rose-700 ring-rose-600/20"]
      : assignment.status === "failed"
      ? [`Failed ${assignment.lastScore ?? ""}%`, "bg-amber-50 text-amber-800 ring-amber-600/20"]
      : ["To do", "bg-zinc-50 text-zinc-600 ring-zinc-500/20"];

  return <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>{label}</span>;
}
